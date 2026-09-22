import * as THREE from "three";
import {
  FIXED_DT,
  FORCE_ARROW_SCALE,
  LUNAR_G,
  MAX_ACCUM,
  ROVER_MASS,
  WHEEL_COUNT,
} from "./constants";
import { createInput, type InputController } from "./input";
import { buildRoverView } from "./roverMesh";
import {
  chassisPoint,
  clonePose,
  createRover,
  interpPose,
  resetRover,
  stepRover,
  type RoverPose,
} from "./rover";
import { createTerrain } from "./terrain";
import { buildDust, buildWorld } from "./worldMesh";

export type HudSnapshot = {
  speed: number;
  yaw: number;
  pitch: number;
  roll: number;
  stance: number;
  maxLift: number;
  contacts: number;
  x: number;
  z: number;
  camera: number;
  pov: boolean;
  playing: boolean;
  showForces: boolean;
  wheels: Array<{ id: string; label: string; lift: number; compression: number }>;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer: (v: number) => void;
  setKeys: (codes: string[]) => void;
  getLift: () => number;
  getPeakLift: () => number;
  getPos: () => { x: number; z: number; y: number };
  getCamera: () => number;
  getSteer: () => number;
  getYawRate: () => number;
  setCamera: (mode: number) => void;
  reset: () => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

type ChaseCam = { kind: "chase"; dist: number; height: number; look: number; fov: number };
type PovCam = { kind: "pov"; fov: number };
type CamMode = ChaseCam | PovCam;

const CAM_MODES: CamMode[] = [
  { kind: "chase", dist: 7.4, height: 2.35, look: 0.7, fov: 52 },
  { kind: "chase", dist: 11.5, height: 5.2, look: 0.4, fov: 52 },
  { kind: "chase", dist: 3.6, height: 1.55, look: 0.9, fov: 48 },
  { kind: "pov", fov: 70 },
];

export const POV_CAM_INDEX = CAM_MODES.findIndex((m) => m.kind === "pov");

export const EMPTY_HUD: HudSnapshot = {
  speed: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  stance: 1,
  maxLift: 0,
  contacts: WHEEL_COUNT,
  x: 0,
  z: 0,
  camera: 0,
  pov: false,
  playing: false,
  showForces: false,
  wheels: [],
};

export type EngineHandle = {
  dispose: () => void;
  setPlaying: (v: boolean) => void;
  setTouch: InputController["setTouch"];
  cycleCamera: () => void;
  toggleForces: () => void;
  reset: () => void;
  getHud: () => HudSnapshot;
  subscribe: (fn: () => void) => () => void;
};

function makeForceArrow(color: number) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1, 6),
    new THREE.MeshBasicMaterial({ color, depthTest: true }),
  );
  shaft.position.y = 0.5;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.12, 8),
    new THREE.MeshBasicMaterial({ color, depthTest: true }),
  );
  head.position.y = 1.06;
  group.add(shaft, head);
  group.visible = false;
  return group;
}

function setArrow(group: THREE.Group, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) {
    group.visible = false;
    return;
  }
  group.visible = true;
  group.position.set(ox, oy, oz);
  group.scale.set(1, len, 1);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  group.quaternion.copy(quat);
}

export function createEngine(canvas: HTMLCanvasElement, onHud: () => void): EngineHandle {
  const terrain = createTerrain();
  const rover = createRover(terrain);
  let prev = clonePose(rover);
  let curr = clonePose(rover);
  let playing = false;
  let camMode = 0;
  let snapCam = true;
  let hudDirty = 0;
  let hudCache: HudSnapshot = EMPTY_HUD;
  let peakLift = 0;
  let lastSteer = 0;
  let showForces = false;
  let prevF = false;

  const input = createInput();
  const listeners = new Set<() => void>();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.08, 400);
  camera.position.set(0, 4, 10);

  const sun = new THREE.DirectionalLight(0xfff1d6, 3.35);
  sun.position.set(28, 46, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const earthShine = new THREE.DirectionalLight(0x8fb4ff, 0.22);
  earthShine.position.set(-40, 30, -50);
  scene.add(earthShine);
  scene.add(new THREE.AmbientLight(0x101014, 0.12));
  scene.add(new THREE.HemisphereLight(0x0c1018, 0x1a1814, 0.16));

  const world = buildWorld(terrain);
  scene.add(world.root);
  const roverView = buildRoverView();
  scene.add(roverView.group);
  roverView.update(rover);
  const dust = buildDust();
  scene.add(dust.points);

  const forceGroup = new THREE.Group();
  forceGroup.visible = false;
  scene.add(forceGroup);
  const gravityArrow = makeForceArrow(0x4488ff);
  forceGroup.add(gravityArrow);
  const driveArrow = makeForceArrow(0xffcc33);
  forceGroup.add(driveArrow);
  const normalArrows = Array.from({ length: WHEEL_COUNT }, () => {
    const a = makeForceArrow(0x44dd66);
    forceGroup.add(a);
    return a;
  });

  const camPos = new THREE.Vector3(2, 4, 10);
  const camLook = new THREE.Vector3();
  const camDesired = new THREE.Vector3();
  const lookDesired = new THREE.Vector3();
  const _n = { x: 0, y: 1, z: 0 };

  let acc = 0;
  let last = performance.now();
  let disposed = false;
  let dustAcc = 0;

  function resize() {
    const parent = canvas.parentElement ?? canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement ?? canvas);

  function snapshot(): HudSnapshot {
    return {
      speed: rover.speed,
      yaw: rover.yaw,
      pitch: rover.pitch,
      roll: rover.roll,
      stance: rover.stance,
      maxLift: rover.maxLift,
      contacts: rover.contacts,
      x: rover.x,
      z: rover.z,
      camera: camMode,
      pov: CAM_MODES[camMode]?.kind === "pov",
      playing,
      showForces,
      wheels: rover.wheels.map((w) => ({
        id: w.id,
        label: w.label,
        lift: w.lift,
        compression: w.compression,
      })),
    };
  }

  function notify() {
    hudCache = snapshot();
    onHud();
    listeners.forEach((fn) => fn());
  }
  hudCache = snapshot();

  function setFov(fov: number) {
    if (Math.abs(camera.fov - fov) < 0.01) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  function applyCamera(pose: RoverPose, dt: number) {
    const mode = CAM_MODES[camMode]!;
    if (mode.kind === "pov") {
      const eye = chassisPoint(pose, 0, 0.62, -0.88);
      const aim = chassisPoint(pose, 0, 0.36, -18);
      camDesired.set(eye.x, eye.y, eye.z);
      lookDesired.set(aim.x, aim.y, aim.z);
      setFov(mode.fov);
    } else {
      const fx = -Math.sin(pose.yaw);
      const fz = -Math.cos(pose.yaw);
      camDesired.set(pose.x - fx * mode.dist, pose.y + mode.height, pose.z - fz * mode.dist);
      lookDesired.set(pose.x + fx * 1.2, pose.y + mode.look, pose.z + fz * 1.2);
      setFov(mode.fov);
    }
    const k = snapCam ? 1 : 1 - Math.exp((mode.kind === "pov" ? -18 : -3.6) * dt);
    snapCam = false;
    camPos.lerp(camDesired, k);
    camLook.lerp(lookDesired, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function updateForces() {
    if (!showForces) {
      forceGroup.visible = false;
      return;
    }
    forceGroup.visible = true;
    const weight = ROVER_MASS * LUNAR_G;
    setArrow(gravityArrow, rover.x, rover.y + 0.15, rover.z, 0, -weight * FORCE_ARROW_SCALE, 0);

    const traction = rover.contacts / WHEEL_COUNT;
    const driveN =
      Math.abs(rover.speed) > 0.05
        ? Math.min(weight * 0.35, Math.abs(rover.speed) * 80) * traction
        : 0;
    const fx = -Math.sin(rover.yaw);
    const fz = -Math.cos(rover.yaw);
    const sign = rover.speed >= 0 ? 1 : -1;
    setArrow(
      driveArrow,
      rover.x,
      rover.y + 0.4,
      rover.z,
      fx * driveN * FORCE_ARROW_SCALE * sign,
      0,
      fz * driveN * FORCE_ARROW_SCALE * sign,
    );

    for (let i = 0; i < WHEEL_COUNT; i++) {
      const w = rover.wheels[i]!;
      const arrow = normalArrows[i]!;
      if (!w.contact) {
        arrow.visible = false;
        continue;
      }
      terrain.sampleNormal(w.x, w.z, _n);
      const nForce = weight * w.load;
      setArrow(
        arrow,
        w.x,
        w.y - 0.02,
        w.z,
        _n.x * nForce * FORCE_ARROW_SCALE,
        _n.y * nForce * FORCE_ARROW_SCALE,
        _n.z * nForce * FORCE_ARROW_SCALE,
      );
    }
  }

  function physicsStep(dt: number) {
    prev = curr;
    const actions = playing
      ? input.sample()
      : { throttle: 0, steer: 0, stance: 1, cameraCycle: false, reset: false };
    if (actions.cameraCycle) {
      camMode = (camMode + 1) % CAM_MODES.length;
      snapCam = true;
    }
    if (actions.reset) resetRover(rover, terrain);
    lastSteer = actions.steer;
    stepRover(rover, terrain, actions, dt);
    if (rover.maxLift > peakLift) peakLift = rover.maxLift;
    curr = clonePose(rover);

    const fDown = input.has("KeyF");
    if (fDown && !prevF) {
      showForces = !showForces;
      notify();
    }
    prevF = fDown;

    dustAcc += dt;
    if (dustAcc > 0.045 && Math.abs(rover.speed) > 0.35) {
      dustAcc = 0;
      const fx = -Math.sin(rover.yaw);
      const fz = -Math.cos(rover.yaw);
      for (const w of rover.wheels) {
        if (w.contact && Math.random() > 0.4) {
          dust.emit(w.x, w.y - 0.18, w.z, fx * rover.speed, fz * rover.speed);
        }
      }
    }
  }

  const loop = () => {
    if (disposed) return;
    const now = performance.now();
    let dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    if (acc > MAX_ACCUM) acc = MAX_ACCUM;
    while (acc >= FIXED_DT) {
      physicsStep(FIXED_DT);
      acc -= FIXED_DT;
    }
    const alpha = acc / FIXED_DT;
    const pose = interpPose(prev, curr, alpha);
    roverView.update(pose);
    dust.update(dt);
    applyCamera(pose, dt);
    updateForces();

    sun.target.position.set(pose.x, pose.y, pose.z);
    sun.position.set(pose.x + 28, pose.y + 46, pose.z + 16);
    sun.target.updateMatrixWorld();

    renderer.render(scene, camera);

    hudDirty += dt;
    if (hudDirty > 0.08) {
      hudDirty = 0;
      notify();
    }
  };

  renderer.setAnimationLoop(loop);

  window.__controlsTest = {
    getYaw: () => rover.yaw,
    getSpeed: () => rover.speed,
    setKeys: (codes) => input.setKeys(codes),
    setSteer: (v) => input.setSteer(v),
    getLift: () => rover.maxLift,
    getPeakLift: () => peakLift,
    getPos: () => ({ x: rover.x, z: rover.z, y: rover.y }),
    getCamera: () => camMode,
    getSteer: () => lastSteer,
    getYawRate: () => rover.yawRate,
    setCamera: (mode) => {
      camMode = ((mode % CAM_MODES.length) + CAM_MODES.length) % CAM_MODES.length;
      snapCam = true;
      notify();
    },
    reset: () => {
      resetRover(rover, terrain);
      prev = clonePose(rover);
      curr = clonePose(rover);
      peakLift = 0;
    },
  };

  function dispose() {
    disposed = true;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    input.dispose();
    world.albedo.dispose();
    renderer.dispose();
    if (window.__controlsTest) delete window.__controlsTest;
  }

  return {
    dispose,
    setPlaying: (v) => {
      playing = v;
      notify();
    },
    setTouch: input.setTouch,
    cycleCamera: () => {
      camMode = (camMode + 1) % CAM_MODES.length;
      snapCam = true;
      notify();
    },
    toggleForces: () => {
      showForces = !showForces;
      notify();
    },
    reset: () => {
      resetRover(rover, terrain);
      prev = clonePose(rover);
      curr = clonePose(rover);
      notify();
    },
    getHud: () => hudCache,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
