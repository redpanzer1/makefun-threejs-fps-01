# Dustline Depot — design brief, loop contract, level plan

Game for make.fun threejs-fps-01. Original desert freight yard, CS-style
round-based tactical FPS, single player (Vanguard, attacker) vs 5 bots
(Jackals, defenders). Desktop Chrome, pointer lock + WASD.

## Design brief
- Player promise: one attacker against five defenders — out-aim, out-think,
  plant the bomb or wipe the site.
- Feeling: tense, deliberate, fair. Stopping to aim pays; spraying while
  sprinting does not.
- Primary verb: aim and fire. Secondary: move with purpose, manage money,
  plant/defuse, throw a grenade.
- Every 5–30 s the player: picks a lane, clears an angle, spends or saves.
- Across 1–5 min: rounds escalate (better guns both sides), money snowballs
  or dries up, the bomb forces a fight at a site.
- Lose: eliminated, timer expires without a plant, bomb defused. Each end
  names the reason, so the next round teaches.
- Reward: money per kill/plant/win, spent in the buy menu. Risk: dying
  loses bought weapons; the bomb carrier must commit to a site.
- A better player: holds angles, buys to the round, uses sound (shots pull
  bots), plants where defenders are thin.
- Non-goals: multiplayer, mobile touch controls, purchased assets, any
  copied map/name/art (no Counter-Strike anything; weapon names are ours).

## Core loop contract
Player aims and fires to eliminate defenders or plant the bomb while the
round timer and five bots create risk; success gives money and the round,
failure costs bought weapons and the round.
- Verb mapped: mouse look + click fire, R reload, 1–6 weapons, G grenade,
  E plant, B buy, Ctrl crouch/slide, Shift sprint, RMB aim-down-sights.
- Objective visible: site markers A/B in the world and on the minimap,
  compass + timer + hostiles in the HUD, buy menu between rounds.
- Pressure inside the first minute: buy phase 15 s, then bots patrol the
  lanes and investigate gunfire.
- Reward changes state: money buys weapons/armor/grenades that persist.
- Failure teaches: round-over panel names the cause.
- Restart is fast: next round starts in seconds, no reload.

## Level plan — Dustline Depot (56 x 44 m)
- Three lanes: west (containers), mid (tower plaza), east (warehouse).
- Player spawn south (0, 18). Sites north: A Silo (west, -20, -14),
  B Depot (east, 20, -14). Landmark: central tower (0, -2) splits mid.
- First decision: which lane, which site. First threat: a patrolling bot
  on mid or a lane within ~10 s of live. First reward: a kill pays $300.
- Cover: rust/teal/steel/ochre containers, crates, barrels, low barriers,
  silo cylinders, warehouse block. Sightlines are long down lanes, broken
  at mid by the tower and crates.
- Bot routes: waypoint graph along the lanes; bots hold near sites,
  patrol between site nodes, investigate gunfire, rotate to a planted bomb,
  defuse when they reach it.
- Recovery beats: buy phase between rounds; armor and grenades in the shop.
- Telegraphs: bomb site markers glow, plant/defuse progress rings, tracers
  show where fire came from, beeps accelerate as the bomb timer runs down.

## Feel (from threejs-game-skills game-feel.md)
- Trauma shake (trauma^2, capped, decaying): hit 0.4, kill 0.3, explosion 0.7.
- Hitstop 60–90 ms on kill and explosion (gameplay delta only).
- FOV punch +4–6 deg on slide and explosion; ADS narrows FOV per weapon.
- Impact flash on bot materials; pitch-varied shots; all randomness through
  the seeded rng so ?shot= captures are deterministic.

## Graphics bar (from visual-scorecard.md)
- Target premium: every category >= 2, average >= 2.3.
- Procedural CanvasTextures (corrugated containers, concrete, sand) instead
  of flat colors; ACES tone mapping; key + fill + rim light; shadows.
- Authored viewmodels (receiver, rails, scope, mag, stock), readable bot
  silhouettes (tan uniform, dark vest, red headband, weapon in hand).
- Event VFX only: tracers, impact sparks, muzzle flash, explosion, damage
  vignette — no fog/bloom standing in for geometry.

## Progress
- 2026-11-15: kit init attempted — competition opens 2026-11-16T17:00:00Z,
  init must be re-run then (anchor round 34015012). Repo created manually,
  starter copied, three.js hashes verified byte-for-byte.
- Built: main.ts (rewritten), serve.ts (rewritten), palette, rng, state, audio.
- Next: map, world, physics, player, weapons, bots, grenade, bomb, round,
  effects, hud, input, main, index.html; then node checks, dossier, serve.
- Still open: real screenshots (parent, browser task after play-test),
  Playwright smoke test + bot playtest (parent, browser task), GitHub repo
  create + push, submission (parent, after opening, user approval).
