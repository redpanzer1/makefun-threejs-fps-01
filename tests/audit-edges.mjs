import { NODES, EDGES, BOXES, CYLINDERS } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/map.js';
const R = 0.34; // bot radius
function boxClear(x, z) {
  let min = Infinity, what = '';
  for (const [w,,d,bx,,bz,mat] of BOXES) {
    if (mat === 'ground') continue;
    const dx = Math.max(Math.abs(x-bx)-w/2, 0);
    const dz = Math.max(Math.abs(z-bz)-d/2, 0);
    const c = Math.hypot(dx, dz);
    if (c < min) { min = c; what = `box ${mat} @(${bx},${bz})`; }
  }
  for (const c of CYLINDERS) {
    const cc = Math.max(Math.hypot(x-c.x, z-c.z)-c.r, 0);
    if (cc < min) { min = cc; what = `cyl ${c.material} @(${c.x},${c.z}) r${c.r}`; }
  }
  return [min, what];
}
for (const [a,b] of EDGES) {
  const [x1,z1] = NODES[a], [x2,z2] = NODES[b];
  const len = Math.hypot(x2-x1, z2-z1);
  let worst = Infinity, worstAt = null, worstWhat = '';
  for (let d=0; d<=len; d+=0.1) {
    const t = d/len, x = x1+(x2-x1)*t, z = z1+(z2-z1)*t;
    const [c, w] = boxClear(x, z);
    if (c < worst) { worst = c; worstAt = [x.toFixed(1), z.toFixed(1)]; worstWhat = w; }
  }
  const flag = worst < R ? 'BLOCKED' : worst < 0.6 ? 'tight' : 'ok';
  console.log(`${flag} edge ${a}->${b} min clearance ${worst.toFixed(2)}m at (${worstAt}) vs ${worstWhat}`);
}
// spawn pockets: can each bot spawn reach its hold node by straight line?
import { MAP } from '/home/hatch/workspace/makefun/threejs-fps-01/game/src/map.js';
for (let i=0;i<MAP.botSpawns.length;i++) {
  const s = MAP.botSpawns[i];
  const [hx,hz] = NODES[[10,8,11,9,4][i]];
  const len = Math.hypot(hx-s.x, hz-s.z);
  let worst = Infinity;
  for (let d=0; d<=len; d+=0.1) {
    const t=d/len, x=s.x+(hx-s.x)*t, z=s.z+(hz-s.z)*t;
    const [c] = boxClear(x,z);
    if (c<worst) worst=c;
  }
  console.log(`spawn ${i} (${s.x},${s.z}) -> hold node: min clearance ${worst.toFixed(2)}m ${worst<R?'BLOCKED':''}`);
}
