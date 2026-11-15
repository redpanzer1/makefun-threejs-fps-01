// The defenders: five bots (Jackals) with a small state machine — hold,
// patrol, investigate, engage, rotate, defuse. They walk the waypoint graph,
// see through a field of view plus line of sight, hear gunfire, and shoot
// back in bursts with distance- and movement-based accuracy. One shared
// raycaster and staggered 10 Hz perception keep the cost flat.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { moveBody, hasLineOfSight } from './physics.js';
import { NODES, nearestNode, findPath, MAP } from './map.js';
import { rng } from './rng.js';

const NAMES = ['Dune', 'Rook', 'Vex', 'Flint', 'Ash'];
const HEALTH = 100;
const WALK_SPEED = 3.4;
const ROTATE_SPEED = 4.3;
const SIGHT_RANGE = 42;
const HEAR_RANGE = 32;
const FOV_DOT = 0.62; // ~103 degrees
const FALL_SECONDS = 0.45;

const _v = new THREE.Vector3();
const _target = new THREE.Vector3();

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

export function createBots(scene, world, state) {
  const uniform = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a7a5c'), roughness: 0.85 });
  const vest = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2e2a24'), roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a184'), roughness: 0.7 });
  const band = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.danger), roughness: 0.6 });
  const gun = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1f1c18'), roughness: 0.5, metalness: 0.5 });
  const torsoGeo = new THREE.BoxGeometry(0.52, 0.72, 0.3);
  const vestGeo = new THREE.BoxGeometry(0.56, 0.5, 0.34);
  const headGeo = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  const bandGeo = new THREE.BoxGeometry(0.28, 0.07, 0.28);
  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  const gunGeo = new THREE.BoxGeometry(0.07, 0.09, 0.55);

  const bots = [];
  const hitMeshes = [];

  for (let i = 0; i < 5; i += 1) {
    const group = new THREE.Group();
    const torsoMat = uniform.clone();
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.08;
    const vestMesh = new THREE.Mesh(vestGeo, vest);
    vestMesh.position.y = 1.12;
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 1.6;
    const headband = new THREE.Mesh(bandGeo, band);
    headband.position.y = 1.7;
    const legL = new THREE.Mesh(legGeo, vest);
    legL.position.set(-0.13, 0.36, 0);
    const legR = new THREE.Mesh(legGeo, vest);
    legR.position.set(0.13, 0.36, 0);
    const weapon = new THREE.Mesh(gunGeo, gun);
    weapon.position.set(0.2, 1.05, -0.3);
    group.add(torso, vestMesh, head, headband, legL, legR, weapon);
    group.traverse((mesh) => {
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    scene.add(group);
    const bot = {
      id: i,
      name: NAMES[i],
      group,
      torso,
      flashMat: torsoMat,
      head,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      yaw: 0,
      health: HEALTH,
      alive: true,
      state: 'hold',
      kind: i % 2 === 0 ? 'rifle' : 'smg',
      path: [],
      pathIdx: 0,
      holdNode: 0,
      holdUntil: 0,
      patrolRoute: [],
      patrolIdx: 0,
      scanPhase: rng.range(0, Math.PI * 2),
      lastSeen: new THREE.Vector3(),
      lastSeenAt: -99,
      reactionAt: 0,
      burstLeft: 0,
      burstAt: 0,
      nextBurstAt: 0,
      fall: 0,
      spottedAt: -99,
      investigateAt: new THREE.Vector3(),
      investigateUntil: 0,
    };
    torso.userData.bot = bot;
    torso.userData.part = 'torso';
    head.userData.bot = bot;
    head.userData.part = 'head';
    hitMeshes.push(torso, head);
    bots.push(bot);
  }

  function setPath(bot, nodeIdx) {
    const from = nearestNode(bot.pos.x, bot.pos.z);
    bot.path = findPath(from, nodeIdx);
    bot.pathIdx = 0;
  }

  function reset() {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      const spawn = MAP.botSpawns[i];
      bot.pos.set(spawn.x, 0, spawn.z);
      bot.vel.set(0, 0, 0);
      bot.yaw = Math.PI; // face south, toward the player spawn
      bot.health = HEALTH;
      bot.alive = true;
      bot.fall = 0;
      bot.group.rotation.set(0, bot.yaw, 0);
      bot.group.position.copy(bot.pos);
      bot.group.visible = true;
      bot.burstLeft = 0;
      bot.lastSeenAt = -99;
      bot.spottedAt = -99;
      bot.defuseDone = false;
      if (i < 2) {
        bot.state = 'hold';
        bot.holdNode = i === 0 ? 10 : 8;
        bot.patrolRoute = [10, 8, 15, 8];
      } else if (i < 4) {
        bot.state = 'hold';
        bot.holdNode = i === 2 ? 11 : 9;
        bot.patrolRoute = [11, 9, 16, 9];
      } else {
        bot.state = 'patrol';
        bot.patrolRoute = [4, 1, 5, 16, 12, 15];
        bot.patrolIdx = 0;
        setPath(bot, bot.patrolRoute[0]);
      }
      bot.patrolIdx = 0;
      bot.holdUntil = 0;
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    // Being shot interrupts a defuse and pulls the bot to the fight.
    if (state.bomb.state === 'planted') state.bomb.defuseProgress = 0;
    if (bot.health > 0) {
      if (bot.state === 'defuse' || bot.state === 'hold' || bot.state === 'patrol') {
        bot.state = 'investigate';
        bot.investigateAt.copy(bot.lastSeen);
        bot.investigateUntil = state.time + 3;
        setPath(bot, nearestNode(bot.lastSeen.x, bot.lastSeen.z));
      }
      return false;
    }
    bot.alive = false;
    bot.fall = 0;
    bot.state = 'dead';
    return true;
  }

  function aliveCount() {
    let n = 0;
    for (const bot of bots) if (bot.alive) n += 1;
    return n;
  }

  function steer(bot, tx, tz, speed, dt) {
    _v.set(tx - bot.pos.x, 0, tz - bot.pos.z);
    const dist = _v.length();
    if (dist < 0.05) return true;
    _v.divideScalar(dist);
    const blend = Math.min(1, 10 * dt);
    bot.vel.x += (_v.x * speed - bot.vel.x) * blend;
    bot.vel.z += (_v.z * speed - bot.vel.z) * blend;
    bot.yaw = angleLerp(bot.yaw, Math.atan2(-_v.x, -_v.z), Math.min(1, dt * 8));
    return dist < 0.7;
  }

  function followPath(bot, speed, dt) {
    if (bot.pathIdx >= bot.path.length) return true;
    const node = NODES[bot.path[bot.pathIdx]];
    if (steer(bot, node[0], node[1], speed, dt)) bot.pathIdx += 1;
    return bot.pathIdx >= bot.path.length;
  }

  function perceive(bot, playerPos, time) {
    _v.set(playerPos.x - bot.pos.x, 0, playerPos.z - bot.pos.z);
    const dist = _v.length();
    if (dist > SIGHT_RANGE) return false;
    _v.divideScalar(dist || 1);
    const fx = -Math.sin(bot.yaw);
    const fz = -Math.cos(bot.yaw);
    if (fx * _v.x + fz * _v.z < FOV_DOT && dist > 2.5) return false;
    if (!hasLineOfSight(world.shootables, bot.pos.x, 1.55, bot.pos.z, playerPos.x, playerPos.y + 1.2, playerPos.z)) return false;
    bot.lastSeen.set(playerPos.x, playerPos.y, playerPos.z);
    bot.lastSeenAt = time;
    bot.spottedAt = time;
    return true;
  }

  function shootAt(bot, playerPos, playerSpeed, crouching, dt) {
    if (bot.burstLeft > 0) {
      if (state.time < bot.burstAt) return;
      bot.burstAt = state.time + 0.12;
      bot.burstLeft -= 1;
      const dist = Math.hypot(playerPos.x - bot.pos.x, playerPos.z - bot.pos.z);
      let p = 0.5 - dist * 0.008;
      if (playerSpeed > 3) p *= 0.7;
      if (crouching) p *= 0.85;
      const moving = Math.hypot(bot.vel.x, bot.vel.z) > 1;
      if (moving) p *= 0.7;
      const hit = rng.next() < Math.max(0.05, p);
      const dmg = bot.kind === 'rifle' ? rng.int(13, 19) : rng.int(10, 14);
      _target.set(playerPos.x, playerPos.y + 1.2, playerPos.z);
      if (!hit) {
        _target.x += rng.range(-1.2, 1.2);
        _target.y += rng.range(-0.6, 1.2);
        _target.z += rng.range(-1.2, 1.2);
      }
      state.events.push({
        type: 'botshot',
        bot,
        from: { x: bot.pos.x, y: 1.35, z: bot.pos.z },
        to: { x: _target.x, y: _target.y, z: _target.z },
        hit,
        damage: hit ? dmg : 0,
      });
      if (bot.burstLeft === 0) bot.nextBurstAt = state.time + rng.range(0.9, 1.5);
      return;
    }
    if (state.time >= bot.nextBurstAt) {
      bot.burstLeft = rng.int(3, 5);
      bot.burstAt = state.time;
    }
  }

  function step(dt, player, tick) {
    const time = state.time;
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      if (!bot.alive) {
        bot.fall = Math.min(1, bot.fall + dt / FALL_SECONDS);
        bot.group.rotation.x = -bot.fall * 1.45;
        bot.group.position.y = -bot.fall * 0.08;
        continue;
      }
      // Perception runs staggered at ~10 Hz per bot.
      if (tick % 6 === i % 6 && player.health > 0) {
        if (perceive(bot, player.position, time)) {
          if (bot.state !== 'engage') {
            bot.state = 'engage';
            bot.reactionAt = time + rng.range(0.35, 0.6);
          }
        } else if (bot.state === 'engage' && time - bot.lastSeenAt > 2.5) {
          bot.state = 'investigate';
          bot.investigateAt.copy(bot.lastSeen);
          bot.investigateUntil = time + 3;
          setPath(bot, nearestNode(bot.lastSeen.x, bot.lastSeen.z));
        }
      }

      if (bot.state === 'engage') {
        // Face the player and shoot in bursts once reacted.
        const dx = player.position.x - bot.pos.x;
        const dz = player.position.z - bot.pos.z;
        bot.yaw = angleLerp(bot.yaw, Math.atan2(-dx, -dz), Math.min(1, dt * 10));
        const dist = Math.hypot(dx, dz);
        if (time >= bot.reactionAt && player.health > 0) {
          if (dist > 20) {
            // Close the distance along the graph; stop to shoot when near.
            if (bot.pathIdx >= bot.path.length) setPath(bot, nearestNode(player.position.x, player.position.z));
            followPath(bot, WALK_SPEED, dt);
          } else {
            bot.vel.x *= Math.max(0, 1 - 8 * dt);
            bot.vel.z *= Math.max(0, 1 - 8 * dt);
            shootAt(bot, player.position, Math.hypot(player.velocity.x, player.velocity.z), player.crouching, dt);
          }
        }
      } else if (bot.state === 'defuse') {
        bot.vel.x = 0;
        bot.vel.z = 0;
        if (state.bomb.state === 'planted') {
          state.bomb.defuseProgress += dt / 5;
          if (state.bomb.defuseProgress >= 1) {
            state.bomb.state = 'defused';
          }
        } else {
          bot.state = 'hold';
        }
      } else if (bot.state === 'rotate') {
        const site = state.bomb.site === 'A' ? 10 : 11;
        if (followPath(bot, ROTATE_SPEED, dt)) {
          const bomb = state.bomb;
          const d = Math.hypot(bot.pos.x - bomb.x, bot.pos.z - bomb.z);
          if (bomb.state === 'planted' && d < 2.2) bot.state = 'defuse';
          else if (bomb.state !== 'planted') bot.state = 'hold';
        }
        // Re-path if the bomb site changed under us.
        if (bot.path.length > 0 && bot.path[bot.path.length - 1] !== site) setPath(bot, site);
      } else if (bot.state === 'investigate') {
        if (followPath(bot, WALK_SPEED, dt)) {
          // Arrived: scan the area, then go back to holding.
          bot.yaw += Math.sin(time * 1.5 + bot.scanPhase) * dt * 1.2;
          if (time >= bot.investigateUntil) {
            bot.state = 'hold';
            setPath(bot, bot.holdNode);
          }
        }
      } else if (bot.state === 'patrol') {
        if (followPath(bot, WALK_SPEED, dt)) {
          bot.patrolIdx = (bot.patrolIdx + 1) % bot.patrolRoute.length;
          bot.holdUntil = time + rng.range(1.5, 3);
          bot.state = 'hold';
        }
      } else {
        // hold: stand at the hold node, scan slowly, then patrol on.
        const node = NODES[bot.holdNode];
        const d = Math.hypot(bot.pos.x - node[0], bot.pos.z - node[1]);
        if (d > 1) {
          if (bot.pathIdx >= bot.path.length) setPath(bot, bot.holdNode);
          followPath(bot, WALK_SPEED, dt);
        } else {
          bot.vel.x *= Math.max(0, 1 - 8 * dt);
          bot.vel.z *= Math.max(0, 1 - 8 * dt);
          bot.yaw += Math.sin(time * 0.7 + bot.scanPhase) * dt * 0.9;
          if (time >= bot.holdUntil && bot.holdUntil > 0 && bot.patrolRoute.length > 1) {
            bot.holdUntil = 0;
            bot.state = 'patrol';
            bot.patrolIdx = (bot.patrolIdx + 1) % bot.patrolRoute.length;
            setPath(bot, bot.patrolRoute[bot.patrolIdx]);
          }
        }
      }

      // Bomb planted: every living bot that is not fighting rotates to it.
      if (state.bomb.state === 'planted' && bot.state !== 'engage' && bot.state !== 'defuse' && bot.state !== 'rotate') {
        bot.state = 'rotate';
        setPath(bot, state.bomb.site === 'A' ? 10 : 11);
      }

      bot.vel.y -= 20 * dt;
      const ground = moveBody(world.colliders, bot.pos, bot.vel, dt, 0.34, 1.72);
      if (ground) bot.vel.y = 0;
      bot.group.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
      bot.group.rotation.y = bot.yaw;
      // Walk cycle: legs swing while moving.
      const speed = Math.hypot(bot.vel.x, bot.vel.z);
      if (speed > 0.5) {
        const swing = Math.sin(time * 9) * 0.5;
        bot.group.children[4].rotation.x = swing;
        bot.group.children[5].rotation.x = -swing;
      } else {
        bot.group.children[4].rotation.x = 0;
        bot.group.children[5].rotation.x = 0;
      }
    }
  }

  // A gunshot somewhere: bots in earshot investigate it.
  function hearShot(x, z) {
    for (const bot of bots) {
      if (!bot.alive || bot.state === 'engage' || bot.state === 'defuse') continue;
      const d = Math.hypot(bot.pos.x - x, bot.pos.z - z);
      if (d < HEAR_RANGE) {
        bot.state = 'investigate';
        bot.investigateAt.set(x, 0, z);
        bot.investigateUntil = state.time + 3.5;
        setPath(bot, nearestNode(x, z));
      }
    }
  }

  reset();

  return {
    bots,
    hitMeshes,
    step,
    damage,
    hearShot,
    reset,
    aliveCount,
  };
}
