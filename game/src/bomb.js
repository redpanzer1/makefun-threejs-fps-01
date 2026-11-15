// The bomb: plant it at a site, defend it, or lose the round to a defuse.
// Planting takes 3 s of holding E inside a site ring. Once planted the
// 40 s timer runs and the beeps accelerate; a defender that reaches it
// channels a 5 s defuse. The bomb is a small box with a blinking light.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { siteAt } from './map.js';

const PLANT_TIME = 3;
const BOMB_TIME = 40;

export function createBomb(scene, state) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.22, 0.24),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1f1c18'), roughness: 0.6, metalness: 0.4 }),
  );
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.05, 0.08),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 2 }),
  );
  light.position.set(0, 0.13, 0);
  group.add(body, light);
  group.visible = false;
  scene.add(group);
  let beepAt = 0;

  function reset() {
    state.bomb.state = 'idle';
    state.bomb.site = null;
    state.bomb.plantProgress = 0;
    state.bomb.timer = 0;
    state.bomb.defuseProgress = 0;
    state.bomb.defuser = null;
    group.visible = false;
    beepAt = 0;
  }

  function step(dt, playerPos, holdingPlant, audio) {
    const bomb = state.bomb;
    if (bomb.state === 'idle' || bomb.state === 'carried') {
      // Planting: hold E inside a site ring.
      const site = siteAt(playerPos.x, playerPos.z);
      if (holdingPlant && site && (bomb.state === 'carried' || bomb.state === 'idle')) {
        bomb.state = 'carried';
        bomb.plantProgress += dt / PLANT_TIME;
        if (bomb.plantProgress >= 1) {
          bomb.state = 'planted';
          bomb.site = site;
          bomb.x = playerPos.x;
          bomb.z = playerPos.z;
          bomb.timer = BOMB_TIME;
          bomb.defuseProgress = 0;
          group.position.set(bomb.x, 0.11, bomb.z);
          group.visible = true;
          beepAt = state.time;
          audio.plant();
        }
      } else {
        // Not planting: progress bleeds away, but the carrier keeps the bomb.
        bomb.plantProgress = Math.max(0, bomb.plantProgress - dt / PLANT_TIME);
      }
      return;
    }
    if (bomb.state === 'planted') {
      bomb.timer -= dt;
      // Beeps accelerate as the timer runs down.
      const interval = 0.25 + (bomb.timer / BOMB_TIME) * 0.75;
      if (state.time >= beepAt + interval) {
        beepAt = state.time;
        audio.beep(bomb.timer < 10);
      }
      light.material.emissiveIntensity = 1 + Math.sin(state.time * 10) * 1;
      if (bomb.timer <= 0) {
        bomb.state = 'detonated';
        group.visible = false;
      }
    }
  }

  return {
    step,
    reset,
    group,
    get planted() {
      return state.bomb.state === 'planted';
    },
  };
}
