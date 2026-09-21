import {
  BODY_FOLLOW,
  BODY_RADIUS,
  MAX_SPEED,
  SPAWN,
  TRACK,
  TURN_RATE,
  WHEEL_COUNT,
  WHEEL_LAYOUT,
  WHEEL_RADIUS,
  WHEELBASE,
  WORLD_SIZE,
} from "./constants";
import type { Actions } from "./input";
import type { Terrain } from "./terrain";

export type WheelState = {
  id: string;
  label: string;
  hipLocalX: number;
  hipLocalY: number;
  hipLocalZ: number;
  side: -1 | 1;
  row: "front" | "rear";
  x: number;
  y: number;
  z: number;
  hipX: number;
  hipY: number;
  hipZ: number;
  kneeX: number;
  kneeY: number;
  kneeZ: number;
  contact: boolean;
  lift: number;
  compression: number;
  spin: number;
  steer: number;
  load: number;
};

export type RoverState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  yawRate: number;
  stance: number;
  wheels: WheelState[];
  maxLift: number;
  contacts: number;
};

export type ChassisPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Match three.js Euler order YXZ used by the rover body. */
export function chassisPoint(rover: ChassisPose, lx: number, ly: number, lz: number) {
  const x = rover.pitch;
  const y = rover.yaw;
  const z = rover.roll;
  const c1 = Math.cos(x);
  const c2 = Math.cos(y);
  const c3 = Math.cos(z);
  const s1 = Math.sin(x);
  const s2 = Math.sin(y);
  const s3 = Math.sin(z);
  const m00 = c2 * c3 - s2 * s1 * s3;
  const m10 = c2 * s3 + s2 * s1 * c3;
  const m20 = -s2 * c1;
  const m01 = -c1 * s3;
  const m11 = c1 * c3;
  const m21 = s1;
  const m02 = s2 * c3 + c2 * s1 * s3;
  const m12 = s2 * s3 - c2 * s1 * c3;
  const m22 = c2 * c1;
  return {
    x: rover.x + m00 * lx + m01 * ly + m02 * lz,
    y: rover.y + m10 * lx + m11 * ly + m12 * lz,
    z: rover.z + m20 * lx + m21 * ly + m22 * lz,
  };
}

export function createRover(terrain: Terrain): RoverState {
  const wheels: WheelState[] = WHEEL_LAYOUT.map((w) => ({
    id: w.id,
    label: w.label,
    hipLocalX: w.x * 0.7,
    hipLocalY: 0.06,
    hipLocalZ: w.z,
    side: w.side,
    row: w.row,
    x: 0,
    y: 0,
    z: 0,
    hipX: 0,
    hipY: 0,
    hipZ: 0,
    kneeX: 0,
    kneeY: 0,
    kneeZ: 0,
    contact: true,
    lift: 0,
    compression: 0.2,
    spin: 0,
    steer: 0,
    load: 1 / WHEEL_COUNT,
  }));

  const rover: RoverState = {
    x: SPAWN.x,
    y: 1.2,
    z: SPAWN.z,
    yaw: SPAWN.yaw,
    pitch: 0,
    roll: 0,
    speed: 0,
    yawRate: 0,
    stance: 1,
    wheels,
    maxLift: 0,
    contacts: WHEEL_COUNT,
  };
  snapToGround(rover, terrain);
  return rover;
}

function placeWheels(rover: RoverState, terrain: Terrain, dt: number) {
  const fy = -Math.sin(rover.yaw);
  const fz = -Math.cos(rover.yaw);
  let maxLift = 0;
  let contacts = 0;
  let loadSum = 0;
  const nominal = terrain.sample(rover.x, rover.z) + WHEEL_RADIUS;

  for (const w of rover.wheels) {
    const hip = chassisPoint(rover, w.hipLocalX, w.hipLocalY, w.hipLocalZ);
    const foot = chassisPoint(rover, w.hipLocalX + w.side * 0.34, -0.2, w.hipLocalZ);
    const ground = terrain.sample(foot.x, foot.z);
    const targetY = ground + WHEEL_RADIUS;
    const follow = dt >= 0.2 ? 1 : 1 - Math.exp(-28 * dt);
    w.y = lerp(w.y, targetY, follow);
    w.x = foot.x;
    w.z = foot.z;

    w.lift = Math.max(0, w.y - nominal);
    if (w.lift > maxLift) maxLift = w.lift;

    const hipToWheel = hip.y - w.y;
    w.compression = clamp((0.62 * rover.stance - hipToWheel) / 0.62, 0, 1);
    w.contact = w.y <= targetY + 0.05;
    if (w.contact) contacts += 1;
    w.load = 0.08 + w.compression;
    loadSum += w.load;

    w.hipX = hip.x;
    w.hipY = hip.y;
    w.hipZ = hip.z;

    const dx = w.x - hip.x;
    const dy = w.y - hip.y;
    const dz = w.z - hip.z;
    const along = Math.hypot(dx, dy, dz) || 0.001;
    const extra = Math.max(0, 0.88 - along);
    const bend = extra * 0.9 + 0.08;
    w.kneeX = (hip.x + w.x) * 0.5 + fy * (-0.7 * bend) + w.side * 0.1 * bend;
    w.kneeY = (hip.y + w.y) * 0.5 + 0.02;
    w.kneeZ = (hip.z + w.z) * 0.5 + fz * (-0.7 * bend) + w.side * 0.04 * bend;
  }

  if (loadSum > 0) {
    for (const w of rover.wheels) w.load /= loadSum;
  }
  rover.maxLift = maxLift;
  rover.contacts = contacts;
}

function fitBody(rover: RoverState, dt: number) {
  const wheels = rover.wheels;
  const front = (wheels[0]!.y + wheels[1]!.y) * 0.5;
  const rear = (wheels[2]!.y + wheels[3]!.y) * 0.5;
  const left = (wheels[0]!.y + wheels[2]!.y) * 0.5;
  const right = (wheels[1]!.y + wheels[3]!.y) * 0.5;
  const avg = (front + rear) * 0.5;

  const terrainPitch = Math.atan2(front - rear, WHEELBASE);
  const terrainRoll = Math.atan2(right - left, TRACK);
  rover.pitch = damp(rover.pitch, terrainPitch * BODY_FOLLOW, 7, dt);
  rover.roll = damp(rover.roll, terrainRoll * BODY_FOLLOW, 7, dt);

  const clearance = 0.58 * rover.stance;
  rover.y = damp(rover.y, avg + clearance, 9, dt);
}

export function stepRover(rover: RoverState, terrain: Terrain, actions: Actions, dt: number) {
  rover.stance = damp(rover.stance, actions.stance, 6, dt);

  const traction = rover.contacts / WHEEL_COUNT;
  const sprint = actions.throttle > 1 ? 1.22 : 1;
  const maxSpeed = MAX_SPEED * sprint * (0.5 + 0.5 * traction);
  const want = clamp(actions.throttle, -1, 1) * maxSpeed;
  const accel = actions.throttle !== 0 ? 2.1 : 3.2;
  rover.speed += (want - rover.speed) * Math.min(1, accel * dt);
  rover.speed *= 1 - 0.18 * dt;

  const reverse = rover.speed >= -0.04 ? 1 : -1;
  const speedFactor = 0.4 + 0.6 * Math.min(1, Math.abs(rover.speed) / 3.2);
  const turn = actions.steer * TURN_RATE * speedFactor * reverse;
  rover.yawRate = damp(rover.yawRate, turn, 10, dt);
  rover.yaw += rover.yawRate * dt;

  const fx = -Math.sin(rover.yaw);
  const fz = -Math.cos(rover.yaw);
  rover.x += fx * rover.speed * dt;
  rover.z += fz * rover.speed * dt;

  const limit = WORLD_SIZE / 2 - 3;
  rover.x = clamp(rover.x, -limit, limit);
  rover.z = clamp(rover.z, -limit, limit);

  const blocked = terrain.resolveBody(rover.x, rover.y, rover.z, BODY_RADIUS);
  if (blocked.hit) {
    rover.x = blocked.x;
    rover.z = blocked.z;
    rover.speed *= 0.55;
  }

  const steerVis = actions.steer * 0.48;
  for (const w of rover.wheels) {
    const mag = w.row === "front" ? 1 : -0.7;
    w.steer = damp(w.steer, steerVis * mag, 12, dt);
    w.spin += (rover.speed / WHEEL_RADIUS) * (w.contact ? 1 : 1.35) * dt;
  }

  placeWheels(rover, terrain, dt);
  fitBody(rover, dt);
}

export function snapToGround(rover: RoverState, terrain: Terrain) {
  for (let i = 0; i < 10; i++) {
    placeWheels(rover, terrain, 0.2);
    fitBody(rover, 0.2);
  }
  rover.speed = 0;
  rover.yawRate = 0;
}

export function resetRover(rover: RoverState, terrain: Terrain) {
  rover.x = SPAWN.x;
  rover.z = SPAWN.z;
  rover.yaw = SPAWN.yaw;
  rover.pitch = 0;
  rover.roll = 0;
  rover.speed = 0;
  rover.yawRate = 0;
  rover.stance = 1;
  snapToGround(rover, terrain);
}

export function clonePose(rover: RoverState) {
  return {
    x: rover.x,
    y: rover.y,
    z: rover.z,
    yaw: rover.yaw,
    pitch: rover.pitch,
    roll: rover.roll,
    wheels: rover.wheels.map((w) => ({
      x: w.x,
      y: w.y,
      z: w.z,
      hipX: w.hipX,
      hipY: w.hipY,
      hipZ: w.hipZ,
      kneeX: w.kneeX,
      kneeY: w.kneeY,
      kneeZ: w.kneeZ,
      spin: w.spin,
      steer: w.steer,
      lift: w.lift,
      compression: w.compression,
    })),
  };
}

export type RoverPose = ReturnType<typeof clonePose>;

export function interpPose(a: RoverPose, b: RoverPose, t: number): RoverPose {
  const lerpA = (x: number, y: number) => x + (y - x) * t;
  const lerpAngle = (x: number, y: number) => {
    let d = y - x;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return x + d * t;
  };
  return {
    x: lerpA(a.x, b.x),
    y: lerpA(a.y, b.y),
    z: lerpA(a.z, b.z),
    yaw: lerpAngle(a.yaw, b.yaw),
    pitch: lerpA(a.pitch, b.pitch),
    roll: lerpA(a.roll, b.roll),
    wheels: a.wheels.map((w, i) => {
      const n = b.wheels[i]!;
      return {
        x: lerpA(w.x, n.x),
        y: lerpA(w.y, n.y),
        z: lerpA(w.z, n.z),
        hipX: lerpA(w.hipX, n.hipX),
        hipY: lerpA(w.hipY, n.hipY),
        hipZ: lerpA(w.hipZ, n.hipZ),
        kneeX: lerpA(w.kneeX, n.kneeX),
        kneeY: lerpA(w.kneeY, n.kneeY),
        kneeZ: lerpA(w.kneeZ, n.kneeZ),
        spin: lerpA(w.spin, n.spin),
        steer: lerpA(w.steer, n.steer),
        lift: lerpA(w.lift, n.lift),
        compression: lerpA(w.compression, n.compression),
      };
    }),
  };
}
