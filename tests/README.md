# Headless tests (Node 24, no browser, no WebGL)

Run from anywhere on this VM:

  node --import tests/register-three.mjs tests/smoke.mjs    # 31 checks: map graph, player, weapons, bot AI, bomb, rounds, grenades
  node --import tests/register-three.mjs tests/smoke2.mjs   # 3 checks: 60 s wander (no stalls), rotate + defuse
  node tests/audit-edges.mjs                                # waypoint-edge clearance vs boxes/cylinders (bot radius 0.34 m)

The game modules import bare `three`, so the loader maps it to the vendored
`game/vendor/three/three.module.min.js`. `document` is stubbed for the
procedural canvas textures in `world.js`.
