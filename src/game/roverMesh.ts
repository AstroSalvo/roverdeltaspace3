import * as THREE from "three";
import { WHEEL_COUNT, WHEEL_RADIUS, WHEEL_WIDTH } from "./constants";
import type { RoverPose, RoverState } from "./rover";

const gold = new THREE.MeshStandardMaterial({
  color: 0xc4a056,
  metalness: 0.72,
  roughness: 0.38,
});
const goldDark = new THREE.MeshStandardMaterial({
  color: 0x8a6a32,
  metalness: 0.65,
  roughness: 0.48,
});
const white = new THREE.MeshStandardMaterial({
  color: 0xe6e2da,
  metalness: 0.15,
  roughness: 0.55,
});
const black = new THREE.MeshStandardMaterial({
  color: 0x161618,
  metalness: 0.4,
  roughness: 0.55,
});
const titan = new THREE.MeshStandardMaterial({
  color: 0x9a9aa2,
  metalness: 0.78,
  roughness: 0.32,
});
const tire = new THREE.MeshStandardMaterial({
  color: 0x3a3a3c,
  metalness: 0.1,
  roughness: 0.82,
});
const grouser = new THREE.MeshStandardMaterial({
  color: 0x8d8d92,
  metalness: 0.55,
  roughness: 0.4,
});
const lamp = new THREE.MeshStandardMaterial({
  color: 0xf2efe6,
  metalness: 0.2,
  roughness: 0.25,
  emissive: 0xd8d0c0,
  emissiveIntensity: 0.45,
});

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, segs = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function makeWheel() {
  const g = new THREE.Group();
  const hub = cyl(WHEEL_RADIUS * 0.42, WHEEL_RADIUS * 0.42, WHEEL_WIDTH * 0.7, titan, 14);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  const rim = cyl(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH * 0.55, tire, 18);
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const disc = cyl(WHEEL_RADIUS * 0.78, WHEEL_RADIUS * 0.78, WHEEL_WIDTH * 0.18, black, 16);
  disc.rotation.z = Math.PI / 2;
  g.add(disc);
  const grouserGeo = new THREE.BoxGeometry(WHEEL_WIDTH * 0.7, 0.045, 0.07);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const m = new THREE.Mesh(grouserGeo, grouser);
    m.position.set(0, Math.sin(a) * WHEEL_RADIUS, Math.cos(a) * WHEEL_RADIUS);
    m.rotation.x = a;
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

type LegView = {
  hipJoint: THREE.Mesh;
  kneeJoint: THREE.Mesh;
  upper: THREE.Mesh;
  lower: THREE.Mesh;
  piston: THREE.Mesh;
  fork: THREE.Group;
  wheel: THREE.Group;
};

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _y = new THREE.Vector3(0, 1, 0);

function placeBone(
  mesh: THREE.Object3D,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  thickScale = 1,
) {
  _from.set(ax, ay, az);
  _to.set(bx, by, bz);
  _dir.subVectors(_to, _from);
  const len = Math.max(0.04, _dir.length());
  _mid.copy(_from).add(_to).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  _quat.setFromUnitVectors(_y, _dir.normalize());
  mesh.quaternion.copy(_quat);
  mesh.scale.set(thickScale, len, thickScale);
}

export type RoverView = {
  group: THREE.Group;
  update: (pose: RoverPose | RoverState) => void;
};

export function buildRoverView(): RoverView {
  const root = new THREE.Group();
  root.name = "rover";

  const posed = new THREE.Group();
  const body = new THREE.Group();
  body.add(box(1.22, 0.34, 1.48, gold, 0, 0.1, 0.02));
  body.add(box(1.12, 0.07, 1.4, white, 0, 0.3, 0.02));
  body.add(box(1.16, 0.14, 0.42, goldDark, 0, 0.16, 0.62));
  body.add(box(0.48, 0.05, 0.08, titan, 0, 0.04, -0.76));
  body.add(box(0.1, 0.07, 0.08, lamp, -0.38, 0.16, -0.74));
  body.add(box(0.1, 0.07, 0.08, lamp, 0.38, 0.16, -0.74));
  posed.add(body);
  root.add(posed);

  const legs: LegView[] = [];
  const upperGeo = new THREE.CylinderGeometry(0.045, 0.055, 1, 8);
  const lowerGeo = new THREE.CylinderGeometry(0.04, 0.035, 1, 8);
  const pistonGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  const jointGeo = new THREE.SphereGeometry(0.07, 12, 10);

  for (let i = 0; i < WHEEL_COUNT; i++) {
    const hipJoint = new THREE.Mesh(jointGeo, gold);
    hipJoint.castShadow = true;
    const kneeJoint = new THREE.Mesh(jointGeo, goldDark);
    kneeJoint.castShadow = true;
    const upper = new THREE.Mesh(upperGeo, titan);
    upper.castShadow = true;
    const lower = new THREE.Mesh(lowerGeo, titan);
    lower.castShadow = true;
    const piston = new THREE.Mesh(pistonGeo, black);
    piston.castShadow = true;
    const fork = new THREE.Group();
    fork.add(box(0.08, 0.16, 0.05, titan, 0, 0, 0));
    const wheel = makeWheel();
    fork.add(wheel);
    root.add(hipJoint, kneeJoint, upper, lower, piston, fork);
    legs.push({ hipJoint, kneeJoint, upper, lower, piston, fork, wheel });
  }

  function update(pose: RoverPose | RoverState) {
    posed.position.set(pose.x, pose.y, pose.z);
    posed.rotation.order = "YXZ";
    posed.rotation.y = pose.yaw;
    posed.rotation.x = pose.pitch;
    posed.rotation.z = pose.roll;

    for (let i = 0; i < WHEEL_COUNT; i++) {
      const w = pose.wheels[i]!;
      const leg = legs[i]!;
      leg.hipJoint.position.set(w.hipX, w.hipY, w.hipZ);
      leg.kneeJoint.position.set(w.kneeX, w.kneeY, w.kneeZ);
      placeBone(leg.upper, w.hipX, w.hipY, w.hipZ, w.kneeX, w.kneeY, w.kneeZ, 1);
      placeBone(leg.lower, w.kneeX, w.kneeY, w.kneeZ, w.x, w.y, w.z, 1);
      placeBone(leg.piston, w.hipX, w.hipY - 0.02, w.hipZ, w.x, w.y + 0.04, w.z, 0.75);
      leg.fork.position.set(w.x, w.y, w.z);
      leg.fork.rotation.order = "YXZ";
      leg.fork.rotation.set(0, pose.yaw + w.steer, 0);
      leg.wheel.rotation.x = w.spin;
    }
  }

  return { group: root, update };
}
