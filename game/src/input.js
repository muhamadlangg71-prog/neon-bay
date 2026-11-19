// Keyboard + mouse (pointer lock) input. Actions are named; the game reads them each step.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_HANDBRAKE = 'handbrake';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let locked = false;

  const KEY_ACTIONS = {
    KeyE: ACTION_ENTER_CAR,
    KeyF: ACTION_PUNCH,
    Space: ACTION_HANDBRAKE,
    Escape: ACTION_PAUSE,
    Enter: ACTION_CONFIRM,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) pressed.add(action);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
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

  const ACTION_KEYS = {};
  for (const [code, action] of Object.entries(KEY_ACTIONS)) ACTION_KEYS[action] = code;

  return {
    /** Held movement keys as -1/0/1 (x: strafe right, y: forward). */
    move() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** Mouse delta since the last read; reading clears it. */
    look() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    shootHeld() {
      return mouseDown;
    },
    shootClicked() {
      const c = mouseClicked;
      mouseClicked = false;
      return c;
    },
    /** True once when the action's key was pressed; reading clears it. */
    wasPressed(action) {
      const hit = pressed.has(action);
      pressed.delete(action);
      return hit;
    },
    /** True while the action's key is held down. */
    isHeld(action) {
      const code = ACTION_KEYS[action];
      return code ? keys.has(code) : false;
    },
    clearPressed() {
      pressed.clear();
    },
    lockPointer() {
      if (!locked) {
        try {
          canvas.requestPointerLock();
        } catch {
          // Pointer lock can fail (headless, iframe): the game still plays with keys.
        }
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
