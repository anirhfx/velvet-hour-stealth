# velvet-hour-stealth

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/anirhfx/velvet-hour-stealth/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/anirhfx/velvet-hour-stealth/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Velvet Hour** is an original top-down stealth game built for the make.fun **“Make the best stealth game”** bounty. You are Wren, a cat burglar in the Marlow Gallery after dark: slip past patrolling guards, lift the Starlight Opal, pocket the side artifacts, and reach the service exit unseen.

No existing commercial game's names, characters, art, music or levels anywhere in this game — the gallery, the guards, the story and the sounds are all original.

## Play it

Open `game/index.html` in a desktop browser, or serve the folder:

```sh
node serve.ts
# then open http://localhost:8080
```

## Controls

- **WASD / arrows** — move
- **Shift** — run (fast, but loud: guards hear footsteps)
- **C** — sneak (slow, hard to spot, especially in shadow)
- **Mouse click** — throw a pebble to distract a guard (3 per wing)
- **P / Esc** — pause · **M** — mute

## What is in the game

- Three wings — the Marble Wing, the Vault Hall and the Rooftop Garden — each a hand-built level with its own patrol routes
- Guards with vision cones and line of sight blocked by walls, crates, pedestals and hedges
- A suspicion system with recovery: guards get curious, investigate, chase, then search and give up — breaking line of sight is always a way out
- Shadow floor that makes you harder to see, cover you can read at a glance, and noise that draws guards to a point
- A HUD with the alarm meter, artifacts, pebbles, timer and score, plus a live minimap
- Procedural sound and ambient music (WebAudio synthesis — no audio files)
- A save in the browser: best score and furthest wing reached
- Deterministic screenshot scenes: `?shot=start|play|alert|end|caught&seed=1`

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
