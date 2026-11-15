// The world: builds the Dustline Depot scene from map.js data. Forms first,
// then materials, then light — no fog or glow standing in for geometry.
// Materials are procedural: canvas textures for corrugated container steel,
// worn concrete and speckled sand, made here in code, no files, no network.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { BOXES, CYLINDERS, MAP } from './map.js';

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, size, base, dots, alpha) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < dots; i += 1) {
    const v = Math.floor(Math.random() * 60) - 30;
    ctx.fillStyle = `rgba(${128 + v},${110 + v},${80 + v},${alpha})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
}

function makeTextures() {
  // Corrugated steel: vertical ribs with a darker groove and a lighter crest.
  const corrugated = (base) => canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, 0, 5, s);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 8, 0, 4, s);
    }
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(60,40,20,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 3 + Math.random() * 8, 2);
    }
  });
  const concrete = canvasTexture(128, (ctx, s) => {
    speckle(ctx, s, '#9a8563', 500, 0.16);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    ctx.beginPath();
    ctx.moveTo(0, s / 2);
    ctx.lineTo(s, s / 2);
    ctx.stroke();
  });
  const sand = canvasTexture(256, (ctx, s) => {
    speckle(ctx, s, '#b89a6d', 2600, 0.2);
    ctx.strokeStyle = 'rgba(90,70,45,0.35)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 7; i += 1) {
      const y = 20 + Math.random() * (s - 40);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + 8, s * 0.6, y - 8, s, y);
      ctx.stroke();
    }
  });
  return { corrugated, concrete, sand };
}

function labelTexture(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(25,21,18,0.85)';
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5b81e';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#f5b81e';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const textures = makeTextures();

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' ? 0.5 : 0.92,
      metalness: name === 'steel' ? 0.45 : 0.03,
    });
  }
  // Material roles: containers get corrugated steel tinted per colour,
  // walls get worn concrete, the ground gets speckled sand.
  const containerMats = {};
  for (const name of ['rust', 'teal', 'steel', 'ochre']) {
    containerMats[name] = new THREE.MeshStandardMaterial({
      map: textures.corrugated(PALETTE[name]),
      color: new THREE.Color('#ffffff'),
      roughness: 0.62,
      metalness: 0.35,
    });
  }
  materials.wall.map = textures.concrete;
  materials.darkwall.map = textures.concrete;
  materials.ground = new THREE.MeshStandardMaterial({
    map: textures.sand,
    color: new THREE.Color('#ffffff'),
    roughness: 1,
    metalness: 0,
  });
  textures.sand.repeat.set(8, 6);
  textures.concrete.repeat.set(2, 2);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent),
    emissive: new THREE.Color(PALETTE.accent),
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });

  const colliders = [];
  const shootables = [];
  const siteRings = {};
  const boxGeoCache = new Map();

  function boxGeometry(w, h, d) {
    const key = `${w}|${h}|${d}`;
    let geo = boxGeoCache.get(key);
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d);
      boxGeoCache.set(key, geo);
    }
    return geo;
  }

  function addBox(w, h, d, x, y, z, material, collide = true, shootable = true) {
    const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) colliders.push(new THREE.Box3().setFromObject(mesh));
    if (shootable) shootables.push(mesh);
    return mesh;
  }

  for (const [w, h, d, x, y, z, name] of BOXES) {
    const mat = name === 'accent' ? beaconMat : containerMats[name] ?? materials[name];
    addBox(w, h, d, x, y, z, mat);
  }

  const cylGeoCache = new Map();
  for (const cyl of CYLINDERS) {
    const key = `${cyl.r}|${cyl.h}`;
    let geo = cylGeoCache.get(key);
    if (!geo) {
      geo = new THREE.CylinderGeometry(cyl.r, cyl.r, cyl.h, 18);
      cylGeoCache.set(key, geo);
    }
    const mesh = new THREE.Mesh(geo, containerMats[cyl.material] ?? materials[cyl.material]);
    mesh.position.set(cyl.x, cyl.h / 2, cyl.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3(
      new THREE.Vector3(cyl.x - cyl.r, 0, cyl.z - cyl.r),
      new THREE.Vector3(cyl.x + cyl.r, cyl.h, cyl.z + cyl.r),
    ));
    shootables.push(mesh);
  }

  // Painted ground markings: mid-lane dashes, flat and thin.
  const paintMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.ink), transparent: true, opacity: 0.5 });
  for (let z = 14; z >= -8; z -= 4) {
    addBox(0.35, 0.02, 2, 0, 0.02, z, paintMat, false, false);
  }

  // Bomb site rings and floating letter markers, so the objective reads
  // from anywhere on the map without reading the HUD.
  const ringGeo = new THREE.RingGeometry(3.4, 4.2, 40);
  for (const key of Object.keys(MAP.sites)) {
    const site = MAP.sites[key];
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.03, site.z);
    group.add(ring);
    siteRings[key] = ring;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(key), transparent: true, depthWrite: false }));
    label.scale.set(2.2, 2.2, 1);
    label.position.set(site.x, 6.5, site.z);
    group.add(label);
  }

  // Distant silhouettes beyond the walls: dunes and depot blocks in the haze,
  // so the horizon is not a flat colour. No colliders, no shadows.
  const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8a7648'), roughness: 1 });
  const farGeo = new THREE.BoxGeometry(1, 1, 1);
  const farSpots = [
    [-52, 5, -30, 18, 10, 8], [48, 4, -38, 22, 8, 10], [-44, 6, 34, 16, 12, 10],
    [52, 7, 30, 20, 14, 8], [0, 4, -52, 26, 8, 8], [-8, 3, 52, 30, 6, 10],
    [60, 5, 0, 10, 10, 22], [-60, 6, -6, 10, 12, 20],
  ];
  for (const [x, y, z, w, h, d] of farSpots) {
    const mesh = new THREE.Mesh(farGeo, farMat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    group.add(mesh);
  }

  // Light: a hard noon key sun, a warm sky/ground gradient and a cool fill,
  // so faces read and long shadows point the player down the lanes.
  const sky = new THREE.HemisphereLight(new THREE.Color('#ffe9c4'), new THREE.Color(PALETTE.ground), 0.95);
  scene.add(sky);
  const key = new THREE.DirectionalLight(new THREE.Color('#fff2d8'), 2.6);
  key.position.set(24, 34, 18);
  key.target.position.set(0, 0, -2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -34;
  key.shadow.camera.right = 34;
  key.shadow.camera.top = 34;
  key.shadow.camera.bottom = -34;
  key.shadow.camera.far = 110;
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#9db4d6'), 0.5);
  fill.position.set(-18, 14, 20);
  scene.add(fill);

  return {
    colliders,
    shootables,
    group,
    siteRings,
    step(time) {
      // Site rings breathe while their site is the live objective.
      for (const key of Object.keys(siteRings)) {
        const s = 1 + Math.sin(time * 2.4) * 0.04;
        siteRings[key].scale.set(s, s, 1);
      }
    },
  };
}
