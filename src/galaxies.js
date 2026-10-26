import * as THREE from "three";

// Face-on Milky Way. The bar, four major arms, and the Orion Spur follow the
// real layout: pitch about 13°, arms trailing, dust on the inner edge, and the
// Sun between the Sagittarius and Perseus arms. Scene size is compressed.
// The disk lies in the galactic plane and stays faded in the helix view.

const DISK = 3400;
const SUN_OUT = 920;
const PITCH = 16 * (Math.PI / 180);
const B = Math.tan(PITCH);
const BAR_ANGLE = -Math.PI / 2 + 0.52;
const WARP = 90;

const ARMS = [
  { r: 1180, offset: 0.05, t0: -3.15, t1: 1.12, weight: 1, dust: 1 },
  { r: 1080, offset: Math.PI + 0.12, t0: -3.25, t1: 1.05, weight: 1, dust: 1 },
  { r: 640, offset: -0.06, t0: -1.7, t1: 1.65, weight: 0.55, dust: 0.7 },
  { r: 760, offset: Math.PI * 0.58, t0: -1.9, t1: 1.35, weight: 0.46, dust: 0.55 },
  { r: 920, offset: 0, t0: -0.72, t1: 0.55, weight: 0.4, dust: 0.22 },
];

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

function gauss(rng) {
  const u = Math.max(1e-6, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function armPoints(arm) {
  const thetaRef = -Math.PI / 2 + arm.offset;
  const pts = [];
  const steps = 150;
  for (let i = 0; i <= steps; i++) {
    const theta = thetaRef + arm.t0 + ((arm.t1 - arm.t0) * i) / steps;
    const r = arm.r * Math.exp(B * (theta - thetaRef));
    if (r < 250 || r > 1660) continue;
    pts.push({
      x: Math.cos(theta) * r,
      y: Math.sin(theta) * r,
      theta,
      r,
    });
  }
  return pts;
}

function makeMilkyWayTexture() {
  const rng = mulberry32(27);
  const pixels = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = pixels;
  const g = canvas.getContext("2d");
  const cx = pixels / 2;
  const cy = pixels / 2;
  const toPixel = pixels / DISK;
  const plot = (lx, ly) => [cx + lx * toPixel, cy - ly * toPixel];
  const [sunX, sunY] = plot(0, -SUN_OUT);

  const halo = g.createRadialGradient(cx, cy, pixels * 0.08, cx, cy, pixels * 0.5);
  halo.addColorStop(0, "rgba(255, 228, 196, 0.3)");
  halo.addColorStop(0.16, "rgba(214, 168, 124, 0.16)");
  halo.addColorStop(0.4, "rgba(160, 136, 150, 0.07)");
  halo.addColorStop(0.68, "rgba(120, 128, 168, 0.03)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = halo;
  g.beginPath();
  g.ellipse(cx, cy, pixels * 0.49, pixels * 0.455, -0.15, 0, Math.PI * 2);
  g.fill();

  const speck = (lx, ly, color, size) => {
    const [x, y] = plot(lx, ly);
    g.fillStyle = color;
    g.fillRect(x, y, size, size);
  };

  for (const arm of ARMS) {
    const pts = armPoints(arm);
    const w = arm.weight;
    for (let k = 0; k < Math.round(7 * w); k++) {
      const p = pts[Math.floor(rng() * pts.length)];
      if (!p || p.r < 380) continue;
      const [x, y] = plot(p.x + Math.cos(p.theta) * 24, p.y + Math.sin(p.theta) * 24);
      const radius = (5 + rng() * 9) * (w + 0.3);
      const grad = g.createRadialGradient(x, y, 0, x, y, radius);
      const pink = rng() > 0.62;
      grad.addColorStop(0, pink ? "rgba(255, 170, 190, 0.85)" : "rgba(210, 228, 255, 0.9)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, radius, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.save();
  g.translate(cx, cy);
  g.rotate(-BAR_ANGLE);
  const len = 470 * toPixel;
  const wid = 112 * toPixel;
  const bar = g.createLinearGradient(-len, 0, len, 0);
  bar.addColorStop(0, "rgba(0,0,0,0)");
  bar.addColorStop(0.07, "rgba(255, 176, 110, 0.12)");
  bar.addColorStop(0.26, "rgba(255, 206, 150, 0.42)");
  bar.addColorStop(0.5, "rgba(255, 244, 226, 0.72)");
  bar.addColorStop(0.74, "rgba(255, 206, 150, 0.42)");
  bar.addColorStop(0.93, "rgba(255, 176, 110, 0.12)");
  bar.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = bar;
  g.beginPath();
  g.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  for (let i = 0; i < 280; i++) {
    const a = rng() * Math.PI * 2;
    const along = (rng() - 0.5) * 860;
    const across = (rng() - 0.5) * 160;
    const x = Math.cos(a) * 40 + along * Math.cos(BAR_ANGLE) - across * Math.sin(BAR_ANGLE);
    const y = Math.sin(a) * 28 + along * Math.sin(BAR_ANGLE) + across * Math.cos(BAR_ANGLE);
    if (Math.hypot(x, y) > 520) continue;
    speck(x, y, "rgba(255, 236, 210, 0.7)", rng() > 0.9 ? 2 : 1);
  }

  const bulge = g.createRadialGradient(cx, cy, 0, cx, cy, 96 * toPixel);
  bulge.addColorStop(0, "rgba(255, 250, 242, 0.95)");
  bulge.addColorStop(0.16, "rgba(255, 220, 170, 0.72)");
  bulge.addColorStop(0.42, "rgba(230, 160, 96, 0.28)");
  bulge.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = bulge;
  g.beginPath();
  g.ellipse(cx, cy, 96 * toPixel, 70 * toPixel, -BAR_ANGLE, 0, Math.PI * 2);
  g.fill();

  for (let i = 0; i < 2200; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.pow(rng(), 0.45) * 1620;
    const hot = rng() > 0.84;
    speck(Math.cos(a) * r, Math.sin(a) * r * 0.95, hot ? "rgba(190, 214, 255, 0.75)" : "rgba(255, 236, 214, 0.55)", rng() > 0.96 ? 2 : 1);
  }

  g.globalCompositeOperation = "destination-out";
  const hole = g.createRadialGradient(sunX, sunY, 36, sunX, sunY, 118);
  hole.addColorStop(0, "rgba(0,0,0,1)");
  hole.addColorStop(0.55, "rgba(0,0,0,0.85)");
  hole.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hole;
  g.beginPath();
  g.arc(sunX, sunY, 118, 0, Math.PI * 2);
  g.fill();

  g.globalCompositeOperation = "source-over";
  g.fillStyle = "rgba(255, 250, 236, 0.95)";
  g.beginPath();
  g.arc(sunX, sunY, 3.4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255, 214, 160, 0.75)";
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(sunX, sunY, 9, 0, Math.PI * 2);
  g.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeCoreGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255, 248, 236, 1)");
  grad.addColorStop(0.18, "rgba(255, 206, 140, 0.5)");
  grad.addColorStop(0.46, "rgba(255, 160, 80, 0.08)");
  grad.addColorStop(1, "rgba(255, 140, 60, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStarfield() {
  const count = 7800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const rng = mulberry32(91);
  const Rd = 540;

  const place = (n, x, y, z, r, hot) => {
    const ang = Math.atan2(y, x);
    const warp = smoothstep(800, 1650, r) * WARP * Math.sin(ang + 0.4);
    positions[n * 3] = x;
    positions[n * 3 + 1] = y;
    positions[n * 3 + 2] = z + warp;
    const inner = Math.exp(-r / 700);
    colors[n * 3] = hot ? 0.62 : 0.84 + inner * 0.16;
    colors[n * 3 + 1] = hot ? 0.76 : 0.72 + inner * 0.14;
    colors[n * 3 + 2] = hot ? 1 : 0.55 + (1 - inner) * 0.16;
    sizes[n] = hot ? 2.2 + rng() * 2 : 1.05 + rng() * 1.5;
  };

  let n = 0;
  while (n < count) {
    let x;
    let y;
    let r;
    if (rng() < 0.2) {
      const along = (rng() - 0.5) * 960;
      const across = gauss(rng) * 64;
      const c = Math.cos(BAR_ANGLE);
      const s = Math.sin(BAR_ANGLE);
      x = along * c - across * s;
      y = along * s + across * c;
      r = Math.hypot(x, y);
    } else {
      r = Math.sqrt(rng()) * 1660;
      if (rng() > Math.exp(-r / Rd)) continue;
      const ang = rng() * Math.PI * 2;
      x = Math.cos(ang) * r;
      y = Math.sin(ang) * r;
    }
    if (x * x + (y + SUN_OUT) * (y + SUN_OUT) < 175 * 175) continue;
    const thick = rng() < 0.13;
    const z = gauss(rng) * (thick ? 42 + r * 0.018 : 11 + r * 0.009);
    place(n, x, y, z, r, rng() > 0.86);
    n += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.subarray(0, n * 3), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors.subarray(0, n * 3), 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes.subarray(0, n), 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uShow: { value: 0 } },
    vertexShader: `
      attribute vec3 color;
      attribute float aSize;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * (2400.0 / -mv.z), 0.0, 3.6);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uShow;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.05, d) * uShow;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  stars.visible = false;
  return stars;
}

export function buildGalaxies() {
  const map = makeMilkyWayTexture();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(DISK, DISK, 48, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: map },
        uShow: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          float r = length(p.xy);
          float ang = atan(p.y, p.x);
          p.z += smoothstep(780.0, 1680.0, r) * ${WARP.toFixed(1)} * sin(ang + 0.4);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uShow;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(uMap, vUv);
          gl_FragColor = vec4(color.rgb, color.a * uShow);
        }
      `,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -SUN_OUT);

  const stars = makeStarfield();
  mesh.add(stars);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeCoreGlow(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }),
  );
  glow.scale.set(96, 96, 1);
  glow.position.set(0, 0, 18);
  mesh.add(glow);

  mesh.userData.focus = "Milky Way";
  return {
    major: [
      {
        name: "Milky Way",
        color: "#f0d2a8",
        blurb: "Barred spiral · Sun in the Orion Spur",
        mesh,
        radius: DISK * 0.5,
        focusDist: 2650,
        labelLift: 180,
        glow,
        kind: "galaxy",
        data: { name: "Milky Way" },
        fade(show) {
          const on = show > 0.06;
          mesh.visible = on;
          mesh.material.uniforms.uShow.value = show;
          stars.material.uniforms.uShow.value = show;
          stars.visible = on;
          glow.material.opacity = on ? 0.28 * show : 0;
        },
      },
    ],
    deep: [],
  };
}
