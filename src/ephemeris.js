// Approximate J2000 Keplerian elements (NASA planetary fact sheet / JPL mean elements).
// Accurate enough to watch the system move. Not a navigation ephemeris.

export const TAU = Math.PI * 2;
export const YEAR = 365.256363;
export const AU_SCENE = 16;
export const SUN_AU_PER_YEAR = 46.4; // ~220 km/s
export const RADIAL_EXP = 0.6;

const DEG = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
const EPOCH = Date.UTC(2026, 9, 25);
export const EPOCH_MS = EPOCH;
export const EPOCH_OFFSET_DAYS = (EPOCH - J2000) / 86400000;

function el({ name, a, e, i, O, w, M, period, re, tilt, spinHours, speed, color, texture, kind }) {
  return {
    name,
    a,
    e,
    i: i * DEG,
    O: O * DEG,
    w: w * DEG,
    M0: M * DEG,
    period,
    re,
    tilt: tilt * DEG,
    spinHours,
    speed,
    color,
    texture: texture || null,
    kind: kind || "planet",
  };
}

export const PLANETS = [
  el({
    name: "Mercury",
    a: 0.387098,
    e: 0.20563,
    i: 7.005,
    O: 48.331,
    w: 29.124,
    M: 174.796,
    period: 87.9691,
    re: 0.383,
    tilt: 0.03,
    spinHours: 1407.6,
    speed: 47.4,
    color: 0xcfc8bf,
    texture: "mercury.jpg",
  }),
  el({
    name: "Venus",
    a: 0.723332,
    e: 0.006772,
    i: 3.395,
    O: 76.68,
    w: 54.884,
    M: 50.415,
    period: 224.701,
    re: 0.949,
    tilt: 177.36,
    spinHours: -5832.5,
    speed: 35.0,
    color: 0xf0d2a0,
    texture: "venus.jpg",
  }),
  el({
    name: "Earth",
    a: 1,
    e: 0.016709,
    i: 0,
    O: 0,
    w: 102.937,
    M: -2.473,
    period: YEAR,
    re: 1,
    tilt: 23.44,
    spinHours: 23.934,
    speed: 29.78,
    color: 0x8eb7ff,
    texture: "earth.jpg",
  }),
  el({
    name: "Mars",
    a: 1.523679,
    e: 0.093401,
    i: 1.85,
    O: 49.558,
    w: 286.502,
    M: 19.393,
    period: 686.98,
    re: 0.532,
    tilt: 25.19,
    spinHours: 24.623,
    speed: 24.07,
    color: 0xe07a4c,
    texture: "mars.jpg",
  }),
  el({
    name: "Jupiter",
    a: 5.2026,
    e: 0.048495,
    i: 1.303,
    O: 100.464,
    w: 273.867,
    M: 20.073,
    period: 4332.59,
    re: 11.21,
    tilt: 3.13,
    spinHours: 9.925,
    speed: 13.06,
    color: 0xe6c7a2,
    texture: "jupiter.jpg",
  }),
  el({
    name: "Saturn",
    a: 9.5549,
    e: 0.055508,
    i: 2.489,
    O: 113.666,
    w: 339.391,
    M: 317.021,
    period: 10759.22,
    re: 9.45,
    tilt: 26.73,
    spinHours: 10.656,
    speed: 9.68,
    color: 0xf3e0bd,
    texture: "saturn.jpg",
  }),
  el({
    name: "Uranus",
    a: 19.2184,
    e: 0.046295,
    i: 0.773,
    O: 74.006,
    w: 96.998,
    M: 143.051,
    period: 30688.5,
    re: 4.01,
    tilt: 97.77,
    spinHours: -17.24,
    speed: 6.8,
    color: 0xbffff4,
    texture: "uranus.jpg",
  }),
  el({
    name: "Neptune",
    a: 30.1104,
    e: 0.008988,
    i: 1.77,
    O: 131.784,
    w: 273.187,
    M: 259.909,
    period: 60182,
    re: 3.88,
    tilt: 28.32,
    spinHours: 16.11,
    speed: 5.43,
    color: 0x6f8cff,
    texture: "neptune.jpg",
  }),
];

export function scaleAU(au) {
  return Math.pow(Math.max(au, 0), RADIAL_EXP) * AU_SCENE;
}

export function visualRadius(earthRadii) {
  return 0.4 * Math.pow(earthRadii, 0.45);
}

function normalizeAngle(rad) {
  const m = rad % TAU;
  return m < 0 ? m + TAU : m;
}

function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 12; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    E -= f / fp;
  }
  return E;
}

export function meanAnomaly(p, simDays) {
  return normalizeAngle(p.M0 + (TAU * (EPOCH_OFFSET_DAYS + simDays)) / p.period);
}

// Uncompressed ecliptic coordinates in AU. target.set receives x, y in-plane, z north.
export function trueEcliptic(p, simDays, target) {
  const mean = meanAnomaly(p, simDays);
  const E = solveKepler(mean, p.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const denom = 1 - p.e * cosE;
  const r = p.a * denom;
  const cosv = (cosE - p.e) / denom;
  const sinv = (Math.sqrt(1 - p.e * p.e) * sinE) / denom;
  const cosw = Math.cos(p.w);
  const sinw = Math.sin(p.w);
  const coswv = cosw * cosv - sinw * sinv;
  const sinwv = sinw * cosv + cosw * sinv;
  const cosi = Math.cos(p.i);
  const sini = Math.sin(p.i);
  const cosO = Math.cos(p.O);
  const sinO = Math.sin(p.O);
  const x = r * (cosO * coswv - sinO * sinwv * cosi);
  const y = r * (sinO * coswv + cosO * sinwv * cosi);
  const z = r * sinwv * sini;
  target.set(x, y, z);
  return r;
}

// Ecliptic coordinates, then radially compressed so the outer planets fit on screen.
// target receives scene units still in the ecliptic frame: x, y in-plane, z north.
export function eclipticPosition(p, simDays, target) {
  const r = trueEcliptic(p, simDays, target);
  const dist = Math.hypot(target.x, target.y, target.z) || 1;
  const s = scaleAU(dist) / dist;
  target.set(target.x * s, target.y * s, target.z * s);
  return r;
}

// Lay the ecliptic onto Three.js's horizontal XZ plane (Y up).
export function toScene(ecliptic, target) {
  target.set(ecliptic.x, ecliptic.z, -ecliptic.y);
  return target;
}

export function radiusAU(p, simDays) {
  const M = meanAnomaly(p, simDays);
  const E = solveKepler(M, p.e);
  return p.a * (1 - p.e * Math.cos(E));
}

// Dwarf planets and Halley's comet. Angles are approximate mean elements, degrees at J2000.
export const SMALL_BODIES = [
  el({
    name: "Ceres",
    kind: "dwarf",
    a: 2.767,
    e: 0.0785,
    i: 10.59,
    O: 80.3,
    w: 73.6,
    M: 291.4,
    period: 1681.6,
    re: 0.074,
    tilt: 4,
    spinHours: 9.07,
    speed: 17.9,
    color: 0xb7b1a8,
  }),
  el({
    name: "Pluto",
    kind: "dwarf",
    a: 39.482,
    e: 0.2488,
    i: 17.16,
    O: 110.3,
    w: 113.83,
    M: 14.86,
    period: 90560,
    re: 0.186,
    tilt: 122.5,
    spinHours: -153.3,
    speed: 4.74,
    color: 0xd2b9a2,
  }),
  el({
    name: "Haumea",
    kind: "dwarf",
    a: 43.13,
    e: 0.191,
    i: 28.19,
    O: 122.1,
    w: 239.2,
    M: 218.2,
    period: 103650,
    re: 0.122,
    tilt: 15,
    spinHours: 3.92,
    speed: 4.53,
    color: 0xe8e4dc,
  }),
  el({
    name: "Makemake",
    kind: "dwarf",
    a: 45.43,
    e: 0.162,
    i: 28.98,
    O: 79.4,
    w: 294.8,
    M: 165.5,
    period: 111470,
    re: 0.112,
    tilt: 0,
    spinHours: 22.8,
    speed: 4.42,
    color: 0xc4b8a4,
  }),
  el({
    name: "Eris",
    kind: "dwarf",
    a: 67.86,
    e: 0.436,
    i: 44.04,
    O: 35.95,
    w: 151.6,
    M: 205.2,
    period: 204200,
    re: 0.183,
    tilt: 0,
    spinHours: 25.9,
    speed: 3.43,
    color: 0xddd4c8,
  }),
  el({
    name: "Halley",
    kind: "comet",
    a: 17.834,
    e: 0.96714,
    i: 162.26,
    O: 58.42,
    w: 111.33,
    M: 65.71,
    period: 27510,
    re: 0.01,
    tilt: 0,
    spinHours: 52.8,
    speed: 54.6,
    color: 0xb7d4e8,
  }),
];

export function travelScene(simDays, motionFactor) {
  return (simDays / YEAR) * SUN_AU_PER_YEAR * motionFactor * AU_SCENE;
}
