// Keyboard and mouse, and the pointer lock that turns the mouse into look.
// Plain browser APIs only. justPressed is the edge set: keys pressed since
// the last frame, consumed by main.js once per frame so a single press never
// fires twice. Right mouse is aim-down-sights; the wheel cycles weapons.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const justPressed = new Set();
  const state = { keys, justPressed, locked: false, firing: false, aiming: false, lookX: 0, lookY: 0, wheel: 0 };

  function setKey(event, down) {
    if (event.repeat) return;
    if (down) {
      keys.add(event.code);
      justPressed.add(event.code);
    } else {
      keys.delete(event.code);
    }
    if (event.code === 'Space') event.preventDefault();
  }

  window.addEventListener('keydown', (event) => setKey(event, true));
  window.addEventListener('keyup', (event) => setKey(event, false));
  window.addEventListener('blur', () => {
    keys.clear();
    state.firing = false;
    state.aiming = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      state.firing = false;
      state.aiming = false;
    }
  });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.aiming = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.aiming = false;
  });
  window.addEventListener('wheel', (event) => {
    if (!state.locked) return;
    state.wheel += event.deltaY > 0 ? 1 : -1;
  }, { passive: true });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      state.firing = false;
      state.aiming = false;
    }
    onLockChange(state.locked);
  });

  return {
    state,
    requestLock() {
      canvas.requestPointerLock();
    },
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
    takeWheel() {
      const w = state.wheel;
      state.wheel = 0;
      return w;
    },
    clearPressed() {
      justPressed.clear();
    },
  };
}
