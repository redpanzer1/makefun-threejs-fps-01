// Thrown frag grenades: a short arc, a bounce off walls and floor, a 2.2 s
// fuse, then an explosion that hurts through line of sight only. A small
// pool (four live at most); nothing is allocated while one flies.
import * as THREE from 'three';
import { bodyOverlaps } from './physics.js';

const FUSE = 2.2;
const RADIUS = 7;
const MAX_DAMAGE = 130;

export function createGrenades(scene, world) {
  const geo = new THREE.SphereGeometry(0.09, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1f1c18'), roughness: 0.6, metalness: 0.4 });
  const pool = [];
  for (let i = 0; i < 4; i += 1) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fuse: 0, live: false });
  }

  function throwFrag(from, dir) {
    const g = pool.find((item) => !item.live);
    if (!g) return false;
    g.live = true;
    g.fuse = FUSE;
    g.pos.copy(from).addScaledVector(dir, 0.5);
    g.vel.copy(dir).multiplyScalar(16);
    g.vel.y += 4.5;
    g.mesh.visible = true;
    g.mesh.position.copy(g.pos);
    return true;
  }

  function step(dt, explode) {
    for (const g of pool) {
      if (!g.live) continue;
      g.fuse -= dt;
      g.vel.y -= 14 * dt;
      // Move one axis at a time; a hit reflects the velocity instead of
      // stopping it, so the grenade bounces and rolls.
      const nx = g.pos.x + g.vel.x * dt;
      if (!bodyOverlaps(world.colliders, nx, g.pos.y, g.pos.z, 0.09, 0.18, 0)) g.pos.x = nx;
      else g.vel.x *= -0.45;
      const nz = g.pos.z + g.vel.z * dt;
      if (!bodyOverlaps(world.colliders, g.pos.x, g.pos.y, nz, 0.09, 0.18, 0)) g.pos.z = nz;
      else g.vel.z *= -0.45;
      g.pos.y += g.vel.y * dt;
      if (g.pos.y < 0.09) {
        g.pos.y = 0.09;
        if (Math.abs(g.vel.y) > 1.2) g.vel.y = Math.abs(g.vel.y) * 0.45;
        else {
          g.vel.y = 0;
          g.vel.x *= 0.7;
          g.vel.z *= 0.7;
        }
      } else if (bodyOverlaps(world.colliders, g.pos.x, g.pos.y, g.pos.z, 0.09, 0.18, 0)) {
        g.vel.y = Math.abs(g.vel.y) * 0.45 + 1;
      }
      g.mesh.position.copy(g.pos);
      if (g.fuse <= 0) {
        g.live = false;
        g.mesh.visible = false;
        explode(g.pos, RADIUS, MAX_DAMAGE);
      }
    }
  }

  function reset() {
    for (const g of pool) {
      g.live = false;
      g.mesh.visible = false;
    }
  }

  return { throwFrag, step, reset };
}
