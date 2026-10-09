/* ============================================
   BJRCON 3D — utilitários compartilhados
   Texturas procedurais, materiais, renderer e easing
   ============================================ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ---------- Math / easing ---------- */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => {
  const c1 = 1.4, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** progresso local de uma etapa [a,b] dentro do progresso global p */
export const range = (p, a, b) => clamp((p - a) / (b - a));

/* pseudo-random determinístico (para o modelo ser sempre igual) */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

/* ---------- Renderer ---------- */
export function makeRenderer(canvas, { shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  return renderer;
}

const envCache = new WeakMap();
export function roomEnv(renderer) {
  if (envCache.has(renderer)) return envCache.get(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  envCache.set(renderer, tex);
  return tex;
}

/** Mantém o canvas do tamanho do elemento pai */
export function autoResize(renderer, camera, el, onResize) {
  const fit = () => {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    onResize && onResize(w, h);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  fit();
  return () => ro.disconnect();
}

/* ---------- Texturas procedurais (canvas) ---------- */
const texCache = new Map();

function canvasTex(key, size, draw, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const k = key + '|' + repeat.join('x');
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

function noise(g, s, amount, alpha = 0.08, seed = 7, sizePx = 1) {
  const r = rng(seed);
  for (let i = 0; i < amount; i++) {
    const v = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    g.fillRect(r() * s, r() * s, sizePx, sizePx);
  }
}

/** reboco texturizado (paredes externas) */
export function plasterTex() {
  return canvasTex('plaster', 256, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    noise(g, s, 9000, 0.12, 3, 2);
    noise(g, s, 4000, 0.07, 9, 1);
  });
}

/** piso / revestimento cerâmico com rejunte */
export function tileTex({ base = '#eceae6', grout = '#cfcac2', n = 4, veins = false, seed = 2 } = {}) {
  return canvasTex(`tile-${base}-${grout}-${n}-${veins}-${seed}`, 1024, (g, s) => {
    const r = rng(seed);
    const cell = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const c = new THREE.Color(base);
        const d = (r() - 0.5) * 0.04;
        c.offsetHSL(0, 0, d);
        g.fillStyle = '#' + c.getHexString();
        g.fillRect(i * cell, j * cell, cell, cell);
        if (veins) drawVeins(g, i * cell, j * cell, cell, r, 3);
        else {
          g.globalAlpha = 0.05;
          for (let k = 0; k < 6; k++) {
            g.strokeStyle = '#9a958d';
            g.lineWidth = 6 + r() * 20;
            g.beginPath();
            g.moveTo(i * cell + r() * cell, j * cell);
            g.bezierCurveTo(i * cell + r() * cell, j * cell + cell * 0.3, i * cell + r() * cell, j * cell + cell * 0.6, i * cell + r() * cell, j * cell + cell);
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      }
    }
    g.strokeStyle = grout;
    g.lineWidth = Math.max(3, s / 300);
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(s, i * cell); g.stroke();
    }
  });
}

function drawVeins(g, x, y, w, r, count) {
  g.save();
  g.beginPath(); g.rect(x, y, w, w); g.clip();
  for (let k = 0; k < count; k++) {
    // trajetória suave, diagonal, como os veios de porcelanato calacatta
    const pts = [];
    let px = x + r() * w, py = y - w * 0.1;
    const drift = (r() - 0.5) * 0.5;
    for (let t = 0; t <= 6; t++) {
      pts.push([px, py]);
      px += w * (drift + (r() - 0.5) * 0.18);
      py += w * 0.2;
    }
    const path = () => {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      g.stroke();
    };
    g.lineCap = 'round';
    g.filter = 'blur(6px)';
    g.strokeStyle = `rgba(150,150,155,${0.08 + r() * 0.08})`;
    g.lineWidth = 10 + r() * 16;
    path();
    g.filter = 'blur(0.6px)';
    g.strokeStyle = `rgba(125,125,132,${0.22 + r() * 0.2})`;
    g.lineWidth = 0.8 + r() * 1.4;
    path();
    g.filter = 'none';
  }
  g.restore();
}

/** porcelanato marmorizado (Premier) */
export function marbleTex({ n = 2, seed = 11, base = '#f4f3f1' } = {}) {
  return canvasTex(`marble-${n}-${seed}-${base}`, 1024, (g, s) => {
    const r = rng(seed);
    const cell = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = base;
      g.fillRect(i * cell, j * cell, cell, cell);
      drawVeins(g, i * cell, j * cell, cell, r, 3);
    }
    g.strokeStyle = '#dcdad6';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(s, i * cell); g.stroke();
    }
  });
}

/** mármore crema/marrom (bancada esculpida do banheiro Premier) */
export function cremaTex() {
  return canvasTex('crema', 1024, (g, s) => {
    const r = rng(27);
    g.fillStyle = '#8f6f50';
    g.fillRect(0, 0, s, s);
    // manchas claras e escuras sobrepostas, como na foto
    for (let i = 0; i < 260; i++) {
      const light = r() > 0.45;
      g.fillStyle = light ? `rgba(${215 + r() * 25},${190 + r() * 25},${160 + r() * 25},${0.18 + r() * 0.3})` : `rgba(${90 + r() * 30},${62 + r() * 20},${40 + r() * 15},${0.15 + r() * 0.25})`;
      g.filter = `blur(${2 + r() * 6}px)`;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 20 + r() * 110, 8 + r() * 40, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.filter = 'none';
    // veios claros finos
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(240,225,200,${0.25 + r() * 0.4})`;
      g.lineWidth = 0.6 + r() * 1.8;
      g.beginPath();
      let x = r() * s, y = r() * s;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; g.lineTo(x, y); }
      g.stroke();
    }
    noise(g, s, 8000, 0.05, 28, 1);
  });
}

/** travertino (bancada do banheiro Premier) */
export function travertineTex() {
  return canvasTex('travertine', 512, (g, s) => {
    const r = rng(21);
    g.fillStyle = '#d9c7a8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(${150 + r() * 40},${120 + r() * 30},${80 + r() * 30},${0.08 + r() * 0.15})`;
      g.fillRect(0, r() * s, s, 1 + r() * 6);
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = 'rgba(120,95,60,0.25)';
      g.fillRect(r() * s, r() * s, 2 + r() * 10, 1 + r() * 2);
    }
    noise(g, s, 6000, 0.06, 4, 1);
  });
}

/** madeira (portas, móveis, estrutura do telhado) */
export function woodTex(color = '#9a5b32', seed = 5) {
  return canvasTex(`wood-${color}-${seed}`, 512, (g, s) => {
    const r = rng(seed);
    const c = new THREE.Color(color);
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const cc = c.clone().offsetHSL(0, 0, (r() - 0.5) * 0.12);
      g.strokeStyle = '#' + cc.getHexString();
      g.globalAlpha = 0.5;
      g.lineWidth = 1 + r() * 4;
      g.beginPath();
      const x = r() * s;
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 30, s * 0.33, x + (r() - 0.5) * 30, s * 0.66, x + (r() - 0.5) * 20, s);
      g.stroke();
    }
    g.globalAlpha = 1;
    noise(g, s, 3000, 0.05, seed + 1, 1);
  });
}

/** granito preto (bancadas) */
export function graniteTex() {
  return canvasTex('granite', 512, (g, s) => {
    const r = rng(33);
    g.fillStyle = '#121214';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const v = 40 + r() * 90;
      g.fillStyle = `rgba(${v},${v},${v + 5},${0.3 + r() * 0.5})`;
      const z = 1 + r() * 2.5;
      g.fillRect(r() * s, r() * s, z, z);
    }
  });
}

/** telha cerâmica colonial: u = largura (1 telha por unidade), v = comprimento */
export function roofTileTex() {
  return canvasTex('rooftile', 512, (g, s) => {
    const r = rng(42);
    const cols = 8, rows = 4;
    const cw = s / cols, rh = s / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const base = new THREE.Color().setHSL(0.045 + (r() - 0.5) * 0.015, 0.55 + r() * 0.1, 0.36 + (r() - 0.5) * 0.08);
        const x = i * cw, y = j * rh;
        const grad = g.createLinearGradient(x, 0, x + cw, 0);
        const lo = base.clone().offsetHSL(0, 0, -0.12), hi = base.clone().offsetHSL(0, 0, 0.08);
        const capa = i % 2 === 0; // capa (convexa) x canal (côncava)
        grad.addColorStop(0, '#' + (capa ? lo : hi).getHexString());
        grad.addColorStop(0.5, '#' + (capa ? hi : lo).getHexString());
        grad.addColorStop(1, '#' + (capa ? lo : hi).getHexString());
        g.fillStyle = grad;
        g.fillRect(x, y, cw, rh);
        // sombra da sobreposição da fiada
        const sh = g.createLinearGradient(0, y, 0, y + rh * 0.25);
        sh.addColorStop(0, 'rgba(0,0,0,0.45)');
        sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh;
        g.fillRect(x, y, cw, rh * 0.25);
        // manchas de queima
        for (let k = 0; k < 18; k++) {
          g.fillStyle = `rgba(${r() > 0.5 ? '60,30,20' : '230,170,120'},${0.05 + r() * 0.08})`;
          g.beginPath();
          g.arc(x + r() * cw, y + r() * rh, 2 + r() * 8, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });
}

export function sandTex() {
  return canvasTex('sand', 512, (g, s) => {
    g.fillStyle = '#d9a26a';
    g.fillRect(0, 0, s, s);
    const r = rng(8);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '235,190,140' : '190,120,70'},0.12)`;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 20 + r() * 80, 10 + r() * 40, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    noise(g, s, 20000, 0.12, 12, 1);
  });
}

export function gravelTex() {
  return canvasTex('gravel', 512, (g, s) => {
    g.fillStyle = '#9b958e';
    g.fillRect(0, 0, s, s);
    const r = rng(15);
    for (let i = 0; i < 9000; i++) {
      const v = 100 + r() * 120;
      g.fillStyle = `rgb(${v},${v - 5},${v - 10})`;
      const z = 1.5 + r() * 3.5;
      g.beginPath();
      g.ellipse(r() * s, r() * s, z, z * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function concreteTex() {
  return canvasTex('concrete', 512, (g, s) => {
    g.fillStyle = '#bdbab4';
    g.fillRect(0, 0, s, s);
    const r = rng(19);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '90,85,80'},0.05)`;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 30 + r() * 90, 20 + r() * 60, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    noise(g, s, 14000, 0.1, 20, 1);
  });
}

export function grassTex() {
  return canvasTex('grass', 512, (g, s) => {
    g.fillStyle = '#4f7d2c';
    g.fillRect(0, 0, s, s);
    const r = rng(23);
    for (let i = 0; i < 16000; i++) {
      g.strokeStyle = `hsla(${85 + r() * 25},${45 + r() * 20}%,${22 + r() * 25}%,0.7)`;
      g.lineWidth = 1;
      const x = r() * s, y = r() * s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5); g.stroke();
    }
  });
}

export function fabricTex(color = '#8a7a6c') {
  return canvasTex('fabric-' + color, 256, (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) {
      g.fillStyle = 'rgba(255,255,255,0.035)';
      g.fillRect(i, 0, 1, s);
      g.fillStyle = 'rgba(0,0,0,0.035)';
      g.fillRect(0, i, s, 1);
    }
    noise(g, s, 4000, 0.06, 31, 1);
  });
}

/** blocos cerâmicos (alvenaria) — usado como cor base com leve ruído */
export function brickTex() {
  return canvasTex('brick', 128, (g, s) => {
    g.fillStyle = '#c4673d';
    g.fillRect(0, 0, s, s);
    noise(g, s, 1800, 0.18, 44, 2);
    g.strokeStyle = 'rgba(80,30,15,0.35)';
    g.lineWidth = 3;
    g.strokeRect(1, 1, s - 2, s - 2);
  });
}

/** gradiente de céu para scene.background */
export function skyTex(top = '#2f7fd8', bottom = '#cfe6f7', key = 'sky') {
  const k = key + top + bottom;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.62, bottom);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

/** sombra de contato suave (plano com gradiente radial) */
let shadowTexCache = null;
export function contactShadow(w, d, opacity = 0.35) {
  if (!shadowTexCache) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    shadowTexCache = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTexCache, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  m.renderOrder = 1;
  return m;
}

/* ---------- Materiais ---------- */
const matCache = new Map();
/** material standard com cache por chave */
export function mat(key, params) {
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial(params);
  matCache.set(key, m);
  return m;
}

/** Ajusta repetição de textura num material clonado (para escalas diferentes) */
export function texMat(key, tex, repeatX, repeatY, params = {}) {
  if (matCache.has(key)) return matCache.get(key);
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(repeatX, repeatY);
  const m = new THREE.MeshStandardMaterial({ map: t, ...params });
  matCache.set(key, m);
  return m;
}

/* ---------- Geometria ---------- */
export function box(w, h, d, material, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** UV de caixa em metros (textura não estica) */
export function worldUVBox(w, h, d, scale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // ordem das faces: +x, -x, +y, -y, +z, -z (4 vértices cada)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / scale, uv.getY(i) * dims[f][1] / scale);
    }
  }
  return g;
}
