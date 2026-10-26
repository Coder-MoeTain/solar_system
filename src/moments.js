// Live figures for the details card. Distances use the real orbit, not the compressed view.

import { EPOCH_MS, PLANETS, meanAnomaly, radiusAU, trueEcliptic } from "./ephemeris.js";

const TAU = Math.PI * 2;
const AU_KM = 149597870.7;
const EARTH_DIAMETER_KM = 12756;
const LIGHT_MINUTES_PER_AU = 8.31675;
const LY_PER_AU = 63241.077;
const OBL = (23.439 * Math.PI) / 180;

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const scratchA = makeVec();
const scratchB = makeVec();
const earthEl = PLANETS.find((planet) => planet.name === "Earth");

function makeVec() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    },
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function len(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function formatDistance(au, unit) {
  const safe = Math.max(au, 0);
  if (unit === "km") {
    const km = safe * AU_KM;
    if (km >= 1e9) return `${(km / 1e9).toFixed(2)} billion km`;
    if (km >= 1e6) return `${(km / 1e6).toFixed(2)} million km`;
    if (km >= 100) return `${Math.round(km).toLocaleString()} km`;
    return `${km.toFixed(1)} km`;
  }
  if (unit === "lm") return formatLight(safe);
  if (unit === "ed") {
    const diameters = (safe * AU_KM) / EARTH_DIAMETER_KM;
    if (diameters >= 100) return `${Math.round(diameters).toLocaleString()} Earth diameters`;
    return `${diameters.toFixed(diameters < 10 ? 2 : 1)} Earth diameters`;
  }
  if (safe < 0.01) return `${safe.toFixed(4)} AU`;
  if (safe < 100) return `${safe.toFixed(2)} AU`;
  return `${Math.round(safe).toLocaleString()} AU`;
}

export function formatLight(au) {
  const minutes = Math.max(au, 0) * LIGHT_MINUTES_PER_AU;
  if (minutes < 1) return `${Math.max(minutes * 60, 0).toFixed(1)} light-seconds`;
  if (minutes < 90) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} light-minutes`;
  if (minutes < 60 * 48) return `${(minutes / 60).toFixed(1)} light-hours`;
  if (minutes < 60 * 24 * 800) return `${(minutes / 60 / 24).toFixed(1)} light-days`;
  return `${(minutes / 60 / 24 / 365.25).toFixed(2)} light-years`;
}

function phaseWord(fraction) {
  if (fraction >= 0.98) return "full";
  if (fraction >= 0.62) return "gibbous";
  if (fraction >= 0.38) return "quarter";
  if (fraction >= 0.02) return "crescent";
  return "new";
}

function signName(x, y) {
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const deg = (lon + 360) % 360;
  return SIGNS[Math.floor(deg / 30) % 12];
}

function skySign(el, simDays) {
  trueEcliptic(el, simDays, scratchA);
  trueEcliptic(earthEl, simDays, scratchB);
  return signName(scratchA.x - scratchB.x, scratchA.y - scratchB.y);
}

function sunSign(simDays) {
  trueEcliptic(earthEl, simDays, scratchA);
  return signName(-scratchA.x, -scratchA.y);
}

function yearProgress(el, simDays) {
  const mean = meanAnomaly(el, simDays);
  const fraction = mean / TAU;
  const days = fraction * el.period;
  return `${Math.round(fraction * 100)}% of this orbit · ${Math.round(days).toLocaleString()} days after closest approach`;
}

function planetPhase(el, simDays) {
  trueEcliptic(el, simDays, scratchA);
  trueEcliptic(earthEl, simDays, scratchB);
  const sun = { x: -scratchA.x, y: -scratchA.y, z: -scratchA.z };
  const earth = sub(scratchB, scratchA);
  const denom = len(sun) * len(earth) || 1;
  const cos = clamp(dot(sun, earth) / denom, -1, 1);
  const fraction = (1 + cos) / 2;
  return `${phaseWord(fraction)} · ${Math.round(fraction * 100)}% lit`;
}

function moonPhase(body) {
  const moon = body.anchor.position;
  const planet = body.parentBody.anchor.position;
  const sun = { x: -planet.x, y: -planet.y, z: -planet.z };
  const denom = len(moon) * len(sun) || 1;
  const cos = clamp(dot(moon, sun) / denom, -1, 1);
  const fraction = (1 - cos) / 2;
  return `${phaseWord(fraction)} · ${Math.round(fraction * 100)}% lit`;
}

function northernSeason(simDays) {
  const date = new Date(EPOCH_MS + simDays * 86400000);
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const n = month * 100 + day;
  if (n < 320) return "Northern winter";
  if (n < 621) return "Northern spring";
  if (n < 922) return "Northern summer";
  if (n < 1221) return "Northern autumn";
  return "Northern winter";
}

function hasKepler(body) {
  return body?.data?.a > 0 && body.data.period > 0;
}

export function momentRows(body, simDays, unit) {
  if (!body) return [];
  const name = body.data?.name;
  if (body.kind === "planet" || body.kind === "dwarf" || body.kind === "comet") {
    const au = radiusAU(body.data, simDays);
    trueEcliptic(body.data, simDays, scratchA);
    trueEcliptic(earthEl, simDays, scratchB);
    const fromEarth = len(sub(scratchA, scratchB));
    const rows = [
      ["From the Sun", formatDistance(au, unit)],
      ["Sunlight", formatLight(au)],
    ];
    if (name !== "Earth") {
      rows.push(["From Earth", formatDistance(fromEarth, unit)]);
      rows.push(["Radio signal", formatLight(fromEarth)]);
    }
    rows.push(["This orbit", yearProgress(body.data, simDays)]);
    if (name === "Earth") rows.push(["Sun in the sky", sunSign(simDays)]);
    else rows.push(["In the sky", skySign(body.data, simDays)]);
    if (name === "Mercury" || name === "Venus") rows.push(["Phase", planetPhase(body.data, simDays)]);
    if (name === "Earth") rows.push(["Season", northernSeason(simDays)]);
    if (body.kind === "comet") {
      rows.push(["Tail", au < 3 ? "Bright. The tail points away from the Sun." : "Faint. Halley grows a tail inside about 3 AU."]);
    }
    return rows;
  }
  if (body.kind === "sun") {
    return [
      ["In the sky", sunSign(simDays)],
      ["Light to Earth", formatLight(radiusAU(earthEl, simDays))],
      ["Through the galaxy", "220 km/s"],
    ];
  }
  if (body.kind === "moon") {
    const km = body.def.radii * body.def.planetKm;
    const direction = body.def.retrograde ? -1 : 1;
    let angle = direction * ((TAU * simDays) / body.def.period + body.def.phase);
    angle %= TAU;
    if (angle < 0) angle += TAU;
    const along = (angle / TAU) * body.def.period;
    const rows = [
      ["From " + body.moonOf, `${Math.round(km).toLocaleString()} km`],
      ["This loop", `${Math.round((angle / TAU) * 100)}% around · ${along < 2 ? along.toFixed(1) : Math.round(along).toLocaleString()} days along`],
    ];
    if (name === "Moon" || body.moonOf === "Earth") rows.push(["Phase", moonPhase(body)]);
    return rows;
  }
  if (body.kind === "probe") {
    const au = body.def.au;
    return [
      ["From the Sun", formatDistance(au, unit)],
      ["Radio signal", formatLight(au)],
      ["Place", "Outside the heliopause, in interstellar space"],
    ];
  }
  if (body.kind === "star") {
    const ly = body.def.ly;
    const pretty = ly < 20 ? ly.toFixed(2) : String(Math.round(ly));
    return [
      ["Distance", `${pretty} light-years`],
      ["Light left", ly >= 2 ? `${pretty} years ago` : "a few years ago"],
    ];
  }
  if (body.kind === "exoplanet") {
    return [
      ["Around its star", `${body.def.days} days`],
      ["From its star", formatDistance(body.def.au, unit)],
      ["From the Sun", "40.7 light-years"],
      ["Light left the system", "41 years ago"],
    ];
  }
  if (body.kind === "heliopause") {
    return [
      ["From the Sun", formatDistance(120, unit)],
      ["Radio signal", formatLight(120)],
      ["Crossed by", "Voyager 1 in 2012, Voyager 2 in 2018"],
    ];
  }
  if (body.kind === "satellite") {
    return [["Radio to Earth", "A fraction of a second"]];
  }
  return [];
}

function speedOf(body) {
  if (!body || body.kind === "sun" || body.kind === "star" || body.kind === "galaxy" || body.kind === "heliopause") return null;
  return body.data?.speed || body.speed || body.def?.speed || null;
}

function probeVector(def, target) {
  const ra = def.ra * (Math.PI / 12);
  const dec = def.dec * (Math.PI / 180);
  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);
  const x = xEq;
  const y = yEq * Math.cos(OBL) + zEq * Math.sin(OBL);
  const z = -yEq * Math.sin(OBL) + zEq * Math.cos(OBL);
  const scale = def.au || def.ly * LY_PER_AU;
  target.set(x * scale, y * scale, z * scale);
}

function positionAU(body, simDays, target) {
  if (body.kind === "sun") {
    target.set(0, 0, 0);
    return true;
  }
  if (hasKepler(body)) {
    trueEcliptic(body.data, simDays, target);
    return true;
  }
  if (body.kind === "moon" && hasKepler(body.parentBody)) {
    trueEcliptic(body.parentBody.data, simDays, target);
    return true;
  }
  if ((body.kind === "probe" || body.kind === "star") && body.def) {
    probeVector(body.def, target);
    return true;
  }
  if (body.kind === "heliopause") {
    target.set(120, 0, 0);
    return true;
  }
  if (body.kind === "exoplanet") {
    target.set(0, 0, 40.7 * LY_PER_AU);
    return true;
  }
  return false;
}

export function compareText(a, b, simDays, unit) {
  if (!a || !b) return "Choose a second body.";
  if (a.data.name === b.data.name) return "Choose a different body.";
  const lines = [];
  if (a.kind === "moon" && b.data?.name === a.moonOf) {
    const km = a.def.radii * a.def.planetKm;
    lines.push(`${a.data.name} orbits ${a.moonOf} at ${Math.round(km).toLocaleString()} km.`);
    lines.push(`Light crosses that gap in ${(km / 299792.458).toFixed(2)} seconds.`);
  } else if (b.kind === "moon" && a.data?.name === b.moonOf) {
    const km = b.def.radii * b.def.planetKm;
    lines.push(`${b.data.name} orbits ${b.moonOf} at ${Math.round(km).toLocaleString()} km.`);
    lines.push(`Light crosses that gap in ${(km / 299792.458).toFixed(2)} seconds.`);
  } else if (positionAU(a, simDays, scratchA) && positionAU(b, simDays, scratchB)) {
    const gap = len(sub(scratchA, scratchB));
    const moonNote = a.kind === "moon" || b.kind === "moon" ? " Center to center of the planet it orbits." : "";
    lines.push(`${formatDistance(gap, unit)} apart.${moonNote}`);
    lines.push(`A radio signal would take ${formatLight(gap)}.`);
  }
  const sa = speedOf(a);
  const sb = speedOf(b);
  if (sa && sb && a.kind !== "comet" && b.kind !== "comet") {
    const ratio = Math.max(sa, sb) / Math.min(sa, sb);
    const faster = sa >= sb ? a.data.name : b.data.name;
    lines.push(`${a.data.name} ${sa} km/s · ${b.data.name} ${sb} km/s. ${faster} is ${ratio.toFixed(ratio < 10 ? 1 : 0)}× faster.`);
  } else if (a.kind === "comet" || b.kind === "comet") {
    lines.push("Halley reaches about 55 km/s at perihelion, far faster than its speed out by Neptune.");
  }
  return lines.join(" ") || "These two do not share a distance I can measure yet.";
}
