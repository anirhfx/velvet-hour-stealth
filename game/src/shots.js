// The screenshot scenes behind ?shot=start|play|alert|end. Each one stages a
// real game state — the world is reset, then either played forward with a
// fixed scripted input or placed into a named situation — and the real
// renderer paints it, so the frame is what the game really looks like and the
// same seed always gives the same frame.

import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { EVENT_CAUGHT, EVENT_WIN, loadLevel, stepWorld } from './world.js';

const START_SECONDS = 6;
const STEP = 1 / 60;

/** One leg of a scripted walk: direction, seconds, crouch, run. */
function walkScript(world, legs) {
  for (const leg of legs) {
    const steps = Math.round(leg.seconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      const events = stepWorld(world, { x: leg.x, y: leg.y }, !!leg.crouch, !!leg.run);
      if (events & (EVENT_CAUGHT | EVENT_WIN)) return;
    }
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the title, like the game does before it starts.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    loadLevel(world, 0);
    // Wren slips down the left wing, crouches past the guard walking the
    // sixth column, and freezes as he turns toward her — suspicious, not yet
    // certain. The frame catches the near miss.
    walkScript(world, [
      { x: 1, y: 0, seconds: 0.8 },
      { x: 0, y: 1, seconds: 3.0 },
      { x: 1, y: 0, seconds: 1.5 },
      { x: 0, y: 1, seconds: 1.0, crouch: true },
      { x: -1, y: 0, seconds: 0.6, crouch: true },
    ]);
    return { screen: SCREEN_PLAY, best: 100 };
  }
  if (name === 'alert') {
    loadLevel(world, 0);
    // Caught in the open: a guard has the alarm up and is running Wren down
    // while a second guard hurries over, suspicious.
    const player = world.player;
    player.x = 560;
    player.y = 300;
    const chaser = world.guards[1];
    chaser.x = 560;
    chaser.y = 430;
    chaser.angle = -Math.PI / 2;
    chaser.state = 'alert';
    chaser.suspicion = 1;
    chaser.lastSeen = { x: player.x, y: player.y };
    const second = world.guards[0];
    second.x = 420;
    second.y = 200;
    second.angle = Math.PI / 4;
    second.state = 'suspicious';
    second.suspicion = 0.7;
    second.lastSeen = { x: player.x, y: player.y };
    walkScript(world, [{ x: 1, y: 0, seconds: 0.5, run: true }]);
    return { screen: SCREEN_PLAY, best: 100 };
  }
  if (name === 'end') {
    loadLevel(world, 2);
    world.gemTaken = true;
    world.exitOpen = true;
    world.artifactsTaken = 2;
    world.score = 1150;
    for (const artifact of world.level.artifacts) artifact.taken = true;
    world.status = 'won';
    world.time = 172;
    return { screen: SCREEN_WIN, best: 1150 };
  }
  if (name === 'caught') {
    loadLevel(world, 0);
    world.status = 'caught';
    world.score = 100;
    world.time = 48;
    return { screen: SCREEN_CAUGHT, best: 100 };
  }
  // start: the title over a live, patrolling gallery.
  loadLevel(world, 0);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    stepWorld(world, { x: 0, y: 0 }, false, false);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
