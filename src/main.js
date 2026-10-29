import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  EPOCH_MS,
  EPOCH_OFFSET_DAYS,
  PLANETS,
  SMALL_BODIES,
  SUN_AU_PER_YEAR,
  YEAR,
  eclipticPosition,
  radiusAU,
  toScene,
  travelScene,
  visualRadius,
} from "./ephemeris.js";
import { MOONS, moonBodyRadius, moonOrbitDistance } from "./moons.js";
import { buildGalaxies } from "./galaxies.js";
import { createSatellites } from "./satellites.js";
import { EXTRA_ROWS, FACTS } from "./facts.js";
import { createBeyond } from "./beyond.js";
import { compareText, formatDistance, momentRows } from "./moments.js";
import { EVENTS, TOURS, isoFromSimDays, simDaysFromIso } from "./learn.js";

const MAX_STEPS = 2200;
const MAX_VERTS = (MAX_STEPS - 1) * 6;
const HOME_CAM = new THREE.Vector3(62, 34, 86);
const HOME_TARGET = new THREE.Vector3(-16, 3, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const LOG_MIN = Math.log10(1 / 86400);
const LOG_MAX = Math.log10(3652.56);

const $ = (id) => document.getElementById(id);

const ui = {
  date: $("date"),
  elapsed: $("elapsed"),
  traveled: $("traveled"),
  frame: $("frame"),
  viewDeg: $("view-deg"),
  focusLabel: $("focus-label"),
  focusStat: $("focus-stat"),
  lesson: $("lesson"),
  detailsScale: $("details-scale"),
  frameLesson: $("frame-lesson"),
  play: $("play"),
  live: $("live"),
  telemetry: document.querySelector(".telemetry"),
  toggle: $("toggle"),
  close: $("close"),
  panel: $("panel"),
  modeSpace: $("mode-space"),
  modeOrbit: $("mode-orbit"),
  presets: $("presets"),
  speed: $("speed"),
  speedHint: $("speed-hint"),
  trail: $("trail"),
  trailVal: $("trail-val"),
  motion: $("motion"),
  motionVal: $("motion-val"),
  motionHint: $("motion-hint"),
  tilt: $("tilt"),
  tiltVal: $("tilt-val"),
  tiltHint: $("tilt-hint"),
  labels: $("show-labels"),
  trails: $("show-trails"),
  orbits: $("show-orbits"),
  belt: $("show-belt"),
  moon: $("show-moon"),
  satellites: $("show-satellites"),
  satTracks: $("show-sat-tracks"),
  planets: $("planets"),
  resetView: $("reset-view"),
  resetTime: $("reset-time"),
  details: $("details"),
  detailsKind: $("details-kind"),
  detailsName: $("details-name"),
  detailsSummary: $("details-summary"),
  detailsFacts: $("details-facts"),
  detailsClose: $("details-close"),
  detailsNow: $("details-now"),
  detailsTabs: $("details-tabs"),
  units: $("units"),
  compareWith: $("compare-with"),
  compareOut: $("compare-out"),
  search: $("search"),
  searchResults: $("search-results"),
  gotoDate: $("goto-date"),
  gotoGo: $("goto-go"),
  events: $("events"),
  tours: $("tours"),
  tourStop: $("tour-stop"),
  share: $("share"),
  lookPad: $("look-pad"),
};

const state = {
  simDays: 0,
  playing: true,
  daysPerSecond: 7,
  spaceMode: false,
  motion: 0.08,
  tilt: 60 * THREE.MathUtils.DEG2RAD,
  trailYears: 5,
  focus: "Sun",
  spinAccum: 0,
  units: "au",
  detailTab: "orbit",
  live: false,
};

const LESSON = {
  sun: "The Sun moves through the galaxy at 220 km/s. Planets keep orbiting, so each trail is a helix.",
  planet: "The amber arrow points at the Sun. The blue arrow is the way it is moving. A year is one trip around.",
  dwarf: "A dwarf planet follows the same kind of orbit as a planet. The amber arrow points at the Sun, and the blue arrow is its motion.",
  comet: "Halley orbits backward. Inside about 3 AU it grows a tail that points away from the Sun.",
  moon: "A moon’s month is one loop around its planet. Sizes are enlarged so the moon is readable beside it.",
  satellite: "Altitude, tilt, and period match published orbits. Craft are drawn in close so they stay visible.",
  star: "A real star beyond the solar system. Its direction on the sky is real. The distance is shortened.",
  probe: "These probes have crossed the heliopause, where the solar wind gives way to interstellar gas.",
  galaxy: "You are inside a barred spiral. Rise above the disk to see the arms. The close view keeps the galaxy faded.",
  exoplanet: "These seven worlds orbit a dim red dwarf 40.7 light-years away. Three of them sit in the habitable zone.",
  heliopause: "The heliopause is the edge of the solar wind, about 120 AU out. Both Voyagers have crossed it.",
};

const SCALE_NOTE = {
  sun: "On screen the Sun is enlarged. Its real motion around the galaxy is 220 km/s, about 46 AU every Earth year.",
  planet: "Orbital time is to scale. Distance from the Sun is compressed. Amber points at the Sun. Blue is the direction of motion.",
  dwarf: "The orbit is real and the on-screen distance is compressed. The body is enlarged so you can find it.",
  comet: "The orbit is the real ellipse, drawn with compressed distance. The tail only shows when Halley is near the Sun.",
  moon: "The orbit is pulled in and the moon is enlarged. Period, size, and distance in the list are the real ones.",
  satellite: "The numbers are the real orbit. The craft is parked just outside the planet so it does not cover the moons.",
  star: "The star is placed in its real direction. Light-years are compressed into the band just past the planets.",
  probe: "Voyager’s path is the real direction out of the system. The AU distance is the true one; the marker is brought inward.",
  galaxy: "The disk shows the real shape: bar, four arms, and the Orion Spur. It fades until the camera rises above the plane.",
  exoplanet: "The seven planets are enlarged around the star marker. Periods and distances in the card are the real ones.",
  heliopause: "The shell is the boundary near 120 AU, drawn on the compressed scale so it sits just inside the Voyagers.",
};

const NAMED_LESSON = {
  Venus: "A year on Venus is 225 Earth days. Its day is longer, 243 Earth days, and it spins backward, so the Sun rises in the west.",
  Saturn: "Saturn’s rings are ice, and they share the planet’s 27° tilt. The ring plane opens and closes over the 29-year orbit.",
  Uranus: "Uranus is tipped on its side. One pole faces the Sun for about 21 years, then the other. Each season is a generation long.",
};

function lessonFor(body) {
  if (tourLesson) return tourLesson;
  const kind = body?.kind || "sun";
  if (kind === "sun" && !state.spaceMode) {
    return "The Sun is held still, so each orbit closes. Choose Through space to stretch those orbits into helices.";
  }
  if (body?.data?.name && NAMED_LESSON[body.data.name]) return NAMED_LESSON[body.data.name];
  return LESSON[kind] || LESSON.planet;
}

let tourLesson = null;
let activeTour = null;
let savedSpeed = null;
const REAL_DPS = 1 / 86400;

const eclipticVec = new THREE.Vector3();
const sceneVec = new THREE.Vector3();
const tangent = new THREE.Vector3();
const side = new THREE.Vector3();
const focusDesiredCam = new THREE.Vector3();
const focusDesiredTarget = new THREE.Vector3();
const focusOffset = new THREE.Vector3();
const followBase = new THREE.Vector3(1, 0.45, 1);
const vecA = new THREE.Vector3();
const vecB = new THREE.Vector3();
const vecC = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
let focusTween = 0;
let following = false;
let followZoom = 1;
let zoomCarry = 0;
const zoomPoint = { x: 0, y: 0 };

const view = $("view");
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x05060c, 1);
view.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.04, 30000);
camera.position.copy(HOME_CAM);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.9;
controls.maxDistance = 6400;
controls.zoomToCursor = true;
controls.zoomSpeed = 0.7;
controls.update();
renderer.domElement.addEventListener("wheel", onSmoothWheel, { capture: true, passive: false });

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.inset = "0";
labelRenderer.domElement.style.pointerEvents = "none";
view.appendChild(labelRenderer.domElement);

scene.add(new THREE.AmbientLight(0xb7c6e4, 0.28));
scene.add(new THREE.HemisphereLight(0x9eb4d8, 0x1a120c, 0.28));
const sunLight = new THREE.PointLight(0xfff1d4, 2.4, 0, 0);
scene.add(sunLight);
const fill = new THREE.DirectionalLight(0x7f92b8, 0.28);
fill.position.set(-40, 20, -30);
scene.add(fill);

const ecliptic = new THREE.Group();
scene.add(ecliptic);

const starTexture = circleTexture();
createStars();
const sun = createSun();
const bodies = [...PLANETS, ...SMALL_BODIES].map(createBody);
const moons = createMoons();
const satellites = createSatellites(bodies, scene, makeLabel, focusBody);
const galaxies = createGalaxies();
const beyond = createBeyond(ecliptic, scene, makeLabel, focusBody);
const belt = createBelt();
const ribbons = bodies.map(createRibbon);
const arrow = createArrow();
const vectors = createVectors();
bindUi();
updateBodies();
updateHud();
window.addEventListener("resize", resize);
renderer.domElement.addEventListener("pointerdown", onPointerDown);
renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerup", onPointerUp);
renderer.domElement.addEventListener("pointercancel", onPointerUp);
controls.addEventListener("start", () => {
  focusTween = 0;
  following = false;
});

let pointer = null;
let lastHud = 0;
let lastTime = performance.now();
requestAnimationFrame(() => document.body.classList.add("ready"));
renderer.setAnimationLoop(tick);

function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (state.live && state.playing) {
    state.simDays = (Date.now() - EPOCH_MS) / 86400000;
    state.spinAccum = state.simDays;
  } else if (state.playing) {
    state.simDays += state.daysPerSecond * dt;
    const spinDays = Math.min(state.daysPerSecond, 0.3) * dt;
    state.spinAccum += spinDays;
    if (activeTour) advanceTour(dt);
  }

  ecliptic.rotation.x = state.tilt;
  updateBodies(dt);
  fadeGalaxy();
  updateSun(dt, now);
  updateRibbons();
  applySmoothZoom(dt);
  updateFocus(dt);
  applyLook(dt);
  const focusedNow = findFocus();
  const nearEarth = camera.position.distanceTo(bodies[2].world) < 16;
  controls.minDistance = (following && focusedNow?.kind === "satellite") || nearEarth ? 0.1 : 2.9;
  controls.update();
  layoutLabels();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  if (now - lastHud > 80) {
    lastHud = now;
    updateHud();
  }
}

function updateBodies(dt = 0) {
  for (const body of bodies) {
    eclipticPosition(body.data, state.simDays, eclipticVec);
    toScene(eclipticVec, sceneVec);
    body.anchor.position.copy(sceneVec);
    const sign = Math.sign(body.data.spinHours) || 1;
    const hours = Math.abs(body.data.spinHours);
    body.spinner.rotation.y = sign * state.spinAccum * ((Math.PI * 2) / (hours / 24));
    const world = body.anchor.getWorldPosition(body.world);
    body.label.position.copy(world);
    body.label.position.y += body.radius * 1.7 + 0.35;
    body.label.visible = ui.labels.checked;
  }

  updateMoons();
  updateCometTails();
  satellites.update(
    dt,
    ui.satellites.checked,
    state.playing,
    state.daysPerSecond,
    camera,
    ui.satTracks.checked,
    state.live ? state.simDays : null,
  );
  beyond.update(camera, state.simDays, state.focus);
  updateVectors();

  belt.visible = ui.belt.checked;
  if (belt.visible) updateBelt();

  arrow.visible = state.spaceMode && camera.position.distanceTo(bodies[2].world) > 12;
}

function updateRibbons() {
  const show = ui.trails.checked;
  const dist = camera.position.distanceTo(controls.target);
  const widthBoost = THREE.MathUtils.clamp(dist / 110, 0.65, 1.8);

  for (let b = 0; b < bodies.length; b++) {
    const body = bodies[b];
    const ribbon = ribbons[b];
    ribbon.mesh.visible = show;
    if (!show) continue;

    const yearsCap = state.spaceMode ? state.trailYears : Math.min(state.trailYears, (body.data.period / YEAR) * 0.92);
    const windowDays = Math.max(2, yearsCap * YEAR);
    const steps = Math.max(32, Math.min(MAX_STEPS, Math.round(yearsCap * 220)));
    const start = state.simDays - windowDays;

    for (let i = 0; i < steps; i++) {
      const t = start + (windowDays * i) / (steps - 1);
      eclipticPosition(body.data, t, eclipticVec);
      toScene(eclipticVec, body.samples[i]);
      body.samples[i].applyAxisAngle(AXIS_X, state.tilt);
      if (state.spaceMode) {
        body.samples[i].x += travelScene(t, state.motion) - travelScene(state.simDays, state.motion);
      }
    }
    writeRibbon(ribbon.geometry, body.samples, steps, Math.max(0.07, body.radius * 0.38) * widthBoost);
  }
}

function writeRibbon(geometry, points, count, width) {
  const pos = geometry.attributes.position.array;
  const along = geometry.attributes.along.array;
  const sideAttr = geometry.attributes.side.array;
  let o = 0;

  for (let i = 0; i < count - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    tangent.subVectors(p1, p0);
    if (tangent.lengthSq() < 1e-10) tangent.set(1, 0, 0);
    side.subVectors(camera.position, p0);
    side.cross(tangent);
    if (side.lengthSq() < 1e-10) side.set(0, 1, 0);
    side.normalize().multiplyScalar(width);

    const a0 = i / (count - 1);
    const a1 = (i + 1) / (count - 1);
    o = pushVert(pos, along, sideAttr, o, p0, side, 1, a0);
    o = pushVert(pos, along, sideAttr, o, p0, side, -1, a0);
    o = pushVert(pos, along, sideAttr, o, p1, side, 1, a1);
    o = pushVert(pos, along, sideAttr, o, p0, side, -1, a0);
    o = pushVert(pos, along, sideAttr, o, p1, side, -1, a1);
    o = pushVert(pos, along, sideAttr, o, p1, side, 1, a1);
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.along.needsUpdate = true;
  geometry.attributes.side.needsUpdate = true;
  geometry.setDrawRange(0, (count - 1) * 6);
}

function pushVert(pos, along, sideAttr, o, point, sideVec, sign, alongValue) {
  pos[o] = point.x + sideVec.x * sign;
  pos[o + 1] = point.y + sideVec.y * sign;
  pos[o + 2] = point.z + sideVec.z * sign;
  const i = o / 3;
  along[i] = alongValue;
  sideAttr[i] = sign;
  return o + 3;
}

function onSmoothWheel(event) {
  if (!controls.enableZoom) return;
  event.preventDefault();
  event.stopPropagation();
  let delta = event.deltaY;
  if (event.deltaMode === 1) delta *= 16;
  else if (event.deltaMode === 2) delta *= 100;
  if (event.ctrlKey) delta *= 6;
  delta = THREE.MathUtils.clamp(delta, -160, 160);
  zoomCarry = THREE.MathUtils.clamp(zoomCarry + delta * 0.01, -8, 8);
  zoomPoint.x = event.clientX;
  zoomPoint.y = event.clientY;
}

const zoomHeld = { in: false, out: false };

function queueZoom(amount) {
  zoomCarry = THREE.MathUtils.clamp(zoomCarry + amount, -8, 8);
  const rect = renderer.domElement.getBoundingClientRect();
  zoomPoint.x = rect.left + rect.width / 2;
  zoomPoint.y = rect.top + rect.height / 2;
}

function setZoom(dir, on) {
  zoomHeld[dir] = on;
  ui.lookPad.querySelector(`[data-zoom="${dir}"]`)?.classList.toggle("is-on", on);
}

function applySmoothZoom(dt) {
  const held = (zoomHeld.out ? 1 : 0) - (zoomHeld.in ? 1 : 0);
  if (held) queueZoom(held * 5 * dt);
  if (Math.abs(zoomCarry) < 0.0004) {
    zoomCarry = 0;
    return;
  }
  const step = zoomCarry * (1 - Math.exp(-dt * 11));
  zoomCarry -= step;
  if (following) {
    followZoom = THREE.MathUtils.clamp(followZoom * Math.pow(0.95, -step), 0.08, 16);
    return;
  }
  controls._updateZoomParameters(zoomPoint.x, zoomPoint.y);
  controls._scale *= Math.pow(0.95, -step);
}

const lookHeld = { up: false, down: false, left: false, right: false };
const LOOK_KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

function setLook(dir, on) {
  if (!lookHeld[dir] && !on) return;
  lookHeld[dir] = on;
  ui.lookPad.querySelector(`[data-look="${dir}"]`)?.classList.toggle("is-on", on);
  if (on) {
    following = false;
    focusTween = 0;
  }
}

function applyLook(dt) {
  const yaw = (lookHeld.right ? 1 : 0) - (lookHeld.left ? 1 : 0);
  const pitch = (lookHeld.up ? 1 : 0) - (lookHeld.down ? 1 : 0);
  if (!yaw && !pitch) return;
  following = false;
  focusTween = 0;
  const step = 1.2 * dt;
  if (yaw) controls._rotateLeft(yaw * step);
  if (pitch) controls._rotateUp(pitch * step);
}

function placeLookPad() {
  const covered = ui.panel.classList.contains("open") || !ui.details.hidden;
  ui.lookPad.classList.toggle("away", covered);
}

function updateFocus(dt) {
  if (!following) return;
  const body = findFocus();
  const target = body ? body.world : sun.world;
  if (body?.kind === "satellite") aimSatelliteCamera(body, target);
  else if (body?.kind === "probe") aimProbeCamera(body, target);
  else focusOffset.copy(followBase).multiplyScalar(followZoom);
  focusDesiredTarget.copy(target);
  focusDesiredCam.copy(target).add(focusOffset);
  if (focusTween > 0) {
    focusTween = Math.max(0, focusTween - dt);
    controls.target.lerp(focusDesiredTarget, 0.22);
    camera.position.lerp(focusDesiredCam, 0.22);
    return;
  }
  controls.target.copy(target);
  camera.position.copy(target).add(focusOffset);
}

const ndc = new THREE.Vector3();

function layoutLabels() {
  const showLabels = ui.labels.checked;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const placed = [];
  const focused = findFocus();
  const earth = bodies[2];
  const camDist = camera.position.length();
  const order = [
    focused,
    sun,
    earth,
    ...[...bodies].filter((body) => body !== earth).sort((a, b) => b.anchor.position.lengthSq() - a.anchor.position.lengthSq()),
    ...moons,
    ...satellites.craft,
    ...beyond.stars,
    ...beyond.exo,
    beyond.helio,
    ...galaxies.major,
  ];
  const seen = new Set();

  for (const body of order) {
    if (!body || seen.has(body)) continue;
    seen.add(body);
    let allowed = showLabels;
    if (body.kind === "moon") {
      const nearParent = camera.position.distanceTo(body.parentBody.world) < Math.max(16, body.parentBody.radius * 26);
      allowed = showLabels && ui.moon.checked && (body === focused || nearParent);
    } else if (body.kind === "satellite") {
      const hostDist = camera.position.distanceTo(body.host.world);
      const overview = hostDist > body.overviewMin && hostDist < body.overviewMax;
      allowed = showLabels && ui.satellites.checked && (body === focused || (body.labeled && overview));
    } else if (body.kind === "galaxy") {
      allowed = showLabels && (body === focused || camDist > 280);
    } else if (body.kind === "star" || body.kind === "probe") {
      allowed = showLabels && (body === focused || camDist > 190);
    } else if (body.kind === "exoplanet") {
      allowed = showLabels && body.anchor.visible && (body === focused || camera.position.distanceTo(body.host.world) < 40);
    } else if (body.kind === "heliopause") {
      allowed = showLabels && (body === focused || camDist > 170);
    } else if (body.kind === "dwarf" || body.kind === "comet") {
      allowed = showLabels && (body === focused || camDist > 150);
    }
    if (!allowed) {
      body.label.visible = false;
      continue;
    }
    ndc.copy(body.world).project(camera);
    const x = (ndc.x * 0.5 + 0.5) * width;
    const y = (-ndc.y * 0.5 + 0.5) * height;
    const overlap = placed.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < 38 * 38);
    const onScreen = ndc.z < 1 && x > -60 && x < width + 60 && y > -30 && y < height + 30;
    const show = onScreen && (!overlap || body === focused);
    body.label.visible = show;
    if (show) placed.push({ x, y });
  }
}

function updateHud() {
  ui.date.textContent = formatDate(state.simDays);
  if (document.activeElement !== ui.gotoDate && Math.abs(state.simDays / YEAR) < 8000) {
    ui.gotoDate.value = isoFromSimDays(state.simDays);
  }
  ui.elapsed.textContent = formatElapsed(state.simDays / YEAR);
  const trueAU = (state.simDays / YEAR) * SUN_AU_PER_YEAR;
  ui.traveled.textContent = state.spaceMode ? `${formatAU(trueAU * state.motion)} on screen` : "Sun held still";
  ui.frame.textContent = state.spaceMode ? "Through space" : "Around the Sun";
  ui.viewDeg.textContent = viewDegrees();

  const focused = findFocus();
  ui.lesson.textContent = state.live
    ? "Live. Orbits match this clock, and one second here is one second outside."
    : lessonFor(focused);
  ui.telemetry?.classList.toggle("is-live", state.live);
  if (!focused || focused.kind === "sun") {
    ui.focusLabel.textContent = "Sun";
    ui.focusStat.textContent = sun.storm > 0.35 ? "Solar storm · 220 km/s" : "220 km/s · 27,000 ly out";
  } else if (focused.kind === "moon") {
    ui.focusLabel.textContent = focused.data.name;
    ui.focusStat.textContent = `${focused.speed.toFixed(2)} km/s · ${focused.moonOf}`;
  } else if (focused.kind === "satellite") {
    ui.focusLabel.textContent = focused.data.name;
    ui.focusStat.textContent = focused.blurb;
  } else if (focused.kind === "galaxy") {
    ui.focusLabel.textContent = focused.data.name;
    ui.focusStat.textContent = focused.blurb;
  } else if (focused.kind === "star" || focused.kind === "probe" || focused.kind === "exoplanet" || focused.kind === "heliopause") {
    ui.focusLabel.textContent = focused.data.name;
    ui.focusStat.textContent = focused.blurb;
  } else if (focused.kind === "comet") {
    const r = radiusAU(focused.data, state.simDays);
    ui.focusLabel.textContent = focused.data.name;
    ui.focusStat.textContent = `${r.toFixed(2)} AU · ${r < 3 ? "tail out" : "quiet"}`;
  } else {
    const r = radiusAU(focused.data, state.simDays);
    ui.focusLabel.textContent = focused.data.name;
    ui.focusStat.textContent = `${focused.data.speed.toFixed(2)} km/s · ${r.toFixed(2)} AU`;
  }
  refreshLiveDetails(focused);

  for (const body of catalog()) {
    const active = body === focused || (body === sun && state.focus === "Sun");
    body.labelEl.classList.toggle("is-active", active);
  }
  for (const button of ui.planets.children) {
    button.classList.toggle("is-on", button.dataset.focus === state.focus);
  }
}

const ORBIT_LABELS = new Set([
  "Mean distance",
  "Right now",
  "Year",
  "Orbital speed",
  "Period",
  "Inclination",
  "Distance",
  "Altitude",
  "Longitude",
  "From the center",
  "Around the galaxy",
  "Heading",
  "Location",
  "Halo period",
  "Eccentricity",
  "Perihelion",
  "Aphelion",
  "Orbit of b",
  "Separation",
  "Companion period",
  "Galactic year",
  "Sun's speed",
  "Speed",
  "Next return",
  "Last return",
]);
const MISSION_LABELS = new Set([
  "Operator",
  "First module",
  "Launched",
  "Interstellar",
  "Core module",
  "Mission",
  "Crew",
  "Shown here",
  "Found",
  "Arrived",
]);

function rowTab(label) {
  if (MISSION_LABELS.has(label)) return "missions";
  if (ORBIT_LABELS.has(label)) return "orbit";
  return "world";
}

let shownName = "";

function showDetails(body) {
  const fact = FACTS[body?.data?.name];
  if (!fact) {
    ui.details.hidden = true;
    shownName = "";
    placeLookPad();
    return;
  }
  const switched = shownName !== body.data.name;
  shownName = body.data.name;
  ui.detailsKind.textContent = fact.kind;
  ui.detailsName.textContent = body.data.name;
  ui.detailsSummary.textContent = fact.summary;
  ui.detailsScale.textContent = SCALE_NOTE[body.kind] || SCALE_NOTE.planet;
  const rows = fact.rows.concat(EXTRA_ROWS[body.data.name] || []);
  const groups = { orbit: [], world: [], missions: [] };
  for (const entry of rows) groups[rowTab(entry[0])].push(entry);
  const tabs = [
    ["orbit", "Orbit"],
    ["world", "World"],
    ["missions", "Missions"],
  ].filter(([key]) => groups[key].length);
  if (!groups[state.detailTab]?.length) state.detailTab = tabs[0]?.[0] || "world";
  ui.detailsTabs.replaceChildren();
  for (const [key, label] of tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(key === state.detailTab));
    button.addEventListener("click", () => {
      state.detailTab = key;
      showDetails(findFocus());
    });
    ui.detailsTabs.append(button);
  }
  fillFacts(ui.detailsFacts, groups[state.detailTab] || []);
  if (switched) {
    ui.compareWith.value = "";
    ui.compareOut.textContent = "Pick a second body to measure the gap, the radio time, and which one moves faster.";
  }
  ui.details.hidden = false;
  placeLookPad();
  refreshLiveDetails(body);
}

function fillFacts(list, entries) {
  list.replaceChildren();
  for (const entry of entries) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = entry[0];
    dd.textContent = entry[1];
    if (entry[2]) dd.dataset.live = entry[2];
    wrap.append(dt, dd);
    list.append(wrap);
  }
}

function refreshLiveDetails(body) {
  if (ui.details.hidden || !body) return;
  const live = ui.detailsFacts.querySelector("[data-live='distance']");
  if (live && body.data?.a) live.textContent = formatDistance(radiusAU(body.data, state.simDays), state.units);
  fillFacts(ui.detailsNow, momentRows(body, state.simDays, state.units));
  if (ui.compareWith.value) {
    const other = catalog().find((item) => item.data.name === ui.compareWith.value);
    ui.compareOut.textContent = compareText(body, other, state.simDays, state.units);
  }
}

function catalog() {
  return [sun, ...bodies, ...moons, ...satellites.craft, ...beyond.stars, ...beyond.exo, beyond.helio, ...galaxies.major];
}

function findFocus() {
  return catalog().find((body) => body.data.name === state.focus) || sun;
}

function aimSatelliteCamera(body, target) {
  const outward = target.clone().sub(body.host.world);
  if (outward.lengthSq() < 1e-4) return;
  outward.normalize();
  const dist = body.focusDist * followZoom;
  if (body.def.model === "jwst") {
    const side = new THREE.Vector3().crossVectors(outward, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    focusOffset.copy(side.multiplyScalar(0.72).add(outward.clone().multiplyScalar(0.62)).normalize()).multiplyScalar(dist);
    return;
  }
  if (body.def.model === "iss") {
    const radial = new THREE.Vector3(0, 1, 0).applyQuaternion(body.anchor.quaternion);
    const flight = new THREE.Vector3(0, 0, 1).applyQuaternion(body.anchor.quaternion);
    focusOffset.copy(flight.multiplyScalar(0.78).add(radial.multiplyScalar(0.38)).normalize()).multiplyScalar(dist);
    return;
  }
  focusOffset.copy(outward.multiplyScalar(0.82).add(new THREE.Vector3(0, 0.55, 0)).normalize()).multiplyScalar(dist);
}

function aimProbeCamera(body, target) {
  vecA.copy(target);
  if (vecA.lengthSq() < 1e-4) vecA.set(0, 0, 1);
  vecA.negate().normalize();
  vecB.crossVectors(UP, vecA);
  if (vecB.lengthSq() < 1e-4) vecB.set(1, 0, 0);
  vecB.normalize();
  vecC.crossVectors(vecA, vecB).normalize();
  const dist = body.focusDist * followZoom;
  focusOffset.copy(vecA).multiplyScalar(0.9).addScaledVector(vecC, 0.32).addScaledVector(vecB, 0.24).normalize().multiplyScalar(dist);
}

function focusBody(name) {
  state.focus = name;
  const body = findFocus();
  const target = body.world.clone();
  const from = camera.position.clone().sub(controls.target);
  let dist = THREE.MathUtils.clamp(body.radius * 16 + 6, 8, 90);
  if (body.kind === "sun") dist = 10.5;
  else if (body.kind === "moon") dist = Math.max(3.4, body.radius * 18);
  else if (body.kind === "satellite" || body.kind === "star" || body.kind === "probe" || body.kind === "exoplanet" || body.kind === "heliopause") dist = body.focusDist;
  else if (body.kind === "galaxy") dist = body.focusDist || Math.max(40, body.radius * 2.4);
  else if (body.kind === "dwarf") dist = 12;
  else if (body.kind === "comet") dist = 10;
  if (from.lengthSq() < 0.001) from.set(1, 0.45, 1);
  if (body.kind === "galaxy") focusOffset.set(dist * 0.16, dist * 0.95, dist * 0.1);
  else focusOffset.copy(from.normalize().multiplyScalar(dist));
  if (body.kind === "satellite" && body.host) {
    const outward = target.clone().sub(body.host.world);
    if (outward.lengthSq() > 1e-4) {
      outward.normalize();
      const side = new THREE.Vector3().crossVectors(outward, new THREE.Vector3(0, 1, 0));
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      if (body.def.model === "jwst") focusOffset.copy(side.multiplyScalar(0.72).add(outward.clone().multiplyScalar(0.62)).normalize()).multiplyScalar(dist);
      else focusOffset.copy(outward.multiplyScalar(0.82).add(new THREE.Vector3(0, 0.5, 0)).normalize().multiplyScalar(dist));
    }
  }
  followZoom = 1;
  if (body.kind === "probe") aimProbeCamera(body, target);
  followBase.copy(focusOffset);
  following = true;
  focusDesiredTarget.copy(target);
  focusDesiredCam.copy(target).add(focusOffset);
  focusTween = 0.7;
  showDetails(body);
  updateHud();
}

function showOrbitGuides(show) {
  for (const body of bodies) body.guide.visible = show && body.kind === "planet";
}

function setMode(space) {
  state.spaceMode = space;
  ui.modeSpace.setAttribute("aria-pressed", String(space));
  ui.modeOrbit.setAttribute("aria-pressed", String(!space));
  ui.orbits.checked = !space;
  showOrbitGuides(!space);
  arrow.visible = space;
  syncFrameLesson();
}

function syncFrameLesson() {
  ui.frameLesson.textContent = state.spaceMode
    ? "The Sun is moving. Each orbit stretches into a helix along that path."
    : "The Sun is held still. You see the closed orbit, the view in a textbook.";
}

function setPanel(open) {
  ui.panel.classList.toggle("open", open);
  ui.toggle.hidden = open;
  placeLookPad();
}

function bindUi() {
  if (window.matchMedia("(max-width: 800px)").matches) setPanel(false);

  ui.detailsClose.addEventListener("click", () => {
    ui.details.hidden = true;
    placeLookPad();
  });
  ui.lookPad.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.zoom) {
      event.preventDefault();
      setZoom(button.dataset.zoom, true);
      queueZoom(button.dataset.zoom === "in" ? -1.15 : 1.15);
      button.setPointerCapture(event.pointerId);
      return;
    }
    if (!button.dataset.look) return;
    event.preventDefault();
    setLook(button.dataset.look, true);
    button.setPointerCapture(event.pointerId);
  });
  const releaseLook = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.zoom) setZoom(button.dataset.zoom, false);
    if (button.dataset.look) setLook(button.dataset.look, false);
  };
  ui.lookPad.addEventListener("pointerup", releaseLook);
  ui.lookPad.addEventListener("pointercancel", releaseLook);
  ui.play.addEventListener("click", togglePlay);
  ui.live.addEventListener("click", () => setLive(!state.live));
  ui.toggle.addEventListener("click", () => setPanel(true));
  ui.close.addEventListener("click", () => setPanel(false));
  ui.modeSpace.addEventListener("click", () => setMode(true));
  ui.modeOrbit.addEventListener("click", () => setMode(false));

  ui.presets.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    leaveLive();
    state.daysPerSecond = Number(button.dataset.dps);
    ui.speed.value = String(dpsToSlider(state.daysPerSecond));
    syncSpeedUi();
  });

  ui.speed.addEventListener("input", () => {
    leaveLive();
    state.daysPerSecond = sliderToDps(Number(ui.speed.value));
    syncSpeedUi();
  });

  ui.trail.addEventListener("input", () => {
    state.trailYears = Number(ui.trail.value);
    ui.trailVal.textContent = `${trimNum(state.trailYears)} yr`;
  });

  ui.motion.addEventListener("input", syncMotion);
  ui.tilt.addEventListener("input", () => {
    state.tilt = Number(ui.tilt.value) * THREE.MathUtils.DEG2RAD;
    syncTilt();
  });

  ui.labels.addEventListener("change", () => {
    if (!ui.labels.checked) {
      for (const body of catalog()) body.label.visible = false;
    }
  });
  ui.trails.addEventListener("change", () => {});
  ui.orbits.addEventListener("change", () => {
    showOrbitGuides(ui.orbits.checked);
  });
  ui.moon.addEventListener("change", () => {
    for (const moon of moons) {
      moon.anchor.visible = ui.moon.checked;
      if (!ui.moon.checked) moon.label.visible = false;
    }
  });
  ui.satellites.addEventListener("change", () => {
    if (!ui.satellites.checked) {
      for (const craft of satellites.craft) craft.label.visible = false;
    }
  });

  ui.resetView.addEventListener("click", () => {
    focusTween = 0;
    following = false;
    camera.position.copy(HOME_CAM);
    controls.target.copy(HOME_TARGET);
  });
  ui.resetTime.addEventListener("click", () => {
    leaveLive();
    state.simDays = 0;
    state.spinAccum = 0;
    updateHud();
  });

  window.addEventListener("keydown", (event) => {
    const dir = LOOK_KEYS[event.code];
    if (dir) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (typing) return;
      event.preventDefault();
      if (!event.repeat) setLook(dir, true);
      return;
    }
    if (event.code !== "Space" || event.repeat) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    togglePlay();
  });
  window.addEventListener("keyup", (event) => {
    const dir = LOOK_KEYS[event.code];
    if (dir) setLook(dir, false);
  });

  ui.units.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    state.units = button.dataset.unit;
    for (const item of ui.units.querySelectorAll("button")) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    refreshLiveDetails(findFocus());
  });

  ui.gotoGo.addEventListener("click", () => goToIso(ui.gotoDate.value));
  ui.gotoDate.addEventListener("keydown", (event) => {
    if (event.key === "Enter") goToIso(ui.gotoDate.value);
  });

  ui.compareWith.addEventListener("change", () => refreshLiveDetails(findFocus()));
  ui.search.addEventListener("input", () => renderSearch(ui.search.value));
  ui.search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const first = ui.searchResults.querySelector("button");
    if (first) first.click();
  });
  ui.share.addEventListener("click", copyShareLink);
  ui.tourStop.addEventListener("click", stopTour);

  buildFocusButtons();
  buildEvents();
  buildTours();
  buildCompareOptions();
  syncSpeedUi();
  syncMotion();
  syncTilt();
  syncFrameLesson();
  ui.trailVal.textContent = "5 yr";
  setMode(false);
  applyQuery();
}

function buildFocusButtons() {
  const items = [
    ["Sun", "#ffb15a"],
    ...PLANETS.map((p) => [p.name, "#" + new THREE.Color(p.color).getHexString()]),
    ["ISS", "#ffe1a8"],
    ["Pluto", "#d2b9a2"],
    ["Halley", "#b7d4e8"],
  ];
  for (const [name, color] of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.focus = name;
    button.style.setProperty("--c", color);
    button.textContent = name;
    button.addEventListener("click", () => focusBody(name));
    ui.planets.appendChild(button);
  }
}

function togglePlay() {
  state.playing = !state.playing;
  if (state.live && state.playing) {
    state.simDays = (Date.now() - EPOCH_MS) / 86400000;
    state.spinAccum = state.simDays;
  }
  ui.play.textContent = state.playing ? "Pause" : "Play";
}

function setLive(on) {
  if (on) {
    if (activeTour) {
      activeTour = null;
      tourLesson = null;
      ui.tourStop.hidden = true;
    }
    if (!state.live) savedSpeed = state.daysPerSecond;
    state.live = true;
    state.playing = true;
    state.daysPerSecond = REAL_DPS;
    ui.speed.value = String(dpsToSlider(REAL_DPS));
    state.simDays = (Date.now() - EPOCH_MS) / 86400000;
    state.spinAccum = state.simDays;
    syncSpeedUi();
  } else if (state.live) {
    state.live = false;
    if (savedSpeed != null) {
      state.daysPerSecond = savedSpeed;
      ui.speed.value = String(dpsToSlider(savedSpeed));
      savedSpeed = null;
      syncSpeedUi();
    }
  }
  ui.live.setAttribute("aria-pressed", String(state.live));
  ui.play.textContent = state.playing ? "Pause" : "Play";
  updateBodies();
  updateHud();
}

function leaveLive() {
  if (!state.live) return;
  state.live = false;
  savedSpeed = null;
  ui.live.setAttribute("aria-pressed", "false");
}

function goToIso(iso, focusName) {
  const days = simDaysFromIso(iso);
  if (days == null || Number.isNaN(days)) return;
  leaveLive();
  state.simDays = days;
  state.spinAccum = 0;
  updateBodies();
  if (focusName) focusBody(focusName);
  else updateHud();
}

function buildEvents() {
  for (const event of EVENTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = event.name;
    button.addEventListener("click", () => goToIso(event.iso, event.focus));
    ui.events.append(button);
  }
}

function buildTours() {
  for (const tour of TOURS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tour.name;
    button.addEventListener("click", () => startTour(tour));
    ui.tours.append(button);
  }
}

function startTour(tour) {
  leaveLive();
  const snap = activeTour?.snap || {
    dps: state.daysPerSecond,
    motion: ui.motion.value,
    space: state.spaceMode,
    trail: state.trailYears,
  };
  activeTour = { def: tour, elapsed: 0, step: 0, snap };
  tourLesson = null;
  ui.tourStop.hidden = false;
  if (!state.playing) togglePlay();
  advanceTour(0);
}

function advanceTour(dt) {
  if (!activeTour) return;
  activeTour.elapsed += dt;
  const steps = activeTour.def.steps;
  while (activeTour && activeTour.step < steps.length && steps[activeTour.step].t <= activeTour.elapsed + 0.001) {
    const step = steps[activeTour.step];
    activeTour.step += 1;
    applyTourStep(step);
  }
  if (activeTour && activeTour.step >= steps.length && activeTour.elapsed > steps[steps.length - 1].t + 4) {
    activeTour = null;
    tourLesson = null;
    ui.tourStop.hidden = true;
    updateHud();
  }
}

function applyTourStep(step) {
  if (step.space != null && step.space !== state.spaceMode) setMode(step.space);
  if (step.dps != null) {
    state.daysPerSecond = step.dps;
    ui.speed.value = String(dpsToSlider(step.dps));
    syncSpeedUi();
  }
  if (step.trail != null) {
    state.trailYears = step.trail;
    ui.trail.value = String(Math.min(40, Math.max(0.5, step.trail)));
    ui.trailVal.textContent = `${trimNum(state.trailYears)} yr`;
  }
  if (step.motion != null) {
    ui.motion.value = String(step.motion);
    syncMotion();
  }
  if (step.lesson) tourLesson = step.lesson;
  if (step.focus) focusBody(step.focus);
  else updateHud();
}

function stopTour() {
  if (!activeTour) return;
  const snap = activeTour.snap;
  activeTour = null;
  tourLesson = null;
  ui.tourStop.hidden = true;
  state.daysPerSecond = snap.dps;
  ui.speed.value = String(dpsToSlider(snap.dps));
  syncSpeedUi();
  ui.motion.value = String(snap.motion);
  syncMotion();
  state.trailYears = snap.trail;
  ui.trail.value = String(snap.trail);
  ui.trailVal.textContent = `${trimNum(snap.trail)} yr`;
  if (snap.space !== state.spaceMode) setMode(snap.space);
  updateHud();
}

function renderSearch(query) {
  const q = query.trim().toLowerCase();
  ui.searchResults.replaceChildren();
  if (!q) return;
  const matches = catalog().filter((body) => body.data.name.toLowerCase().includes(q)).slice(0, 8);
  for (const body of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = body.data.name;
    button.addEventListener("click", () => {
      focusBody(body.data.name);
      ui.search.value = "";
      ui.searchResults.replaceChildren();
    });
    ui.searchResults.append(button);
  }
}

function buildCompareOptions() {
  ui.compareWith.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Choose a body";
  ui.compareWith.append(blank);
  const seen = new Set();
  for (const body of catalog()) {
    if (seen.has(body.data.name)) continue;
    seen.add(body.data.name);
    const option = document.createElement("option");
    option.value = body.data.name;
    option.textContent = body.data.name;
    ui.compareWith.append(option);
  }
}

function copyShareLink() {
  const url = new URL(location.href);
  url.searchParams.set("d", state.simDays.toFixed(2));
  url.searchParams.set("f", state.focus);
  url.searchParams.set("m", state.spaceMode ? "space" : "sun");
  url.searchParams.set("s", state.daysPerSecond.toFixed(6));
  if (state.live) url.searchParams.set("l", "1");
  else url.searchParams.delete("l");
  history.replaceState(null, "", url);
  const text = url.toString();
  const done = () => {
    ui.share.textContent = "Copied";
    setTimeout(() => {
      ui.share.textContent = "Copy link";
    }, 1400);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(done);
  else done();
}

function applyQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get("m") === "space") setMode(true);
  const speed = Number(q.get("s"));
  if (q.has("s") && speed > 0) {
    state.daysPerSecond = speed;
    ui.speed.value = String(dpsToSlider(speed));
    syncSpeedUi();
  }
  const days = Number(q.get("d"));
  if (q.has("d") && Number.isFinite(days)) state.simDays = days;
  const focus = q.get("f");
  if (focus && catalog().some((body) => body.data.name === focus)) focusBody(focus);
  if (q.get("l") === "1") setLive(true);
}

function createVectors() {
  const sunDir = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 4, 0xffb15a, 1.1, 0.45);
  const motion = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 4, 0x8eb7ff, 1.1, 0.45);
  for (const part of [sunDir.line, sunDir.cone, motion.line, motion.cone]) {
    if (part?.material) part.material.toneMapped = false;
  }
  const group = new THREE.Group();
  group.add(sunDir, motion);
  group.visible = false;
  scene.add(group);
  return { group, sunDir, motion };
}

function updateVectors() {
  const body = findFocus();
  const show = body && (body.kind === "planet" || body.kind === "dwarf" || body.kind === "comet");
  vectors.group.visible = Boolean(show);
  if (!show) return;
  vecC.copy(sun.world).sub(body.world);
  if (vecC.lengthSq() < 1e-6) {
    vectors.group.visible = false;
    return;
  }
  const reach = camera.position.distanceTo(body.world);
  const length = THREE.MathUtils.clamp(reach * 0.11, body.radius * 4.5, 16);
  vecC.normalize();
  vectors.sunDir.position.copy(body.world);
  vectors.sunDir.setDirection(vecC);
  vectors.sunDir.setLength(length, length * 0.28, length * 0.14);
  eclipticPosition(body.data, state.simDays, eclipticVec);
  toScene(eclipticVec, vecA);
  eclipticPosition(body.data, state.simDays + 0.2, eclipticVec);
  toScene(eclipticVec, vecB);
  vecA.applyAxisAngle(AXIS_X, state.tilt);
  vecB.applyAxisAngle(AXIS_X, state.tilt);
  vecC.subVectors(vecB, vecA);
  if (vecC.lengthSq() < 1e-8) {
    vectors.motion.visible = false;
    return;
  }
  vectors.motion.visible = true;
  vecC.normalize();
  vectors.motion.position.copy(body.world);
  vectors.motion.setDirection(vecC);
  vectors.motion.setLength(length * 1.15, length * 0.28, length * 0.14);
}

function updateCometTails() {
  for (const body of bodies) {
    if (!body.tail) continue;
    const away = body.anchor.position;
    if (away.lengthSq() < 1e-6) continue;
    vecA.copy(away).normalize();
    body.tail.position.copy(vecA).multiplyScalar(body.radius * 8);
    body.tail.quaternion.setFromUnitVectors(UP, vecA);
    const au = radiusAU(body.data, state.simDays);
    const bright = THREE.MathUtils.smoothstep(au, 4.2, 0.8);
    body.tail.material.opacity = bright * 0.55;
    body.tail.visible = bright > 0.04;
  }
}

function syncSpeedUi() {
  ui.speedHint.textContent = speedLabel(state.daysPerSecond);
  for (const button of ui.presets.querySelectorAll("button")) {
    const dps = Number(button.dataset.dps);
    button.classList.toggle("is-on", Math.abs(Math.log10(dps) - Math.log10(state.daysPerSecond)) < 0.08);
  }
}

function syncMotion() {
  state.motion = Number(ui.motion.value) / 100;
  ui.motionVal.textContent = `${ui.motion.value}%`;
  const advance = SUN_AU_PER_YEAR * state.motion;
  ui.motionHint.textContent =
    state.motion > 0.97
      ? "True scale. The Sun moves about 46 AU per Earth year, so the helices are long and loose."
      : `Drawn tighter so the spirals read. The Sun advances ${advance.toFixed(1)} AU per Earth year on screen. The true distance is 46 AU.`;
}

function syncTilt() {
  const deg = Number(ui.tilt.value);
  ui.tiltVal.textContent = `${deg}°`;
  ui.tiltHint.textContent =
    deg === 60
      ? "60° to the galactic plane — the real tilt. Planets sometimes lead the Sun and sometimes trail it."
      : deg > 80
        ? "Nearly face-on to the Sun’s motion. This is the tight corkscrew from the popular clips."
        : deg < 5
          ? "Orbits lying in the galactic plane. Motion is mostly ahead of and behind the Sun."
          : `${deg}° between the orbit plane and the galaxy.`;
}

function sliderToDps(value) {
  return 10 ** (LOG_MIN + (value / 100) * (LOG_MAX - LOG_MIN));
}

function dpsToSlider(dps) {
  const t = (Math.log10(Math.max(dps, 1e-8)) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return THREE.MathUtils.clamp(t * 100, 0, 100);
}

function speedLabel(dps) {
  if (dps < 1 / 86400 * 2) return "Real time";
  if (dps < 0.2) return `${trimNum(dps * 24)} hours / sec`;
  if (dps < 2) return `${trimNum(dps)} days / sec`;
  if (dps < 45) return `${trimNum(dps / 7)} weeks / sec`;
  if (dps < 500) return `${trimNum(dps / 30.437)} months / sec`;
  return `${trimNum(dps / YEAR)} years / sec`;
}

function trimNum(n) {
  return n >= 10 ? n.toFixed(0) : n.toFixed(n >= 1 ? 1 : 2);
}

function formatElapsed(years) {
  const sign = years < 0 ? "−" : "";
  const y = Math.abs(years);
  if (y < 100) return `${sign}${y.toFixed(2)} yr`;
  if (y < 1e6) return `${sign}${Math.round(y).toLocaleString()} yr`;
  return `${sign}${(y / 1e6).toFixed(3)} Myr`;
}

function formatAU(au) {
  const sign = au < 0 ? "−" : "";
  const v = Math.abs(au);
  if (v < 100) return `${sign}${v.toFixed(1)} AU`;
  if (v < 1e6) return `${sign}${Math.round(v).toLocaleString()} AU`;
  return `${sign}${(v / 63241).toFixed(2)} ly`;
}

function viewDegrees() {
  const ox = camera.position.x - controls.target.x;
  const oy = camera.position.y - controls.target.y;
  const oz = camera.position.z - controls.target.z;
  const dist = Math.hypot(ox, oy, oz) || 1;
  const elev = Math.round(Math.asin(THREE.MathUtils.clamp(oy / dist, -1, 1)) * THREE.MathUtils.RAD2DEG);
  const around = Math.round(THREE.MathUtils.euclideanModulo(Math.atan2(ox, oz) * THREE.MathUtils.RAD2DEG, 360));
  const pitch = elev >= 0 ? `${elev}° up` : `${-elev}° down`;
  return `${pitch} · ${around}°`;
}

function formatDate(simDays) {
  const years = simDays / YEAR;
  if (Math.abs(years) > 8000) {
    const abs = Math.abs(2026 + years);
    if (abs >= 1e6) return `${(abs / 1e6).toFixed(2)} Myr ${years + 2026 >= 0 ? "CE" : "BCE"}`;
    return `${Math.round(abs).toLocaleString()} ${years + 2026 >= 0 ? "CE" : "BCE"}`;
  }
  const date = new Date(EPOCH_MS + simDays * 86400000);
  if (state.live) {
    return date.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function createStars() {
  const count = 2800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 500 + Math.random() * 1700;
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u * (i % 5 === 0 ? 0.35 : 1);
    positions[i * 3 + 2] = r * s * Math.sin(theta);
    color.setHSL(0.58 + Math.random() * 0.1, 0.15 + Math.random() * 0.2, 0.75 + Math.random() * 0.25);
    if (Math.random() < 0.08) color.setHSL(0.08, 0.45, 0.75);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 2.4,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
      sizeAttenuation: true,
    }),
  );
  points.frustumCulled = false;
  scene.add(points);

  const bandCount = 2200;
  const bandPos = new Float32Array(bandCount * 3);
  const bandCol = new Float32Array(bandCount * 3);
  for (let i = 0; i < bandCount; i++) {
    const radius = 700 + Math.random() * 1600;
    const theta = Math.random() * Math.PI * 2;
    const y = gauss() * 70;
    bandPos[i * 3] = Math.cos(theta) * radius;
    bandPos[i * 3 + 1] = y;
    bandPos[i * 3 + 2] = Math.sin(theta) * radius;
    color.setHSL(0.62, 0.25, 0.55 + Math.random() * 0.2);
    bandCol[i * 3] = color.r;
    bandCol[i * 3 + 1] = color.g;
    bandCol[i * 3 + 2] = color.b;
  }
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute("position", new THREE.BufferAttribute(bandPos, 3));
  bandGeo.setAttribute("color", new THREE.BufferAttribute(bandCol, 3));
  const band = new THREE.Points(
    bandGeo,
    new THREE.PointsMaterial({
      map: starTexture,
      size: 2.1,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
      sizeAttenuation: true,
    }),
  );
  band.frustumCulled = false;
  scene.add(band);
}

function createSun() {
  const radius = 2.25;
  const group = new THREE.Group();
  const surfaceMat = sunSurfaceMaterial();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), surfaceMat);
  group.add(mesh);
  loadTexture("sun.jpg", (tex) => {
    surfaceMat.uniforms.uMap.value = tex;
    surfaceMat.uniforms.uHasMap.value = 1;
  });

  const coronaMat = coronaMaterial();
  const corona = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.22, 64, 48), coronaMat);
  corona.visible = false;
  group.add(corona);

  const promMat = prominenceMaterial();
  const prominences = new THREE.Group();
  for (let i = 0; i < 8; i++) prominences.add(makeProminence(radius, promMat, i));
  prominences.visible = false;
  group.add(prominences);

  const flares = Array.from({ length: 8 }, () => {
    const material = new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    material.toneMapped = false;
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.scale.set(0.4, 0.4, 1);
    group.add(sprite);
    return { sprite, dir: new THREE.Vector3(), age: 0, life: 1, active: false };
  });

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    }),
  );
  glow.material.toneMapped = false;
  glow.scale.set(9.5, 9.5, 1);
  group.add(glow);
  scene.add(group);

  const label = makeLabel("Sun", "#ffb15a", () => focusBody("Sun"));
  label.position.set(0, radius + 1.5, 0);
  scene.add(label);
  return {
    mesh,
    corona,
    prominences,
    promMat,
    flares,
    glow,
    group,
    label,
    labelEl: label.element,
    world: new THREE.Vector3(),
    radius,
    anchor: mesh,
    kind: "sun",
    data: { name: "Sun" },
    storm: 0,
    lastFlare: 0,
  };
}

function updateSun(dt, now) {
  const dist = camera.position.distanceTo(sun.world);
  const t = THREE.MathUtils.clamp((30 - dist) / (30 - 8), 0, 1);
  const storm = t * t * (3 - 2 * t);
  sun.storm = storm;
  const seconds = now * 0.001;
  sun.mesh.material.uniforms.uTime.value = seconds;
  sun.mesh.material.uniforms.uStorm.value = storm;
  sun.corona.material.uniforms.uTime.value = seconds;
  sun.corona.material.uniforms.uStorm.value = storm;
  sun.corona.visible = storm > 0.08;
  sun.prominences.visible = storm > 0.15;
  sun.promMat.uniforms.uOpacity.value = storm * 0.95;
  sun.prominences.rotation.y += dt * 0.08;
  sun.group.rotation.y += dt * 0.03;
  sun.glow.material.opacity = 0.95 * (1 - storm * 0.78);
  const glowScale = 9.5 * (1 - storm * 0.45);
  sun.glow.scale.set(glowScale, glowScale, 1);

  if (storm > 0.45 && now - sun.lastFlare > 1100) {
    sun.lastFlare = now;
    launchFlare();
  }
  for (const flare of sun.flares) {
    if (!flare.active) continue;
    flare.age += dt;
    const life = flare.age / flare.life;
    if (life >= 1 || storm < 0.05) {
      flare.active = false;
      flare.sprite.visible = false;
      continue;
    }
    const height = sun.radius * (1.01 + life * 2.1);
    flare.sprite.position.copy(flare.dir).multiplyScalar(height);
    const scale = 0.25 + life * 2.4;
    flare.sprite.scale.set(scale, scale * (1.4 - life * 0.6), 1);
    flare.sprite.material.opacity = Math.sin(life * Math.PI) * (0.35 + storm * 0.65);
  }
}

function launchFlare() {
  const flare = sun.flares.find((item) => !item.active);
  if (!flare) return;
  flare.dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
  flare.age = 0;
  flare.life = 1.3 + Math.random() * 1.5;
  flare.active = true;
  flare.sprite.visible = true;
  flare.sprite.position.copy(flare.dir).multiplyScalar(sun.radius);
}

function makeProminence(radius, material, index) {
  const azimuth = (index / 8) * Math.PI * 2 + index * 0.17;
  const tilt = (index - 3.5) * 0.28;
  const height = 0.9 + (index % 3) * 0.55;
  const span = 0.42 + (index % 4) * 0.14;
  const base = new THREE.Vector3(Math.cos(azimuth) * Math.cos(tilt), Math.sin(tilt), Math.sin(azimuth) * Math.cos(tilt)).normalize();
  const side = new THREE.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth)).normalize();
  const points = [];
  const steps = 22;
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const angle = (u - 0.5) * span;
    const lift = Math.sin(u * Math.PI) * height * (0.75 + 0.25 * Math.sin(u * Math.PI * 2));
    const dir = base.clone().multiplyScalar(Math.cos(angle)).add(side.clone().multiplyScalar(Math.sin(angle))).normalize();
    points.push(dir.multiplyScalar(radius + lift));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.016 + (index % 3) * 0.008, 6, false), material);
}

function sunSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uStorm: { value: 0 },
      uMap: { value: whitePixel() },
      uHasMap: { value: 0 },
    },
    vertexShader: `
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec2 vUv;
      void main() {
        vObj = position;
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uStorm;
      uniform sampler2D uMap;
      uniform float uHasMap;
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec2 vUv;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.23, 0.37));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
          mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
              mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
          f.z);
      }

      void main() {
        vec3 n = normalize(vObj);
        float gran = noise(n * 20.0 + vec3(uTime * 0.07, uTime * 0.04, 0.2));
        float fine = noise(n * 46.0 - vec3(uTime * 0.05, 0.3, uTime * 0.08));
        float spots = smoothstep(0.58, 0.8, noise(n * 3.2 + vec3(1.7, uTime * 0.015, 0.4)));
        float flare = smoothstep(0.7, 0.92, noise(n * 7.5 + vec3(0.0, uTime * 0.45, 2.0)));
        vec3 base = vec3(1.0, 0.58, 0.16);
        if (uHasMap > 0.5) base *= texture2D(uMap, vUv).rgb * vec3(1.45, 1.08, 0.72);
        base *= 0.78 + 0.32 * gran + 0.1 * fine;
        base = mix(base, base * vec3(0.35, 0.18, 0.08), spots * uStorm);
        base += vec3(1.0, 0.9, 0.5) * flare * uStorm * 1.5;
        float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
        base *= 0.42 + 0.58 * pow(mu, 0.42);
        gl_FragColor = vec4(base, 1.0);
      }
    `,
  });
}

function prominenceMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vWorld;
      void main() {
        vec3 radial = normalize(vWorld);
        float face = dot(radial, normalize(cameraPosition));
        float limb = smoothstep(0.82, 0.22, face);
        float lift = smoothstep(2.15, 3.6, length(vWorld));
        vec3 col = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.86, 0.48), lift);
        float alpha = uOpacity * limb;
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function coronaMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uStorm: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vObj;
      void main() {
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vObj;
      uniform float uTime;
      uniform float uStorm;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.65);
        float ang = atan(vObj.z, vObj.x);
        float stream = 0.5 + 0.5 * sin(ang * 9.0 + uTime * 0.9 + vObj.y * 5.0);
        float burst = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(ang * 3.0 - uTime * 1.6));
        float alpha = fres * stream * (0.08 + 0.92 * uStorm) * (0.65 + burst * uStorm);
        vec3 col = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.92, 0.62), fres);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createBody(data) {
  let radius = visualRadius(data.re);
  if (data.kind === "dwarf") radius = Math.max(radius, 0.28);
  if (data.kind === "comet") radius = 0.34;
  const anchor = new THREE.Group();
  const tiltPivot = new THREE.Group();
  tiltPivot.rotation.z = data.tilt;
  const spinner = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: data.color,
    roughness: data.name === "Jupiter" || data.name === "Saturn" ? 0.62 : 0.82,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, data.re > 3 ? 64 : 40, data.re > 3 ? 48 : 32), material);
  spinner.add(mesh);
  tiltPivot.add(spinner);
  anchor.add(tiltPivot);
  ecliptic.add(anchor);
  if (data.texture) {
    loadTexture(data.texture, (tex) => {
      material.map = tex;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });
  }

  let tail = null;
  if (data.kind === "comet") {
    tail = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 1.4, radius * 16, 14),
      new THREE.MeshBasicMaterial({ color: 0xd6ecff, transparent: true, opacity: 0, depthWrite: false }),
    );
    tail.raycast = () => {};
    anchor.add(tail);
  }
  let hit = mesh;
  if (data.kind === "dwarf" || data.kind === "comet") {
    hit = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(radius * 3, 1.1), 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    anchor.add(hit);
  }

  if (data.name === "Earth") {
    const atmos = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 40, 32), atmosphereMaterial());
    anchor.add(atmos);
  }
  if (data.name === "Saturn" || data.name === "Uranus") {
    tiltPivot.add(makeRings(data, radius));
  }

  const guide = makeGuide(data);
  ecliptic.add(guide);

  const color = "#" + new THREE.Color(data.color).getHexString();
  const label = makeLabel(data.name, color, () => focusBody(data.name));
  scene.add(label);

  return {
    data,
    kind: data.kind || "planet",
    radius,
    anchor,
    spinner,
    mesh,
    hit,
    tail,
    guide,
    label,
    labelEl: label.element,
    world: new THREE.Vector3(),
    samples: Array.from({ length: MAX_STEPS }, () => new THREE.Vector3()),
  };
}

function createMoons() {
  return MOONS.map((def) => {
    const parentBody = bodies.find((body) => body.data.name === def.planet);
    const radius = moonBodyRadius(parentBody.radius, def.km, def.planetKm);
    const anchor = new THREE.Group();
    const spinner = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: def.texture && def.texture !== "moon" ? 0xffffff : def.color,
      roughness: def.texture === "ice" || def.texture === "europa" ? 0.45 : 0.94,
      metalness: 0,
    });
    if (def.texture && def.texture !== "moon") material.map = proceduralMoonMap(def.texture);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 20), material);
    spinner.add(mesh);
    anchor.add(spinner);
    parentBody.anchor.add(anchor);
    if (def.texture === "moon") {
      loadTexture("moon.jpg", (tex) => {
        material.map = tex;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      });
    }
    const color = "#" + new THREE.Color(def.color).getHexString();
    const label = makeLabel(def.name, color, () => focusBody(def.name));
    scene.add(label);
    return {
      def,
      data: { name: def.name },
      kind: "moon",
      moonOf: def.planet,
      speed: def.speed,
      parentBody,
      distance: moonOrbitDistance(parentBody.radius, def.radii),
      anchor,
      spinner,
      mesh,
      label,
      labelEl: label.element,
      world: new THREE.Vector3(),
      radius,
    };
  });
}

function updateMoons() {
  const show = ui.moon.checked;
  for (const moon of moons) {
    const direction = moon.def.retrograde ? -1 : 1;
    const angle = direction * ((Math.PI * 2 * state.simDays) / moon.def.period + moon.def.phase);
    const incl = moon.def.incl * THREE.MathUtils.DEG2RAD;
    const x = Math.cos(angle) * moon.distance;
    const flatZ = Math.sin(angle) * moon.distance;
    moon.anchor.position.set(x, flatZ * Math.sin(incl), flatZ * Math.cos(incl));
    moon.anchor.visible = show;
    moon.spinner.rotation.y += 0.002;
    moon.anchor.getWorldPosition(moon.world);
    moon.label.position.copy(moon.world);
    moon.label.position.y += moon.radius * 2.4 + 0.12;
  }
}

function createGalaxies() {
  const built = buildGalaxies();
  for (const galaxy of built.major) {
    scene.add(galaxy.mesh);
    const label = makeLabel(galaxy.data.name, galaxy.color, () => focusBody(galaxy.data.name));
    label.position.copy(galaxy.mesh.position);
    label.position.y += galaxy.labelLift ?? Math.max(12, galaxy.radius * 0.62);
    scene.add(label);
    galaxy.label = label;
    galaxy.labelEl = label.element;
    galaxy.world = galaxy.mesh.position;
  }
  for (const galaxy of built.deep) scene.add(galaxy.mesh);
  return built;
}

function fadeGalaxy() {
  const height = Math.abs(camera.position.y);
  const show = THREE.MathUtils.smoothstep(height, 120, 520);
  for (const galaxy of galaxies.major) {
    if (galaxy.fade) {
      galaxy.fade(show);
      continue;
    }
    const showUniform = galaxy.mesh.material.uniforms?.uShow;
    if (showUniform) showUniform.value = show;
    if (galaxy.glow) galaxy.glow.material.opacity = 0.4 * show;
  }
}

function proceduralMoonMap(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (kind === "io") {
    g.fillStyle = "#e2b24a";
    g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = i % 2 ? "#f4e2a0" : "#c45a28";
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 128, 10 + Math.random() * 28, 6 + Math.random() * 14, Math.random(), 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === "europa") {
    g.fillStyle = "#efeae2";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "rgba(176, 92, 70, 0.85)";
    g.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      g.moveTo(Math.random() * 256, Math.random() * 128);
      g.bezierCurveTo(Math.random() * 256, Math.random() * 128, Math.random() * 256, Math.random() * 128, Math.random() * 256, Math.random() * 128);
      g.stroke();
    }
  } else if (kind === "titan") {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#c9843e");
    grad.addColorStop(0.5, "#e2a85a");
    grad.addColorStop(1, "#a86a32");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "rgba(255, 220, 170, 0.25)";
    for (let i = 0; i < 8; i++) g.fillRect(0, i * 16 + 4, 256, 6);
  } else if (kind === "triton") {
    g.fillStyle = "#ead4cc";
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#b85a62";
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.ellipse(Math.random() * 256, 20 + Math.random() * 90, 18, 5, -0.4, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle = "#f4f7fb";
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = "rgba(150, 176, 190, 0.7)";
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.moveTo(Math.random() * 256, Math.random() * 128);
      g.lineTo(Math.random() * 256, Math.random() * 128);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function createBelt() {
  const count = 700;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      map: starTexture,
      color: 0xd9cbb8,
      size: 0.55,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const rng = mulberry32(20261025);
  points.userData.rocks = Array.from({ length: count }, () => {
    const a = 2.15 + rng() * 1.25;
    return {
      a,
      e: rng() * 0.16,
      i: (rng() - 0.5) * 12 * THREE.MathUtils.DEG2RAD,
      O: rng() * Math.PI * 2,
      w: rng() * Math.PI * 2,
      M0: rng() * Math.PI * 2,
      period: YEAR * Math.pow(a, 1.5),
    };
  });
  ecliptic.add(points);
  return points;
}

function updateBelt() {
  const positions = belt.geometry.attributes.position.array;
  const rocks = belt.userData.rocks;
  for (let i = 0; i < rocks.length; i++) {
    const rock = rocks[i];
    const fake = {
      a: rock.a,
      e: rock.e,
      i: rock.i,
      O: rock.O,
      w: rock.w,
      M0: rock.M0,
      period: rock.period,
    };
    eclipticPosition(fake, state.simDays, eclipticVec);
    toScene(eclipticVec, sceneVec);
    positions[i * 3] = sceneVec.x;
    positions[i * 3 + 1] = sceneVec.y;
    positions[i * 3 + 2] = sceneVec.z;
  }
  belt.geometry.attributes.position.needsUpdate = true;
}

function createRibbon(body) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_VERTS * 3), 3));
  geometry.setAttribute("along", new THREE.BufferAttribute(new Float32Array(MAX_VERTS), 1));
  geometry.setAttribute("side", new THREE.BufferAttribute(new Float32Array(MAX_VERTS), 1));
  geometry.setDrawRange(0, 0);
  const material = ribbonMaterial(body.data.color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return { mesh, geometry };
}

function createArrow() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd7a8 });
  mat.toneMapped = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 12, 12), mat);
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.set(13, 6.2, 0);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.5, 18), mat);
  head.rotation.z = -Math.PI / 2;
  head.position.set(19.4, 6.2, 0);
  group.add(shaft, head);
  const label = new CSS2DObject(Object.assign(document.createElement("div"), { className: "dir-label", textContent: "Sun’s motion" }));
  label.position.set(16, 8.4, 0);
  group.add(label);
  scene.add(group);
  return group;
}

function makeGuide(data) {
  const points = [];
  const steps = 256;
  const probe = { ...data };
  for (let i = 0; i < steps; i++) {
    probe.M0 = data.M0 + (Math.PI * 2 * i) / steps;
    eclipticPosition(probe, -EPOCH_OFFSET_DAYS, eclipticVec);
    points.push(toScene(eclipticVec, new THREE.Vector3()).clone());
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: data.color,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.visible = false;
  return line;
}

function makeRings(data, radius) {
  const inner = radius * (data.name === "Saturn" ? 1.28 : 1.55);
  const outer = radius * (data.name === "Saturn" ? 2.22 : 1.92);
  const geometry = new THREE.RingGeometry(inner, outer, 180);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uInner: { value: inner },
      uOuter: { value: outer },
      uColor: { value: new THREE.Color(data.name === "Saturn" ? 0xf0d7b0 : 0xc8fff8) },
      uStrength: { value: data.name === "Saturn" ? 0.85 : 0.45 },
    },
    vertexShader: `
      varying float vR;
      void main() {
        vR = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vR;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uColor;
      uniform float uStrength;
      void main() {
        float t = clamp((vR - uInner) / (uOuter - uInner), 0.0, 1.0);
        float division = smoothstep(0.035, 0.0, abs(t - 0.58));
        float bands = 0.45 + 0.55 * (0.5 + 0.5 * sin(t * 52.0));
        float edge = smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.9, t);
        float alpha = (1.0 - division * 0.92) * bands * edge * uStrength;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function makeLabel(name, color, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "body-label";
  element.textContent = name;
  element.style.setProperty("--c", color);
  element.style.color = color;
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return new CSS2DObject(element);
}

function ribbonMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `
      attribute float along;
      attribute float side;
      varying float vAlong;
      varying float vSide;
      void main() {
        vAlong = along;
        vSide = side;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlong;
      varying float vSide;
      void main() {
        float edge = smoothstep(1.0, 0.05, abs(vSide));
        float fade = smoothstep(0.0, 0.2, vAlong) * pow(vAlong, 1.85);
        float alpha = edge * fade;
        vec3 col = uColor * (0.45 + 0.9 * edge);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);
        gl_FragColor = vec4(0.45, 0.7, 1.0, fres * 0.9);
      }
    `,
  });
}

function loadTexture(file, onLoad) {
  const loader = new THREE.TextureLoader();
  loader.load(
    `/textures/${file}`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      onLoad(tex);
    },
    undefined,
    () => {},
  );
}

function circleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function whitePixel() {
  const tex = new THREE.DataTexture(new Uint8Array([255, 210, 140, 255]), 1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255,244,220,1)");
  grad.addColorStop(0.18, "rgba(255,190,80,0.75)");
  grad.addColorStop(0.42, "rgba(255,120,30,0.18)");
  grad.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gauss() {
  let u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function onPointerDown(event) {
  pointer = { x: event.clientX, y: event.clientY, button: event.button };
  if (event.button === 2) renderer.domElement.classList.add("is-grab");
}

function onPointerMove(event) {
  if (pointer?.button !== 2) return;
  if ((event.buttons & 2) === 0) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  renderer.domElement.classList.toggle("is-grab", dx * dx + dy * dy <= 4);
  renderer.domElement.classList.toggle("is-grabbing", dx * dx + dy * dy > 4);
}

function onPointerUp(event) {
  if (event.button === 2 || pointer?.button === 2) {
    renderer.domElement.classList.remove("is-grab", "is-grabbing");
  }
  if (!pointer) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer = null;
  if (dx * dx + dy * dy > 16) return;
  pick(event);
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const meshes = [
    { mesh: sun.mesh, name: "Sun" },
    ...bodies.map((body) => ({ mesh: body.hit || body.mesh, name: body.data.name })),
    ...moons.map((moon) => ({ mesh: moon.mesh, name: moon.data.name })),
    ...satellites.pick,
    ...beyond.pick,
    ...(camera.position.length() > 260
      ? [
          ...galaxies.major.map((galaxy) => ({ mesh: galaxy.mesh, name: galaxy.data.name })),
          ...galaxies.deep.map((galaxy) => ({ mesh: galaxy.mesh, name: null })),
        ]
      : []),
  ];
  const hits = raycaster.intersectObjects(meshes.map((item) => item.mesh));
  if (!hits.length) return;
  const found = meshes.find((item) => item.mesh === hits[0].object);
  if (!found?.name) return;
  if (found.body && hits[0].instanceId != null) satellites.track(found.body, hits[0].object, hits[0].instanceId);
  focusBody(found.name);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
}
