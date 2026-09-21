import { HEIGHT_RES, ROCK_EMBED_K, ROCK_HIT_SKIN, WORLD_SIZE } from "./constants";

export type Rock = {
  x: number;
  z: number;
  /** World-space ellipsoid radii — identical to the rendered instance scale. */
  rx: number;
  ry: number;
  rz: number;
  /** World Y of the ellipsoid center (slightly below terrain). */
  cy: number;
  baseY: number;
  rotY: number;
  cosY: number;
  sinY: number;
  color: number;
  variant: number;
};

export type Crater = {
  x: number;
  z: number;
  r: number;
  depth: number;
};

export type Terrain = {
  size: number;
  res: number;
  heights: Float32Array;
  rocks: Rock[];
  pebbles: Rock[];
  craters: Crater[];
  sample: (x: number, z: number) => number;
  groundAt: (x: number, z: number) => number;
  sampleNormal: (x: number, z: number, out?: { x: number; y: number; z: number }) => {
    x: number;
    y: number;
    z: number;
  };
  /** Push a body circle out of rock slices and the lander. Returns true if blocked. */
  resolveBody: (x: number, y: number, z: number, radius: number) => {
    x: number;
    z: number;
    hit: boolean;
  };
};

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

function fade(t: number) {
  return t * t * (3 - 2 * t);
}

function makeValueNoise(rand: () => number, dim = 64) {
  const grid = new Float32Array(dim * dim);
  for (let i = 0; i < grid.length; i++) grid[i] = rand() * 2 - 1;
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = fade(x - xi);
    const ty = fade(y - yi);
    const x0 = ((xi % dim) + dim) % dim;
    const y0 = ((yi % dim) + dim) % dim;
    const x1 = (x0 + 1) % dim;
    const y1 = (y0 + 1) % dim;
    const a = grid[y0 * dim + x0]!;
    const b = grid[y0 * dim + x1]!;
    const c = grid[y1 * dim + x0]!;
    const d = grid[y1 * dim + x1]!;
    const u = a + (b - a) * tx;
    const v = c + (d - c) * tx;
    return u + (v - u) * ty;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct = 5) {
  let s = 0;
  let a = 1;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += noise(x * f, y * f) * a;
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

function craterProfile(t: number, depth: number, rim: number) {
  if (t >= 1.18) return 0;
  const bowl = t < 1 ? -depth * (1 - t * t) * (1 - t * t) : 0;
  const u = (t - 0.92) / 0.16;
  const rimH = rim * Math.exp(-u * u);
  return bowl + rimH;
}

function localXZ(rock: Rock, x: number, z: number) {
  const dx = x - rock.x;
  const dz = z - rock.z;
  return {
    lx: dx * rock.cosY + dz * rock.sinY,
    lz: -dx * rock.sinY + dz * rock.cosY,
  };
}

/** Upper ellipsoid surface, or null if (x,z) is outside the rock's ground footprint. */
export function rockSurfaceY(rock: Rock, x: number, z: number): number | null {
  const { lx, lz } = localXZ(rock, x, z);
  const n2 = (lx * lx) / (rock.rx * rock.rx) + (lz * lz) / (rock.rz * rock.rz);
  if (n2 >= 0.999) return null;
  const upper = rock.cy + rock.ry * Math.sqrt(1 - n2) + ROCK_HIT_SKIN;
  if (upper <= rock.baseY + 0.004) return null;
  return upper;
}

function makeRock(
  x: number,
  z: number,
  rx: number,
  rz: number,
  peak: number,
  rotY: number,
  color: number,
  variant: number,
  bilinear: (x: number, z: number) => number,
): Rock {
  const baseY = bilinear(x, z);
  const k = ROCK_EMBED_K;
  const ry = peak / (1 + k);
  return {
    x,
    z,
    rx,
    ry,
    rz,
    cy: baseY + k * ry,
    baseY,
    rotY,
    cosY: Math.cos(rotY),
    sinY: Math.sin(rotY),
    color,
    variant,
  };
}

export function createTerrain(seed = 0x51a2c): Terrain {
  const rand = mulberry32(seed);
  const noise = makeValueNoise(rand, 96);
  const size = WORLD_SIZE;
  const res = HEIGHT_RES;
  const heights = new Float32Array(res * res);

  const craters: Crater[] = [
    { x: -18, z: -16, r: 7.5, depth: 1.8 },
    { x: 22, z: -11, r: 5.2, depth: 1.1 },
    { x: 14, z: 24, r: 9.4, depth: 2.2 },
    { x: -26, z: 12, r: 4.4, depth: 0.9 },
    { x: 6, z: -28, r: 6.1, depth: 1.3 },
    { x: -8, z: 28, r: 3.6, depth: 0.7 },
    { x: 30, z: 8, r: 4.8, depth: 1.0 },
    { x: -32, z: -24, r: 8.2, depth: 1.9 },
  ];

  for (let i = 0; i < 10; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 16 + rand() * 22;
    craters.push({
      x: Math.cos(ang) * dist,
      z: Math.sin(ang) * dist,
      r: 1.4 + rand() * 2.4,
      depth: 0.25 + rand() * 0.45,
    });
  }

  const half = size / 2;
  for (let iz = 0; iz < res; iz++) {
    for (let ix = 0; ix < res; ix++) {
      const x = (ix / (res - 1)) * size - half;
      const z = (iz / (res - 1)) * size - half;
      let h = fbm(noise, x * 0.035, z * 0.035, 5) * 1.55;
      h += fbm(noise, x * 0.14 + 20, z * 0.14, 3) * 0.22;
      const r = Math.hypot(x, z);
      const flatten = fade(Math.min(1, Math.max(0, (14 - r) / 10)));
      h *= 1 - 0.88 * flatten;
      for (const c of craters) {
        const t = Math.hypot(x - c.x, z - c.z) / c.r;
        h += craterProfile(t, c.depth, c.depth * 0.22);
      }
      heights[iz * res + ix] = h;
    }
  }

  function bilinear(x: number, z: number): number {
    const u = ((x + half) / size) * (res - 1);
    const v = ((z + half) / size) * (res - 1);
    const x0 = Math.max(0, Math.min(res - 2, Math.floor(u)));
    const z0 = Math.max(0, Math.min(res - 2, Math.floor(v)));
    const tx = Math.max(0, Math.min(1, u - x0));
    const tz = Math.max(0, Math.min(1, v - z0));
    const h00 = heights[z0 * res + x0]!;
    const h10 = heights[z0 * res + x0 + 1]!;
    const h01 = heights[(z0 + 1) * res + x0]!;
    const h11 = heights[(z0 + 1) * res + x0 + 1]!;
    return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
  }

  const rocks: Rock[] = [];
  const rockPalette = [0x6a6560, 0x5c5853, 0x78726a, 0x4e4b46, 0x6e6860];

  const debris: Array<{ x: number; z: number; s: number }> = [
    { x: -0.9, z: -5.4, s: 0.5 },
    { x: 0.9, z: -5.4, s: 0.46 },
    { x: 0.0, z: -6.5, s: 0.62 },
    { x: -0.85, z: -7.6, s: 0.54 },
    { x: 0.85, z: -7.8, s: 0.5 },
    { x: 0.1, z: -9.0, s: 0.58 },
    { x: -0.95, z: -10.2, s: 0.48 },
    { x: 0.9, z: -11.4, s: 0.56 },
    { x: 0.0, z: -12.8, s: 0.64 },
    { x: -0.8, z: -14.4, s: 0.5 },
    { x: 0.75, z: -15.8, s: 0.54 },
    { x: 0.15, z: -17.4, s: 0.52 },
  ];

  for (const d of debris) {
    rocks.push(
      makeRock(
        d.x,
        d.z,
        d.s * (0.92 + rand() * 0.16),
        d.s * (0.78 + rand() * 0.22),
        d.s * (0.48 + rand() * 0.16),
        rand() * Math.PI * 2,
        rockPalette[Math.floor(rand() * rockPalette.length)]!,
        Math.floor(rand() * 3),
        bilinear,
      ),
    );
  }

  for (let i = 0; i < 58; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = 6 + rand() * 34;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    if (Math.hypot(x, z - 2.4) < 4.2) continue;
    const s = 0.16 + rand() * 0.42;
    rocks.push(
      makeRock(
        x,
        z,
        s * (0.85 + rand() * 0.4),
        s * (0.75 + rand() * 0.4),
        s * (0.42 + rand() * 0.32),
        rand() * Math.PI * 2,
        rockPalette[Math.floor(rand() * rockPalette.length)]!,
        Math.floor(rand() * 3),
        bilinear,
      ),
    );
  }

  // A few large boulders on crater rims — side-hit, not climbable.
  const boulders: Array<{ x: number; z: number; s: number }> = [
    { x: -16.2, z: -12.4, s: 1.35 },
    { x: 18.6, z: -8.8, s: 1.15 },
    { x: 11.2, z: 20.4, s: 1.55 },
    { x: -28.4, z: 10.6, s: 1.05 },
    { x: 4.4, z: -25.2, s: 1.22 },
    { x: -30.8, z: -21.5, s: 1.4 },
  ];
  for (const b of boulders) {
    rocks.push(
      makeRock(
        b.x,
        b.z,
        b.s * (0.9 + rand() * 0.2),
        b.s * (0.78 + rand() * 0.22),
        b.s * (0.7 + rand() * 0.18),
        rand() * Math.PI * 2,
        0x58544f,
        Math.floor(rand() * 3),
        bilinear,
      ),
    );
  }

  const pebbles: Rock[] = [];
  for (let i = 0; i < 160; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = rand() * 38;
    const x = Math.cos(ang) * dist;
    const z = Math.sin(ang) * dist;
    const s = 0.05 + rand() * 0.11;
    pebbles.push(
      makeRock(
        x,
        z,
        s,
        s * (0.7 + rand() * 0.45),
        s * 0.62,
        rand() * Math.PI * 2,
        0x6a655e,
        0,
        bilinear,
      ),
    );
  }

  function sample(x: number, z: number): number {
    const limit = half - 0.4;
    const cx = Math.max(-limit, Math.min(limit, x));
    const cz = Math.max(-limit, Math.min(limit, z));
    let h = bilinear(cx, cz);
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i]!;
      const pad = Math.max(r.rx, r.rz);
      if (Math.abs(cx - r.x) > pad || Math.abs(cz - r.z) > pad) continue;
      const bump = rockSurfaceY(r, cx, cz);
      if (bump !== null && bump > h) h = bump;
    }
    return h;
  }

  const _n = { x: 0, y: 1, z: 0 };
  function sampleNormal(x: number, z: number, out = _n) {
    const e = 0.18;
    const dx = sample(x + e, z) - sample(x - e, z);
    const dz = sample(x, z + e) - sample(x, z - e);
    const nx = -dx;
    const ny = 2 * e;
    const nz = -dz;
    const inv = 1 / Math.hypot(nx, ny, nz);
    out.x = nx * inv;
    out.y = ny * inv;
    out.z = nz * inv;
    return out;
  }

  function resolveBody(x: number, y: number, z: number, radius: number) {
    let px = x;
    let pz = z;
    let hit = false;

    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i]!;
      const peak = r.cy + r.ry;
      if (peak < y - 0.12) continue;
      const pad = Math.max(r.rx, r.rz) + radius;
      if (Math.abs(px - r.x) > pad || Math.abs(pz - r.z) > pad) continue;

      const hy = (y - r.cy) / r.ry;
      if (hy >= 0.98 || hy <= -0.98) continue;
      const slice = Math.sqrt(Math.max(0.05, 1 - hy * hy));
      const erx = r.rx * slice + radius;
      const erz = r.rz * slice + radius;
      const { lx, lz } = localXZ(r, px, pz);
      const n2 = (lx * lx) / (erx * erx) + (lz * lz) / (erz * erz);
      if (n2 >= 1 || n2 < 1e-8) continue;
      const s = 1 / Math.sqrt(n2);
      const lx2 = lx * s;
      const lz2 = lz * s;
      px = r.x + lx2 * r.cosY - lz2 * r.sinY;
      pz = r.z + lx2 * r.sinY + lz2 * r.cosY;
      hit = true;
    }

    return { x: px, z: pz, hit };
  }

  return { size, res, heights, rocks, pebbles, craters, sample, groundAt: bilinear, sampleNormal, resolveBody };
}
