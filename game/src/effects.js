// Feedback, pooled and preallocated: tracers, impact sparks, explosions,
// trauma-based camera shake and hit flashes. Nothing here allocates in the
// hot loop; every effect is an event with a short life, scaled so the
// strongest events (explosion, death) are unmistakable and the weakest stay
// subtle. Feedback clarifies state — it never hides the next decision.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function pseudoNoise(t, seed) {
  const x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export function createEffects(scene, camera) {
  // Tracers: 12 reusable lines, two points each.
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 12; i += 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, tracerMat.clone());
    line.visible = false;
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerIdx = 0;

  // Impact sparks: 10 small boxes that fly out and fade.
  const sparks = [];
  const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd97a') });
  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(sparkGeo, sparkMat);
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, vel: new THREE.Vector3(), life: 0 });
  }
  let sparkIdx = 0;

  // One explosion: an expanding shell plus a point light.
  const boomGeo = new THREE.SphereGeometry(1, 18, 12);
  const boomMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9a3d'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const boom = new THREE.Mesh(boomGeo, boomMat);
  boom.visible = false;
  scene.add(boom);
  const boomLight = new THREE.PointLight(new THREE.Color('#ff9a3d'), 0, 26);
  scene.add(boomLight);
  let boomLife = 0;
  let boomSize = 1;

  // Hit flashes: emissive pulses on bot materials.
  const flashes = [];

  // Trauma shake: trauma^2, decaying, capped at 1.
  let trauma = 0;
  let shakeTime = 0;

  return {
    tracer(from, to) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % tracers.length;
      const pos = t.line.geometry.attributes.position;
      pos.setXYZ(0, from.x, from.y, from.z);
      pos.setXYZ(1, to.x, to.y, to.z);
      pos.needsUpdate = true;
      t.line.visible = true;
      t.line.material.opacity = 0.9;
      t.life = 0.07;
    },
    spark(pos, dir) {
      const s = sparks[sparkIdx];
      sparkIdx = (sparkIdx + 1) % sparks.length;
      s.mesh.position.copy(pos);
      s.vel.set(dir.x * 3 + (Math.random() - 0.5) * 2, Math.random() * 2 + 1, dir.z * 3 + (Math.random() - 0.5) * 2);
      s.mesh.visible = true;
      s.life = 0.35;
    },
    explosion(pos, size = 6) {
      boom.position.copy(pos);
      boom.position.y = Math.max(0.6, pos.y);
      boom.visible = true;
      boomLife = 0.5;
      boomSize = size;
      boomLight.position.copy(boom.position);
      boomLight.position.y += 1;
      this.addTrauma(0.7);
    },
    flash(material) {
      material.emissive = material.emissive ?? new THREE.Color(PALETTE.accent);
      flashes.push({ material, base: material.emissiveIntensity, life: 0.22 });
      material.emissiveIntensity = 2.4;
    },
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        if (t.life <= 0) t.line.visible = false;
        else t.line.material.opacity = (t.life / 0.07) * 0.9;
      }
      for (const s of sparks) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) {
          s.mesh.visible = false;
          continue;
        }
        s.vel.y -= 9 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.scale.setScalar(Math.max(0.1, s.life / 0.35));
      }
      if (boomLife > 0) {
        boomLife -= dt;
        const k = 1 - Math.max(0, boomLife) / 0.5;
        boom.scale.setScalar(0.5 + k * boomSize);
        boomMat.opacity = Math.max(0, 0.85 * (1 - k));
        boomLight.intensity = Math.max(0, 60 * (1 - k));
        if (boomLife <= 0) {
          boom.visible = false;
          boomLight.intensity = 0;
        }
      }
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        const f = flashes[i];
        f.life -= dt;
        if (f.life <= 0) {
          f.material.emissiveIntensity = f.base;
          flashes.splice(i, 1);
        } else {
          f.material.emissiveIntensity = f.base + (2.4 - f.base) * (f.life / 0.22);
        }
      }
      // Shake decays in real time and is applied by the caller after the
      // base camera transform, so it never accumulates.
      shakeTime += dt;
      trauma = Math.max(0, trauma - 1.4 * dt);
    },
    applyShake() {
      if (trauma <= 0) return;
      const shake = trauma * trauma;
      const freq = shakeTime * 32;
      camera.position.x += 0.35 * shake * pseudoNoise(freq, 1);
      camera.position.y += 0.35 * shake * pseudoNoise(freq, 2);
      camera.rotation.z += 0.06 * shake * pseudoNoise(freq, 3);
    },
  };
}
