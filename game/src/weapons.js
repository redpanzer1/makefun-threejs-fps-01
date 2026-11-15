// The arsenal. Five guns, a knife and a frag grenade, all original names.
// Each definition owns its numbers; main.js owns the ray and the damage.
// Spread punishes firing on the move and grows with sustained fire (bloom);
// aiming down sights narrows it and narrows the field of view.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  kestrel: { id: 'kestrel', name: 'AR-41 Kestrel', slot: 1, kind: 'rifle', auto: true, mag: 30, reserve: 120, price: 2700, damage: 34, headMul: 2.95, gap: 0.1, reload: 2.1, spread: 0.0022, moveSpread: 0.026, recoil: 0.011, bloom: 0.0012, adsFov: 55, muzzle: [0.24, -0.17, -0.86] },
  wasp: { id: 'wasp', name: 'SMG-9 Wasp', slot: 2, kind: 'smg', auto: true, mag: 32, reserve: 128, price: 1500, damage: 26, headMul: 3, gap: 0.07, reload: 1.7, spread: 0.004, moveSpread: 0.03, recoil: 0.008, bloom: 0.001, adsFov: 60, muzzle: [0.24, -0.17, -0.72] },
  falcon: { id: 'falcon', name: 'P-12 Falcon', slot: 3, kind: 'pistol', auto: false, mag: 12, reserve: 60, price: 500, damage: 30, headMul: 3, gap: 0.16, reload: 1.4, spread: 0.002, moveSpread: 0.02, recoil: 0.009, bloom: 0.0008, adsFov: 60, muzzle: [0.24, -0.17, -0.62] },
  talon: { id: 'talon', name: 'Talon Knife', slot: 4, kind: 'melee', auto: false, mag: 0, reserve: 0, price: 0, damage: 40, headMul: 1, gap: 0.45, reload: 0, spread: 0, moveSpread: 0, recoil: 0.004, bloom: 0, adsFov: 74, range: 1.9, muzzle: [0.24, -0.2, -0.5] },
  longbow: { id: 'longbow', name: 'SR-88 Longbow', slot: 5, kind: 'sniper', auto: false, mag: 5, reserve: 20, price: 4750, damage: 100, headMul: 2, gap: 1.15, reload: 2.8, spread: 0.0004, moveSpread: 0.02, recoil: 0.03, bloom: 0, adsFov: 28, scope: true, muzzle: [0.24, -0.16, -1.02] },
};
export const FRAG_PRICE = 300;
export const FRAG_MAX = 3;
export const ARMOR_PRICE = 650;

export function createWeapons(camera) {
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color('#33302b'), roughness: 0.45, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1f1c18'), roughness: 0.7, metalness: 0.2 });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.5, metalness: 0.3 });
  const lens = new THREE.MeshStandardMaterial({ color: new THREE.Color('#16222e'), roughness: 0.15, metalness: 0.8 });

  function part(parent, w, h, d, mat, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // One authored view model per gun: receiver, barrel and handguard, rail
  // teeth, magazine, stock and sights — a silhouette, not a glowing box.
  function buildModel(id) {
    const g = new THREE.Group();
    if (id === 'talon') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.34), metal);
      blade.position.set(0, 0.01, -0.3);
      blade.rotation.x = -0.25;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.16), dark);
      handle.position.set(0, -0.01, -0.08);
      g.add(blade, handle);
      return g;
    }
    const long = id === 'longbow';
    const short = id === 'falcon' || id === 'wasp';
    const len = long ? 0.52 : short ? 0.3 : 0.42;
    part(g, 0.09, 0.1, len, metal, 0, 0, -0.1); // receiver
    part(g, 0.045, 0.045, long ? 0.5 : 0.38, dark, 0, 0.025, -0.28 - len / 2 + 0.2); // barrel
    part(g, 0.07, 0.06, long ? 0.42 : 0.3, dark, 0, -0.01, -0.3); // handguard
    for (let i = 0; i < 5; i += 1) { // rail teeth
      part(g, 0.075, 0.015, 0.02, metal, 0, 0.055, -0.14 - i * 0.07);
    }
    part(g, 0.06, 0.16, 0.09, dark, 0, -0.12, 0.02); // magazine
    part(g, 0.075, 0.08, 0.24, dark, 0, -0.02, 0.22 + len / 2 - 0.21); // stock
    part(g, 0.02, 0.05, 0.02, accent, 0, 0.075, -0.28); // front sight
    if (long || id === 'kestrel') {
      // Scope: tube, objective bell, ocular, lens glint.
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), dark);
      tube.rotation.x = Math.PI / 2;
      tube.position.set(0, 0.085, -0.05);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 12), dark);
      bell.rotation.x = Math.PI / 2;
      bell.position.set(0, 0.085, -0.17);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.042, 12), lens);
      glass.position.set(0, 0.085, -0.206);
      g.add(tube, bell, glass);
    }
    if (id === 'wasp') part(g, 0.05, 0.05, 0.12, dark, 0, -0.07, -0.18); // foregrip
    return g;
  }

  const models = {};
  for (const id of Object.keys(WEAPONS)) {
    models[id] = buildModel(id);
    models[id].position.set(0.24, -0.2, -0.42);
    models[id].visible = false;
    camera.add(models[id]);
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 6);
  camera.add(flashLight);

  const ammo = {
    kestrel: { mag: 30, reserve: 120 },
    wasp: { mag: 32, reserve: 128 },
    falcon: { mag: 12, reserve: 60 },
    longbow: { mag: 5, reserve: 20 },
  };
  const owned = new Set(['falcon']);
  let current = 'falcon';
  let frags = 0;
  let cooldown = 0;
  let reloadLeft = 0;
  let switchLeft = 0;
  let flashLeft = 0;
  let kick = 0;
  let bloom = 0;
  let aiming = false;
  let adsAmount = 0;
  models[current].visible = true;

  function def() {
    return WEAPONS[current];
  }

  function step(dt) {
    cooldown = Math.max(0, cooldown - dt);
    flashLeft = Math.max(0, flashLeft - dt);
    bloom = Math.max(0, bloom - dt * 0.03);
    kick += (0 - kick) * Math.min(1, dt * 14);
    const target = aiming && def().kind !== 'melee' ? 1 : 0;
    adsAmount += (target - adsAmount) * Math.min(1, dt * 12);
    const model = models[current];
    model.position.z = -0.42 + kick + adsAmount * 0.1;
    model.position.x = 0.24 * (1 - adsAmount);
    model.position.y = -0.2 + adsAmount * 0.075;
    model.rotation.x = kick * 2.2;
    flash.visible = flashLeft > 0;
    if (flash.visible) {
      const m = def().muzzle;
      flash.position.set(m[0], m[1], m[2]);
      flash.rotation.z = flashLeft * 30;
      flashLight.position.set(m[0], m[1], m[2] - 0.2);
      flashLight.intensity = 18;
    } else {
      flashLight.intensity = 0;
    }
    if (reloadLeft > 0) {
      reloadLeft = Math.max(0, reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def().reload - reloadLeft) * 2);
      if (reloadLeft === 0 && def().kind !== 'melee') {
        const a = ammo[current];
        const need = def().mag - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
      }
    }
    if (switchLeft > 0) {
      switchLeft = Math.max(0, switchLeft - dt);
      model.position.y = -0.2 - 0.25 * Math.sin((switchLeft / 0.35) * Math.PI);
    }
  }

  return {
    currentId() { return current; },
    def,
    owned(id) { return owned.has(id); },
    frags() { return frags; },
    addFrag() { frags = Math.min(FRAG_MAX, frags + 1); },
    takeFrag() {
      if (frags <= 0) return false;
      frags -= 1;
      return true;
    },
    buy(id) {
      if (owned.has(id) || !WEAPONS[id]) return false;
      owned.add(id);
      return true;
    },
    dropBought() {
      // Dying loses bought guns; the pistol and the knife stay.
      for (const id of [...owned]) if (id !== 'falcon') owned.delete(id);
      if (current !== 'falcon' && current !== 'talon') this.switchTo('falcon');
      frags = 0;
    },
    ammo() {
      const a = ammo[current];
      return a ? { mag: a.mag, reserve: a.reserve } : { mag: 0, reserve: 0 };
    },
    refillOnRound() {
      for (const id of owned) {
        if (ammo[id]) ammo[id].reserve = WEAPONS[id].reserve;
      }
    },
    switchTo(id) {
      if (!owned.has(id) || id === current || switchLeft > 0) return false;
      models[current].visible = false;
      current = id;
      models[current].visible = true;
      reloadLeft = 0;
      switchLeft = 0.35;
      return true;
    },
    setAiming(on) {
      aiming = on && def().kind !== 'melee';
    },
    isAiming() {
      return aiming;
    },
    adsFov() {
      return def().adsFov;
    },
    adsAmount() {
      return adsAmount;
    },
    ready() {
      return cooldown === 0 && reloadLeft === 0 && switchLeft === 0;
    },
    reloading() {
      return reloadLeft > 0;
    },
    reload() {
      const a = ammo[current];
      if (reloadLeft > 0 || !a || a.mag === def().mag || a.reserve === 0) return false;
      reloadLeft = def().reload;
      return true;
    },
    // Returns the shot's definition and spread, or null when it cannot fire.
    tryFire(speed, sprinting, crouching) {
      const d = def();
      if (!this.ready()) return null;
      if (d.kind !== 'melee') {
        const a = ammo[current];
        if (a.mag <= 0) return { empty: true, def: d };
        a.mag -= 1;
      }
      cooldown = d.gap;
      flashLeft = 0.06;
      kick = 0.055;
      bloom = Math.min(0.012, bloom + d.bloom);
      let spread = d.spread + bloom;
      spread += Math.min(1, speed / 5.2) * d.moveSpread;
      if (sprinting) spread += d.moveSpread * 1.5;
      if (crouching) spread *= 0.8;
      if (aiming) spread *= 0.35;
      return { def: d, spread };
    },
    // Same formula as tryFire, without side effects: the HUD crosshair
    // grows from the same numbers the shots obey.
    spreadNow(speed, sprinting, crouching) {
      const d = def();
      let spread = d.spread + bloom;
      spread += Math.min(1, speed / 5.2) * d.moveSpread;
      if (sprinting) spread += d.moveSpread * 1.5;
      if (crouching) spread *= 0.8;
      if (aiming) spread *= 0.35;
      return spread;
    },
    step,
  };
}
