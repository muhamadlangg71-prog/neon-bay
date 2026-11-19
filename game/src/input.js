// Keyboard + mouse (pointer lock) input. The game reads named actions each step,
// never raw key codes — so the controls are one table, not scattered checks.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_RELOAD = 'reload';
export const ACTION_HANDBRAKE = 'handbrake';

const KEY_TO_ACTION = {
  KeyE: ACTION_ENTER_CAR,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  Space: ACTION_HANDBRAKE,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
};

// Keys whose browser default (scroll, etc.) would fight the game.
const SWALLOW = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  const tapped = new Set();
  let lookX = 0;
  let lookY = 0;
  let mouseHeld = false;
  let clickQueued = false;
  let locked = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_TO_ACTION[event.code];
    if (action) tapped.add(action);
    if (SWALLOW.has(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseMove(event) {
    if (!locked) return;
    lookX += event.movementX || 0;
    lookY += event.movementY || 0;
  }
  function onMouseDown(event) {
    if (event.button !== 0) return;
    mouseHeld = true;
    clickQueued = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseHeld = false;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  const ACTION_TO_KEY = {};
  for (const [code, action] of Object.entries(KEY_TO_ACTION)) ACTION_TO_KEY[action] = code;

  return {
    /** Held movement keys as -1/0/1 (x: strafe right, y: forward). */
    move() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    run() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Mouse delta since the last read; reading clears it. */
    look() {
      const d = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return d;
    },
    shootHeld() {
      return mouseHeld;
    },
    shootClicked() {
      const c = clickQueued;
      clickQueued = false;
      return c;
    },
    /** True once when the action's key was pressed; reading clears it. */
    wasPressed(action) {
      const hit = tapped.has(action);
      tapped.delete(action);
      return hit;
    },
    /** True while the action's key is held down. */
    isHeld(action) {
      const code = ACTION_TO_KEY[action];
      return code ? held.has(code) : false;
    },
    clearPressed() {
      tapped.clear();
    },
    lockPointer() {
      if (locked) return;
      // A click queued on the title screen (e.g. on NEW GAME) must not fire the
      // pistol the moment play starts.
      clickQueued = false;
      try {
        // requestPointerLock returns a promise in Chrome; a rejected one (no
        // user gesture yet) must not surface as an unhandled error.
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        // Pointer lock can fail (headless, iframe): the game still plays with keys.
      }
    },
    unlockPointer() {
      if (locked) document.exitPointerLock();
    },
    isLocked() {
      return locked;
    },
  };
}
