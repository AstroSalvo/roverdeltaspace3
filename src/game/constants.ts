export const LUNAR_G = 1.62;

export const WORLD_SIZE = 84;
export const HEIGHT_RES = 168;

export const WHEEL_RADIUS = 0.26;
export const WHEEL_WIDTH = 0.2;
export const LEG_UPPER = 0.42;
export const LEG_LOWER = 0.46;
export const TRACK = 1.68;
export const WHEELBASE = 1.92;

export const ROVER_MASS = 340;
export const MAX_SPEED = 4.4;
export const TURN_RATE = 0.95;
export const BODY_FOLLOW = 0.28;
export const STANCE_CLEARANCE = 0.4;
export const BODY_RADIUS = 0.74;

/** Ellipsoid center as a fraction of ry below (-) the terrain so the dome tapers to the ground. */
export const ROCK_EMBED_K = -0.22;
/** Extra meters on the sampled rock surface so wheels rest on the visual hull. */
export const ROCK_HIT_SKIN = 0.012;

export const SPAWN = { x: 0, z: 2.4, yaw: 0 };

export const FIXED_DT = 1 / 60;
export const MAX_ACCUM = 0.2;

export const WHEEL_LAYOUT = [
  { id: "AS", label: "Ant. sin", x: -TRACK / 2, z: -WHEELBASE / 2, side: -1 as const, row: "front" as const },
  { id: "AD", label: "Ant. des", x: TRACK / 2, z: -WHEELBASE / 2, side: 1 as const, row: "front" as const },
  { id: "PS", label: "Post. sin", x: -TRACK / 2, z: WHEELBASE / 2, side: -1 as const, row: "rear" as const },
  { id: "PD", label: "Post. des", x: TRACK / 2, z: WHEELBASE / 2, side: 1 as const, row: "rear" as const },
] as const;

export const WHEEL_COUNT = WHEEL_LAYOUT.length;

/** Force-debug scale: Newtons → arrow length (m). */
export const FORCE_ARROW_SCALE = 0.0018;
