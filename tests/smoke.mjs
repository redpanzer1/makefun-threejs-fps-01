// Headless integration smoke test for Dustline Depot: no DOM, no WebGL.
// Exercises the real modules (map graph, player physics, weapons, bot AI,
// bomb, round flow, grenades) through the same calls main.js makes.
import * as THREE from 'three';
import { createState, drainEvents } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/state.js';
import { MAP, NODES, CYLINDERS, findPath, siteAt, BOXES } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/map.js';
import { rng } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/rng.js';
import { createWorld } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/world.js';
import { createPlayer } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/player.js';
import { createWeapons } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/weapons.js';
import { createBots } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/bots.js';
import { createBomb } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/bomb.js';
import { createRound } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/round.js';
import { createGrenades } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/grenade.js';

// world.js paints procedural CanvasTextures: stub the 2D canvas it needs.
// (Static imports above only evaluate the modules; document is first touched
// when createWorld() runs, below.)
globalThis.document = {
  createElement: (tag) => {
    if (tag !== 'canvas') return {};
    const ctx = new Proxy({}, {
      get: (t, p) => (p === 'canvas' ? canvas : () => {}),
      set: () => true,
    });
    const canvas = { width: 0, height: 0, getContext: () => ctx, style: {} };
    return canvas;
  },
};

const results = [];
function check(name, ok, detail = '') {
  results.push([ok ? 'PASS' : 'FAIL', name, detail]);
}

const DT = 1 / 60;

// 1. Waypoint graph: fully connected, nodes in open space.
const n = NODES.length;
let unreachable = 0;
for (let i = 0; i < n; i += 1) {
  for (let j = 0; j < n; j += 1) {
    if (i !== j && !findPath(i, j)) unreachable += 1;
  }
}
check('waypoint graph fully connected', unreachable === 0, `${n} nodes, ${unreachable} unreachable pairs`);
let inside = 0;
for (const [x, z] of NODES) {
  for (const [w, , d, bx, , bz, mat] of BOXES) {
    if (mat === 'ground') continue; // the ground slab spans the whole map
    if (Math.abs(x - bx) < w / 2 + 0.4 && Math.abs(z - bz) < d / 2 + 0.4) { inside += 1; break; }
  }
}
check('waypoints in open space', inside === 0, `${inside} inside boxes`);
let insideCyl = 0;
for (const [x, z] of NODES) {
  for (const c of CYLINDERS) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + 0.4) { insideCyl += 1; break; }
  }
}
check('waypoints clear of cylinders', insideCyl === 0, `${insideCyl} too close`);
check('siteAt A', siteAt(-20, -14) === 'A');
check('siteAt B', siteAt(20, -14) === 'B');
check('siteAt none', siteAt(0, 18) === null);
rng.seed(7);
const a = [rng.next(), rng.next(), rng.next()];
rng.seed(7);
const b = [rng.next(), rng.next(), rng.next()];
check('rng deterministic', a.join() === b.join());

// 2. World + player movement.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 220);
scene.add(camera);
const world = createWorld(scene);
check('world colliders', world.colliders.length > 20, `${world.colliders.length}`);
check('world shootables', world.shootables.length > 20, `${world.shootables.length}`);
const state = createState();
const player = createPlayer(world.colliders, MAP.playerSpawn);
const keys = new Set(['KeyW']);
for (let i = 0; i < 120; i += 1) player.step(DT, keys, () => {});
check('player walks forward (W)', player.state.position.z < 14, `z=${player.state.position.z.toFixed(2)}`);
check('player pos finite', Number.isFinite(player.state.position.x) && Number.isFinite(player.state.position.z));
const wallX = player.state.position.x;
player.state.position.set(-24, 0, 0);
player.state.yaw = Math.PI / 2; // face -x... yaw +90deg looks toward -x? walk into the west wall
for (let i = 0; i < 120; i += 1) player.step(DT, new Set(['KeyW']), () => {});
check('wall collision stops player', player.state.position.x > -27.9, `x=${player.state.position.x.toFixed(2)} (wall inner face -28.0, radius 0.34)`);

// 3. Weapons: buy, switch, fire, reload.
const weapons = createWeapons(camera);
check('start weapon falcon', weapons.currentId() === 'falcon');
check('buy kestrel', weapons.buy('kestrel') === true);
check('switch kestrel', weapons.switchTo('kestrel') === true);
let shots = 0;
for (let i = 0; i < 120; i += 1) {
  const r = weapons.tryFire(0, false, false);
  if (r && !r.empty) shots += 1;
  weapons.step(DT);
}
check('kestrel fires repeatedly', shots >= 5, `${shots} shots in 120 ticks`);
check('mag decreases', weapons.ammo().mag === 30 - shots, `mag=${weapons.ammo().mag}`);
weapons.reload();
for (let i = 0; i < 180; i += 1) weapons.step(DT);
check('reload refills mag', weapons.ammo().mag === 30, `mag=${weapons.ammo().mag}`);

// 4. Bots: patrol, perceive, shoot.
const bots = createBots(scene, world, state);
bots.reset();
check('5 bots', bots.bots.length === 5);
// A dead player cannot be perceived, so the bots just walk their routes
// instead of engaging the test dummy.
player.state.health = 0;
const startPos = bots.bots.map((bot) => bot.pos.clone());
for (let i = 0; i < 1200; i += 1) {
  state.time += DT;
  bots.step(DT, player.state, i);
}
player.state.health = 100;
const moved = bots.bots.filter((bot, idx) => bot.pos.distanceTo(startPos[idx]) > 0.5).length;
check('bots walk their routes', moved >= 4, `${moved}/5 moved in 20s`);
// Deterministic sight test: bot 0 at the open plaza, facing +z, player 6 m ahead.
bots.reset();
state.time = 0;
const b0 = bots.bots[0];
b0.pos.set(0, 0, 0);
b0.group.position.copy(b0.pos);
b0.yaw = Math.PI;
b0.state = 'hold';
player.state.position.set(0, 0, 6);
player.state.health = 100;
let engaged = false;
for (let i = 0; i < 30; i += 1) {
  state.time += DT;
  bots.step(DT, player.state, i);
  if (b0.state === 'engage') engaged = true;
}
check('bot sees player in front (FOV+LOS)', engaged, `state=${b0.state}`);
let shotEvents = 0;
let hits = 0;
for (let i = 30; i < 630; i += 1) {
  state.time += DT;
  bots.step(DT, player.state, i);
  drainEvents(state, (ev) => {
    if (ev.type === 'botshot') {
      shotEvents += 1;
      if (ev.hit) hits += 1;
    }
  });
}
check('bot shoots in bursts', shotEvents > 0, `${shotEvents} botshot events in 10s`);
check('bot shots can hit', hits > 0, `${hits} hits, player hp=${player.state.health.toFixed(0)}`);

// 5. Bomb plant: player in Site A holding E.
const audioStub = { plant() {}, beep() {} };
const bomb = createBomb(scene, state);
state.bomb.state = 'carried';
player.state.position.set(-20, 0, -14);
for (let i = 0; i < 240; i += 1) bomb.step(DT, player.state.position, true, audioStub);
check('bomb plants after 3s hold', state.bomb.state === 'planted', state.bomb.state);

// 6. Round flow: buy -> live -> win by elimination.
bots.reset();
player.reset(MAP.playerSpawn);
const round = createRound(state, player, weapons, bots, bomb);
round.startRound();
check('round starts in buy phase', state.phase === 'buy');
state.money = 3000;
check('buy kestrel in buy phase', round.buy('kestrel') === true || weapons.owned('kestrel'), `money=${state.money}`);
for (let i = 0; i < 16 * 60; i += 1) round.step(DT);
check('buy phase ends to live', state.phase === 'live', state.phase);
const moneyBefore = state.money;
for (const bot of bots.bots) bots.damage(bot, 999);
round.step(DT);
check('elimination wins round', state.phase === 'over' && state.overWon === true, `${state.phase} won=${state.overWon}`);
check('win money +3250', state.money === moneyBefore + 3250, `${moneyBefore} -> ${state.money}`);

// 7. Grenade fuse.
const grenades = createGrenades(scene, world);
let exploded = false;
const dir = new THREE.Vector3(0, 0.2, -1).normalize();
check('frag throws', grenades.throwFrag(new THREE.Vector3(0, 1.5, 10), dir) === true);
for (let i = 0; i < 240; i += 1) grenades.step(DT, () => { exploded = true; });
check('grenade explodes ~2.2s', exploded);

const fails = results.filter((r) => r[0] === 'FAIL').length;
for (const [status, name, detail] of results) console.log(`${status} ${name}${detail ? ` — ${detail}` : ''}`);
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
