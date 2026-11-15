// Shared collision: a body is a vertical box (radius, height) moved one axis
// at a time against the world's Box3 colliders, so a wall never swallows a
// body and sliding along a wall works. Player, bots and grenades all use it;
// the caller owns gravity, jumping and bounce.
import * as THREE from 'three';

const probe = new THREE.Box3();

function overlaps(colliders, x, y, z, radius, height, lift) {
  probe.min.set(x - radius, y + lift, z - radius);
  probe.max.set(x + radius, y + height - lift, z + radius);
  for (const collider of colliders) {
    if (probe.intersectsBox(collider)) return collider;
  }
  return null;
}

// Moves pos by vel * dt with collision. Returns the collider hit under the
// feet (for grounding) or null. vel is zeroed on the axis that hit.
export function moveBody(colliders, pos, vel, dt, radius, height) {
  const nextX = pos.x + vel.x * dt;
  if (!overlaps(colliders, nextX, pos.y, pos.z, radius, height, 0.04)) pos.x = nextX;
  else vel.x = 0;
  const nextZ = pos.z + vel.z * dt;
  if (!overlaps(colliders, pos.x, pos.y, nextZ, radius, height, 0.04)) pos.z = nextZ;
  else vel.z = 0;
  pos.y += vel.y * dt;
  let ground = null;
  const hit = overlaps(colliders, pos.x, pos.y, pos.z, radius, height, 0);
  if (hit && vel.y <= 0) {
    pos.y = hit.max.y;
    vel.y = 0;
    ground = hit;
  } else if (hit) {
    pos.y = hit.min.y - height;
    vel.y = 0;
  }
  if (pos.y < 0) {
    pos.y = 0;
    vel.y = 0;
    ground = ground ?? { max: new THREE.Vector3(0, 0, 0) };
  }
  return ground;
}

export function bodyOverlaps(colliders, x, y, z, radius, height, lift = 0.02) {
  return overlaps(colliders, x, y, z, radius, height, lift);
}

// A clear straight line between two points, tested against the shootable
// meshes. One shared raycaster, no allocation per call.
const sightRay = new THREE.Raycaster();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function hasLineOfSight(shootables, ax, ay, az, bx, by, bz) {
  _from.set(ax, ay, az);
  _to.set(bx, by, bz);
  _dir.subVectors(_to, _from);
  const dist = _dir.length();
  if (dist < 0.001) return true;
  _dir.divideScalar(dist);
  sightRay.set(_from, _dir);
  sightRay.far = dist - 0.05;
  return sightRay.intersectObjects(shootables, false).length === 0;
}
