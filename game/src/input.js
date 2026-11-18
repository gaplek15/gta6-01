// Keyboard and mouse input.
// One job: turn raw DOM events into a clean per-frame state (held keys,
// keys pressed this frame, and mouse-drag camera deltas).
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    isDown(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    // Arrow keys also steer the camera, so mouse and keyboard both work.
    cameraDX() {
      let dx = mouseDX;
      if (keys.has('ArrowLeft')) dx -= 6;
      if (keys.has('ArrowRight')) dx += 6;
      return dx;
    },
    cameraDY() {
      let dy = mouseDY;
      if (keys.has('ArrowUp')) dy -= 3;
      if (keys.has('ArrowDown')) dy += 3;
      return dy;
    },
    // Call once per frame, after the game has read the input.
    endFrame() {
      pressed.clear();
      mouseDX = 0;
      mouseDY = 0;
    },
    // Test hooks: let the screenshot autopilot press keys.
    injectDown(code) { keys.add(code); pressed.add(code); },
    injectUp(code) { keys.delete(code); },
  };
}
