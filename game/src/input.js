// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (start, pause, enter car, horn, mission list, mute) are queued as
// bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. The mouse position is kept in screen
// pixels and converted to world coordinates by the caller.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_HORN = 8;
export const ACTION_MISSIONS = 16;
export const ACTION_MUTE = 32;
export const ACTION_TAXI = 64;

const MOVE = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, shift: false, space: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    const dir = MOVE[event.code];
    if (dir) {
      held[dir] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { held.shift = true; return; }
    if (event.code === 'Space') { held.space = true; event.preventDefault(); return; }
    if (event.repeat) return;
    if (event.code === 'Enter' || event.code === 'KeyF') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    else if (event.code === 'KeyM') actions |= ACTION_MISSIONS;
    else if (event.code === 'KeyN') actions |= ACTION_MUTE;
    else if (event.code === 'KeyT') actions |= ACTION_TAXI;
  });
  window.addEventListener('keyup', (event) => {
    const dir = MOVE[event.code];
    if (dir) held[dir] = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.shift = false;
    if (event.code === 'Space') held.space = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.shift = held.space = false;
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouseDown = true; mouseClicked = true; }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse() { return { x: mouseX, y: mouseY }; },
    mouseHeld() { return mouseDown; },
    /** True once for each click since the last call. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
