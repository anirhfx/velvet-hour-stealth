// Keyboard and mouse input. Movement keys are polled every frame; the rest are
// one-shot actions the game consumes with takeActions().

export const ACTION_CONFIRM = 1 << 0; // Enter / Space / click: start, retry, advance
export const ACTION_PAUSE = 1 << 1; // P / Escape: pause and resume
export const ACTION_MUTE = 1 << 2; // M: mute and unmute
export const ACTION_PEBBLE = 1 << 3; // mouse click while playing: throw a pebble
export const ACTION_CROUCH = 1 << 4; // held: C or Control — sneak (slow, hard to see)
export const ACTION_RUN = 1 << 5; // held: Shift — run (fast, noisy)

const MOVE_KEYS = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export function createInput(canvas) {
  const down = new Set();
  let queued = 0;
  let clickPoint = null;

  function onKeyDown(event) {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.repeat) return;
    down.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') queued |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
  }

  function onKeyUp(event) {
    down.delete(event.code);
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    clickPoint = {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
    queued |= ACTION_PEBBLE | ACTION_CONFIRM;
  }

  function onBlur() {
    down.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised movement direction from the keys held down, or {x:0,y:0}. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of down) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** True while the crouch key is held. */
    crouching() {
      return down.has('KeyC') || down.has('ControlLeft') || down.has('ControlRight');
    },
    /** True while the run key is held. */
    running() {
      return down.has('ShiftLeft') || down.has('ShiftRight');
    },
    /** One-shot actions since the last call; also takes the last click point. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    /** The last mouse click in canvas pixels, or null; consumed on read. */
    takeClick() {
      const point = clickPoint;
      clickPoint = null;
      return point;
    },
  };
}
