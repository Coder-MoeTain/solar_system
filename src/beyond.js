import * as THREE from "three";

// Real objects past the planets. Voyager 1 and 2 are in interstellar space.
// The stars are the nearest systems plus a few bright landmarks.
// Distances are compressed so they sit just outside the planets; the card
// keeps the real figure. Directions are equatorial coordinates (J2000).

const OBL = 23.439 * (Math.PI / 180);
const COS_E = Math.cos(OBL);
const SIN_E = Math.sin(OBL);

const CATALOG = [
  { kind: "probe", name: "Voyager 1", ra: 17.22, dec: 12.4, au: 169, speed: 17, color: "#f3d7a4", radius: 1.2, pick: 6, focus: 6.6, blurb: "169 AU · interstellar · 17 km/s" },
  { kind: "probe", name: "Voyager 2", ra: 19.97, dec: -57.2, au: 141, speed: 15, color: "#e7c89a", radius: 1.2, pick: 6, focus: 6.6, blurb: "141 AU · interstellar · 15 km/s" },

  { kind: "star", name: "Proxima Centauri", ra: 14.495, dec: -62.68, ly: 4.25, color: "#ff5a3c", radius: 0.75, pick: 8, focus: 28, blurb: "4.25 ly · M5.5Ve · closest star" },
  { kind: "star", name: "Alpha Centauri", ra: 14.66, dec: -60.84, ly: 4.34, color: "#ffe0b0", radius: 1.15, pick: 8, focus: 30, blurb: "4.34 ly · G2V + K1V" },
  { kind: "star", name: "Barnard's Star", ra: 17.963, dec: 4.69, ly: 5.96, color: "#ff6a45", radius: 0.7, pick: 8, focus: 26, blurb: "5.96 ly · M4Ve" },
  { kind: "star", name: "Wolf 359", ra: 10.941, dec: 7.01, ly: 7.86, color: "#ff4d30", radius: 0.65, pick: 8, focus: 26, blurb: "7.86 ly · M6Ve" },
  { kind: "star", name: "Sirius", ra: 6.752, dec: -16.72, ly: 8.66, color: "#e7f0ff", radius: 1.7, pick: 9, focus: 34, blurb: "8.66 ly · A1V · brightest star" },
  { kind: "star", name: "Epsilon Eridani", ra: 3.549, dec: -9.46, ly: 10.5, color: "#ffc48a", radius: 0.95, pick: 8, focus: 28, blurb: "10.5 ly · K2V" },
  { kind: "star", name: "61 Cygni", ra: 21.115, dec: 38.75, ly: 11.4, color: "#ffb070", radius: 0.85, pick: 8, focus: 26, blurb: "11.4 ly · K5V + K7V" },
  { kind: "star", name: "Procyon", ra: 7.655, dec: 5.22, ly: 11.46, color: "#fff1d2", radius: 1.3, pick: 8, focus: 30, blurb: "11.5 ly · F5IV" },
  { kind: "star", name: "Tau Ceti", ra: 1.734, dec: -15.94, ly: 11.9, color: "#ffe2b4", radius: 1.05, pick: 8, focus: 28, blurb: "11.9 ly · G8V" },
  { kind: "star", name: "Altair", ra: 19.846, dec: 8.87, ly: 16.7, color: "#f4f7ff", radius: 1.45, pick: 8, focus: 32, blurb: "16.7 ly · A7V" },
  { kind: "star", name: "Vega", ra: 18.616, dec: 38.78, ly: 25.0, color: "#e4eeff", radius: 1.65, pick: 9, focus: 34, blurb: "25.0 ly · A0V" },
  { kind: "star", name: "Fomalhaut", ra: 22.961, dec: -29.62, ly: 25.1, color: "#e6f0ff", radius: 1.5, pick: 8, focus: 32, blurb: "25.1 ly · A3V" },
  { kind: "star", name: "TRAPPIST-1", ra: 23.108, dec: -5.04, ly: 40.7, color: "#ff3b22", radius: 0.6, pick: 8, focus: 24, blurb: "40.7 ly · M8V · seven planets" },
  { kind: "star", name: "Polaris", ra: 2.53, dec: 89.26, ly: 448, color: "#fff3cf", radius: 1.8, pick: 10, focus: 36, blurb: "448 ly · F7Ib · pole star" },
  { kind: "star", name: "Betelgeuse", ra: 5.92, dec: 7.41, ly: 548, color: "#ff6a38", radius: 2.5, pick: 11, focus: 42, blurb: "548 ly · red supergiant" },
];

function direction(raHours, decDeg) {
  const ra = raHours * (Math.PI / 12);
  const dec = decDeg * (Math.PI / 180);
  const xEq = Math.cos(dec) * Math.cos(ra);
  const yEq = Math.cos(dec) * Math.sin(ra);
  const zEq = Math.sin(dec);
  return {
    x: xEq,
    y: yEq * COS_E + zEq * SIN_E,
    z: -yEq * SIN_E + zEq * COS_E,
  };
}

function visualDistance(def) {
  if (def.au) {
    const t = Math.min(Math.log(def.au / 30) / Math.log(200 / 30), 1);
    return 168 + t * 58;
  }
  const t = Math.log(def.ly / 4.25) / Math.log(548 / 4.25);
  return 250 + Math.min(Math.max(t, 0), 1) * 210;
}

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeVoyager() {
  const craft = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.48, metalness: 0.08 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4b06a, roughness: 0.42, metalness: 0.48 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.52, metalness: 0.32 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb7b2a8, roughness: 0.38, metalness: 0.5 });
  const blanket = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.7, metalness: 0.08 });

  const dishPts = [];
  const innerPts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    dishPts.push(new THREE.Vector2(t * 1.18, t * t * 0.36));
    innerPts.push(new THREE.Vector2(t * 1.05, t * t * 0.32 + 0.02));
  }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 48), white);
  const inner = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 40), gold);
  dish.rotation.x = -Math.PI / 2;
  inner.rotation.x = -Math.PI / 2;
  craft.add(dish, inner);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.028, 8, 48), metal);
  rim.position.z = -0.36;
  craft.add(rim);

  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.1, 0.26, 12), metal);
  feed.rotation.x = Math.PI / 2;
  feed.position.z = -0.52;
  craft.add(feed);
  const feedCap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), dark);
  feedCap.position.z = -0.66;
  craft.add(feedCap);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.016, 0.016), metal);
    bar.position.set(Math.cos(angle) * 0.58, Math.sin(angle) * 0.58, -0.28);
    bar.rotation.z = angle;
    craft.add(bar);
  }

  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.58, 10), white);
  bus.rotation.x = Math.PI / 2;
  bus.position.z = 0.46;
  craft.add(bus);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.1, 10), blanket);
  band.rotation.x = Math.PI / 2;
  band.position.z = 0.5;
  craft.add(band);
  const record = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.018, 24), gold);
  record.rotation.z = Math.PI / 2;
  record.position.set(0.46, 0.08, 0.42);
  craft.add(record);

  const science = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.045, 0.045), metal);
  science.position.set(-1.22, -0.18, 0.58);
  craft.add(science);
  const scan = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.16), dark);
  scan.position.set(-2.08, -0.16, 0.58);
  craft.add(scan);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 12), metal);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(-2.08, -0.16, 0.4);
  craft.add(lens);
  const wide = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.1, 10), dark);
  wide.rotation.z = Math.PI / 2;
  wide.position.set(-2.2, -0.16, 0.58);
  craft.add(wide);

  const rtgBoom = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.04), metal);
  rtgBoom.position.set(0.9, -0.32, 0.72);
  craft.add(rtgBoom);
  for (let i = 0; i < 3; i++) {
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 8), dark);
    rtg.rotation.z = Math.PI / 2;
    rtg.position.set(0.62 + i * 0.28, -0.48, 0.72);
    const finA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.012), gold);
    const finB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.2), gold);
    finA.position.copy(rtg.position);
    finB.position.copy(rtg.position);
    craft.add(rtg, finA, finB);
  }

  const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 2.5, 6), metal);
  mag.position.set(0.22, 1.45, 0.64);
  craft.add(mag);
  const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.14), dark);
  magTip.position.set(0.22, 2.72, 0.64);
  craft.add(magTip);

  const lowGain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), metal);
  lowGain.position.set(-0.22, 0.38, 0.2);
  craft.add(lowGain);

  craft.scale.setScalar(0.82);
  return craft;
}

export function createBeyond(ecliptic, scene, makeLabel, focusBody) {
  const glowMap = glowTexture();
  const stars = [];
  const pick = [];

  for (const def of CATALOG) {
    const dir = direction(def.ra, def.dec);
    const dist = visualDistance(def);
    const anchor = new THREE.Group();
    anchor.position.set(dir.x * dist, dir.z * dist, -dir.y * dist);
    ecliptic.add(anchor);

    const color = new THREE.Color(def.color);
    const mesh = def.kind === "probe"
      ? makeVoyager()
      : new THREE.Mesh(new THREE.SphereGeometry(def.radius, 20, 14), new THREE.MeshBasicMaterial({ color }));
    anchor.add(mesh);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowMap,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: def.kind === "probe" ? 0.2 : 0.7,
      }),
    );
    glow.scale.setScalar(def.kind === "probe" ? 2.2 : def.radius * 7);
    anchor.add(glow);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(def.pick, 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    anchor.add(hit);

    const label = makeLabel(def.name, def.color, () => focusBody(def.name));
    scene.add(label);
    const body = {
      def,
      data: { name: def.name, speed: def.speed || null },
      kind: def.kind,
      radius: def.radius,
      anchor,
      mesh,
      label,
      labelEl: label.element,
      world: new THREE.Vector3(),
      glow,
      blurb: def.blurb,
      focusDist: def.focus,
    };
    stars.push(body);
    pick.push({ mesh: hit, name: def.name });
  }

  const helioR = visualDistance({ au: 120 });
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(helioR, 48, 24),
    new THREE.MeshBasicMaterial({
      color: 0x9eb6e6,
      transparent: true,
      opacity: 0.05,
      side: THREE.FrontSide,
      depthWrite: false,
    }),
  );
  shell.raycast = () => {};
  ecliptic.add(shell);
  const marker = new THREE.Group();
  marker.position.set(helioR, 4, 0);
  ecliptic.add(marker);
  const helioLabel = makeLabel("Heliopause", "#b7c6e4", () => focusBody("Heliopause"));
  scene.add(helioLabel);
  const helio = {
    data: { name: "Heliopause" },
    kind: "heliopause",
    radius: 4,
    anchor: marker,
    mesh: marker,
    label: helioLabel,
    labelEl: helioLabel.element,
    world: new THREE.Vector3(),
    blurb: "about 120 AU · edge of the solar wind",
    focusDist: 48,
  };

  const trappist = stars.find((star) => star.data.name === "TRAPPIST-1");
  const exoDefs = [
    { name: "TRAPPIST-1b", days: 1.51, au: 0.0115, orbit: 1.15, color: "#ffb080", phase: 0.2 },
    { name: "TRAPPIST-1c", days: 2.42, au: 0.0158, orbit: 1.7, color: "#ffc49a", phase: 1.1 },
    { name: "TRAPPIST-1d", days: 4.05, au: 0.0223, orbit: 2.25, color: "#f0d2b4", phase: 2.2 },
    { name: "TRAPPIST-1e", days: 6.1, au: 0.0293, orbit: 2.85, color: "#d5e6c8", phase: 3.4 },
    { name: "TRAPPIST-1f", days: 9.21, au: 0.0385, orbit: 3.45, color: "#c9e0c0", phase: 4.5 },
    { name: "TRAPPIST-1g", days: 12.35, au: 0.0468, orbit: 4.1, color: "#b7d4c4", phase: 5.2 },
    { name: "TRAPPIST-1h", days: 18.77, au: 0.0619, orbit: 4.8, color: "#c8d4e4", phase: 0.8 },
  ];
  const exo = exoDefs.map((def) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: def.color }));
    pivot.add(mesh);
    trappist.anchor.add(pivot);
    const label = makeLabel(def.name.slice(-1), def.color, () => focusBody(def.name));
    scene.add(label);
    const body = {
      def,
      data: { name: def.name },
      kind: "exoplanet",
      radius: 0.16,
      anchor: pivot,
      mesh,
      label,
      labelEl: label.element,
      world: new THREE.Vector3(),
      host: trappist,
      blurb: `${def.days} days · ${def.au} AU`,
      focusDist: 4.2,
    };
    pick.push({ mesh, name: def.name });
    return body;
  });

  function update(camera, simDays = 0, focusName = "") {
    for (const star of stars) {
      if (star.kind === "probe") star.anchor.lookAt(0, 0, 0);
      star.anchor.getWorldPosition(star.world);
      star.label.position.copy(star.world);
      star.label.position.y += star.kind === "probe" ? 3.4 : star.radius * 2.4 + 1.4;
      if (star.kind === "probe") star.glow.visible = !camera || camera.position.distanceTo(star.world) > 28;
    }
    const far = camera && camera.position.length() > helioR * 0.82;
    shell.visible = far;
    marker.getWorldPosition(helio.world);
    helio.label.position.copy(helio.world);
    helio.label.position.y += 6;
    const showExo = camera && (focusName.startsWith("TRAPPIST") || camera.position.distanceTo(trappist.world) < 40);
    for (const planet of exo) {
      const angle = ((Math.PI * 2 * simDays) / planet.def.days + planet.def.phase);
      planet.anchor.position.set(Math.cos(angle) * planet.def.orbit, Math.sin(angle) * 0.12, Math.sin(angle) * planet.def.orbit);
      planet.anchor.visible = showExo;
      planet.anchor.getWorldPosition(planet.world);
      planet.label.position.copy(planet.world);
      planet.label.position.y += 0.45;
    }
  }

  return { stars, exo, helio, pick, update };
}
