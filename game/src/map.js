// Dustline Depot: the map as data. Three lanes (west containers, mid tower
// plaza, east warehouse) between the south spawn and two bomb sites north:
// A Silo (west) and B Depot (east). Every entry is one axis-aligned box
// [w, h, d, x, y, z, material] or one cylinder {x, z, r, h, material}; the
// world builds meshes and colliders from these, and the bots walk the
// waypoint graph below. Nothing here copies any commercial map.
export const MAP = {
  bounds: { minX: -28, maxX: 28, minZ: -22, maxZ: 22 },
  sites: {
    A: { x: -20, z: -14, r: 4.2, name: 'A — Silo' },
    B: { x: 20, z: -14, r: 4.2, name: 'B — Depot' },
  },
  playerSpawn: { x: 0, z: 18, yaw: 0 },
  botSpawns: [
    { x: -20, z: -18.5 },
    { x: -11, z: -19 },
    { x: -2, z: -18.5 },
    { x: 9, z: -19 },
    { x: 20, z: -18.5 },
  ],
};

// Ground-standing boxes use y = h / 2; stacked ones give their own y.
export const BOXES = [
  // ground + perimeter
  [56, 0.4, 44, 0, -0.2, 0, 'ground'],
  [0.6, 4.5, 44.6, -28.3, 2.25, 0, 'wall'],
  [0.6, 4.5, 44.6, 28.3, 2.25, 0, 'wall'],
  [56.6, 4.5, 0.6, 0, 2.25, -22.3, 'wall'],
  [56.6, 4.5, 0.6, 0, 2.25, 22.3, 'wall'],
  // central tower: base, column, beacon (the mid landmark)
  [7, 2.5, 7, 0, 1.25, -2, 'darkwall'],
  [2.2, 7, 2.2, 0, 6, -2, 'wall'],
  [2.8, 0.8, 2.8, 0, 9.9, -2, 'accent'],
  [0.3, 4, 0.3, 0, 12.3, -2, 'darkwall'],
  // site A — silo yard (cylinders below) + crates + low walls
  [3.6, 1.1, 1.2, -14, 0.55, -11, 'darkwall'],
  [1.2, 1.1, 3.6, -25, 0.55, -10, 'darkwall'],
  [1.2, 1.2, 1.2, -23.5, 0.6, -12, 'ochre'],
  [1.2, 1.2, 1.2, -16.5, 0.6, -17.5, 'ochre'],
  [1.2, 1.2, 1.2, -22, 0.6, -18, 'teal'],
  [2.4, 0.9, 1.2, -19, 0.45, -9, 'rust'],
  // site B — depot containers + crates
  [6, 2.6, 2.4, 17, 1.3, -17.5, 'steel'],
  [6, 2.6, 2.4, 23, 1.3, -17.5, 'rust'],
  [6, 2.6, 2.4, 20, 3.9, -17.5, 'teal'],
  [1.2, 1.2, 1.2, 15, 0.6, -11.5, 'ochre'],
  [1.2, 1.2, 1.2, 24.5, 0.6, -11, 'steel'],
  [2.4, 0.9, 1.2, 20, 0.45, -9.5, 'darkwall'],
  // west lane
  [6, 2.6, 2.4, -14, 1.3, 6, 'rust'],
  [6, 2.6, 2.4, -16, 1.3, -6, 'teal'],
  [1.2, 1.2, 1.2, -10, 0.6, 10, 'ochre'],
  [1.2, 1.2, 1.2, -19, 0.6, 1, 'steel'],
  [2.4, 1.1, 0.6, -18, 0.55, -1.5, 'darkwall'],
  [1.2, 1.2, 1.2, -8, 0.6, -4, 'rust'],
  // east lane — warehouse block + containers
  [12, 4, 6, 16, 2, 4, 'darkwall'],
  [6, 2.6, 2.4, 14, 1.3, -8, 'ochre'],
  [1.2, 1.2, 1.2, 10, 0.6, 12, 'teal'],
  [1.2, 1.2, 1.2, 22, 0.6, 10, 'rust'],
  [2.4, 1.1, 0.6, 18, 0.55, -1.5, 'darkwall'],
  [1.2, 1.2, 1.2, 8, 0.6, -5, 'steel'],
  // mid lane
  [1.2, 1.2, 1.2, -4, 0.6, 6, 'teal'],
  [1.2, 1.2, 1.2, 4, 0.6, 6, 'rust'],
  [1.2, 1.2, 1.2, -4, 0.6, -7.5, 'ochre'],
  [1.2, 1.2, 1.2, 4, 0.6, -7.5, 'steel'],
  [2.4, 1.1, 0.6, -3, 0.55, -11, 'darkwall'],
  [2.4, 1.1, 0.6, 3, 0.55, -11, 'darkwall'],
  // spawn cover
  [2.4, 1.1, 0.6, -4, 0.55, 14, 'darkwall'],
  [2.4, 1.1, 0.6, 4, 0.55, 14, 'darkwall'],
  [1.2, 1.2, 1.2, 0, 0.6, 11, 'ochre'],
];

export const CYLINDERS = [
  // site A silos
  { x: -23, z: -16, r: 2, h: 5.5, material: 'steel' },
  { x: -17, z: -17, r: 1.8, h: 4.5, material: 'rust' },
  // barrels scattered as cover
  { x: -6, z: 13, r: 0.55, h: 1.1, material: 'rust' },
  { x: 6, z: 13, r: 0.55, h: 1.1, material: 'teal' },
  { x: -24, z: 4, r: 0.55, h: 1.1, material: 'ochre' },
  { x: 24, z: 2, r: 0.55, h: 1.1, material: 'steel' },
  { x: -2, z: -15, r: 0.55, h: 1.1, material: 'rust' },
  { x: 2, z: -15, r: 0.55, h: 1.1, material: 'teal' },
];

// Waypoint graph the bots walk. Nodes are [x, z]; edges are index pairs.
export const NODES = [
  [0, 18], // 0 spawn
  [0, 12], // 1 mid-south
  [-14, 8], // 2 west-mid
  [14, 8], // 3 east-mid
  [-5, -2], // 4 plaza west
  [5, -2], // 5 plaza east
  [-14, -6], // 6 west-north
  [14, -6], // 7 east-north
  [-14, -11], // 8 site A approach
  [14, -11], // 9 site B approach
  [-20, -14], // 10 site A
  [20, -14], // 11 site B
  [0, -12], // 12 north-mid
  [-20, 12], // 13 west-south
  [20, 12], // 14 east-south
  [-8, -8], // 15 mid-north-west
  [8, -8], // 16 mid-north-east
];

export const EDGES = [
  [0, 1], [0, 13], [0, 14], [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 6], [2, 13], [3, 7], [3, 14], [4, 6], [4, 15], [5, 7], [5, 16],
  [6, 8], [7, 9], [8, 10], [8, 15], [9, 11], [9, 16],
  [12, 15], [12, 16], [15, 8], [16, 9],
];

const ADJ = NODES.map(() => []);
for (const [a, b] of EDGES) {
  ADJ[a].push(b);
  ADJ[b].push(a);
}

export function nearestNode(x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < NODES.length; i += 1) {
    const dx = NODES[i][0] - x;
    const dz = NODES[i][1] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Breadth-first path over the graph; returns node indices from start to goal.
export function findPath(from, to) {
  if (from === to) return [from];
  const prev = new Array(NODES.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const next of ADJ[cur]) {
      if (prev[next] !== -1) continue;
      prev[next] = cur;
      if (next === to) {
        const path = [to];
        let at = to;
        while (at !== from) {
          at = prev[at];
          path.unshift(at);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [from, to];
}

export function siteAt(x, z) {
  for (const key of Object.keys(MAP.sites)) {
    const site = MAP.sites[key];
    const dx = x - site.x;
    const dz = z - site.z;
    if (dx * dx + dz * dz <= site.r * site.r) return key;
  }
  return null;
}
