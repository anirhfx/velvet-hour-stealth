# Velvet Hour — build log

Top-down stealth game for the make.fun **“Make the best stealth game”** bounty
(`best-stealth-game-20261121-1759`, $50, closes Sat 22 Nov 2026 12:59 WIB).
Built 2026-11-22 ~05:30–06:00 WIB by a Muse subagent, in a fresh git repo.

## What was built

**Velvet Hour** — you are Wren, a cat burglar in the Marlow Gallery after dark.
Steal the Starlight Opal, pocket the side artifacts, reach the service exit unseen.
All names, art, story and sounds are original.

| File | What it does |
|---|---|
| `game/index.html` | 1280×720 canvas page, module script, screen-reader status line |
| `game/src/config.js` | Constants + 3 hand-built levels (Marble Wing, Vault Hall, Rooftop Garden) |
| `game/src/random.js` | Seeded RNG (mulberry32) so seeds replay identically |
| `game/src/input.js` | Keyboard (WASD/arrows, Shift run, C sneak, P pause, M mute) + mouse clicks |
| `game/src/audio.js` | WebAudio synthesis only — footsteps, alert sting, pickup, gem, door, win/lose, ambient pad |
| `game/src/level.js` | Tile map parsing, collision, line of sight, flood fill, BFS pathfinding |
| `game/src/guards.js` | Guard AI: patrol / suspicious / alert / search, vision cones, suspicion meter |
| `game/src/world.js` | Game state: player, pebbles, pickups, gem, exit, noise, win/caught |
| `game/src/render.js` | Canvas drawing: floor, shadow pools, cones, HUD, minimap, all six screens |
| `game/src/shots.js` | Deterministic `?shot=start\|play\|alert\|end\|caught&seed=1` scenes |
| `game/src/main.js` | Boot, fixed-step loop, screens, best-score + progress save, `window.__velvet` test handle |
| `main.ts` | Entrypoint: copies `game/` + `screenshots/`, writes `dossier.json` via `vendor/makefun-game.ts` |
| `vendor/makefun-game.ts` | Kit library, copied unchanged |
| `serve.ts` | Tiny static dev server (`node serve.ts` → http://localhost:8080) |
| `shots.json` | 4 shots: start, play, alert, end (all `&seed=1`) |
| `screenshots/1-start.jpg`, `2-play.jpg`, `3-alert.jpg`, `4-end.jpg` | Real renders of the game's own code, 1280×720, 45–48 KiB each |
| `LICENSE` | MIT, copyright Ani Rohani |
| `README.md` | Entry README with make.fun badges (owner `anirhfx`, repo `velvet-hour-stealth`) |
| `.makefun/owner.json` | Wallet `DUL85HUYW91grnwd3H2E9aP8TZXKDZfQhYbd3UuFQHFb` (linked on the make.fun profile 2026-11-22) |

### The game

- Three wings, each a hand-built 32×18 tile level with its own patrol routes; rooms
  joined by door gaps so guards and the player can cross them.
- Guards with vision cones and line of sight blocked by walls, crates, pedestals
  and hedges; a suspicion meter that fills when you are seen (faster up close,
  slower crouched or in shadow) and drains when you hide; guards get curious,
  investigate, chase, then search the last seen spot and give up.
- Noise: running feet pulse a noise radius; a thrown pebble (click, 3 per wing)
  draws guards to the landing point.
- Shadow floor that makes you harder to see; cover readable at a glance.
- HUD with alarm meter, artifacts, pebbles, timer and score, plus a live minimap.
- Browser save: best score and furthest wing reached.
- Deterministic screenshot scenes: `?shot=start|play|alert|end|caught&seed=1`.

## Tests run (all on this machine, 2026-11-22)

1. **Syntax:** `node --input-type=module --check` on all 10 game modules — all pass.
2. **Logic sim** (`/tmp/stealth-test/test.mjs`, headless, imports the game modules
   directly — 40 checks, all pass):
   - every level map is 18×32, has one start/gem/exit, all artifacts, gem and exit
     reachable, every guard waypoint on a walkable tile;
   - guards see the player in front but not behind, walls block line of sight,
     crouching reduces visibility;
   - a staring guard raises the alarm; a fleeing player breaks sight and the
     guard calms down and returns to patrol;
   - a pebble makes a guard suspicious and walk toward it;
   - an alerted guard catches a still player;
   - a BFS autopilot clears level 1 (gem then exit, score 937);
   - all five `stageShot` scenes are deterministic and stage the right screen.
3. **Browser test** (headless Chromium via CDP, `file://` — the sandbox blocks
   loopback HTTP; the Hatch Chromium needs the WebGL domain-policy switches
   `--hatch-webgl-allowed-domains-file` / `--hatch-webgl-allowed-domains-sha256`
   with the `hatch-webgl-all-origins-v1` policy file): title → Enter → walk with
   the keyboard → pause/resume → click to throw a pebble, and all four `?shot=`
   scenes reaching `__shotReady` — **zero page/console/request errors, zero
   external requests**. Play-through state: title → play, walk moved the player
   (60,60) → (266,228), pebble 3 → 2 with a guard's suspicion rising to 0.39.
   Screenshots visually checked: title, near-miss with a suspicious guard,
   red-cone chase, win screen.
4. **Dossier:** `MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts` and a second run into
   `/tmp/out2` — byte-identical (`diff -r` clean). `dossier.json` 312,208 bytes;
   text 61,210 bytes (cap 163,840, no truncation); all 11 source files included
   whole; 4 screenshots copied.
5. **Gate limits:** screenshots 45–48 KiB each (cap 256 KiB), 1280×720 (long side
   ≤ 1280, short side ≥ 480); `game/` is 12 plain files, no symlinks;
   `index.html` 816 bytes (cap 1 MiB); no `http:`/`https:`/`fetch` anywhere in
   `game/`.

## Bugs found and fixed during the build

- **Level maps sealed off:** the first maps had full-height wall columns with no
  door gaps, so the gem, exit and artifacts were unreachable. Rebuilt all three
  maps as four rooms with door gaps and re-validated reachability by flood fill.
- **Row-length typos:** 13 map rows were 31 or 33 chars instead of 32; fixed each
  to the exact segment counts and re-checked.
- **Guards stuck on walls:** guards first walked straight at waypoints and jammed
  against walls. Added BFS pathfinding (`findPath` in `level.js`) and made
  guards follow tile paths, rebuilding the chase path twice a second.
- **Vault Hall waypoint on a pedestal:** guard route point (19,9) sat on a `P`
  tile; moved the route to (18,9)/(18,5).
- **`stepWorld` not imported in `main.js`:** the game loop threw
  `ReferenceError: stepWorld is not defined` every frame, so the live game never
  advanced (the shot scenes were unaffected — they stage state directly). Caught
  by the CDP play-through, fixed by adding the import, re-tested clean.

## Not done (needs the parent agent / user)

- Nothing was submitted, no GitHub repo was created, nothing was pushed, no
  login and no wallet/key/seed was touched.
- The GitHub repo still needs creating as `anirhfx/velvet-hour-stealth` (the name
  the README badges use) with About set per the requirements (`repo_about.gh`),
  then the entry bundled and submitted before Sat 22 Nov 2026 12:59 WIB.
- Transcripts: this bounty is not a strict/recorded-only one
  (`transcripts_witnessed` does not apply), and the coordinator confirmed the
  kit's bundle finds these Muse app sessions as recorded sessions — so bundle
  the sessions from the top-level agent when submitting; no Superbot rebuild
  is needed for this bounty.
