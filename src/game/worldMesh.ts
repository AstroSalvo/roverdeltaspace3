import * as THREE from "three";
import { WORLD_SIZE } from "./constants";
import type { Rock, Terrain } from "./terrain";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeEarthTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1a3a78";
  ctx.fillRect(0, 0, 512, 256);
  const drawLand = (x: number, y: number, rx: number, ry: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawLand(90, 90, 70, 50, "#2f6a3a");
  drawLand(70, 110, 40, 28, "#4a7a3e");
  drawLand(200, 70, 55, 38, "#3d6b3a");
  drawLand(310, 130, 90, 40, "#356338");
  drawLand(400, 80, 50, 55, "#2c5a34");
  drawLand(470, 140, 40, 30, "#3a6840");
  ctx.fillStyle = "rgba(240,246,255,0.55)";
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 97) % 512,
      40 + ((i * 53) % 180),
      30 + (i % 5) * 8,
      8 + (i % 3) * 3,
      i * 0.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.fillStyle = "#e8eef6";
  ctx.fillRect(0, 0, 512, 18);
  ctx.fillRect(0, 238, 512, 18);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeAlbedo(terrain: Terrain) {
  const res = 512;
  const c = document.createElement("canvas");
  c.width = res;
  c.height = res;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(res, res);
  const half = WORLD_SIZE / 2;
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const wx = (x / (res - 1)) * WORLD_SIZE - half;
      const wz = (y / (res - 1)) * WORLD_SIZE - half;
      const ix = Math.floor((x / (res - 1)) * (terrain.res - 1));
      const iz = Math.floor((y / (res - 1)) * (terrain.res - 1));
      const h = terrain.heights[iz * terrain.res + ix]!;
      const n = 0.52 + h * 0.08 + ((x * 13 + y * 7) % 9) * 0.004;
      let crater = 0;
      for (const cr of terrain.craters) {
        const t = Math.hypot(wx - cr.x, wz - cr.z) / cr.r;
        if (t < 1) crater += (1 - t) * 0.18;
      }
      const r = (0.42 + n * 0.18 - crater) * 255;
      const g = (0.4 + n * 0.16 - crater * 0.9) * 255;
      const b = (0.36 + n * 0.14 - crater * 0.7) * 255;
      const i = (y * res + x) * 4;
      img.data[i] = Math.max(40, Math.min(200, r));
      img.data[i + 1] = Math.max(38, Math.min(190, g));
      img.data[i + 2] = Math.max(34, Math.min(175, b));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Irregular rock: higher subdivision + multi-octave radial displacement.
 * Lower hemisphere compressed so it embeds into the ground.
 * Collision still uses the (rx, ry, rz) ellipsoid envelope.
 */
function makeRockGeometry(seed: number) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position!;
  const rand = mulberry32(seed);

  const displace = (x: number, y: number, z: number) => {
    const n1 = Math.sin(x * 4.1 + y * 3.7 + z * 2.9 + seed * 0.01) * 0.5 + 0.5;
    const n2 = Math.sin(x * 9.3 - y * 7.1 + z * 5.5 + 17.3) * 0.5 + 0.5;
    const n3 = Math.sin(x * 15.2 + y * 11.8 - z * 8.4 + 41.7) * 0.5 + 0.5;
    return 0.78 + n1 * 0.22 + n2 * 0.12 + n3 * 0.06;
  };

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;
    let r = displace(nx, ny, nz);
    if (y < 0) {
      r *= 0.45 + 0.35 * (1 + y);
    }
    r *= 0.94 + rand() * 0.12;
    x = nx * r;
    y = ny * r;
    z = nz * r;
    pos.setXYZ(i, x, y, z);
  }

  let maxR = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y >= -0.1) maxR = Math.max(maxR, Math.hypot(x, y, z));
  }
  if (maxR > 1e-6) {
    const s = 1 / maxR;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
    }
  }

  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const shade = 0.88 + rand() * 0.18;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.97;
    colors[i * 3 + 2] = shade * 0.93;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function placeRocks(
  rocks: Rock[],
  geos: THREE.BufferGeometry[],
  material: THREE.MeshStandardMaterial,
  dummy: THREE.Object3D,
  color: THREE.Color,
) {
  const groups: Rock[][] = [[], [], []];
  for (const r of rocks) {
    groups[r.variant % 3]!.push(r);
  }
  const meshes: THREE.InstancedMesh[] = [];
  groups.forEach((list, vi) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geos[vi]!, material, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    list.forEach((r, i) => {
      dummy.position.set(r.x, r.cy, r.z);
      dummy.rotation.set(
        (r.variant * 0.31) % (Math.PI * 0.15),
        r.rotY,
        (r.variant * 0.19) % (Math.PI * 0.12),
      );
      dummy.scale.set(r.rx, r.ry, r.rz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(r.color);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    meshes.push(mesh);
  });
  return meshes;
}

export function buildWorld(terrain: Terrain) {
  const root = new THREE.Group();
  const half = WORLD_SIZE / 2;

  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, terrain.res - 1, terrain.res - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ix = Math.round(((x + half) / WORLD_SIZE) * (terrain.res - 1));
    const iz = Math.round(((z + half) / WORLD_SIZE) * (terrain.res - 1));
    const clampedIx = Math.max(0, Math.min(terrain.res - 1, ix));
    const clampedIz = Math.max(0, Math.min(terrain.res - 1, iz));
    const h = terrain.heights[clampedIz * terrain.res + clampedIx] ?? 0;
    pos.setY(i, h);
    const shade = 0.55 + h * 0.06;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 0.98;
    colors[i * 3 + 2] = shade * 0.92;
  }
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const albedo = makeAlbedo(terrain);
  const mat = new THREE.MeshStandardMaterial({
    map: albedo,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    color: 0xc8c2b8,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  ground.castShadow = true;
  root.add(ground);

  const rockGeos = [makeRockGeometry(0x91a2), makeRockGeometry(0xc31d), makeRockGeometry(0x5e07)];
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.04,
    flatShading: false,
    vertexColors: true,
  });
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (const mesh of placeRocks(terrain.rocks, rockGeos, rockMat, dummy, color)) {
    root.add(mesh);
  }

  const pebbleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.03,
    flatShading: true,
  });
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, terrain.pebbles.length);
  pebbles.castShadow = true;
  pebbles.receiveShadow = true;
  pebbles.frustumCulled = false;
  terrain.pebbles.forEach((r, i) => {
    dummy.position.set(r.x, r.cy, r.z);
    dummy.rotation.set(0, r.rotY, 0);
    dummy.scale.set(r.rx, r.ry, r.rz);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    color.setHex(r.color);
    pebbles.setColorAt(i, color);
  });
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  root.add(pebbles);

  root.add(makeStars());

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(6.5, 32, 24),
    new THREE.MeshBasicMaterial({ map: makeEarthTexture() }),
  );
  earth.position.set(-42, 38, -70);
  root.add(earth);
  const earthGlow = new THREE.Mesh(
    new THREE.SphereGeometry(7.1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x6ea4ff, transparent: true, opacity: 0.12 }),
  );
  earthGlow.position.copy(earth.position);
  root.add(earthGlow);

  return { root, ground, albedo };
}

function makeStars() {
  const n = 1800;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 220 + Math.random() * 40;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xf2f4ff, size: 0.55, sizeAttenuation: true }),
  );
}

export function buildDust() {
  const n = 220;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) positions[i * 3 + 1] = -20;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xb7aea2,
    size: 0.11,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  const life = new Float32Array(n);
  const vel = new Float32Array(n * 3);
  let cursor = 0;

  function emit(x: number, y: number, z: number, fx: number, fz: number) {
    const i = cursor % n;
    cursor += 1;
    positions[i * 3] = x + (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
    vel[i * 3] = -fx * 0.4 + (Math.random() - 0.5) * 0.3;
    vel[i * 3 + 1] = 0.35 + Math.random() * 0.5;
    vel[i * 3 + 2] = -fz * 0.4 + (Math.random() - 0.5) * 0.3;
    life[i] = 0.8 + Math.random() * 0.5;
  }

  function update(dt: number) {
    for (let i = 0; i < n; i++) {
      if (life[i]! <= 0) {
        positions[i * 3 + 1] = -20;
        continue;
      }
      life[i]! -= dt;
      vel[i * 3 + 1]! -= 1.62 * dt;
      positions[i * 3]! += vel[i * 3]! * dt;
      positions[i * 3 + 1]! += vel[i * 3 + 1]! * dt;
      positions[i * 3 + 2]! += vel[i * 3 + 2]! * dt;
    }
    geo.attributes.position!.needsUpdate = true;
  }

  return { points, emit, update };
}
