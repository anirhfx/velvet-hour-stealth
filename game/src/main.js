// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between six screens: title, play, paused, caught, level clear and win.
//
// ?seed=N fixes the patrol pattern. ?shot=start|play|alert|end|caught (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_CAUGHT,
  EVENT_GEM,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_SUSPICIOUS,
  EVENT_WIN,
  resetRun,
  stepWorld,
  throwPebble,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PEBBLE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_CAUGHT,
  SCREEN_LEVEL_CLEAR,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(value) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(value));
  } catch {
    // See saveBest.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  const save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let footstepTimer = 0;
  let wasSuspicious = false;
  let levelClearMessage = '';

  // A read-only handle for automated play tests (and curious players):
  // window.__velvet.world is the live state, window.__velvet.screen the screen.
  window.__velvet = {
    world,
    screen: () => screen,
  };

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetRun(world);
    input.takeClick(); // a click that started the game is not also a pebble
    audio.unlock();
    audio.startAmbient();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.level.name}. ${world.level.intro}`);
  }

  function finishRun() {
    if (world.score > best) {
      best = world.score;
      saveBest(best);
    }
    writeSave({ best, wing: world.levelIndex + 1, score: world.score });
    audio.stopAmbient();
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_GEM) {
      audio.gem();
      audio.door();
    }
    if (events & EVENT_SPOTTED) audio.alert();
    if (events & EVENT_SUSPICIOUS && !wasSuspicious) audio.suspicious();
    if (events & EVENT_CAUGHT) {
      audio.caught();
      screen = SCREEN_CAUGHT;
      finishRun();
      announce(`Caught. Score ${world.score}. Best ${best}.`);
    }
    if (events & EVENT_WIN) {
      if (world.status === 'won') {
        audio.win();
        screen = SCREEN_WIN;
        finishRun();
        announce(`You escaped with the opal. Final score ${world.score}. Best ${best}.`);
      } else {
        audio.win();
        levelClearMessage = `Next wing: ${world.level.name}.`;
        screen = SCREEN_LEVEL_CLEAR;
        announce(`Wing cleared. ${levelClearMessage}`);
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_WIN) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_LEVEL_CLEAR) {
      input.takeClick();
      screen = SCREEN_PLAY;
      announce(`Playing ${world.level.name}.`);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    // On the title the gallery idles: guards walk their patrols behind it.
    const move = screen === SCREEN_TITLE ? { x: 0, y: 0 } : input.direction();
    const events = stepWorld(world, move, screen === SCREEN_PLAY && input.crouching(), screen === SCREEN_PLAY && input.running());
    if (screen === SCREEN_PLAY) handleEvents(events);
    // Footsteps: soft while walking or sneaking, louder while running.
    const player = world.player;
    if (screen === SCREEN_PLAY && player.moving && world.status === 'playing') {
      footstepTimer -= STEP;
      if (footstepTimer <= 0) {
        audio.footstep(player.running);
        footstepTimer = player.running ? 0.26 : player.crouching ? 0.55 : 0.38;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // A click while playing throws a pebble at that spot; a click anywhere
    // else is a confirm, handled above, and never reaches here as a pebble.
    if (screen === SCREEN_PLAY) {
      const click = input.takeClick();
      if (click && throwPebble(world, click.x, click.y)) audio.pebble();
    } else {
      input.takeClick();
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const suspicion = world.guards.reduce((max, guard) => Math.max(max, guard.suspicion), 0);
    wasSuspicious = suspicion >= 0.55 && suspicion < 1;
    renderer.draw(world, screen, best, levelClearMessage);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A click on the canvas unlocks audio; the input layer turns it into a start or a pebble.
  canvas.addEventListener('mousedown', () => audio.unlock());

  announce(
    save && save.wing > 1
      ? `Velvet Hour. Best score ${best}, furthest wing ${save.wing}. Press Enter or click to start.`
      : 'Velvet Hour. Press Enter or click to start.',
  );
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
