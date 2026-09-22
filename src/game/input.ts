export type Actions = {
  throttle: number;
  steer: number;
  stance: number;
  cameraCycle: boolean;
  reset: boolean;
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "KeyC",
  "KeyR",
  "KeyQ",
  "KeyE",
  "KeyF",
]);

function radialDeadzone(x: number, y: number, dz = 0.16): { x: number; y: number } {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

export function createInput() {
  const keys = new Set<string>();
  let injected: string[] | null = null;
  let steerOverride: number | null = null;
  let touchThrottle = 0;
  let touchSteer = 0;
  let touchActive = false;
  let prevC = false;
  let prevR = false;

  function activeKeys(): Set<string> | string[] {
    return injected ?? keys;
  }

  function has(code: string): boolean {
    const src = activeKeys();
    if (src instanceof Set) return src.has(code);
    return src.includes(code);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    keys.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function clear() {
    keys.clear();
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });

  function setTouch(throttle: number, steer: number, active: boolean) {
    touchThrottle = throttle;
    touchSteer = steer;
    touchActive = active;
  }

  function pollGamepad(actions: Actions) {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad || pad.mapping !== "standard") continue;
      const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      actions.throttle += -stick.y;
      actions.steer += -stick.x;
      if (pad.buttons[12]?.pressed) actions.throttle += 1;
      if (pad.buttons[13]?.pressed) actions.throttle -= 1;
      if (pad.buttons[14]?.pressed) actions.steer += 1;
      if (pad.buttons[15]?.pressed) actions.steer -= 1;
      if (pad.buttons[0]?.pressed) actions.stance = Math.max(actions.stance, 1.38);
      if (pad.buttons[1]?.pressed) actions.stance = Math.min(actions.stance, 0.72);
      if (pad.buttons[2]?.pressed) actions.reset = true;
      if (pad.buttons[3]?.pressed) actions.cameraCycle = true;
      break;
    }
  }

  function sample(): Actions {
    const actions: Actions = {
      throttle: 0,
      steer: 0,
      stance: 1,
      cameraCycle: false,
      reset: false,
    };

    if (has("KeyW") || has("ArrowUp")) actions.throttle += 1;
    if (has("KeyS") || has("ArrowDown")) actions.throttle -= 1;
    if (has("KeyA") || has("ArrowLeft")) actions.steer += 1;
    if (has("KeyD") || has("ArrowRight")) actions.steer -= 1;
    if (has("KeyQ")) actions.steer += 1;
    if (has("KeyE")) actions.steer -= 1;
    if (has("ShiftLeft") || has("ShiftRight")) {
      if (actions.throttle > 0) actions.throttle = 1.35;
    }
    if (has("Space")) actions.stance = 1.42;
    if (has("ControlLeft") || has("ControlRight")) actions.stance = 0.7;

    if (touchActive) {
      actions.throttle += touchThrottle;
      actions.steer += touchSteer;
    }

    pollGamepad(actions);

    if (steerOverride !== null) actions.steer = steerOverride;

    actions.throttle = Math.max(-1.35, Math.min(1.35, actions.throttle));
    actions.steer = Math.max(-1, Math.min(1, actions.steer));

    const c = has("KeyC");
    const r = has("KeyR");
    actions.cameraCycle = c && !prevC;
    actions.reset = r && !prevR;
    prevC = c;
    prevR = r;

    return actions;
  }

  function setKeys(codes: string[]) {
    injected = codes.length ? codes : null;
  }

  function setSteer(v: number) {
    steerOverride = v;
  }

  function dispose() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", clear);
  }

  return { sample, setKeys, setSteer, setTouch, dispose, has };
}

export type InputController = ReturnType<typeof createInput>;
