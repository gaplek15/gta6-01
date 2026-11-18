// Keyboard + mouse input: WASD/arrows, Shift run, Space jump/handbrake,
// E interact/enter, F punch, T taxi, Esc pause, mouse orbit (pointer lock
// when playing, drag fallback) and click-to-shoot.
export function createInput(game) {
  const input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    run: false,
    jump: false,
    handbrake: false,
    mouseDX: 0,
    mouseDY: 0,
    clicked: false,
    keys: {},
  };

  const keyMap = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run',
    Space: 'jump',
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') input.handbrake = true;
    if (keyMap[e.code] !== undefined) {
      input[keyMap[e.code]] = true;
      if (e.code === 'Space') e.preventDefault();
    }
    if (e.code === 'KeyE') game.onPressE();
    if (e.code === 'KeyF') game.onPressF();
    if (e.code === 'KeyT') game.onPressT();
    if (e.code === 'Escape') game.onPressEsc();
    if (e.code === 'Enter') game.onPressEnter();
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') input.handbrake = false;
    if (keyMap[e.code] !== undefined) input[keyMap[e.code]] = false;
    input.keys[e.code] = false;
  });

  const canvas = document.getElementById('game');
  canvas.addEventListener('click', () => {
    if (game.state === 'play' && !document.pointerLockElement) {
      canvas.requestPointerLock();
    }
    input.clicked = true;
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  // Drag fallback when pointer lock is unavailable (e.g. headless).
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (dragging && document.pointerLockElement !== canvas) {
      input.mouseDX += e.clientX - lastX;
      input.mouseDY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  // Consume the accumulated mouse delta each frame (orbit the camera).
  input.consumeMouse = () => {
    const dx = input.mouseDX;
    const dy = input.mouseDY;
    input.mouseDX = 0;
    input.mouseDY = 0;
    return { dx, dy };
  };
  input.consumeClick = () => {
    const c = input.clicked;
    input.clicked = false;
    return c;
  };
  return input;
}
