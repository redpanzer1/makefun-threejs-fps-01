// The player: acceleration, friction, gravity, jump, crouch, sprint and a
// slide, resolved as a box against the world one axis at a time. Stopping to
// aim pays: spread in weapons.js reads groundSpeed(), and sprinting locks
// accurate fire out. Health and armour live here too: armour absorbs half
// of every hit while it lasts.
import * as THREE from 'three';
import { moveBody, bodyOverlaps } from './physics.js';

const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 6.6;
const CROUCH_SPEED = 2.4;
const SLIDE_TIME = 0.75;
const SLIDE_SPEED = 7.4;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const GRAVITY = 20;
const JUMP_SPEED = 6.2;

export function createPlayer(colliders, spawn) {
  const player = {
    position: new THREE.Vector3(spawn.x, 0, spawn.z),
    velocity: new THREE.Vector3(),
    yaw: spawn.yaw,
    pitch: 0,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    sliding: false,
    sprinting: false,
    height: STAND_HEIGHT,
    health: 100,
    armor: 0,
    fovKick: 0,
    stepPhase: 0,
  };
  const wish = new THREE.Vector3();
  const slideDir = new THREE.Vector3();
  let slideLeft = 0;
  let stepAcc = 0;

  function look(dx, dy, sensitivity = 0.0022) {
    player.yaw -= dx * sensitivity;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    player.pitch = Math.min(1.45, player.pitch + pitchKick);
    player.yaw += yawKick;
  }

  function punchFov(degrees) {
    player.fovKick = Math.min(10, player.fovKick + degrees);
  }

  function damage(amount) {
    if (player.health <= 0) return true;
    const absorbed = Math.min(player.armor, amount * 0.5);
    player.armor -= absorbed;
    player.health -= (amount - absorbed);
    if (player.health <= 0) {
      player.health = 0;
      return true;
    }
    return false;
  }

  function reset(spawnPoint) {
    player.position.set(spawnPoint.x, 0, spawnPoint.z);
    player.velocity.set(0, 0, 0);
    player.yaw = spawnPoint.yaw;
    player.pitch = 0;
    player.eye = STAND_EYE;
    player.health = 100;
    player.crouching = false;
    player.sliding = false;
    player.height = STAND_HEIGHT;
    player.fovKick = 0;
    slideLeft = 0;
  }

  function step(dt, keys, onStep) {
    const crouchKey = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    const sprintKey = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }
    const moving = wish.lengthSq() > 0;
    player.sprinting = sprintKey && moving && forward > 0 && !player.crouching && !player.sliding;

    // Slide: crouch while sprinting. Direction locks, speed decays.
    if (crouchKey && player.sprinting && player.onGround && slideLeft <= 0) {
      player.sliding = true;
      slideLeft = SLIDE_TIME;
      slideDir.copy(wish);
      punchFov(4);
    }
    if (player.sliding) {
      slideLeft -= dt;
      const k = Math.max(0, slideLeft / SLIDE_TIME);
      player.velocity.x = slideDir.x * (CROUCH_SPEED + (SLIDE_SPEED - CROUCH_SPEED) * k);
      player.velocity.z = slideDir.z * (CROUCH_SPEED + (SLIDE_SPEED - CROUCH_SPEED) * k);
      if (slideLeft <= 0 && !crouchKey) player.sliding = false;
    }

    const wantCrouch = crouchKey || player.sliding;
    if (wantCrouch && !player.crouching) {
      player.crouching = true;
      player.height = CROUCH_HEIGHT;
    } else if (!wantCrouch && player.crouching
      && !bodyOverlaps(colliders, player.position.x, player.position.y, player.position.z, RADIUS, STAND_HEIGHT)) {
      player.crouching = false;
      player.height = STAND_HEIGHT;
    }
    const eyeTarget = player.crouching ? CROUCH_EYE : STAND_EYE;
    player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 12);

    if (!player.sliding) {
      const speed = player.crouching ? CROUCH_SPEED : player.sprinting ? SPRINT_SPEED : WALK_SPEED;
      const blend = Math.min(1, (player.onGround ? GROUND_ACCEL : AIR_ACCEL) * dt / speed);
      player.velocity.x += (wish.x * speed - player.velocity.x) * blend;
      player.velocity.z += (wish.z * speed - player.velocity.z) * blend;
      if (player.onGround && !moving) {
        const damp = Math.max(0, 1 - FRICTION * dt);
        player.velocity.x *= damp;
        player.velocity.z *= damp;
      }
    }

    if (keys.has('Space') && player.onGround && !player.sliding) {
      player.velocity.y = JUMP_SPEED;
      player.onGround = false;
    }
    player.velocity.y -= GRAVITY * dt;
    player.velocity.y = Math.max(-30, player.velocity.y);

    const ground = moveBody(colliders, player.position, player.velocity, dt, RADIUS, player.height);
    const wasAirborne = !player.onGround;
    player.onGround = ground !== null;
    if (player.onGround && wasAirborne && player.velocity.y === 0) {
      // Landed: a small shake through the camera, via fovKick's sibling.
      player.fovKick = Math.max(player.fovKick, 0);
    }

    // Footsteps for audio: one tick per stride while moving on the ground.
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    if (player.onGround && speed > 1.5) {
      stepAcc += dt * speed;
      if (stepAcc > 2.4) {
        stepAcc = 0;
        if (onStep) onStep(player.sprinting);
      }
    } else {
      stepAcc = 0;
    }

    player.fovKick *= Math.exp(-dt / 0.2);
    if (player.fovKick < 0.01) player.fovKick = 0;
  }

  return {
    state: player,
    step,
    look,
    recoil,
    punchFov,
    damage,
    reset,
    groundSpeed() {
      return Math.hypot(player.velocity.x, player.velocity.z);
    },
  };
}
