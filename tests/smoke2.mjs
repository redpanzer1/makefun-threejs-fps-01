// Extended bot test: 60 s of idle wandering (no bot may stall), then a planted
// bomb at Site B — the Jackals must rotate to it and start a defuse.
import * as THREE from 'three';
import { createState } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/state.js';
import { MAP } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/map.js';
import { createWorld } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/world.js';
import { createPlayer } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/player.js';
import { createBots } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/bots.js';

globalThis.document = { createElement: () => {
  const ctx = new Proxy({}, { get: (t, p) => (p === 'canvas' ? canvas : () => {}), set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => ctx, style: {} };
  return canvas;
}};

const DT = 1 / 60;
const scene = new THREE.Scene();
const world = createWorld(scene);
const state = createState();
const player = createPlayer(world.colliders, MAP.playerSpawn);
player.state.health = 0; // dead: bots only patrol, never engage
const bots = createBots(scene, world, state);
bots.reset();

const results = [];
function check(name, ok, detail = '') { results.push([ok ? 'PASS' : 'FAIL', name, detail]); }

// 60 s wander: track each bot's TOTAL distance travelled in every 10 s
// window (net displacement would hide a bot pacing a short loop).
const windows = [];
let lastPos = bots.bots.map((b) => b.pos.clone());
let travelled = [0, 0, 0, 0, 0];
for (let i = 0; i < 3600; i += 1) {
  state.time += DT;
  bots.step(DT, player.state, i);
  bots.bots.forEach((b, idx) => { travelled[idx] += b.pos.distanceTo(lastPos[idx]); lastPos[idx] = b.pos.clone(); });
  if ((i + 1) % 600 === 0) {
    windows.push([...travelled]);
    travelled = [0, 0, 0, 0, 0];
  }
}
let stalled = [];
windows.forEach((w, wi) => w.forEach((d, bi) => { if (d < 0.5) stalled.push(`bot ${bi} window ${wi} (${d.toFixed(2)}m)`); }));
check('no bot stalls in 60s wander', stalled.length === 0, stalled.join('; ') || 'all bots travelled >0.5m per 10s window');

// Plant the bomb at Site B; bots must rotate and defuse. The player is dead,
// so no bot gets pulled into a fight at the site instead.
player.state.health = 0;
state.bomb.state = 'planted';
state.bomb.site = 'B';
state.bomb.x = 20;
state.bomb.z = -14;
state.bomb.timer = 40;
state.bomb.defuseProgress = 0;
let defused = false;
let closest = Infinity;
for (let i = 0; i < 40 * 60; i += 1) {
  state.time += DT;
  bots.step(DT, player.state, 3600 + i);
  for (const b of bots.bots) {
    const d = Math.hypot(b.pos.x - 20, b.pos.z - -14);
    if (d < closest) closest = d;
  }
  if (state.bomb.state === 'defused') { defused = true; break; }
}
check('bots rotate to planted bomb', closest < 2.2, `closest approach ${closest.toFixed(2)}m`);
check('bots defuse within 40s', defused, `final state=${state.bomb.state}, defuseProgress=${state.bomb.defuseProgress.toFixed(2)}`);

const fails = results.filter((r) => r[0] === 'FAIL').length;
for (const [s, n, d] of results) console.log(`${s} ${n}${d ? ` — ${d}` : ''}`);
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
