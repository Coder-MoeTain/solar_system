import * as THREE from "three";

// Real spacecraft. Altitudes, inclinations, and periods follow published
// orbits. Scene distances are compressed so each craft stays outside its
// planet and inside the innermost moon.

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const ISS_PERIOD_DAYS = 92.68 / 1440;

const NAMED = [
  { planet: "Earth", name: "ISS", model: "iss", alt: 420, incl: 51.64, periodMin: 92.68, raan: 18, phase: 0.5, speed: 7.66, color: "#ffe1a8", blurb: "7.66 km/s · 420 km · 92.7 min", focus: 0.72 },
  { planet: "Earth", name: "Tiangong", model: "tiangong", alt: 389, incl: 41.47, periodMin: 92.2, raan: 150, phase: 2.1, speed: 7.68, color: "#f0d2b0", blurb: "7.68 km/s · 390 km · 41.5°", focus: 0.5 },
  { planet: "Earth", name: "Hubble", model: "hubble", alt: 535, incl: 28.47, periodMin: 95.42, raan: 78, phase: 1.3, speed: 7.59, color: "#d5e4ff", blurb: "7.59 km/s · 535 km · 28.5°", focus: 0.42 },
  { planet: "Earth", name: "Landsat 9", model: "bus", alt: 705, incl: 98.2, periodMin: 99.0, raan: 36, phase: 0.7, speed: 7.5, color: "#d5e2cf", blurb: "7.50 km/s · 705 km · sun-sync", focus: 0.32 },
  { planet: "Earth", name: "Iridium", model: "bus", alt: 780, incl: 86.4, periodMin: 100.4, raan: 250, phase: 2.6, speed: 7.46, color: "#d0d8e8", blurb: "7.46 km/s · 780 km · 86.4°", focus: 0.32 },
  { planet: "Earth", name: "NOAA-20", model: "bus", alt: 824, incl: 98.7, periodMin: 101.3, raan: 310, phase: 4.1, speed: 7.45, color: "#d4dceb", blurb: "7.45 km/s · 824 km · sun-sync", focus: 0.32 },
  { planet: "Earth", name: "GPS III", model: "gps", alt: 20180, incl: 55, periodMin: 718, raan: 20, phase: 0.4, speed: 3.87, color: "#d8f0c8", blurb: "3.87 km/s · 20,180 km · 55°", focus: 0.36 },
  { planet: "Earth", name: "GOES-16", model: "geo", alt: 35786, incl: 0, longitude: -75.2, speed: 3.07, color: "#ffd7a4", blurb: "3.07 km/s · geostationary · 75°W", focus: 0.38 },
  { planet: "Earth", name: "GOES-18", model: "geo", alt: 35786, incl: 0, longitude: -137, speed: 3.07, color: "#ffd7a4", blurb: "3.07 km/s · geostationary · 137°W", focus: 0.38 },
  { planet: "Earth", name: "Himawari-9", model: "geo", alt: 35786, incl: 0, longitude: 140.7, speed: 3.07, color: "#ffe0b8", blurb: "3.07 km/s · geostationary · 141°E", focus: 0.38 },
  { planet: "Earth", name: "Meteosat-12", model: "geo", alt: 35786, incl: 0, longitude: 0, speed: 3.07, color: "#ffe0b8", blurb: "3.07 km/s · geostationary · 0°", focus: 0.38 },
  { planet: "Earth", name: "James Webb", model: "jwst", color: "#f0d8c4", blurb: "Sun–Earth L2 · 1.5 million km", focus: 1.45 },
  { planet: "Mars", name: "MRO", model: "bus", alt: 280, incl: 93, periodMin: 112.5, raan: 40, phase: 1.1, speed: 3.4, color: "#e4c8b0", blurb: "3.4 km/s · 280 km · polar", focus: 0.28 },
  { planet: "Mars", name: "Odyssey", model: "bus", alt: 400, incl: 93.1, periodMin: 118, raan: 200, phase: 2.8, speed: 3.38, color: "#d8c4ae", blurb: "3.4 km/s · 400 km · polar", focus: 0.28 },
];

const _pos = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _out = new THREE.Vector3();
const _side = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function orbitalPosition(dist, incl, raan, angle, target) {
  const x = Math.cos(angle) * dist;
  const flat = Math.sin(angle) * dist;
  const y = flat * Math.sin(incl);
  const z = flat * Math.cos(incl);
  const c = Math.cos(raan);
  const s = Math.sin(raan);
  target.set(x * c + z * s, y, -x * s + z * c);
  return target;
}

function earthOrbitRadius(earthRadius, altKm) {
  if (altKm < 2500) {
    const t = Math.max(0, altKm - 200) / 1600;
    return earthRadius * (1.62 + t * 1.15);
  }
  const t = Math.log(altKm / 2500) / Math.log(35786 / 2500);
  return earthRadius * (2.85 + t * 1.35);
}

function lowOrbitRadius(hostRadius, altKm) {
  const t = Math.min(Math.max(altKm, 0), 1500) / 1500;
  return hostRadius * (1.58 + t * 0.45);
}

function makeKit() {
  const mat = (color, metalness, roughness, emissive, emissiveIntensity = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
  return {
    metal: mat(0xc5ccd4, 0.72, 0.38, 0x000000),
    white: mat(0xf4f7fb, 0.16, 0.5, 0x000000),
    dark: mat(0x2a3038, 0.45, 0.55, 0x000000),
    gold: mat(0xe2b34a, 0.42, 0.34, 0x5a3d10, 0.55),
    blue: mat(0x16325f, 0.35, 0.4, 0x0a1c40, 0.75),
    silver: mat(0xd8dee6, 0.82, 0.26, 0x000000),
    pink: mat(0xe7c2b4, 0.2, 0.55, 0x3a2018, 0.25),
    mirror: mat(0xf0c56a, 0.7, 0.22, 0x6a4a12, 0.45),
  };
}

function addMesh(group, geometry, material, x, y, z, rotX = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (rotX) mesh.rotation.x = rotX;
  group.add(mesh);
  return mesh;
}

function makeISS(kit) {
  const g = new THREE.Group();
  addMesh(g, new THREE.BoxGeometry(1.25, 0.045, 0.045), kit.metal, 0, 0, 0);
  for (const x of [-0.46, -0.22, 0.22, 0.46]) {
    addMesh(g, new THREE.BoxGeometry(0.012, 0.08, 0.012), kit.metal, x, 0, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.4, 0.012), kit.gold, x, 0.28, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.4, 0.012), kit.blue, x, -0.28, 0);
  }
  const tube = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 14);
  const mods = [
    [-0.24, kit.white],
    [-0.08, kit.dark],
    [0.08, kit.white],
    [0.22, kit.white],
  ];
  for (const [z, material] of mods) addMesh(g, tube, material, 0, 0, z, Math.PI / 2);
  addMesh(g, new THREE.BoxGeometry(0.34, 0.012, 0.16), kit.white, 0.05, 0.02, -0.02);
  addMesh(g, new THREE.SphereGeometry(0.028, 12, 10), kit.white, 0, -0.07, 0.08);
  g.scale.setScalar(0.09);
  return g;
}

function makeTiangong(kit) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(0.07, 0.07, 0.55, 14), kit.white, 0, 0, 0, Math.PI / 2);
  addMesh(g, new THREE.CylinderGeometry(0.055, 0.055, 0.28, 12), kit.silver, 0.16, 0, 0.02, Math.PI / 2);
  addMesh(g, new THREE.BoxGeometry(0.01, 0.42, 0.14), kit.gold, 0, 0.28, -0.02);
  addMesh(g, new THREE.BoxGeometry(0.01, 0.42, 0.14), kit.blue, 0, -0.28, -0.02);
  g.scale.setScalar(0.055);
  return g;
}

function makeHubble(kit) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(0.07, 0.08, 0.52, 16), kit.silver, 0, 0, 0, Math.PI / 2);
  addMesh(g, new THREE.TorusGeometry(0.075, 0.012, 8, 18), kit.dark, 0, 0, 0.26);
  addMesh(g, new THREE.BoxGeometry(0.012, 0.34, 0.16), kit.blue, 0.16, 0, -0.02);
  addMesh(g, new THREE.BoxGeometry(0.012, 0.34, 0.16), kit.gold, -0.16, 0, -0.02);
  g.scale.setScalar(0.05);
  return g;
}

function makeBus(kit, scale, panels = kit.blue) {
  const g = new THREE.Group();
  addMesh(g, new THREE.BoxGeometry(0.16, 0.12, 0.22), kit.silver, 0, 0, 0);
  addMesh(g, new THREE.BoxGeometry(0.28, 0.16, 0.012), panels, 0.26, 0, 0);
  addMesh(g, new THREE.BoxGeometry(0.28, 0.16, 0.012), kit.gold, -0.26, 0, 0);
  addMesh(g, new THREE.ConeGeometry(0.04, 0.08, 8), kit.white, 0, -0.1, 0, Math.PI);
  g.scale.setScalar(scale);
  return g;
}

function makeGeo(kit) {
  const g = new THREE.Group();
  addMesh(g, new THREE.BoxGeometry(0.18, 0.16, 0.18), kit.white, 0, 0, 0);
  addMesh(g, new THREE.BoxGeometry(0.42, 0.2, 0.012), kit.blue, 0.34, 0, 0);
  addMesh(g, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), kit.silver, 0, -0.1, 0);
  g.scale.setScalar(0.045);
  return g;
}

function makeJwst(kit) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const span = 0.55 + i * 0.035;
    addMesh(g, new THREE.BoxGeometry(span, span * 0.42, 0.008), i % 2 ? kit.pink : kit.silver, 0, 0, -0.08 - i * 0.012);
  }
  addMesh(g, new THREE.CylinderGeometry(0.16, 0.16, 0.02, 6), kit.mirror, 0, 0, 0.06);
  addMesh(g, new THREE.BoxGeometry(0.04, 0.04, 0.12), kit.dark, 0, 0, -0.02);
  g.scale.setScalar(0.34);
  return g;
}

function makeModel(kind, kit) {
  if (kind === "iss") return makeISS(kit);
  if (kind === "tiangong") return makeTiangong(kit);
  if (kind === "hubble") return makeHubble(kit);
  if (kind === "gps") return makeBus(kit, 0.04, kit.blue);
  if (kind === "geo") return makeGeo(kit);
  if (kind === "jwst") return makeJwst(kit);
  return makeBus(kit, kind === "bus" ? 0.04 : 0.04);
}

function makeOrbitLine(distance, incl, raan, color, opacity) {
  const points = [];
  for (let i = 0; i <= 144; i++) {
    const angle = (i / 144) * TAU;
    points.push(orbitalPosition(distance, incl, raan, angle, new THREE.Vector3()));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  line.userData.orbit = true;
  return line;
}

function placeOnOrbit(anchor, dist, incl, raan, angle) {
  orbitalPosition(dist, incl, raan, angle, _pos);
  orbitalPosition(dist, incl, raan, angle + 0.045, _ahead);
  _y.copy(_pos).normalize();
  _z.subVectors(_ahead, _pos).normalize();
  _x.crossVectors(_y, _z).normalize();
  _z.crossVectors(_x, _y);
  anchor.position.copy(_pos);
  anchor.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

function swarm(parent, kit, spec) {
  const { planes, perPlane, alt, incl, periodMin, scale, color, opacity } = spec;
  const dist = spec.distance;
  const period = periodMin / 1440;
  const geo = new THREE.BoxGeometry(scale, scale * 0.35, scale * 1.6);
  const material = kit.silver.clone();
  material.color.set(color);
  material.emissive.set(color);
  material.emissiveIntensity = 0.45;
  const mesh = new THREE.InstancedMesh(geo, material, planes * perPlane);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = planes * perPlane;
  parent.add(mesh);
  const pickGeo = new THREE.SphereGeometry(0.07, 6, 4);
  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const pickMesh = new THREE.InstancedMesh(pickGeo, pickMat, planes * perPlane);
  pickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pickMesh.frustumCulled = false;
  pickMesh.count = planes * perPlane;
  parent.add(pickMesh);
  const lines = [];
  for (let p = 0; p < planes; p++) {
    const line = makeOrbitLine(dist, incl * DEG, (p / planes) * TAU, color, opacity);
    parent.add(line);
    lines.push(line);
  }
  return { mesh, pickMesh, lines, planes, perPlane, dist, incl: incl * DEG, period, phase: spec.phase || 0 };
}

export function createSatellites(bodies, scene, makeLabel, focusBody) {
  const kit = makeKit();
  const byName = Object.fromEntries(bodies.map((body) => [body.data.name, body]));
  const frames = new Map();
  const frameFor = (body) => {
    let frame = frames.get(body);
    if (!frame) {
      frame = new THREE.Group();
      frame.rotation.z = body.data.tilt;
      body.anchor.add(frame);
      frames.set(body, frame);
    }
    return frame;
  };

  const pick = [];
  const craft = [];
  const orbitLines = [];
  const tag = (object, name) => {
    object.traverse((child) => {
      if (child.isMesh) pick.push({ mesh: child, name });
    });
  };

  let geoRing = false;
  for (const def of NAMED) {
    const host = byName[def.planet];
    const frame = frameFor(host);
    const anchor = new THREE.Group();
    const model = makeModel(def.model, kit);
    anchor.add(model);
    const isJwst = def.model === "jwst";
    (isJwst ? host.anchor : frame).add(anchor);
    tag(model, def.name);

    const distance = isJwst
      ? 0
      : def.planet === "Earth"
        ? earthOrbitRadius(host.radius, def.alt)
        : lowOrbitRadius(host.radius, def.alt);
    if (!isJwst && def.model !== "geo") {
      const line = makeOrbitLine(distance, def.incl * DEG, (def.raan || 0) * DEG, new THREE.Color(def.color), 0.38);
      line.userData.host = host;
      frame.add(line);
      orbitLines.push(line);
    }
    if (def.model === "geo" && !geoRing) {
      const line = makeOrbitLine(distance, 0, 0, 0xffd7a4, 0.32);
      line.userData.host = host;
      frame.add(line);
      orbitLines.push(line);
      geoRing = true;
    }

    const color = def.color;
    const label = makeLabel(def.name, color, () => focusBody(def.name));
    scene.add(label);
    const overview = def.planet === "Mars" ? [3.2, 16] : [5.5, 22];
    craft.push({
      def,
      data: { name: def.name },
      kind: "satellite",
      host,
      anchor,
      label,
      labelEl: label.element,
      world: new THREE.Vector3(),
      blurb: def.blurb,
      focusDist: def.focus,
      labeled: true,
      overviewMin: overview[0],
      overviewMax: overview[1],
      distance,
      radius: 0.05,
    });
  }

  const earth = byName.Earth;
  const earthFrame = frameFor(earth);
  const starDistance = earthOrbitRadius(earth.radius, 550);
  const gpsDistance = earthOrbitRadius(earth.radius, 20180);
  const starlink = swarm(earthFrame, kit, {
    planes: 6,
    perPlane: 12,
    distance: starDistance,
    incl: 53,
    periodMin: 95.5,
    scale: 0.01,
    color: 0x9eb4d8,
    opacity: 0.16,
    phase: 0.2,
  });
  const gps = swarm(earthFrame, kit, {
    planes: 6,
    perPlane: 4,
    distance: gpsDistance,
    incl: 55,
    periodMin: 718,
    scale: 0.014,
    color: 0xb7d4b0,
    opacity: 0.2,
    phase: 1.1,
  });

  const dummy = new THREE.Object3D();
  let satDays = 0.35;

  function stepSwarm(spec) {
    let n = 0;
    for (let p = 0; p < spec.planes; p++) {
      const raan = (p / spec.planes) * TAU;
      for (let s = 0; s < spec.perPlane; s++) {
        const angle = (TAU * satDays) / spec.period + spec.phase + (s / spec.perPlane) * TAU;
        placeOnOrbit(dummy, spec.dist, spec.incl, raan, angle);
        dummy.updateMatrix();
        spec.mesh.setMatrixAt(n, dummy.matrix);
        spec.pickMesh.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
    }
    spec.mesh.instanceMatrix.needsUpdate = true;
    spec.pickMesh.instanceMatrix.needsUpdate = true;
  }

  function update(dt, show, playing, daysPerSecond, camera, tracks = true) {
    for (const frame of frames.values()) frame.visible = show;
    const showPaths = (host) => {
      if (!show || !tracks || !camera) return false;
      const dist = camera.position.distanceTo(host.world);
      return dist > 4 && dist < 36;
    };
    for (const line of orbitLines) line.visible = showPaths(line.userData.host);
    for (const spec of [starlink, gps]) {
      const paths = showPaths(earth);
      spec.mesh.visible = show && camera.position.distanceTo(earth.world) > 2.4;
      spec.pickMesh.visible = spec.mesh.visible;
      for (const line of spec.lines) line.visible = paths;
    }
    if (playing && dt > 0) {
      const cap = 0.12 * ISS_PERIOD_DAYS;
      satDays += Math.min(daysPerSecond, cap) * dt;
    }
    const earthSpin = earth.spinner.rotation.y;
    for (const item of craft) {
      const { def, anchor, distance } = item;
      if (!anchor) continue;
      if (def.model === "jwst") {
        _out.copy(earth.anchor.position);
        if (_out.lengthSq() < 1e-6) _out.set(1, 0, 0);
        _out.normalize();
        _side.crossVectors(_out, _up);
        if (_side.lengthSq() < 1e-6) _side.set(0, 0, 1);
        _side.normalize();
        _bin.crossVectors(_out, _side).normalize();
        const halo = satDays * 0.35;
        anchor.position
          .copy(_out)
          .multiplyScalar(3.15)
          .addScaledVector(_side, Math.cos(halo) * 0.42)
          .addScaledVector(_bin, Math.sin(halo) * 0.28);
        anchor.quaternion.setFromUnitVectors(_up.set(0, 0, 1), _out);
        _up.set(0, 1, 0);
      } else if (def.model === "geo") {
        const angle = def.longitude * DEG - earthSpin;
        placeOnOrbit(anchor, distance, 0, 0, angle);
      } else {
        const period = def.periodMin / 1440;
        const direction = def.incl > 90 ? -1 : 1;
        const angle = direction * ((TAU * satDays) / period) + (def.phase || 0);
        placeOnOrbit(anchor, distance, def.incl * DEG, (def.raan || 0) * DEG, angle);
      }
      anchor.visible = show;
      anchor.getWorldPosition(item.world);
      item.label.position.copy(item.world);
      item.label.position.y += item.radius + 0.06;
    }
    if (show) {
      stepSwarm(starlink);
      stepSwarm(gps);
    }
    syncTracked();
  }

  let tracked = null;

  function syncTracked() {
    if (!tracked) return;
    const { body, mesh, index } = tracked;
    if (index >= mesh.count) return;
    mesh.getMatrixAt(index, _m);
    _pos.setFromMatrixPosition(_m);
    mesh.localToWorld(_pos);
    body.world.copy(_pos);
    body.label.position.copy(_pos);
    body.label.position.y += 0.1;
  }

  function track(body, mesh, index) {
    tracked = { body, mesh, index };
    syncTracked();
  }

  function constellation(name, mesh, blurb, color) {
    const label = makeLabel(name, color, () => focusBody(name));
    scene.add(label);
    const body = {
      def: { model: "bus", planet: "Earth" },
      data: { name },
      kind: "satellite",
      host: earth,
      anchor: null,
      label,
      labelEl: label.element,
      world: new THREE.Vector3(),
      blurb,
      focusDist: 0.42,
      labeled: false,
      overviewMin: 5.5,
      overviewMax: 22,
      distance: 0,
      radius: 0.05,
    };
    craft.push(body);
    pick.push({ mesh, name, body });
    return body;
  }

  constellation("Starlink", starlink.pickMesh, "7.6 km/s · 550 km · 53°", "#9eb4d8");
  constellation("GPS", gps.pickMesh, "3.87 km/s · 20,180 km · 55°", "#b7d4b0");

  return { craft, pick, update, track };
}
