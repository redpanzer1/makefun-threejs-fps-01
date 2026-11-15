// Dustline Depot: boot and the one loop. A fixed 60 Hz simulation feeds a
// render at the display's rate; hitstop scales only the gameplay delta, so
// feedback (shake, tweens, HUD) stays live while the world crawls.
// ?shot=start|play|end with &seed=N stages a deterministic frame, renders
// it twice, freezes it and sets window.__shotReady for captures.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { rng } from './rng.js';
import { createState, drainEvents } from './state.js';
import { createAudio } from './audio.js';
import { MAP, siteAt } from './map.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createWeapons, WEAPONS } from './weapons.js';
import { createBots } from './bots.js';
import { createGrenades } from './grenade.js';
import { createBomb } from './bomb.js';
import { createRound } from './round.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';

const FIXED_STEP = 1 / 60;
const BASE_FOV = 74;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
if (shot) rng.seed(seed);

const state = createState();
state.seed = seed;
const audio = createAudio();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), 30, 95);
const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 220);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders, MAP.playerSpawn);
const weapons = createWeapons(camera);
const bots = createBots(scene, world, state);
const grenades = createGrenades(scene, world);
const bomb = createBomb(scene, state);
const round = createRound(state, player, weapons, bots, bomb);
const effects = createEffects(scene, camera);
const hud = createHud();
const input = createInput(renderer.domElement, onLockChange);

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const shootables = world.shootables.concat(bots.hitMeshes);
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _point = new THREE.Vector3();
const _chest = new THREE.Vector3();

let accumulator = 0;
let lastTime = performance.now();
let elapsed = 0;
let tick = 0;
let frozen = false;
let hitstopLeft = 0;
let prevFiring = false;
let prevPhase = state.phase;
let prevBombState = state.bomb.state;
let buyOpen = false;
let hudTimer = 0;
let lastFov = BASE_FOV;
let expectUnlock = false;

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (state.phase === 'menu') {
    round.startRound();
    openBuy();
  } else if (state.phase === 'over') {
    hud.hideOverlay();
  } else {
    input.requestLock();
  }
});
hud.onBuy((id) => {
  if (state.phase !== 'buy') return;
  if (round.buy(id)) {
    audio.buy();
    refreshBuy();
  } else {
    audio.denied();
  }
});
hud.onDeploy(() => {
  closeBuy();
  input.requestLock();
});

function openBuy() {
  buyOpen = true;
  refreshBuy();
  expectUnlock = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
function refreshBuy() {
  hud.showBuy(state.money, new Set([...weaponsOwned()]), weapons.frags(), player.state.armor);
}
function weaponsOwned() {
  return Object.keys(WEAPONS).filter((id) => weapons.owned(id));
}
function closeBuy() {
  buyOpen = false;
  hud.hideBuy();
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    expectUnlock = false;
    hud.hideOverlay();
  } else if (state.phase === 'live' && !expectUnlock) {
    hud.showOverlay('paused');
  }
}

function syncCamera() {
  const body = player.state;
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
  let fov = BASE_FOV + body.fovKick;
  const ads = weapons.adsAmount();
  if (ads > 0) fov = BASE_FOV + (weapons.adsFov() - BASE_FOV) * ads + body.fovKick;
  if (Math.abs(fov - lastFov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    lastFov = fov;
  }
  hud.setScope(weapons.isAiming() && weapons.def().scope && ads > 0.7);
}

function aimAt(point) {
  const body = player.state;
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / len)));
  syncCamera();
}

function muzzleWorld() {
  camera.updateMatrixWorld(true);
  const m = weapons.def().muzzle;
  return _muzzle.set(m[0], m[1], m[2]).applyMatrix4(camera.matrixWorld);
}

function handleKill(bot, weaponName, head) {
  state.kills += 1;
  if (head) state.headshots += 1;
  round.killReward();
  hud.killfeed(`<b>You</b> ▸ ${bot.name} <span>${weaponName}</span>${head ? ' <i>HEADSHOT</i>' : ''}`);
  audio.kill();
  effects.addTrauma(0.3);
  hitstopLeft = Math.max(hitstopLeft, 0.06);
}

function shoot(res) {
  const d = res.def;
  state.shotsFired += 1;
  if (d.kind === 'melee') {
    audio.throwWhoosh();
    camera.getWorldDirection(_dir);
    raycaster.set(camera.position, _dir);
    raycaster.far = d.range;
    const hit = raycaster.intersectObjects(bots.hitMeshes, false)[0];
    if (hit) {
      const bot = hit.object.userData.bot;
      const died = bots.damage(bot, d.damage);
      effects.flash(bot.flashMat);
      hud.hitMarker(died);
      if (died) handleKill(bot, d.name, false);
    }
    player.recoil(0.004, 0);
    return;
  }
  audio.shot(d.kind, 0);
  camera.getWorldDirection(_dir);
  _dir.x += (rng.next() * 2 - 1) * res.spread;
  _dir.y += (rng.next() * 2 - 1) * res.spread;
  _dir.z += (rng.next() * 2 - 1) * res.spread;
  _dir.normalize();
  raycaster.set(camera.position, _dir);
  raycaster.far = 90;
  const from = muzzleWorld();
  const hit = raycaster.intersectObjects(shootables, false)[0];
  const end = hit ? hit.point : _point.copy(camera.position).addScaledVector(_dir, 80);
  effects.tracer(from, end);
  if (hit) {
    if (hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const head = hit.object.userData.part === 'head';
      const dmg = Math.round(d.damage * (head ? d.headMul : 1));
      const died = bots.damage(bot, dmg);
      state.shotsHit += 1;
      effects.flash(bot.flashMat);
      hud.hitMarker(died, shot ? 4000 : 90);
      audio.hit(head);
      if (died) handleKill(bot, d.name, head);
    } else {
      effects.spark(hit.point, _dir);
    }
  }
  bots.hearShot(player.state.position.x, player.state.position.z);
  player.recoil(d.recoil + rng.next() * 0.004, (rng.next() * 2 - 1) * 0.004);
}

function damageAt(pos, radius, maxDmg, label) {
  for (const bot of bots.bots) {
    if (!bot.alive) continue;
    _chest.set(bot.pos.x, 1.2, bot.pos.z);
    const dist = Math.hypot(_chest.x - pos.x, _chest.y - pos.y, _chest.z - pos.z);
    if (dist >= radius) continue;
    // A wall between the blast and the body saves it.
    const blocked = !hasLineOfSight(world.shootables, pos, _chest);
    if (blocked) continue;
    const dmg = Math.round(maxDmg * (1 - (dist / radius) * 0.7));
    const died = bots.damage(bot, dmg);
    if (died) handleKill(bot, label, false);
  }
  _chest.set(player.state.position.x, player.state.position.y + 1.2, player.state.position.z);
  const pDist = Math.hypot(_chest.x - pos.x, _chest.y - pos.y, _chest.z - pos.z);
  if (pDist < radius && player.state.health > 0) {
    const dmg = Math.round(maxDmg * (1 - (pDist / radius) * 0.7));
    if (player.damage(dmg)) {
      hud.killfeed(`<b>${label}</b> ▸ You`);
    }
    hud.damageFlash();
    effects.addTrauma(0.5);
  }
}

function hasLineOfSight(shootables, from, to) {
  _dir.subVectors(to, from);
  const dist = _dir.length();
  if (dist < 0.01) return true;
  _dir.divideScalar(dist);
  raycaster.set(from, _dir);
  raycaster.far = dist - 0.05;
  return raycaster.intersectObjects(shootables, false).length === 0;
}

function step(dt) {
  state.time += dt;
  elapsed += dt;
  tick += 1;
  const keys = input.state.keys;
  const phase = state.phase;

  if (phase === 'live' || phase === 'buy') {
    const look = input.takeLook();
    player.look(look.x, look.y);
  }
  if (phase === 'buy' || phase === 'live') {
    player.step(dt, keys, (run) => audio.step(run));
  }
  weapons.step(dt);
  if (phase === 'live') {
    bots.step(dt, player.state, tick);
    grenades.step(dt, (pos, radius, dmg) => {
      effects.explosion(pos, 6);
      audio.explosion(Math.hypot(player.state.position.x - pos.x, player.state.position.z - pos.z));
      effects.addTrauma(0.7);
      hitstopLeft = Math.max(hitstopLeft, 0.09);
      damageAt(pos, radius, dmg, 'Frag');
    });
  }
  bomb.step(dt, player.state.position, keys.has('KeyE') && phase === 'live', audio);
  round.step(dt);
  world.step(elapsed);
  effects.step(dt);

  // Bomb state changes are the round's turning points.
  if (state.bomb.state === 'planted' && prevBombState !== 'planted') {
    round.plantReward();
    hud.banner('BOMB PLANTED', `Site ${state.bomb.site} — defend it`);
    hud.killfeed(`<b>You</b> planted the bomb <span>Site ${state.bomb.site}</span>`);
  }
  if (state.bomb.state === 'detonated' && prevBombState !== 'detonated') {
    effects.explosion(new THREE.Vector3(state.bomb.x, 0.5, state.bomb.z), 10);
    audio.explosion(0);
  }
  prevBombState = state.bomb.state;

  // Bot shots land here: tracer, sound, damage to the player.
  drainEvents(state, (ev) => {
    if (ev.type !== 'botshot') return;
    effects.tracer(new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z), new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z));
    const dist = Math.hypot(player.state.position.x - ev.from.x, player.state.position.z - ev.from.z);
    audio.shot(ev.bot.kind === 'rifle' ? 'rifle' : 'smg', dist);
    if (ev.hit && player.state.health > 0) {
      if (player.damage(ev.damage)) {
        hud.killfeed(`<b>${ev.bot.name}</b> ▸ You <span>${ev.bot.kind === 'rifle' ? 'AR-41 Kestrel' : 'SMG-9 Wasp'}</span>`);
      }
      hud.damageFlash();
      audio.hurt();
      effects.addTrauma(0.4);
    } else if (!ev.hit) {
      effects.spark(new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z), _dir.set(0, 1, 0));
    }
  });

  if (phase === 'live' && player.state.health > 0) {
    const def = weapons.def();
    const semi = !def.auto;
    const wantFire = input.state.firing && (!semi || !prevFiring);
    if (wantFire) {
      const res = weapons.tryFire(player.groundSpeed(), player.state.sprinting, player.state.crouching);
      if (res) {
        if (res.empty) audio.dryClick();
        else shoot(res);
      }
    }
    prevFiring = input.state.firing;
    if (keys.has('KeyR')) {
      if (weapons.reload()) audio.reload();
    }
    weapons.setAiming(input.state.aiming);
    // Weapon switching: digits and the wheel.
    const order = ['kestrel', 'wasp', 'falcon', 'talon', 'longbow'];
    for (let i = 0; i < order.length; i += 1) {
      if (input.state.justPressed.has(`Digit${i + 1}`)) {
        if (weapons.switchTo(order[i])) audio.swap();
      }
    }
    const wheel = input.takeWheel();
    if (wheel !== 0) {
      const owned = order.filter((id) => weapons.owned(id));
      const idx = owned.indexOf(weapons.currentId());
      const next = owned[(idx + (wheel > 0 ? 1 : -1) + owned.length) % owned.length];
      if (next && weapons.switchTo(next)) audio.swap();
    }
    if (input.state.justPressed.has('KeyG')) {
      if (weapons.takeFrag()) {
        camera.getWorldDirection(_dir);
        if (grenades.throwFrag(camera.position, _dir)) audio.throwWhoosh();
        else weapons.addFrag();
      }
    }
  }

  // Buy keys work while the shop is open.
  if (phase === 'buy' && buyOpen) {
    const buyIds = ['kestrel', 'wasp', 'falcon', 'longbow', 'frag'];
    for (let i = 0; i < buyIds.length; i += 1) {
      if (input.state.justPressed.has(`Digit${i + 1}`)) {
        if (round.buy(buyIds[i])) {
          audio.buy();
          refreshBuy();
        } else {
          audio.denied();
        }
      }
    }
    if (input.state.justPressed.has('Digit6')) {
      if (round.buy('armor')) {
        audio.buy();
        refreshBuy();
      } else {
        audio.denied();
      }
    }
  }
  if (input.state.justPressed.has('KeyB') && phase === 'buy') {
    if (buyOpen) {
      closeBuy();
      input.requestLock();
    } else {
      openBuy();
    }
  }
  input.clearPressed();

  // Phase changes drive the overlays.
  if (phase !== prevPhase) {
    if (phase === 'buy') {
      hud.hideOverlay();
      openBuy();
    } else if (phase === 'live') {
      closeBuy();
      hud.banner(`ROUND ${state.round}`, state.round === 1 ? 'Plant the bomb or eliminate the Jackals' : '');
    } else if (phase === 'over') {
      closeBuy();
      expectUnlock = true;
      if (document.pointerLockElement) document.exitPointerLock();
      hud.showOverlay(state.overWon ? 'overWin' : 'overLose', {
        reason: state.overReason,
        won: state.score.won,
        lost: state.score.lost,
      });
      if (state.overWon) audio.roundWin();
      else audio.roundLose();
      if (player.state.health <= 0) weapons.dropBought();
    }
    prevPhase = phase;
  }

  syncHud();
}

function syncHud() {
  const body = player.state;
  hud.setStatus({
    score: state.score.won * 100 + state.kills * 10,
    kills: state.kills,
    hs: state.headshots,
    health: body.health,
    armor: body.armor,
    grenades: weapons.frags(),
    money: state.money,
  });
  hud.setSlots(weapons.currentId(), new Set(weaponsOwned()), weapons.frags());
  const ammo = weapons.ammo();
  const def = weapons.def();
  hud.setAmmo(def.kind === 'melee' ? null : ammo.mag, ammo.reserve, def.name.toUpperCase());
  const timeLeft = state.phase === 'buy' ? state.buyTime : state.phase === 'live' ? state.roundTime : state.phase === 'over' ? state.overTime : 0;
  hud.setObjective({ round: state.round, timeLeft, hostiles: bots.aliveCount(), phase: state.phase });
  const spread = 6 + weapons.spreadNow(player.groundSpeed(), body.sprinting, body.crouching) * 900;
  hud.setCrosshair(weapons.isAiming() ? spread * 0.4 : spread);
  hud.setPlant(state.bomb.state === 'carried' ? state.bomb.plantProgress : null);
  // Contextual prompt.
  if (state.phase === 'buy') {
    hud.prompt(buyOpen ? 'Choose your loadout — DEPLOY when ready' : 'Buy phase — press B for the shop');
  } else if (state.phase === 'live') {
    if (state.bomb.state === 'planted') {
      if (state.bomb.defuseProgress > 0) hud.prompt('DEFUSE IN PROGRESS — stop them!');
      else hud.prompt(`Bomb planted at Site ${state.bomb.site} — defend it (${Math.ceil(state.bomb.timer)}s)`);
    } else if (siteAt(body.position.x, body.position.z)) {
      hud.prompt('Hold E to plant the bomb');
    } else {
      hud.prompt('');
    }
  } else {
    hud.prompt('');
  }
  hudTimer += FIXED_STEP;
  if (hudTimer >= 0.1) {
    hudTimer = 0;
    hud.setCompass(body.yaw);
    hud.drawMinimap(body, bots.bots, state.bomb, state.time);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    if (hitstopLeft > 0) hitstopLeft -= realDt;
    const dt = realDt * (hitstopLeft > 0 ? 0.05 : 1);
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    effects.applyShake();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let i = 0; i < steps; i += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  if (name === 'start') {
    player.reset(MAP.playerSpawn);
    bots.reset();
    player.state.yaw = 0.12;
    settle(20);
    aimAt(new THREE.Vector3(0, 4, -2));
    hud.showOverlay('start');
  } else if (name === 'play') {
    state.phase = 'live';
    state.round = 2;
    state.roundTime = 84;
    state.money = 3500;
    state.kills = 1;
    state.score.won = 1;
    state.score.lost = 0;
    weapons.buy('kestrel');
    weapons.switchTo('kestrel');
    player.reset(MAP.playerSpawn);
    player.state.position.set(0, 0, 14);
    bots.reset();
    const b0 = bots.bots[0];
    b0.pos.set(-3, 0, 2);
    b0.group.position.copy(b0.pos);
    b0.yaw = Math.PI;
    b0.state = 'hold';
    const b1 = bots.bots[1];
    b1.pos.set(6, 0, 6);
    b1.group.position.copy(b1.pos);
    b1.yaw = Math.PI;
    b1.state = 'hold';
    settle(20);
    // Three torso shots drop the first bot; one shot tags the second.
    for (let i = 0; i < 3; i += 1) {
      aimAt(new THREE.Vector3(b0.pos.x, 1.1, b0.pos.z));
      const res = weapons.tryFire(0, false, false);
      if (res && !res.empty) shoot(res);
      settle(8);
    }
    settle(12);
    aimAt(new THREE.Vector3(b1.pos.x, 1.1, b1.pos.z));
    const res = weapons.tryFire(0, false, false);
    if (res && !res.empty) shoot(res);
    settle(1);
  } else {
    // end: round won at Site B, bomb gone off, two Jackals down.
    state.phase = 'over';
    state.overWon = true;
    state.overReason = 'Bomb detonated — site destroyed';
    state.round = 4;
    state.score.won = 2;
    state.score.lost = 1;
    state.money = 4100;
    state.kills = 6;
    state.headshots = 2;
    state.bomb.state = 'detonated';
    state.bomb.site = 'B';
    state.bomb.x = 20;
    state.bomb.z = -14;
    weapons.buy('kestrel');
    player.reset(MAP.playerSpawn);
    player.state.position.set(13, 0, -5);
    bots.reset();
    const b0 = bots.bots[0];
    b0.alive = false;
    b0.fall = 1;
    b0.state = 'dead';
    b0.group.rotation.x = -1.45;
    b0.group.position.set(17, 0, -10);
    const b1 = bots.bots[1];
    b1.alive = false;
    b1.fall = 1;
    b1.state = 'dead';
    b1.group.rotation.x = -1.45;
    b1.group.position.set(22, 0, -8);
    settle(20);
    aimAt(new THREE.Vector3(20, 1, -14));
    hud.showOverlay('overWin', { reason: state.overReason, won: 2, lost: 1 });
  }
  syncHud();
  syncCamera();
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
syncHud();
if (state.phase === 'menu') hud.showOverlay('start');
if (shot) runShot(shot);
else requestAnimationFrame(frame);
