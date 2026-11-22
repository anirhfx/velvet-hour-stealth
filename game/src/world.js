// The world: one level's live state — the player, the guards, the loot, the
// exit and the clock. Pure logic, no DOM: the headless test drives it too.

import { LEVELS, NOISE, PLAYER, SCORE, STEP } from './config.js';
import { createGuard, guardHearsNoise, maxSuspicion, stepGuard, anyAlert } from './guards.js';
import { isShadow, moveCircle, parseLevel, tileAtPixel } from './level.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1 << 0;
export const EVENT_GEM = 1 << 1;
export const EVENT_SPOTTED = 1 << 2;
export const EVENT_CALMED = 1 << 3;
export const EVENT_CAUGHT = 1 << 4;
export const EVENT_WIN = 1 << 5;
export const EVENT_PEBBLE = 1 << 6;
export const EVENT_NOISE = 1 << 7;
export const EVENT_SUSPICIOUS = 1 << 8;

export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    level: null,
    player: null,
    guards: [],
    pebbles: [],
    pebbleCount: NOISE.pebbleCount,
    artifactsTaken: 0,
    gemTaken: false,
    exitOpen: false,
    time: 0,
    score: 0,
    status: 'playing', // playing | caught | won
    noisePulse: 0,
    stepCount: 0,
    runTime: 0, // footsteps heard while running, for the sound layer
  };
  loadLevel(world, 0);
  return world;
}

export function loadLevel(world, index) {
  world.levelIndex = index;
  world.level = parseLevel(LEVELS[index]);
  world.player = {
    x: world.level.start.x,
    y: world.level.start.y,
    crouching: false,
    running: false,
    moving: false,
    facing: -Math.PI / 2,
  };
  world.guards = world.level.guards.map((spawn) => createGuard(spawn));
  world.pebbles = [];
  world.pebbleCount = NOISE.pebbleCount;
  world.artifactsTaken = 0;
  world.gemTaken = false;
  world.exitOpen = false;
  world.time = 0;
  world.status = 'playing';
  world.noisePulse = 0;
  world.stepCount = 0;
}

/** Start over from level one, keeping the score at zero. */
export function resetRun(world) {
  world.score = 0;
  world.runTime = 0;
  loadLevel(world, 0);
}

/**
 * Throw a pebble at a canvas point: it lands there, clinks, and every guard
 * in earshot walks over to look. Returns false when no pebble is left.
 */
export function throwPebble(world, x, y) {
  if (world.status !== 'playing' || world.pebbleCount <= 0) return false;
  world.pebbleCount -= 1;
  world.pebbles.push({ x, y, age: 0 });
  for (const guard of world.guards) guardHearsNoise(guard, x, y, NOISE.pebbleRadius);
  return true;
}

/**
 * Advance the world one fixed step. `move` is a normalised {x, y} direction,
 * `crouching` and `running` are the held keys. Returns an event bitmask.
 */
export function stepWorld(world, move, crouching, running, dt = STEP) {
  if (world.status !== 'playing') return EVENT_NONE;
  let events = EVENT_NONE;
  const player = world.player;
  const level = world.level;
  world.time += dt;
  world.stepCount += 1;

  // --- Player movement -------------------------------------------------
  player.crouching = crouching;
  player.running = running && !crouching && (move.x !== 0 || move.y !== 0);
  player.moving = move.x !== 0 || move.y !== 0;
  const speed = crouching ? PLAYER.crouch : player.running ? PLAYER.run : PLAYER.walk;
  if (player.moving) {
    player.facing = Math.atan2(move.y, move.x);
    const moved = moveCircle(level, player.x, player.y, move.x * speed * dt, move.y * speed * dt, PLAYER.radius);
    player.x = moved.x;
    player.y = moved.y;
  }

  // Running feet make noise on a pulse; guards in earshot investigate.
  if (player.running) {
    world.noisePulse -= dt;
    if (world.noisePulse <= 0) {
      world.noisePulse = NOISE.runPulse;
      events |= EVENT_NOISE;
      for (const guard of world.guards) guardHearsNoise(guard, player.x, player.y, NOISE.runRadius);
    }
  }

  // --- Pebbles fade ----------------------------------------------------
  for (const pebble of world.pebbles) pebble.age += dt;
  world.pebbles = world.pebbles.filter((pebble) => pebble.age < 1.2);

  // --- Pickups ---------------------------------------------------------
  for (const artifact of level.artifacts) {
    if (!artifact.taken && Math.hypot(artifact.x - player.x, artifact.y - player.y) < 24) {
      artifact.taken = true;
      world.artifactsTaken += 1;
      world.score += SCORE.artifact;
      events |= EVENT_PICKUP;
    }
  }
  if (!world.gemTaken && Math.hypot(level.gem.x - player.x, level.gem.y - player.y) < 26) {
    world.gemTaken = true;
    world.exitOpen = true;
    world.score += SCORE.gem;
    events |= EVENT_GEM;
  }

  // --- Guards ----------------------------------------------------------
  const wasAlert = anyAlert(world.guards);
  for (const guard of world.guards) {
    const event = stepGuard(level, guard, player, dt);
    if (event === 'spotted') events |= EVENT_SPOTTED;
    if (event === 'calmed') events |= EVENT_CALMED;
  }
  if (!wasAlert && anyAlert(world.guards)) events |= EVENT_SPOTTED;
  const suspicion = maxSuspicion(world.guards);
  if (suspicion >= 0.55 && suspicion < 1) events |= EVENT_SUSPICIOUS;

  // Caught: an alerted guard reaches the player.
  for (const guard of world.guards) {
    if (guard.state === 'alert' && Math.hypot(guard.x - player.x, guard.y - player.y) < 26) {
      world.status = 'caught';
      return events | EVENT_CAUGHT;
    }
  }

  // --- Exit ------------------------------------------------------------
  if (
    world.exitOpen &&
    Math.hypot(level.exit.x - player.x, level.exit.y - player.y) < 26
  ) {
    const par = level.par;
    const timeBonus = Math.max(0, Math.round((par - world.time) * SCORE.timeBonusPerSecond));
    world.score += timeBonus;
    if (world.levelIndex + 1 < LEVELS.length) {
      loadLevel(world, world.levelIndex + 1);
      return events | EVENT_WIN; // level cleared; main.js advances the screen
    }
    world.status = 'won';
    return events | EVENT_WIN;
  }

  return events;
}

/** The player is standing in shadow — the renderer's lighting hint. */
export function playerInShadow(world) {
  return isShadow(world.level, world.player.x, world.player.y);
}

/** The tile under the player, for tests and the HUD. */
export function playerTile(world) {
  return tileAtPixel(world.level, world.player.x, world.player.y);
}
