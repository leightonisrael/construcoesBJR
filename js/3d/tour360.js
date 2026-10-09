/* ============================================
   BJRCON 3D — Tour 360° dos ambientes internos
   --------------------------------------------
   Uso:  <div class="tour360" data-house="standard|gold|premier"></div>
         import { initTour360 } from './js/3d/tour360.js';
         document.querySelectorAll('.tour360').forEach(initTour360);

   Os ambientes são modelados em 3D (procedural). Quando houver fotos 360°
   reais (equiretangulares 2:1, ex.: Insta360), basta adicionar `pano:
   'caminho/foto.jpg'` no ambiente em HOUSES abaixo: o tour passa a exibir
   a foto numa esfera em vez do modelo, mantendo abas e hotspots (os
   hotspots usam `links` com posição explícita nesse caso).
   ============================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  clamp, rng, isMobile, webglAvailable, makeRenderer, roomEnv, autoResize,
  tileTex, marbleTex, cremaTex, woodTex, graniteTex, fabricTex,
  contactShadow, mat, texMat, worldUVBox
} from './lib.js';

const EYE = 1.55;
const T = 0.15; // espessura da parede (profundidade dos vãos)
const DEG = Math.PI / 180;

/* ============================================
   Materiais
   ============================================ */
let _M = null;
function M() {
  if (_M) return _M;
  const warm = new THREE.Color(0xffd29a);
  _M = {
    paint: mat('t-paint', { color: 0xf1eee8, roughness: 0.92 }),
    paintWarm: mat('t-paint-warm', { color: 0xf3ece0, roughness: 0.92 }),
    ceiling: mat('t-ceiling', { color: 0xfbfbfa, roughness: 0.96 }),
    ceramic: texMat('t-ceramic', tileTex({ base: '#ebe8e2', grout: '#c9c3b9', n: 4, seed: 3 }), 1 / 2.4, 1 / 2.4, { roughness: 0.2 }),
    wallTile: texMat('t-walltile', tileTex({ base: '#edebe7', grout: '#c3beb6', n: 4, seed: 6 }), 1 / 1.8, 1 / 1.8, { roughness: 0.25 }),
    marble: texMat('t-marble', marbleTex({ n: 2, seed: 11 }), 1 / 2.0, 1 / 2.0, { roughness: 0.1 }),
    marbleWall: texMat('t-marble-wall', marbleTex({ n: 2, seed: 17 }), 1 / 2.4, 1 / 2.4, { roughness: 0.14 }),
    granite: texMat('t-granite', graniteTex(), 1 / 1.0, 1 / 1.0, { roughness: 0.14, metalness: 0.1 }),
    // mármore crema/marrom (bancada, nicho e peitoris Premier)
    travertine: texMat('t-crema', cremaTex(), 1 / 0.9, 1 / 0.9, { roughness: 0.16, color: '#d9cdbf' }),
    travertineDark: texMat('t-crema-d', cremaTex(), 1 / 0.7, 1 / 0.7, { roughness: 0.22, color: '#c8b8a6' }),
    woodDoor: texMat('t-wood-door', woodTex('#7a3e1f', 5), 1 / 0.9, 1 / 1.6, { roughness: 0.45 }),
    woodRed: texMat('t-wood-red', woodTex('#93421c', 7), 1 / 0.9, 1 / 1.6, { roughness: 0.3 }),
    oak: texMat('t-oak', woodTex('#c9a173', 9), 1 / 1.2, 1 / 1.2, { roughness: 0.55 }),
    oakDark: texMat('t-oak-d', woodTex('#8c6a48', 12), 1 / 1.2, 1 / 1.2, { roughness: 0.6 }),
    white: mat('t-white', { color: 0xf4f4f1, roughness: 0.4 }),
    taupe: mat('t-taupe', { color: 0xa69c90, roughness: 0.5 }),
    taupeHead: mat('t-taupe-head', { color: 0x9d9183, roughness: 0.75 }),
    darkCab: mat('t-darkcab', { color: 0x3a3c3f, roughness: 0.45 }),
    steel: mat('t-steel', { color: 0xc6c9cd, metalness: 0.9, roughness: 0.28 }),
    chrome: mat('t-chrome', { color: 0xffffff, metalness: 1, roughness: 0.06 }),
    black: mat('t-black', { color: 0x1c1c1e, metalness: 0.5, roughness: 0.4 }),
    alu: mat('t-alu', { color: 0xf2f2f2, metalness: 0.2, roughness: 0.35 }),
    porcelain: mat('t-porcelain', { color: 0xfbfbfb, roughness: 0.1 }),
    frosted: new THREE.MeshStandardMaterial({ color: 0xf4f6f6, emissive: 0xffffff, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8ecf2, transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0.1, depthWrite: false }),
    glassDark: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.08, metalness: 0.4 }),
    screen: mat('t-screen', { color: 0x07080a, roughness: 0.12, metalness: 0.3 }),
    sofa: mat('t-sofa', { map: fabricTex('#8a7a6b'), roughness: 0.95 }),
    sofaGray: mat('t-sofa-g', { map: fabricTex('#7d8288'), roughness: 0.95 }),
    chair: mat('t-chair', { map: fabricTex('#d9d2c6'), roughness: 0.9 }),
    linen: mat('t-linen', { map: fabricTex('#f2efe9'), roughness: 0.9 }),
    blanket: mat('t-blanket', { map: fabricTex('#7d8b99'), roughness: 0.95 }),
    blanketSand: mat('t-blanket-s', { map: fabricTex('#c2ad8e'), roughness: 0.95 }),
    bedBase: mat('t-bedbase', { map: fabricTex('#22283a'), roughness: 0.9 }),
    rug: mat('t-rug', { map: fabricTex('#cfc6b8'), roughness: 1 }),
    leaf: mat('t-leaf', { color: 0x3d7434, roughness: 0.7 }),
    pot: mat('t-pot', { color: 0x3b3b3b, roughness: 0.6 }),
    cloth: mat('t-cloth', { map: fabricTex('#ffffff'), roughness: 1 }),
    // entregue (Standard/Gold)
    floorTile: texMat('t-floor45', tileTex({ base: '#e6e4e0', grout: '#b9b3aa', n: 4, seed: 4 }), 1 / 1.8, 1 / 1.8, { roughness: 0.1 }),
    wallTileGray: texMat('t-wall50', tileTex({ base: '#cdccc9', grout: '#9b9893', n: 4, seed: 8 }), 1 / 2.0, 1 / 2.0, { roughness: 0.14 }),
    bathTile: texMat('t-bath45', tileTex({ base: '#e3e2df', grout: '#aeaaa3', n: 4, seed: 10 }), 1 / 1.8, 1 / 1.8, { roughness: 0.14 }),
    mosaic: mat('t-mosaic', { map: mosaicTex(), roughness: 0.2 }),
    frameDark: texMat('t-frame-dark', woodTex('#5a2412', 14), 1 / 0.6, 1 / 1.6, { roughness: 0.5 }),
    doorFlush: texMat('t-door-flush', woodTex('#c4843f', 16), 1 / 0.9, 1 / 2.0, { roughness: 0.55 }),
    // Premier
    quilt: mat('t-quilt', { map: quiltTex(), roughness: 0.95 }),
    upholster: mat('t-upholster', { map: fabricTex('#77716b'), roughness: 0.95 }),
    grayFurn: mat('t-grayfurn', { color: 0x6f6b67, roughness: 0.55 }),
    crystal: new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffd49a, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2 }),
    led: new THREE.MeshBasicMaterial({ color: warm.clone().multiplyScalar(2.2) }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.58, 1.5) }),
    lampWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.6, 1.2) })
  };
  return _M;
}

/* ============================================
   Texturas locais (vista da janela, quadros, brilho LED)
   ============================================ */
const localTex = {};
function outsideTex() {
  if (localTex.outside) return localTex.outside;
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const wallTop = 1024 * (1 - 0.46);
  const sky = g.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, '#3d8de0');
  sky.addColorStop(1, '#bfe0f7');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, wallTop);
  const r = rng(77);
  for (let i = 0; i < 9; i++) { // nuvens
    const x = r() * 1024, y = 80 + r() * (wallTop - 200);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.ellipse(x + (r() - 0.5) * 120, y + (r() - 0.5) * 20, 30 + r() * 50, 14 + r() * 16, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // muro de blocos de concreto (como nas fotos)
  g.fillStyle = '#8e8a83';
  g.fillRect(0, wallTop, 1024, 1024 - wallTop);
  const bw = 30, bh = 21;
  for (let row = 0; wallTop + row * bh < 1024; row++) {
    for (let col = -1; col * bw < 1024; col++) {
      const x = col * bw + (row % 2 ? bw / 2 : 0), y = wallTop + row * bh;
      const v = 168 + r() * 26;
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      g.fillRect(x + 1.5, y + 1.5, bw - 2.5, bh - 2.5);
    }
  }
  g.fillStyle = '#c9c4ba';
  g.fillRect(0, wallTop - 6, 1024, 8);
  for (let i = 0; i < 16000; i++) {
    const v = r() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.1 * r()})`;
    g.fillRect(r() * 1024, wallTop + r() * (1024 - wallTop), 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  localTex.outside = t;
  return t;
}

function mosaicTex() {
  if (localTex.mosaic) return localTex.mosaic;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#e4e4e4';
  g.fillRect(0, 0, 512, 512);
  const r = rng(91), n = 24, cs = 512 / n;
  const pal = ['#1c1c1e', '#2e2e31', '#55555a', '#8a8a8f', '#b9b9bd', '#ededee', '#f7f7f7'];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = pal[Math.floor(r() * pal.length)];
    g.fillRect(i * cs + 1.2, j * cs + 1.2, cs - 2.4, cs - 2.4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 0.6, 1 / 0.6);
  t.anisotropy = 8;
  localTex.mosaic = t;
  return t;
}

function quiltTex() {
  if (localTex.quilt) return localTex.quilt;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ddd3bf';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(150,135,110,0.45)';
  g.lineWidth = 2;
  for (let i = -512; i < 1024; i += 48) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke();
    g.beginPath(); g.moveTo(i, 512); g.lineTo(i + 512, 0); g.stroke();
  }
  const r = rng(55);
  for (let k = 0; k < 40; k++) {
    const x = r() * 512, y = r() * 512;
    for (let p = 0; p < 5; p++) {
      g.fillStyle = r() > 0.5 ? 'rgba(120,130,115,0.6)' : 'rgba(140,140,150,0.55)';
      const a = (p / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 3, a, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  localTex.quilt = t;
  return t;
}

function glowTex() {
  if (localTex.glow) return localTex.glow;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 128);
  localTex.glow = new THREE.CanvasTexture(c);
  return localTex.glow;
}

/* ============================================
   Primitivas
   ============================================ */
const G = () => new THREE.Group();
function shadowy(m, cast = true) { m.castShadow = cast; m.receiveShadow = true; return m; }
/** caixa com base em y (yb = altura da base) */
function B(w, h, d, m, x, yb, z, p) {
  const mesh = shadowy(new THREE.Mesh(worldUVBox(w, h, d, 1), m));
  mesh.position.set(x, yb + h / 2, z);
  p && p.add(mesh);
  return mesh;
}
/** caixa arredondada (estofados, louças) */
function R(w, h, d, r, m, x, yb, z, p) {
  const mesh = shadowy(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), m));
  mesh.position.set(x, yb + h / 2, z);
  p && p.add(mesh);
  return mesh;
}
function C(rt, rb, h, m, x, yb, z, p, seg = 24) {
  const mesh = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m));
  mesh.position.set(x, yb + h / 2, z);
  p && p.add(mesh);
  return mesh;
}
function planeM(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}
function place(obj, x, z, ry = 0, p, y = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  p && p.add(obj);
  return obj;
}
function shadowUnder(p, w, d, x, z, op = 0.4) {
  const s = contactShadow(w, d, op);
  s.position.x = x; s.position.z = z;
  p.add(s);
}

/* ============================================
   Paredes
   ============================================ */
function wallFrames(w, d) {
  return {
    n: { o: new THREE.Vector3(-w / 2, 0, -d / 2), dir: new THREE.Vector3(1, 0, 0), nrm: new THREE.Vector3(0, 0, 1), len: w, ry: 0 },
    s: { o: new THREE.Vector3(w / 2, 0, d / 2), dir: new THREE.Vector3(-1, 0, 0), nrm: new THREE.Vector3(0, 0, -1), len: w, ry: Math.PI },
    w: { o: new THREE.Vector3(-w / 2, 0, d / 2), dir: new THREE.Vector3(0, 0, -1), nrm: new THREE.Vector3(1, 0, 0), len: d, ry: Math.PI / 2 },
    e: { o: new THREE.Vector3(w / 2, 0, -d / 2), dir: new THREE.Vector3(0, 0, 1), nrm: new THREE.Vector3(-1, 0, 0), len: d, ry: -Math.PI / 2 }
  };
}
/** ponto no sistema da parede: u ao longo, y altura, dc profundidade (+ = para fora do ambiente) */
function wp(W, u, y, dc) {
  return W.o.clone().addScaledVector(W.dir, u).add(new THREE.Vector3(0, y, 0)).addScaledVector(W.nrm, -dc);
}
function wallBox(p, W, uc, yc, dc, sw, sh, sd, m, cast = true) {
  const mesh = shadowy(new THREE.Mesh(worldUVBox(sw, sh, sd, 1), m), cast);
  mesh.position.copy(wp(W, uc, yc, dc));
  mesh.rotation.y = W.ry;
  p.add(mesh);
  return mesh;
}
function wallRect(p, W, u0, u1, y0, y1, m) {
  if (u1 - u0 < 1e-3 || y1 - y0 < 1e-3) return;
  const g = new THREE.PlaneGeometry(u1 - u0, y1 - y0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), y0 + uv.getY(i) * (y1 - y0));
  const mesh = shadowy(new THREE.Mesh(g, m));
  mesh.position.copy(wp(W, (u0 + u1) / 2, (y0 + y1) / 2, 0));
  mesh.rotation.y = W.ry;
  p.add(mesh);
}
/** retângulo de parede com revestimento até a altura `tile.h` (na faixa u0..u1) */
function wallRectSkin(p, W, u0, u1, y0, y1, base, tile) {
  if (!tile) return wallRect(p, W, u0, u1, y0, y1, base);
  const tu0 = tile.u0 ?? -1, tu1 = tile.u1 ?? 99;
  const segs = [[u0, Math.min(u1, tu0), false], [Math.max(u0, tu0), Math.min(u1, tu1), true], [Math.max(u0, tu1), u1, false]];
  for (const [a, b, tiled] of segs) {
    if (b - a < 1e-3) continue;
    if (!tiled) { wallRect(p, W, a, b, y0, y1, base); continue; }
    const th = tile.h;
    if (th <= y0) wallRect(p, W, a, b, y0, y1, base);
    else if (th >= y1) wallRect(p, W, a, b, y0, y1, tile.mat);
    else { wallRect(p, W, a, b, y0, th, tile.mat); wallRect(p, W, a, b, th, y1, base); }
  }
}

function buildWall(room, ctx, id, spec) {
  const W = ctx.frames[id];
  const h = ctx.h;
  const base = spec.mat || ctx.wallMat;
  const tile = spec.tile ? { mat: ctx.tileMat, ...spec.tile } : null;
  const ops = (spec.openings || []).map((o) => ({ ...o, u0: o.u - o.w / 2, u1: o.u + o.w / 2 })).sort((a, b) => a.u0 - b.u0);
  // divide a parede em faixas verticais entre as bordas dos vãos (permite janela + nicho empilhados)
  const cuts = [...new Set([0, W.len, ...ops.flatMap((o) => [o.u0, o.u1])])].sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    const cover = ops.filter((o) => o.u0 <= a + 1e-6 && o.u1 >= b - 1e-6).sort((x, y) => x.y0 - y.y0);
    let y = 0;
    for (const o of cover) { wallRectSkin(room, W, a, b, y, o.y0, base, tile); y = o.y1; }
    wallRectSkin(room, W, a, b, y, h, base, tile);
  }

  // rodapé (onde não há revestimento nem porta)
  if (!tile || tile.u0 > 0 || (tile.u1 ?? 99) < W.len) {
    let a = 0;
    const segs = [];
    for (const o of ops) { if (o.y0 < 0.05) { segs.push([a, o.u0]); a = o.u1; } }
    segs.push([a, W.len]);
    for (let [s0, s1] of segs) {
      if (tile) {
        // remove faixa revestida
        const tu0 = tile.u0 ?? 0, tu1 = tile.u1 ?? W.len;
        const parts = [[s0, Math.min(s1, tu0)], [Math.max(s0, tu1), s1]];
        for (const [q0, q1] of parts) if (q1 - q0 > 0.02) wallBox(room, W, (q0 + q1) / 2, 0.04, -0.006, q1 - q0, 0.08, 0.012, ctx.floorMat);
      } else if (s1 - s0 > 0.02) wallBox(room, W, (s0 + s1) / 2, 0.04, -0.006, s1 - s0, 0.08, 0.012, ctx.floorMat);
    }
  }

  for (const o of ops) buildOpening(room, ctx, W, { ...o, _tileMat: tile && tile.mat });
}

function buildOpening(room, ctx, W, o) {
  const m = M();
  const ow = o.w, oh = o.y1 - o.y0, yc = (o.y0 + o.y1) / 2;
  const reveal = o.revealMat || (o.tiledReveal ? (o._tileMat || ctx.tileMat) : ctx.wallMat);
  if (o.type === 'niche') {
    // nicho embutido na parede (box)
    const ND = 0.1;
    wallBox(room, W, o.u0 - 0.03, yc, ND / 2 + 0.002, 0.06, oh, ND, reveal);
    wallBox(room, W, o.u1 + 0.03, yc, ND / 2 + 0.002, 0.06, oh, ND, reveal);
    wallBox(room, W, o.u, o.y1 + 0.03, ND / 2 + 0.002, ow + 0.12, 0.06, ND, reveal);
    wallBox(room, W, o.u, o.y0 - 0.03, ND / 2 + 0.002, ow + 0.12, 0.06, ND, reveal);
    wallBox(room, W, o.u, yc, ND + 0.01, ow + 0.02, oh + 0.02, 0.02, o.backMat || reveal);
    if (o.frameMat) {
      const f = 0.025;
      wallBox(room, W, o.u, o.y1 + f / 2, -0.004, ow + 2 * f, f, 0.012, o.frameMat);
      wallBox(room, W, o.u, o.y0 - f / 2, -0.004, ow + 2 * f, f, 0.012, o.frameMat);
      wallBox(room, W, o.u0 - f / 2, yc, -0.004, f, oh, 0.012, o.frameMat);
      wallBox(room, W, o.u1 + f / 2, yc, -0.004, f, oh, 0.012, o.frameMat);
    }
    return;
  }
  // vãos (espessura da parede)
  wallBox(room, W, o.u0 - 0.03, yc, T / 2 + 0.002, 0.06, oh, T, reveal);
  wallBox(room, W, o.u1 + 0.03, yc, T / 2 + 0.002, 0.06, oh, T, reveal);
  wallBox(room, W, o.u, o.y1 + 0.03, T / 2 + 0.002, ow + 0.12, 0.06, T, reveal);
  if (o.y0 > 0.05) wallBox(room, W, o.u, o.y0 - 0.03, T / 2 + 0.002, ow + 0.12, 0.06, T, reveal);

  // vão livre para um ambiente vizinho modelado ao lado (ex.: passa-pratos sala/cozinha)
  if (o.type === 'void') {
    if (o.top) wallBox(room, W, o.u, o.y0 + 0.015, T / 2, ow + 0.04, 0.03, T + 2 * o.top, o.topMat || m.granite);
    if (o.link) ctx.links.push({ to: o.link, label: o.label, pos: wp(W, o.u, o.linkY ?? 1.45, T * 0.5) });
    return;
  }

  if (o.type === 'window') {
    const fm = o.frame === 'black' ? m.black : m.alu;
    const gm = o.frosted ? m.frosted : m.glass;
    const pd = T * 0.5, p = 0.045;
    wallBox(room, W, o.u, o.y1 - p / 2, pd, ow, p, 0.06, fm);
    wallBox(room, W, o.u, o.y0 + p / 2, pd, ow, p, 0.06, fm);
    wallBox(room, W, o.u0 + p / 2, yc, pd, p, oh, 0.06, fm);
    wallBox(room, W, o.u1 - p / 2, yc, pd, p, oh, 0.06, fm);
    const [cols, rows] = o.grid || [2, 1];
    for (let i = 1; i < cols; i++) wallBox(room, W, o.u0 + (ow * i) / cols, yc, pd - (o.grid ? 0 : 0.012), p * 0.8, oh, 0.05, fm);
    for (let j = 1; j < rows; j++) wallBox(room, W, o.u, o.y0 + (oh * j) / rows, pd, ow, p * 0.8, 0.05, fm);
    const glass = wallBox(room, W, o.u, yc, pd + 0.01, ow - 0.02, oh - 0.02, 0.006, gm, false);
    glass.receiveShadow = false;
    glass.renderOrder = 2;
    if (o.y0 > 0.05 && o.sill !== false) wallBox(room, W, o.u, o.y0 - 0.015, T / 2 - 0.025, ow + 0.1, 0.03, T + 0.05, o.sillMat || m.granite);
    // vista externa
    const BW = ow + 14, BH = 10;
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ map: outsideTex(), color: 0xf2f2f2 }));
    bd.position.copy(wp(W, o.u, -3 + BH / 2, T + 2.6));
    bd.rotation.y = W.ry;
    room.add(bd);
    return;
  }

  // portas: guarnição (alizar)
  if (o.trim !== false) {
    const trim = o.trimMat || m.white;
    wallBox(room, W, o.u0 - 0.035, oh / 2, -0.008, 0.07, oh + 0.035, 0.016, trim);
    wallBox(room, W, o.u1 + 0.035, oh / 2, -0.008, 0.07, oh + 0.035, 0.016, trim);
    wallBox(room, W, o.u, o.y1 + 0.035, -0.008, ow + 0.14, 0.07, 0.016, trim);
    // batente (marco) aparente no vão
    if (o.trimMat) {
      wallBox(room, W, o.u0 + 0.012, oh / 2, T / 2, 0.024, oh, T + 0.004, trim);
      wallBox(room, W, o.u1 - 0.012, oh / 2, T / 2, 0.024, oh, T + 0.004, trim);
      wallBox(room, W, o.u, o.y1 - 0.012, T / 2, ow, 0.024, T + 0.004, trim);
    }
  }

  if (o.type === 'door') {
    const leafM = o.leafMat || m.woodDoor;
    wallBox(room, W, o.u, oh / 2, T * 0.5, ow - 0.03, oh - 0.015, 0.045, leafM);
    if (o.panels) {
      // porta almofadada (2 x 5 almofadas)
      const [pc, pr] = o.panels, mg = 0.09, gw = 0.05;
      const pw = (ow - 0.03 - 2 * mg - (pc - 1) * gw) / pc, ph = (oh - 2 * mg - (pr - 1) * gw) / pr;
      for (let i = 0; i < pc; i++) for (let j = 0; j < pr; j++) {
        const uu = o.u0 + 0.015 + mg + pw / 2 + i * (pw + gw);
        const yy = mg + ph / 2 + j * (ph + gw);
        wallBox(room, W, uu, yy, T * 0.5 - 0.027, pw, ph, 0.012, leafM);
        wallBox(room, W, uu, yy, T * 0.5 - 0.034, pw - 0.06, ph - 0.06, 0.008, leafM);
      }
    }
    if (o.grooves) for (let y = 0.3; y < oh - 0.1; y += 0.28) wallBox(room, W, o.u, y, T * 0.5 - 0.024, ow - 0.08, 0.008, 0.004, m.black, false);
    const hx = o.handleSide === 'left' ? o.u0 + 0.12 : o.u1 - 0.12;
    if (o.pull) {
      wallBox(room, W, hx, 1.1, T * 0.5 - 0.06, 0.025, 0.9, 0.025, m.black);
    } else {
      wallBox(room, W, hx, 1.02, T * 0.5 - 0.05, 0.05, 0.05, 0.012, m.chrome);
      wallBox(room, W, hx + (o.handleSide === 'left' ? 0.05 : -0.05), 1.02, T * 0.5 - 0.065, 0.12, 0.02, 0.02, m.chrome);
    }
    return;
  }

  // passagem para outro ambiente: folha aberta + trecho de corredor
  if (o.leaf !== false) {
    const hingeLeft = o.hinge !== 'right';
    const uc = hingeLeft ? o.u0 + 0.03 : o.u1 - 0.03;
    wallBox(room, W, uc, oh / 2, -(ow / 2) + 0.02, 0.04, oh - 0.015, ow - 0.04, o.leafMat || m.woodDoor);
  }
  // trecho visível do ambiente vizinho: profundidade `cd` e largura `cw` (padrão: corredor curto)
  const CD = o.cd ?? 1.7, CW = o.cw ?? ow + 1.8;
  const ch = Math.min(ctx.h, 2.7);
  const fm = o.beyondFloor || ctx.floorMat;
  const bw = o.beyondWall || ctx.wallMat;
  wallBox(room, W, o.u, -0.01, (CD + T) / 2, CW, 0.02, CD + T, fm);
  wallBox(room, W, o.u, ch / 2, T + CD, CW, ch, 0.04, bw);
  wallBox(room, W, o.u - CW / 2, ch / 2, (T + CD) / 2, 0.04, ch, CD + T, bw);
  wallBox(room, W, o.u + CW / 2, ch / 2, (T + CD) / 2, 0.04, ch, CD + T, bw);
  ctx.beyond = ctx.beyond || [];
  ctx.beyond.push({ W, u: o.u, back: T + CD });
  wallBox(room, W, o.u, ch + 0.01, (T + CD) / 2, CW, 0.02, CD + T, m.ceiling);
  // luz suave do ambiente vizinho
  const pl = new THREE.PointLight(0xfff0dc, 1.2, 4, 2);
  pl.position.copy(wp(W, o.u, 2.2, T + CD * 0.6));
  room.add(pl);

  if (o.link) {
    ctx.links.push({ to: o.link, label: o.label, pos: wp(W, o.u, o.linkY ?? 1.25, T * 0.5) });
  }
  for (const l of o.links || []) ctx.links.push({ to: l.to, label: l.label, pos: wp(W, o.u + (l.du || 0), l.y ?? 1.25, l.dc ?? T + 0.4) });
}

/* ============================================
   Ambiente (caixa com paredes, piso, teto, luzes)
   ============================================ */
function buildRoom(spec) {
  const m = M();
  const room = G();
  const { w, d, h } = spec;
  const ctx = {
    w, d, h,
    frames: wallFrames(w, d),
    wallMat: spec.wallMat || m.paint,
    tileMat: spec.tileMat || m.wallTile,
    floorMat: spec.floor || m.ceramic,
    links: []
  };
  const floor = shadowy(new THREE.Mesh(planeM(w, d), ctx.floorMat), false);
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const ceil = shadowy(new THREE.Mesh(planeM(w, d), spec.ceiling || m.ceiling));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = h;
  room.add(ceil);
  // tampa do teto (projeta sombra para o sol não “vazar”)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.05, d + 1), m.ceiling);
  lid.position.y = h + 0.03;
  lid.castShadow = true;
  lid.material = new THREE.MeshBasicMaterial({ colorWrite: false });
  room.add(lid);

  for (const id of ['n', 's', 'w', 'e']) buildWall(room, ctx, id, (spec.walls && spec.walls[id]) || {});

  // luz geral
  const hemi = new THREE.HemisphereLight(0xffffff, 0xcfc4b4, spec.hemi ?? 0.55);
  room.add(hemi);

  // sol entrando pela janela
  if (spec.sun) {
    const W = ctx.frames[spec.sun.wall];
    const el = (spec.sun.elev ?? 38) * DEG;
    const az = (spec.sun.az ?? 25) * DEG;
    const out = W.nrm.clone().negate();
    const dir = out.clone().multiplyScalar(Math.cos(az)).addScaledVector(W.dir, Math.sin(az)).multiplyScalar(Math.cos(el));
    dir.y = Math.sin(el);
    const sun = new THREE.DirectionalLight(0xfff1dc, spec.sun.intensity ?? 2.6);
    const target = new THREE.Object3D();
    room.add(target);
    sun.target = target;
    sun.position.copy(dir.multiplyScalar(12));
    sun.castShadow = true;
    const S = Math.max(w, d, h) * 0.9 + 1;
    Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 30 });
    sun.shadow.mapSize.set(isMobile() ? 1024 : 2048, isMobile() ? 1024 : 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    room.add(sun);
  }

  // luminárias
  for (const L of spec.lights || []) addLight(room, ctx, L);

  ctx.room = room;
  return ctx;
}

function addLight(room, ctx, L) {
  const m = M();
  const h = ctx.h;
  const y = L.y ?? h;
  if (L.type === 'plafon') {
    C(0.2, 0.2, 0.05, m.white, L.x, y - 0.05, L.z, room);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.18, 32), m.lamp);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(L.x, y - 0.052, L.z);
    room.add(disc);
  } else if (L.type === 'panel') {
    B(L.s || 0.4, 0.02, L.s || 0.4, m.white, L.x, y - 0.02, L.z, room);
    const p = new THREE.Mesh(new THREE.PlaneGeometry((L.s || 0.4) - 0.04, (L.s || 0.4) - 0.04), m.lamp);
    p.rotation.x = Math.PI / 2;
    p.position.set(L.x, y - 0.021, L.z);
    room.add(p);
  } else if (L.type === 'spot') {
    C(0.045, 0.045, 0.06, m.black, L.x, y - 0.06, L.z, room, 16);
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), m.lampWarm);
    p.rotation.x = Math.PI / 2;
    p.position.set(L.x, y - 0.061, L.z);
    room.add(p);
  } else if (L.type === 'socket') {
    // bocal de lâmpada (imóvel entregue sem luminária)
    C(0.055, 0.055, 0.018, m.white, L.x, y - 0.018, L.z, room, 20);
    C(0.02, 0.022, 0.035, m.white, L.x, y - 0.053, L.z, room, 12);
  } else if (L.type === 'bulb') {
    C(0.035, 0.035, 0.08, m.white, L.x, y - 0.08, L.z, room, 12);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), m.lamp);
    b.position.set(L.x, y - 0.13, L.z);
    room.add(b);
  }
  if (L.power !== 0) {
    const pl = new THREE.PointLight(L.warm ? 0xffd9a8 : 0xfff3e2, L.power ?? 6, 0, 2);
    pl.position.set(L.x, y - 0.3, L.z);
    room.add(pl);
  }
}

/** faixa de brilho LED descendo pela parede (sanca) */
function ledWash(room, ctx, ids, { y = null, height = 0.9, color = 0xffc47a, opacity = 0.55 } = {}) {
  const top = y ?? ctx.h;
  for (const id of ids) {
    const W = ctx.frames[id];
    const mm = new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(W.len - 0.02, height), mm);
    pl.position.copy(wp(W, W.len / 2, top - height / 2, -0.004));
    pl.rotation.y = W.ry;
    pl.renderOrder = 3;
    room.add(pl);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W.len, 0.012, 0.012), M().led);
    strip.position.copy(wp(W, W.len / 2, top - 0.02, -0.01));
    strip.rotation.y = W.ry;
    room.add(strip);
  }
}

/* ============================================
   Mobiliário
   ============================================ */
function sofa(L = 2.1, m = M().sofa) {
  const g = G(), d = 0.92;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(0.025, 0.02, 0.1, M().black, sx * (L / 2 - 0.08), 0, sz * (d / 2 - 0.08), g, 10);
  R(L, 0.26, d, 0.05, m, 0, 0.1, 0, g);
  R(0.2, 0.36, d, 0.07, m, -L / 2 + 0.1, 0.32, 0, g);
  R(0.2, 0.36, d, 0.07, m, L / 2 - 0.1, 0.32, 0, g);
  R(L - 0.36, 0.42, 0.22, 0.08, m, 0, 0.36, -d / 2 + 0.11, g);
  const n = L > 1.9 ? 3 : 2, cw = (L - 0.4) / n;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + 0.2 + cw * (i + 0.5);
    R(cw - 0.02, 0.15, d - 0.26, 0.06, m, x, 0.36, 0.11, g);
    const bc = R(cw - 0.05, 0.44, 0.2, 0.09, m, x, 0.48, -d / 2 + 0.3, g);
    bc.rotation.x = -0.14;
  }
  return g;
}

function chair(fab = M().chair, leg = M().oak) {
  const g = G();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.035, 0.46, 0.035, leg, sx * 0.19, 0, sz * 0.19, g);
  R(0.46, 0.08, 0.46, 0.03, fab, 0, 0.44, 0, g);
  const back = R(0.44, 0.56, 0.07, 0.03, fab, 0, 0.5, -0.21, g);
  back.rotation.x = -0.08;
  return g;
}

function diningTable(L = 1.2, W = 0.8, seats = 4, top = M().oak, glass = false) {
  const g = G();
  const m = M();
  if (glass) {
    const t = B(L, 0.012, W, m.glass, 0, 0.75, 0, g);
    t.castShadow = false;
    B(L - 0.02, 0.01, W - 0.02, m.white, 0, 0.738, 0, g);
    B(0.08, 0.72, W * 0.6, m.oak, -L / 2 + 0.3, 0.02, 0, g);
    B(0.08, 0.72, W * 0.6, m.oak, L / 2 - 0.3, 0.02, 0, g);
    B(L - 0.5, 0.06, 0.08, m.oak, 0, 0.68, 0, g);
  } else {
    B(L, 0.035, W, top, 0, 0.74, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.05, 0.74, 0.05, top, sx * (L / 2 - 0.07), 0, sz * (W / 2 - 0.07), g);
  }
  const per = seats === 6 ? 2 : seats / 2;
  for (let i = 0; i < per; i++) {
    const x = per === 1 ? 0 : -L / 4 + (i * L) / 2 / Math.max(1, per - 1) * (per > 1 ? 1 : 0);
    const xx = per === 2 ? (i === 0 ? -L * 0.22 : L * 0.22) : x;
    place(chair(), xx, -W / 2 - 0.12, 0, g);
    place(chair(), xx, W / 2 + 0.12, Math.PI, g);
  }
  if (seats === 6) {
    place(chair(), -L / 2 - 0.14, 0, Math.PI / 2, g);
    place(chair(), L / 2 + 0.14, 0, -Math.PI / 2, g);
  }
  return g;
}

function rack(L = 1.6, h = 0.45, d = 0.42, body = M().oak, floating = false) {
  const g = G();
  const y0 = floating ? 0.32 : 0.1;
  if (!floating) for (const sx of [-1, 1]) B(0.04, 0.1, d - 0.1, M().black, sx * (L / 2 - 0.1), 0, 0, g);
  B(L, h, d, body, 0, y0, 0, g);
  // nicho central
  B(L * 0.3, h - 0.06, 0.02, M().oakDark, 0, y0 + 0.03, d / 2 - 0.02, g);
  B(L * 0.3, 0.02, d - 0.04, body, 0, y0 + h / 2 - 0.01, 0.0, g);
  // frisos das portas
  for (const sx of [-1, 1]) {
    B(0.004, h - 0.02, 0.004, M().black, sx * L * 0.15, y0 + 0.01, d / 2 + 0.001, g);
    B(0.004, h - 0.02, 0.004, M().black, sx * L * 0.33, y0 + 0.01, d / 2 + 0.001, g);
  }
  return g;
}

function bed(W = 1.4, L = 1.9, { blanket = M().blanket, head = true, bare = false, cover = false } = {}) {
  const g = G();
  const m = M();
  B(W, 0.32, L, m.bedBase, 0, 0.06, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(0.02, 0.02, 0.06, m.chrome, sx * (W / 2 - 0.1), 0, sz * (L / 2 - 0.1), g, 8);
  if (bare) { R(W - 0.02, 0.24, L - 0.02, 0.05, m.quilt, 0, 0.38, 0, g); return g; }
  R(W - 0.02, 0.24, L - 0.02, 0.06, m.linen, 0, 0.38, 0, g);
  if (cover) {
    // colcha cobrindo toda a cama, caindo nas laterais
    R(W + 0.06, 0.32, L + 0.03, 0.04, blanket, 0, 0.31, 0.015, g);
    for (const x of W > 1.2 ? [-W / 4, W / 4] : [0]) {
      const pw = R(W / (W > 1.2 ? 2 : 1) - 0.12, 0.18, 0.4, 0.08, blanket, x, 0.62, -L / 2 + 0.28, g);
      pw.rotation.x = -0.4;
    }
    if (head) B(W + 0.1, 0.55, 0.08, m.bedBase, 0, 0.6, -L / 2 - 0.04, g);
    return g;
  }
  R(W + 0.04, 0.06, L * 0.62, 0.03, blanket, 0, 0.6, L * 0.19, g);
  R(W + 0.05, 0.07, 0.3, 0.03, blanket, 0, 0.6, -L * 0.13, g);
  const np = W > 1.2 ? 2 : 1;
  for (let i = 0; i < np; i++) {
    const x = np === 1 ? 0 : (i ? 1 : -1) * W / 4;
    const p = R(W / np - 0.12, 0.16, 0.38, 0.07, m.linen, x, 0.6, -L / 2 + 0.26, g);
    p.rotation.x = -0.35;
  }
  if (head) B(W + 0.1, 0.55, 0.08, m.bedBase, 0, 0.6, -L / 2 - 0.04, g);
  return g;
}

function nightstand(body = M().white, lamp = true) {
  const g = G();
  B(0.45, 0.5, 0.4, body, 0, 0.04, 0, g);
  B(0.4, 0.004, 0.004, M().black, 0, 0.3, 0.201, g);
  if (!lamp) { B(0.4, 0.16, 0.02, M().darkCab, 0, 0.36, 0.19, g); return g; }
  C(0.06, 0.07, 0.25, M().white, 0.05, 0.54, -0.02, g, 16);
  const shade = C(0.09, 0.12, 0.17, new THREE.MeshStandardMaterial({ color: 0xf4ead8, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 1 }), 0.05, 0.76, -0.02, g, 20);
  shade.castShadow = false;
  return g;
}

/** bancada com recorte de cuba */
function counterTop(p, L, D, th, mtl, x, y, z, hole) {
  if (!hole) return B(L, th, D, mtl, x, y, z, p);
  const { hx, hw, hd } = hole; // posição x da cuba (relativa), largura, profundidade
  const hz = hole.hz ?? 0;
  const xl = -L / 2, xr = L / 2, l0 = hx - hw / 2, l1 = hx + hw / 2;
  B(l0 - xl, th, D, mtl, x + (xl + l0) / 2, y, z, p);
  B(xr - l1, th, D, mtl, x + (l1 + xr) / 2, y, z, p);
  const front = D / 2 - (hz + hd / 2), back = (hz - hd / 2) + D / 2;
  if (front > 0.005) B(hw, th, front, mtl, x + hx, y, z + D / 2 - front / 2, p);
  if (back > 0.005) B(hw, th, back, mtl, x + hx, y, z - D / 2 + back / 2, p);
  return null;
}
function basin(p, w, d, depth, mtl, x, yTop, z) {
  const t = 0.012;
  B(w, t, d, mtl, x, yTop - depth, z, p);
  B(w, depth, t, mtl, x, yTop - depth, z - d / 2 + t / 2, p);
  B(w, depth, t, mtl, x, yTop - depth, z + d / 2 - t / 2, p);
  B(t, depth, d, mtl, x - w / 2 + t / 2, yTop - depth, z, p);
  B(t, depth, d, mtl, x + w / 2 - t / 2, yTop - depth, z, p);
}
function faucet(p, x, y, z, tall = false, m = M().chrome) {
  const hgt = tall ? 0.42 : 0.22;
  C(0.018, 0.022, hgt, m, x, y, z, p, 12);
  const arm = C(0.012, 0.012, tall ? 0.2 : 0.14, m, x, 0, z, p, 10);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(x, y + hgt - 0.01, z + (tall ? 0.1 : 0.07));
  C(0.006, 0.006, 0.06, m, x, y + hgt * 0.5, z - 0.03, p, 8).rotation.x = 1;
}

/** armários de cozinha (corrida de base) */
function baseRun(L, { body = M().taupe, top = M().granite, sinkAt = null, cooktopAt = null, D = 0.6, H = 0.9, plinth = true } = {}) {
  const g = G();
  const m = M();
  if (body) {
    B(L, 0.1, D - 0.06, m.black, 0, 0, -0.03, g);
    B(L, H - 0.13, D - 0.02, body, 0, 0.1, -0.01, g);
    const n = Math.max(1, Math.round(L / 0.5));
    for (let i = 1; i < n; i++) B(0.004, H - 0.15, 0.004, m.black, -L / 2 + (L * i) / n, 0.11, D / 2 - 0.019, g);
    B(L - 0.02, 0.025, 0.02, m.black, 0, H - 0.18, D / 2 - 0.02, g); // puxador cava
  }
  const hole = sinkAt != null ? { hx: sinkAt, hw: 0.56, hd: 0.36, hz: 0.02 } : null;
  counterTop(g, L + 0.02, D + 0.02, 0.03, top, 0, H - 0.03, 0, hole);
  if (hole) {
    basin(g, 0.56, 0.36, 0.18, m.steel, sinkAt, H - 0.03, 0.02);
    faucet(g, sinkAt, H, -0.24, true);
  }
  if (cooktopAt != null) {
    B(0.58, 0.008, 0.5, m.glassDark, cooktopAt, H, 0, g);
    for (const [bx, bz, r] of [[-0.15, -0.12, 0.06], [0.15, -0.12, 0.05], [-0.15, 0.12, 0.05], [0.15, 0.12, 0.06], [0, 0, 0.07]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 24), m.steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cooktopAt + bx, H + 0.015, bz);
      g.add(ring);
    }
  }
  return g;
}

function upperRun(L, { body = M().taupe, H = 0.7, D = 0.35, open = [] } = {}) {
  const g = G();
  const m = M();
  B(L, H, D, body, 0, 0, 0, g);
  const n = Math.max(1, Math.round(L / 0.45));
  for (let i = 1; i < n; i++) B(0.004, H - 0.02, 0.004, m.black, -L / 2 + (L * i) / n, 0.01, D / 2 + 0.001, g);
  B(L, 0.012, D, m.lamp, 0, -0.012, 0, g).castShadow = false; // LED sob o armário
  for (const [x, w] of open) { // nicho aberto em madeira
    const t = 0.02;
    B(w, H, D + 0.01, m.oak, x, 0, 0.005, g);
    B(w - 2 * t, H - 2 * t, 0.01, m.oakDark, x, t, -D / 2 + 0.01, g);
    B(w - 2 * t, t, D - 0.02, m.oak, x, H / 2 - t / 2, 0.01, g);
  }
  return g;
}

function fridge(W = 0.7, H = 1.82, D = 0.7) {
  const g = G();
  const m = M();
  R(W, H, D, 0.02, m.steel, 0, 0.02, 0, g);
  B(W - 0.02, 0.006, 0.006, m.black, 0, H * 0.66, D / 2 + 0.001, g);
  B(0.02, 0.5, 0.03, m.chrome, -W / 2 + 0.06, H * 0.72, D / 2 + 0.02, g);
  B(0.02, 0.7, 0.03, m.chrome, -W / 2 + 0.06, H * 0.2, D / 2 + 0.02, g);
  return g;
}

function hood() {
  const g = G();
  const m = M();
  B(0.6, 0.1, 0.48, m.steel, 0, 0, 0, g);
  B(0.26, 0.9, 0.24, m.steel, 0, 0.1, -0.12, g);
  return g;
}

function toilet() {
  const g = G();
  const m = M();
  R(0.26, 0.32, 0.42, 0.08, m.porcelain, 0, 0, 0.03, g);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.porcelain);
  bowl.scale.set(0.38, 0.22, 0.52);
  bowl.position.set(0, 0.42, 0.06);
  shadowy(bowl);
  g.add(bowl);
  R(0.38, 0.03, 0.48, 0.015, m.porcelain, 0, 0.41, 0.06, g);
  R(0.38, 0.38, 0.17, 0.03, m.porcelain, 0, 0.4, -0.2, g);
  C(0.02, 0.02, 0.012, m.chrome, 0, 0.78, -0.2, g, 12);
  return g;
}

function mirror(p, W, ctx, wallId, u, y, mw, mh, { led = false } = {}) {
  const Wf = ctx.frames[wallId];
  const scale = isMobile() ? 0.5 : 0.8;
  const ref = new Reflector(new THREE.PlaneGeometry(mw, mh), {
    textureWidth: Math.round(window.innerWidth * scale * (window.devicePixelRatio > 1 ? 1.3 : 1)),
    textureHeight: Math.round(window.innerHeight * scale * (window.devicePixelRatio > 1 ? 1.3 : 1)),
    color: 0xd8d8d8,
    clipBias: 0.003
  });
  ref.position.copy(wp(Wf, u, y, -0.03));
  ref.rotation.y = Wf.ry;
  p.add(ref);
  if (led) {
    const mm = new THREE.MeshBasicMaterial({ map: radialGlow(), color: 0xffd8a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(mw + 0.5, mh + 0.5), mm);
    glow.position.copy(wp(Wf, u, y, -0.006));
    glow.rotation.y = Wf.ry;
    p.add(glow);
  }
}
function radialGlow() {
  if (localTex.rglow) return localTex.rglow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  localTex.rglow = new THREE.CanvasTexture(c);
  return localTex.rglow;
}

function plant(h = 1.1) {
  const g = G();
  const m = M();
  C(0.17, 0.13, 0.32, m.pot, 0, 0, 0, g, 20);
  const r = rng(Math.round(h * 100));
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), m.leaf);
    const a = r() * Math.PI * 2, rad = 0.05 + r() * 0.12;
    leaf.scale.set(0.09, 0.3 + r() * 0.15, 0.04);
    leaf.position.set(Math.cos(a) * rad, 0.32 + h * 0.35 + r() * h * 0.35, Math.sin(a) * rad);
    leaf.rotation.set((r() - 0.5) * 0.9, a, (r() - 0.5) * 0.9);
    shadowy(leaf);
    g.add(leaf);
  }
  C(0.012, 0.012, h * 0.45, m.oakDark, 0, 0.3, 0, g, 6);
  return g;
}

function rug(p, w, d, x, z, mtl = M().rug) {
  B(w, 0.012, d, mtl, x, 0, z, p).castShadow = false;
}

function towel(p, x, y, z, ry = 0) {
  const t = R(0.32, 0.06, 0.24, 0.025, M().cloth, 0, 0, 0, null);
  const t2 = R(0.32, 0.06, 0.24, 0.025, M().cloth, 0, 0.06, 0, null);
  const g = G();
  g.add(t, t2);
  place(g, x, z, ry, p, y);
}

/* ---------- peças de acabamento entregue ---------- */
/** bancada de granito suspensa na parede com cuba (cozinha: inox / banheiro: louça oval) */
function wallSink(p, x, z, ry, { w = 1.2, d = 0.5, y = 0.9, bowl = 'steel' } = {}) {
  const m = M();
  const k = G();
  const steel = bowl === 'steel';
  const bw = steel ? 0.5 : 0.4, bd = steel ? 0.34 : 0.3, hx = steel ? -w * 0.12 : 0;
  counterTop(k, w, d, 0.03, m.granite, 0, y - 0.03, 0, { hx, hw: bw, hd: bd, hz: 0.03 });
  basin(k, bw, bd, steel ? 0.16 : 0.12, steel ? m.steel : m.porcelain, hx, y, 0.03);
  B(w, 0.08, 0.02, m.granite, 0, y, -d / 2 + 0.01, k); // rodabanca
  if (!steel) {
    const under = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.porcelain);
    under.scale.set(0.44, 0.3, 0.34);
    under.position.set(hx, y - 0.03, 0.03);
    k.add(shadowy(under));
    faucet(k, hx + 0.12, y, -d / 2 + 0.07);
  } else {
    // torneira de parede
    const arm = C(0.012, 0.012, 0.2, m.chrome, 0, 0, 0, k, 10);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(hx, y + 0.28, -d / 2 + 0.1);
    C(0.025, 0.025, 0.02, m.chrome, hx, y + 0.27, -d / 2 + 0.005, k, 12).rotation.x = Math.PI / 2;
  }
  // sifão branco
  C(0.02, 0.02, 0.35, m.white, hx, y - 0.5, 0.03, k, 10);
  const sp = C(0.02, 0.02, d / 2, m.white, 0, 0, 0, k, 10);
  sp.rotation.x = Math.PI / 2;
  sp.position.set(hx, y - 0.5, -d / 4 + 0.03);
  // mãos-francesas
  for (const sx of [-1, 1]) B(0.03, 0.18, d * 0.6, m.steel, sx * (w / 2 - 0.12), y - 0.21, -d * 0.18, k);
  place(k, x, z, ry, p);
}

/** chuveiro de parede (braço + crivo) */
function showerArm(p, ctx, wallId, u, y, mtl = M().white) {
  const W = ctx.frames[wallId];
  const base = wp(W, u, y, 0);
  const dir = W.nrm.clone().multiplyScalar(0.3).add(new THREE.Vector3(0, -0.06, 0));
  const arm = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, dir.length(), 10), mtl));
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  arm.position.copy(base).addScaledVector(dir, 0.5);
  p.add(arm);
  const head = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.035, 0.05, 20), mtl));
  head.position.copy(base).add(dir).add(new THREE.Vector3(0, -0.03, 0));
  p.add(head);
  // registro
  const reg = wp(W, u, 1.15, -0.02);
  const r = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16), M().chrome));
  r.position.copy(reg);
  r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), W.nrm);
  p.add(r);
}

function floorDrain(p, x, z) {
  B(0.12, 0.004, 0.12, M().steel, x, 0, z, p).castShadow = false;
}

function conePendant(p, x, z, yb, ceil) {
  const m = M();
  C(0.003, 0.003, ceil - yb - 0.2, m.black, x, yb + 0.2, z, p, 4);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }));
  cone.position.set(x, yb + 0.11, z);
  p.add(cone);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), m.lampWarm);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(x, yb + 0.02, z);
  p.add(disc);
  const pl = new THREE.PointLight(0xffcf96, 1.4, 0, 2);
  pl.position.set(x, yb - 0.05, z);
  p.add(pl);
}

function crystalPendant(p, x, z, ceil) {
  const m = M();
  C(0.002, 0.002, ceil - 1.75, m.chrome, x, 1.75, z, p, 4);
  const c = C(0.06, 0.075, 0.18, m.crystal, x, 1.58, z, p, 10);
  c.castShadow = false;
  const pl = new THREE.PointLight(0xffd29a, 0.7, 0, 2);
  pl.position.set(x, 1.5, z);
  p.add(pl);
}

function glowUp(p, W, u, y, len, h = 0.7, opacity = 0.7) {
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffc47a, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.copy(wp(W, u, y + h / 2, -0.006));
  glow.rotation.set(0, W.ry, Math.PI); // brilho de baixo para cima
  glow.renderOrder = 3;
  p.add(glow);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, 0.012), M().led);
  strip.position.copy(wp(W, u, y, -0.07));
  strip.rotation.y = W.ry;
  p.add(strip);
}

/* ============================================
   AMBIENTES
   Medidas, portas e janelas conforme as plantas baixas (planta standard/gold/premier.pdf).
   Standard e Gold: como o imóvel é ENTREGUE (sem móveis), conforme as fotos.
   Premier: decorado, conforme as fotos do imóvel decorado.
   ============================================ */
const ROOMS = {
  /* ---------------- STANDARD (planta Tipo 7, lado esquerdo) ---------------- */
  // Estar/jantar 3,58 × 4,36 com a cozinha (2,73 × 3,17) ao lado, ligada pela bancada americana (vão de 1,30)
  'standard-sala'() {
    const m = M();
    const ctx = buildRoom({
      w: 3.58, d: 4.36, h: 2.6, floor: m.floorTile,
      walls: {
        // circulação (0,93) para banheiro e quartos
        n: { openings: [{ type: 'pass', u: 0.465, w: 0.93, y0: 0, y1: 2.15, leaf: false, trim: false, cw: 0.93, cd: 3.55,
          links: [{ to: 'banheiro', label: 'Banheiro', du: -0.25, dc: 2.2, y: 1.15 }, { to: 'quarto', label: 'Quarto', du: -0.25, dc: 3.15, y: 1.6 }] }] },
        e: { openings: [{ type: 'window', u: 1.955, w: 1.42, y0: 1.05, y1: 2.05, frame: 'black' }] },
        s: { openings: [{ type: 'window', u: 1.805, w: 1.45, y0: 1.05, y1: 2.05, frame: 'black' }] },
        // porta de entrada (vinda da varanda) + passa-pratos para a cozinha
        w: { openings: [
          { type: 'door', u: 0.52, w: 0.8, y0: 0, y1: 2.1, panels: [2, 5], trimMat: m.frameDark, handleSide: 'left' },
          { type: 'void', u: 2.765, w: 1.3, y0: 1.0, y1: 2.4, top: 0.2, link: 'cozinha', label: 'Cozinha' }
        ] }
      },
      sun: { wall: 'e', elev: 28, az: -30, intensity: 3.0 },
      lights: [{ type: 'socket', x: 0.2, z: 0, power: 3 }]
    });
    const r = ctx.room;
    // portas da circulação: banheiro e quarto 02 à esquerda, quarto 01 à direita
    const zN = -4.36 / 2;
    for (const [x, dc, w, side] of [[-1.79, 2.19, 0.7, 1], [-1.79, 3.14, 0.8, 1], [-0.86, 3.14, 0.8, -1]]) {
      B(0.03, 2.13, w + 0.1, m.frameDark, x + side * 0.02, 0, zN - dc, r);
      B(0.035, 2.08, w - 0.02, m.woodDoor, x + side * 0.035, 0, zN - dc, r);
    }
    // cozinha ao lado, modelada inteira (vista pelo passa-pratos)
    const k = buildRoom({
      w: 2.73, d: 3.17, h: 2.6, floor: m.floorTile, tileMat: m.wallTileGray, hemi: 0.3,
      walls: {
        n: { tile: { h: 2.6 }, openings: [{ type: 'door', u: 0.47, w: 0.8, y0: 0, y1: 2.1, panels: [2, 5], trimMat: m.frameDark, handleSide: 'right' }] },
        e: { tile: { h: 2.6 }, openings: [{ type: 'void', u: 1.6, w: 1.3, y0: 1.0, y1: 2.4, link: 'sala', label: 'Sala', linkY: 1.6 }] },
        s: { tile: { h: 2.6 } },
        w: { tile: { h: 2.6 }, openings: [{ type: 'window', u: 0.62, w: 1.0, y0: 1.1, y1: 2.05, frame: 'black', tiledReveal: true, sill: false }] }
      },
      lights: [{ type: 'socket', x: 0, z: 0, power: 3 }]
    });
    wallSink(k.room, -2.73 / 2 + 0.25, 0.965, Math.PI / 2, { w: 1.1, d: 0.5, y: 0.9, bowl: 'steel' });
    const off = new THREE.Vector3(-(3.58 / 2 + T + 2.73 / 2), 0, zN + 3.17 / 2);
    k.room.position.copy(off);
    r.add(k.room);
    for (const l of k.links) ctx.links.push({ ...l, pos: l.pos.clone().add(off) });
    return { ctx, eye: [-1.0, 1.4], yaw: -35 * DEG };
  },

  // Quarto 02: 2,73 × 3,30, janela para o fundo, porta no fim da circulação
  'standard-quarto'() {
    const m = M();
    const ctx = buildRoom({
      w: 2.73, d: 3.3, h: 2.6, floor: m.floorTile,
      walls: {
        n: { openings: [{ type: 'window', u: 1.32, w: 1.5, y0: 1.05, y1: 2.05, frame: 'black' }] },
        e: { openings: [{ type: 'pass', u: 2.88, w: 0.8, y0: 0, y1: 2.1, link: 'sala', label: 'Sala', trimMat: m.frameDark, leafMat: m.woodDoor, hinge: 'right' }] }
      },
      sun: { wall: 'n', elev: 34, az: 30, intensity: 2.6 },
      lights: [{ type: 'socket', x: 0, z: 0, power: 2.5 }]
    });
    return { ctx, eye: [0.7, 1.05], yaw: 25 * DEG };
  },

  // BWC 1,31 × 2,50 visto da porta: basculante, bacia e lavatório na parede longa, chuveiro na ponta
  'standard-banheiro'() {
    const m = M();
    const ctx = buildRoom({
      w: 2.5, d: 1.31, h: 2.6, floor: m.floorTile, tileMat: m.bathTile,
      walls: {
        n: { tile: { h: 2.6 }, openings: [{ type: 'window', u: 1.75, w: 0.9, y0: 1.65, y1: 2.15, frosted: true, grid: [1, 2], tiledReveal: true, sill: false }] },
        e: { tile: { h: 2.6 } },
        w: { tile: { h: 2.6 } },
        s: { tile: { h: 2.6 }, openings: [{ type: 'pass', u: 0.43, w: 0.7, y0: 0, y1: 2.1, link: 'sala', label: 'Sala', trimMat: m.frameDark, leafMat: m.woodDoor }] }
      },
      sun: { wall: 'n', elev: 58, az: 0, intensity: 1.2 },
      lights: [{ type: 'socket', x: 0.3, z: 0, power: 2.2 }]
    });
    const r = ctx.room;
    place(toilet(), 0.0, -1.31 / 2 + 0.32, 0, r);
    shadowUnder(r, 0.55, 0.65, 0.0, -0.33);
    wallSink(r, 0.87, -1.31 / 2 + 0.225, 0, { w: 0.6, d: 0.45, y: 0.85, bowl: 'oval' });
    showerArm(r, ctx, 'w', 0.65, 2.05);
    floorDrain(r, -0.85, 0.05);
    return { ctx, eye: [0.8, 0.58], yaw: 32 * DEG, pitch: -16 * DEG };
  },

  /* ---------------- GOLD (planta Tipo 4, lado esquerdo) ---------------- */
  // Estar/jantar 2,70 × 5,37 + cozinha 2,70 × 3,52 em linha, separados pela bancada de 1,80 (passagem de 0,90)
  'gold-sala'() {
    const m = M();
    const W2 = 2.7 / 2, D2 = 8.89 / 2;
    const ctx = buildRoom({
      w: 2.7, d: 8.89, h: 2.6, floor: m.floorTile, tileMat: m.wallTileGray,
      walls: {
        // vão para a área de serviço
        n: { tile: { h: 2.6 }, openings: [{ type: 'pass', u: 0.45, w: 0.9, y0: 0, y1: 2.1, leaf: false, trim: false, beyondWall: m.wallTileGray }] },
        // lateral da garagem: porta social, janela da sala, janela e porta da cozinha
        w: { tile: { h: 2.6, u0: 5.37, u1: 8.89 }, openings: [
          { type: 'door', u: 0.48, w: 0.85, y0: 0, y1: 2.1, panels: [2, 5], trimMat: m.frameDark, handleSide: 'right' },
          { type: 'window', u: 3.36, w: 1.5, y0: 1.0, y1: 2.1 },
          { type: 'window', u: 7.11, w: 1.6, y0: 1.0, y1: 2.1, tiledReveal: true },
          { type: 'door', u: 8.45, w: 0.8, y0: 0, y1: 2.1, panels: [2, 5], trimMat: m.frameDark, handleSide: 'left' }
        ] },
        // hall (1,75) para suíte, quarto e banheiro social
        e: { tile: { h: 2.6, u0: 0, u1: 3.52 }, openings: [
          { type: 'pass', u: 4.4, w: 1.75, y0: 0, y1: 2.3, leaf: false, trim: false, cw: 1.75, cd: 0.94,
            links: [{ to: 'suite', label: 'Suíte', du: -0.5, dc: 0.6 }, { to: 'quarto', label: 'Quarto', du: 0.5, dc: 0.6 }] }
        ] },
        s: { openings: [{ type: 'window', u: 1.35, w: 1.52, y0: 1.0, y1: 2.1 }] }
      },
      sun: { wall: 'w', elev: 30, az: 20, intensity: 2.6 },
      lights: [{ type: 'socket', x: 0, z: -2.68, power: 2.5 }, { type: 'socket', x: 0, z: 1.76, power: 2.5 }]
    });
    const r = ctx.room;
    // bancada americana presa à parede da suíte, revestida, com tampo de granito
    B(1.8, 1.0, 0.12, m.wallTileGray, W2 - 0.9, 0, -0.925, r);
    B(1.9, 0.03, 0.44, m.granite, W2 - 0.95, 1.0, -0.925, r);
    // pia na parede do fundo, ao lado do vão da área de serviço
    wallSink(r, 0.72, -D2 + 0.25, 0, { w: 1.2, d: 0.5, y: 0.9, bowl: 'steel' });
    // portas do hall: suíte (norte), quarto (sul) e banheiro social (fundo)
    const hx = W2 + T + 0.53;
    B(0.75, 2.08, 0.035, m.doorFlush, hx, 0, -0.9, r);
    B(0.75, 2.08, 0.035, m.doorFlush, hx, 0, 0.81, r);
    B(0.035, 2.08, 0.65, m.doorFlush, W2 + T + 0.92, 0, 0.4, r);
    return { ctx, eye: [0.3, -3.6], yaw: 180 * DEG };
  },

  // Suíte 2,52 × 3,52: janela lateral, porta do banheiro no fundo, porta do hall na frente
  'gold-suite'() {
    const m = M();
    const ctx = buildRoom({
      w: 2.52, d: 3.52, h: 2.6, floor: m.floorTile,
      walls: {
        e: { openings: [{ type: 'window', u: 1.8, w: 1.45, y0: 1.0, y1: 2.1 }] },
        n: { openings: [{ type: 'pass', u: 0.42, w: 0.65, y0: 0, y1: 2.1, link: 'banheiro', label: 'Banheiro da suíte', trimMat: m.frameDark, leaf: false, beyondWall: m.bathTile, beyondFloor: m.floorTile }] },
        s: { openings: [{ type: 'pass', u: 2.1, w: 0.75, y0: 0, y1: 2.1, link: 'sala', label: 'Sala', leafMat: m.doorFlush, trim: false }] }
      },
      sun: { wall: 'e', elev: 30, az: -20, intensity: 2.6 },
      lights: [{ type: 'socket', x: 0, z: 0, power: 2.5 }]
    });
    const r = ctx.room;
    // folha da porta do banheiro, entreaberta para dentro do banheiro
    const leaf = B(0.035, 2.08, 0.62, m.doorFlush, 0, 0, 0, null);
    leaf.position.set(-2.52 / 2 + 0.42 + 0.3, 1.04, -3.52 / 2 - T - 0.3);
    leaf.rotation.y = 0.35;
    r.add(leaf);
    return { ctx, eye: [0.35, 1.2], yaw: 15 * DEG };
  },

  // BWC da suíte 2,52 × 1,20: lavatório, bacia e chuveiro em linha na parede do fundo; pastilhas na ponta
  'gold-banheiro'() {
    const m = M();
    const ctx = buildRoom({
      w: 2.52, d: 1.2, h: 2.6, floor: m.floorTile, tileMat: m.bathTile,
      walls: {
        e: { tile: { h: 2.6, mat: m.mosaic }, openings: [
          { type: 'window', u: 0.6, w: 0.7, y0: 1.6, y1: 2.2, frosted: true, grid: [1, 2], tiledReveal: true, sill: false },
          { type: 'niche', u: 0.6, w: 0.6, y0: 0.95, y1: 1.3, tiledReveal: true, frameMat: m.black }
        ] },
        n: { tile: { h: 2.6 } },
        w: { tile: { h: 2.6 } },
        s: { tile: { h: 2.6 }, openings: [{ type: 'pass', u: 2.13, w: 0.65, y0: 0, y1: 2.1, link: 'suite', label: 'Suíte', trimMat: m.frameDark, leafMat: m.doorFlush, hinge: 'right' }] }
      },
      sun: { wall: 'e', elev: 58, az: 0, intensity: 1.2 },
      lights: [{ type: 'socket', x: 0, z: 0, power: 2.2 }]
    });
    const r = ctx.room;
    place(toilet(), 0.23, -0.6 + 0.32, 0, r);
    shadowUnder(r, 0.55, 0.65, 0.23, -0.3);
    wallSink(r, -0.85, -0.6 + 0.24, 0, { w: 0.7, d: 0.48, y: 0.85, bowl: 'oval' });
    showerArm(r, ctx, 'n', 2.2, 2.1);
    floorDrain(r, 0.95, 0.1);
    return { ctx, eye: [-0.85, 0.42], yaw: -62 * DEG, pitch: -14 * DEG };
  },

  // Quarto 2,52 × 3,50 com janela para a frente
  'gold-quarto'() {
    const m = M();
    const ctx = buildRoom({
      w: 2.52, d: 3.5, h: 2.6, floor: m.floorTile,
      walls: {
        s: { openings: [{ type: 'window', u: 1.26, w: 1.52, y0: 1.0, y1: 2.1 }] },
        n: { openings: [{ type: 'pass', u: 0.42, w: 0.75, y0: 0, y1: 2.1, link: 'sala', label: 'Sala', leafMat: m.doorFlush, trim: false }] }
      },
      sun: { wall: 's', elev: 32, az: 20, intensity: 2.6 },
      lights: [{ type: 'socket', x: 0, z: 0, power: 2.5 }]
    });
    return { ctx, eye: [0.35, -1.0], yaw: 165 * DEG };
  },

  /* ---------------- PREMIER (planta lado direito) ---------------- */
  // Estar/jantar 3,42 × 5,07 (+ faixa da bancada); norte = fachada, oeste = lado da garagem
  'premier-sala'() {
    const m = M();
    const h = 4.5, W2 = 3.42 / 2, D2 = 5.5 / 2;
    const ctx = buildRoom({
      w: 3.42, d: 5.5, h, floor: m.marble, wallMat: m.paintWarm,
      walls: {
        n: { openings: [{ type: 'window', u: 1.64, w: 1.5, y0: 0.4, y1: 3.4, grid: [2, 3], sill: false }] },
        w: { openings: [{ type: 'door', u: 4.68, w: 1.1, y0: 0, y1: 2.6, leafMat: m.woodDoor, grooves: true, pull: true, handleSide: 'right' }] },
        s: { openings: [
          { type: 'pass', u: 1.2, w: 2.4, y0: 0, y1: 2.6, link: 'cozinha', label: 'Cozinha', linkY: 1.55, leaf: false, trim: false, cw: 2.4, cd: 2.81, beyondWall: m.marbleWall, beyondFloor: m.marble },
          { type: 'pass', u: 2.97, w: 0.9, y0: 0, y1: 2.6, leaf: false, trim: false, cw: 0.9, cd: 5.55,
            links: [{ to: 'quarto2', label: 'Quarto 2', du: 0.25, dc: 3.25, y: 1.3 }, { to: 'suite', label: 'Suíte master', du: 0, dc: 5.3, y: 1.6 }] }
        ] }
      },
      hemi: 0.5,
      sun: { wall: 'n', elev: 30, az: -25, intensity: 2.0 },
      lights: [
        { type: 'spot', x: -0.9, z: -1.9, power: 2.5, warm: true }, { type: 'spot', x: 0.9, z: -1.9, power: 2.5, warm: true },
        { type: 'spot', x: -0.9, z: 0.2, power: 3, warm: true }, { type: 'spot', x: 0.9, z: 0.2, power: 3, warm: true },
        { type: 'spot', x: -0.9, z: 2.0, power: 3, warm: true }, { type: 'spot', x: 0.9, z: 2.0, power: 3, warm: true }
      ]
    });
    const r = ctx.room;
    ledWash(r, ctx, ['n', 's', 'e', 'w'], { height: 1.1, opacity: 0.5 });
    // mesa de jantar (tampo branco) e 6 cadeiras, junto à janela
    place(diningTable(1.6, 0.9, 6, m.oak, true), 0, -1.9, 0, r);
    shadowUnder(r, 2.6, 2.0, 0, -1.9, 0.28);
    // pendente LED em anéis
    const pend = G();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22 + i * 0.06, 0.008, 8, 64), m.lampWarm);
      ring.rotation.set(Math.PI / 2 + (i - 1) * 0.5, (i - 1) * 0.6, 0);
      ring.position.y = i * 0.04;
      pend.add(ring);
    }
    C(0.002, 0.002, h - 1.75, m.black, 0, 0.1, 0, pend, 4);
    place(pend, 0, -1.9, 0, r, 1.6);
    const pl = new THREE.PointLight(0xffc98a, 3, 0, 2);
    pl.position.set(0, 1.5, -1.9);
    r.add(pl);
    // rack suspenso + prateleiras com estrutura metálica (parede do jardim)
    place(rack(2.2, 0.42, 0.45, m.oak, true), W2 - 0.23, 0.3, -Math.PI / 2, r);
    const sh = G();
    for (const [x, y, L] of [[-0.4, 1.95, 1.0], [-0.4, 2.35, 1.0], [-0.4, 2.75, 1.0], [0.6, 3.05, 2.6]]) B(L, 0.035, 0.24, m.oak, x, y, 0, sh);
    for (const x of [-0.85, 0.05]) {
      B(0.015, 1.2, 0.015, m.black, x, 1.92, 0.11, sh);
      B(0.015, 1.2, 0.015, m.black, x + 0.06, 1.92, -0.11, sh);
      B(0.08, 0.015, 0.24, m.black, x + 0.03, 3.12, 0, sh);
    }
    C(0.04, 0.05, 0.2, m.white, -0.6, 1.985, 0, sh, 12);
    C(0.05, 0.05, 0.12, m.oakDark, -0.2, 2.385, 0, sh, 12);
    place(sh, W2 - 0.12, -1.1, -Math.PI / 2, r);
    // sofá retrátil taupe (parede da garagem)
    place(sofa(2.4, m.sofa), -W2 + 0.5, 0.4, Math.PI / 2, r);
    shadowUnder(r, 1.2, 2.7, -W2 + 0.5, 0.4);
    rug(r, 1.8, 2.4, 0.15, 0.4);
    const ct = G();
    C(0.42, 0.42, 0.04, m.oak, 0, 0.34, 0, ct, 32);
    C(0.03, 0.03, 0.34, m.black, 0, 0, 0, ct, 8);
    place(ct, 0.1, 0.4, 0, r);
    place(plant(1.4), W2 - 0.35, -D2 + 0.4, 0, r);
    // bancada (península) da cozinha: base ripada em madeira com LED, tampo em granito preto
    const bx = 0.51, zc = D2 - 0.42;
    B(2.4, 0.96, 0.3, m.oak, bx, 0.04, zc + 0.15, r);
    for (let x = -1.17; x <= 1.17; x += 0.065) B(0.035, 0.95, 0.025, m.oak, bx + x, 0.045, zc - 0.01, r);
    B(2.5, 0.04, 0.56, m.granite, bx, 1.0, zc + 0.22, r);
    B(2.4, 0.01, 0.012, m.led, bx, 0.03, zc - 0.03, r).castShadow = false;
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffc47a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    fg.rotation.set(-Math.PI / 2, 0, Math.PI);
    fg.position.set(bx, 0.004, zc - 0.36);
    r.add(fg);
    for (const x of [-0.8, 0, 0.8]) conePendant(r, bx + x, zc + 0.2, 2.35, h);
    // cozinha ao fundo: bancada da pia sob a janela em fita (parede do jardim), porta de correr e geladeira no fundo
    const z0 = D2 + T, z1 = D2 + T + 2.81, zm = (z0 + z1) / 2;
    place(baseRun(2.75, { sinkAt: -0.25, cooktopAt: 0.75 }), W2 - 0.3, zm, -Math.PI / 2, r);
    place(upperRun(2.1, { open: [[0.8, 0.4]] }), W2 - 0.18, zm + 0.2, -Math.PI / 2, r, 1.95);
    B(0.012, 0.46, 2.1, m.frosted, W2 - 0.01, 1.25, zm, r);
    place(hood(), W2 - 0.25, zm + 0.75, -Math.PI / 2, r, 1.62);
    B(0.85, 2.1, 0.04, m.woodRed, 0.66, 0, z1 - 0.03, r);
    place(fridge(0.72, 1.85, 0.72), -0.33, z1 - 0.37, Math.PI, r);
    addLight(r, ctx, { type: 'panel', x: bx, z: zm, y: 2.7, power: 4 });
    // hall: portas dos quartos (lado da garagem), roupeiro, banheiro social e suíte no fim
    const hxW = -W2, hxE = -W2 + 0.9;
    for (const dc of [2.34, 3.25]) B(0.035, 2.08, 0.78, m.woodRed, hxW + 0.03, 0, D2 + dc, r);
    B(0.02, 2.2, 1.45, m.oak, hxE - 0.012, 0, D2 + 3.65, r);
    B(0.035, 2.08, 0.6, m.woodRed, hxE - 0.03, 0, D2 + 4.84, r);
    B(0.78, 2.08, 0.035, m.woodRed, (hxW + hxE) / 2, 0, D2 + T + 5.55 - 0.03, r);
    return { ctx, eye: [0.2, 1.4], yaw: 8 * DEG };
  },

  // Cozinha em L 2,40 × 2,81 vista do hall: norte = janela em fita (jardim), oeste = península para a sala
  'premier-cozinha'() {
    const m = M();
    const W2 = 2.81 / 2, D2 = 2.4 / 2;
    const ctx = buildRoom({
      w: 2.81, d: 2.4, h: 2.8, floor: m.marble, wallMat: m.paintWarm,
      walls: {
        n: { tile: { h: 2.8, mat: m.marbleWall }, openings: [{ type: 'window', u: 1.33, w: 2.0, y0: 1.2, y1: 1.68, grid: [4, 1], sill: false }] },
        e: { tile: { h: 2.8 }, openings: [{ type: 'door', u: 1.05, w: 0.85, y0: 0, y1: 2.1, leafMat: m.woodRed, grooves: true, handleSide: 'left' }] },
        w: { openings: [{ type: 'pass', u: 1.2, w: 2.4, y0: 0, y1: 2.6, link: 'sala', label: 'Sala', leaf: false, trim: false, cw: 2.4, cd: 3.0, beyondWall: m.paintWarm, beyondFloor: m.marble }] },
        s: { openings: [{ type: 'pass', u: 1.99, w: 1.64, y0: 0, y1: 2.3, leaf: false, trim: false, cw: 1.64, cd: 0.95,
          links: [{ to: 'quarto2', label: 'Quarto 2', du: -0.4, dc: 0.6 }, { to: 'suite', label: 'Suíte master', du: 0.4, dc: 0.6 }] }] }
      },
      tileMat: m.marbleWall,
      sun: { wall: 'n', elev: 45, az: 15, intensity: 1.8 },
      lights: [{ type: 'panel', x: 0, z: -0.2, s: 0.45, power: 6 }]
    });
    const r = ctx.room;
    // bancada da pia e do cooktop sob a janela
    place(baseRun(2.81, { sinkAt: -0.1, cooktopAt: 0.85 }), 0, -D2 + 0.3, 0, r);
    // península (perna do L) voltada para a sala
    const pen = G();
    B(1.8, 0.86, 0.5, m.taupe, 0, 0.02, 0, pen);
    B(1.9, 0.035, 0.65, m.granite, 0, 0.88, 0, pen);
    place(pen, -W2 + 0.3, 0.3, Math.PI / 2, r);
    // armários superiores com nicho de madeira + coifa
    place(upperRun(2.1, { open: [[-0.85, 0.42]] }), -W2 + 1.05, -D2 + 0.18, 0, r, 1.9);
    place(hood(), 0.85, -D2 + 0.25, 0, r, 1.62);
    // geladeira ao lado da porta de correr da área de serviço
    place(fridge(0.72, 1.85, 0.72), W2 - 0.38, 0.75, -Math.PI / 2, r);
    shadowUnder(r, 0.9, 0.9, W2 - 0.38, 0.75);
    C(0.12, 0.08, 0.06, m.white, -W2 + 0.3, 0.915, 0.6, r, 20);
    return { ctx, eye: [0.05, 1.05], yaw: 8 * DEG, pitch: -10 * DEG };
  },

  // Suíte casal 4,20 × 2,87: norte = janela de 2,00, oeste = parede da cama, sul = closet, leste = hall
  'premier-suite'() {
    const m = M();
    const W2 = 2.87 / 2, D2 = 4.2 / 2;
    const ctx = buildRoom({
      w: 2.87, d: 4.2, h: 2.8, floor: m.marble, wallMat: m.paintWarm,
      walls: {
        n: { openings: [{ type: 'window', u: 1.46, w: 2.0, y0: 1.1, y1: 2.1 }] },
        e: { openings: [{ type: 'pass', u: 3.81, w: 0.8, y0: 0, y1: 2.1, link: 'sala', label: 'Hall / sala', leaf: false }] },
        s: { openings: [{ type: 'pass', u: 1.92, w: 1.1, y0: 0, y1: 2.2, link: 'closet', label: 'Closet', leaf: false, trim: false, beyondFloor: m.marble }] }
      },
      sun: { wall: 'n', elev: 40, az: -20, intensity: 1.8 },
      lights: [{ type: 'panel', x: -0.2, z: -0.6, s: 0.35, power: 3.5 }, { type: 'panel', x: 0.5, z: 0.9, s: 0.35, power: 3.5 }]
    });
    const r = ctx.room;
    // parede da cabeceira estofada (painéis) com fita de LED no topo
    const W = ctx.frames.w;
    const cols = 7, rows = 3, cw = 4.2 / cols, rh = 1.3 / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) wallBox(r, W, cw * (i + 0.5), rh * (j + 0.5), -0.03, cw - 0.012, rh - 0.012, 0.05, m.upholster);
    glowUp(r, W, 2.1, 1.3, 4.2, 0.8, 0.75);
    // cama de casal (centrada como na planta), ar-condicionado acima
    const bz = -0.71;
    R(0.2, 0.28, 0.85, 0.04, m.white, -W2 + 0.1, 2.15, bz, r);
    B(0.01, 0.02, 0.7, m.black, -W2 + 0.2, 2.18, bz, r);
    place(bed(1.58, 1.98, { blanket: m.quilt, head: false, cover: true }), -W2 + 0.06 + 0.99, bz, Math.PI / 2, r);
    shadowUnder(r, 2.3, 2.0, -W2 + 1.05, bz, 0.35);
    place(nightstand(m.grayFurn, false), -W2 + 0.28, bz + 1.12, Math.PI / 2, r);
    crystalPendant(r, -W2 + 0.3, bz - 1.05, 2.8);
    crystalPendant(r, -W2 + 0.3, bz + 1.12, 2.8);
    // bancada e nicho suspensos em cinza (parede do hall, frente à cama)
    B(0.4, 0.22, 2.2, m.grayFurn, W2 - 0.2, 0.62, -0.4, r);
    B(0.34, 0.26, 1.5, m.grayFurn, W2 - 0.17, 2.1, -0.6, r);
    return { ctx, eye: [1.0, 1.65], yaw: 58 * DEG };
  },

  // Quarto 2: 3,18 × 2,80, janela lateral (norte), porta do hall (sul)
  'premier-quarto2'() {
    const m = M();
    const ctx = buildRoom({
      w: 2.8, d: 3.18, h: 2.8, floor: m.marble, wallMat: m.paintWarm,
      walls: {
        n: { openings: [{ type: 'window', u: 1.32, w: 1.5, y0: 1.2, y1: 2.15, sill: false }] },
        s: { openings: [{ type: 'pass', u: 0.46, w: 0.8, y0: 0, y1: 2.1, link: 'sala', label: 'Hall / sala', leaf: false }] }
      },
      sun: { wall: 'n', elev: 38, az: 15, intensity: 1.8 },
      lights: [{ type: 'panel', x: 0, z: 0.2, s: 0.35, power: 4 }]
    });
    const r = ctx.room;
    // painel ripado vertical na cabeceira com LED
    const W = ctx.frames.n;
    const n = 14, sw = 2.8 / n;
    for (let i = 0; i < n; i++) wallBox(r, W, sw * (i + 0.5), 0.575, -0.03, sw - 0.012, 1.15, 0.05, m.taupeHead);
    glowUp(r, W, 1.4, 1.15, 2.8, 0.75, 0.7);
    const zb = -3.18 / 2 + 0.06 + 0.94;
    for (const x of [-0.85, 0.85]) {
      place(bed(0.88, 1.88, { bare: true }), x, zb, 0, r);
      shadowUnder(r, 1.1, 2.1, x, zb + 0.1, 0.3);
    }
    // criado-mudo aberto entre as camas
    const ns = G();
    B(0.42, 0.55, 0.38, m.taupe, 0, 0.05, 0, ns);
    B(0.36, 0.2, 0.02, m.oakDark, 0, 0.32, -0.17, ns);
    B(0.36, 0.015, 0.34, m.taupe, 0, 0.3, 0.01, ns);
    place(ns, 0, -3.18 / 2 + 0.26, 0, r);
    return { ctx, eye: [0.25, 1.2], yaw: 4 * DEG };
  },

  // Closet 2,40 × 1,55: norte = janela, leste = marcenaria, sul = suíte, oeste = banheiro
  'premier-closet'() {
    const m = M();
    const ctx = buildRoom({
      w: 1.55, d: 2.4, h: 2.8, floor: m.marble, wallMat: m.paint,
      walls: {
        n: { openings: [{ type: 'window', u: 0.775, w: 0.8, y0: 1.5, y1: 2.1, sillMat: m.travertine }] },
        w: { openings: [{ type: 'pass', u: 0.42, w: 0.7, y0: 0, y1: 2.1, link: 'banheiro', label: 'Banheiro', leaf: false, beyondFloor: m.marble, beyondWall: m.marbleWall }] },
        s: { openings: [{ type: 'pass', u: 0.95, w: 1.1, y0: 0, y1: 2.2, link: 'suite', label: 'Suíte master', leaf: false, trim: false }] }
      },
      sun: { wall: 'n', elev: 50, az: -20, intensity: 1.4 },
      lights: [{ type: 'panel', x: -0.2, z: 0, power: 3.5 }]
    });
    const r = ctx.room;
    // armário modular branco aberto, com LED nos cabideiros
    const cl = G();
    const L = 2.35, D = 0.6, H = 2.6, n = 3, mw = L / n, t = 0.025;
    B(L, t, D, m.white, 0, H - t, 0, cl);
    B(L, 0.08, D, m.white, 0, 0, 0, cl);
    B(L, H, 0.015, m.white, 0, 0, -D / 2 + 0.0075, cl);
    for (let i = 0; i <= n; i++) B(t, H, D, m.white, -L / 2 + i * mw, 0, 0, cl);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + mw * (i + 0.5);
      B(mw - t, t, D, m.white, x, 2.15, 0, cl);
      const rod = C(0.012, 0.012, mw - t, m.black, 0, 0, 0, cl, 8);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(x, 2.02, 0.02);
      B(mw - t - 0.02, 0.008, 0.012, m.led, x, 2.005, 0.045, cl).castShadow = false;
      const pl = new THREE.PointLight(0xffd6a0, 0.9, 2.5, 2);
      pl.position.set(x, 1.85, 0.15);
      cl.add(pl);
      if (i > 0) {
        // gaveteiro + sapateira
        B(mw - t, t, D, m.white, x, 0.95, 0, cl);
        for (const y of [0.5, 0.72]) {
          B(mw - t - 0.01, 0.2, 0.02, m.white, x, y, D / 2 - 0.01, cl);
          B(mw * 0.5, 0.006, 0.006, m.black, x, y + 0.19, D / 2 + 0.001, cl);
        }
        B(mw - t, t, D, m.white, x, 0.3, 0, cl);
      } else {
        for (const y of [0.35, 0.6]) B(mw - t, t, D, m.white, x, y, 0, cl);
      }
    }
    place(cl, 1.55 / 2 - 0.3, 0, -Math.PI / 2, r);
    return { ctx, eye: [-0.45, 1.0], yaw: -24 * DEG };
  },

  // BWC da suíte 2,40 × 1,20: norte = janela + nicho (box), oeste = bancada e bacia, leste = porta do closet
  'premier-banheiro'() {
    const m = M();
    const W2 = 1.2 / 2;
    const ctx = buildRoom({
      w: 1.2, d: 2.4, h: 2.8, floor: m.marble, wallMat: m.paint, tileMat: m.marbleWall,
      walls: {
        n: { tile: { h: 2.8 }, openings: [
          { type: 'window', u: 0.6, w: 0.6, y0: 1.6, y1: 2.2, sill: false, tiledReveal: true },
          { type: 'niche', u: 0.6, w: 0.85, y0: 1.15, y1: 1.42, revealMat: m.travertine, backMat: m.travertine }
        ] },
        e: { tile: { h: 2.8 }, openings: [{ type: 'pass', u: 2.0, w: 0.7, y0: 0, y1: 2.1, link: 'closet', label: 'Closet', leaf: false, beyondFloor: m.marble }] },
        w: { tile: { h: 2.8 } },
        s: { tile: { h: 2.8 } }
      },
      sun: { wall: 'n', elev: 55, az: 0, intensity: 1.4 },
      lights: [{ type: 'spot', x: -0.15, z: 0.6, power: 2.5 }, { type: 'spot', x: 0.15, z: -0.7, power: 2.5 }]
    });
    const r = ctx.room;
    // bancada em mármore travertino com cuba esculpida + gabinete cinza
    const v = G();
    B(1.0, 0.52, 0.46, m.darkCab, 0, 0.3, 0.0, v);
    B(0.004, 0.5, 0.004, m.black, 0, 0.31, 0.231, v);
    counterTop(v, 1.05, 0.5, 0.12, m.travertine, 0, 0.8, 0, { hx: -0.05, hw: 0.62, hd: 0.34, hz: 0.03 });
    basin(v, 0.62, 0.34, 0.1, m.travertineDark, -0.05, 0.92, 0.03);
    faucet(v, -0.05, 0.92, -0.2);
    B(1.05, 0.14, 0.02, m.travertine, 0, 0.92, -0.24, v);
    place(v, -W2 + 0.25, 0.65, Math.PI / 2, r);
    // prateleira sobre a caixa acoplada
    B(0.3, 0.05, 0.6, m.travertine, -W2 + 0.15, 0.95, -0.2, r);
    towel(r, -W2 + 0.16, 1.0, -0.15, Math.PI / 2);
    mirror(r, null, ctx, 'w', 0.55, 1.7, 1.0, 1.0);
    place(toilet(), -W2 + 0.3, -0.25, Math.PI / 2, r);
    shadowUnder(r, 0.6, 0.6, -W2 + 0.3, -0.25);
    // chuveiro quadrado preto (sem box) na ponta da janela
    B(0.3, 0.012, 0.3, m.black, -0.05, 2.15, -0.85, r);
    B(0.4, 0.02, 0.02, m.black, -0.4, 2.16, -0.85, r);
    C(0.012, 0.012, 0.9, m.black, -W2 + 0.015, 1.1, -0.85, r, 8);
    floorDrain(r, 0.1, -0.85);
    return { ctx, eye: [0.3, 1.0], yaw: 30 * DEG, pitch: -12 * DEG };
  }
};

const BADGES = {
  standard: 'Representação 3D do imóvel como entregue',
  gold: 'Representação 3D do imóvel como entregue',
  premier: 'Ambiente decorado ilustrativo em 3D'
};

/* Cada ambiente: id, nome, descrição. `build` reaproveita o modelo de outro ambiente
   (ex.: sala e cozinha integradas) com outro ponto de vista (`eye` [x,z], `yaw` em graus).
   `links` extras: [{ to, label, pos: [x,y,z] }]. `pano`: foto 360° equiretangular opcional. */
const HOUSES = {
  standard: [
    { id: 'sala', build: 'sala', name: 'Sala', desc: 'Estar/jantar de 3,58 × 4,36 m com janelas na frente e na lateral, piso cerâmico e passa-pratos de 1,30 m para a cozinha.',
      eye: [-1.0, 1.4], yaw: -35 },
    { id: 'cozinha', build: 'sala', name: 'Cozinha', desc: 'Cozinha de 2,73 × 3,17 m revestida até o teto, pia em granito sob a janela e porta para a área de serviço.',
      eye: [-2.55, 0.55], yaw: 50, hide: ['quarto', 'banheiro'] },
    { id: 'quarto', name: 'Quarto', desc: 'Quarto 02 (2,73 × 3,30 m) com janela para o fundo; o quarto 01 tem 2,53 × 3,54 m.' },
    { id: 'banheiro', name: 'Banheiro', desc: 'Banheiro de 1,31 × 2,50 m revestido até o teto, bancada em granito, basculante e chuveiro.' }
  ],
  gold: [
    { id: 'sala', name: 'Sala e Cozinha', desc: 'Estar/jantar (2,70 × 5,37 m) integrado à cozinha (2,70 × 3,52 m) pela bancada americana de 1,80 m com tampo em granito.' },
    { id: 'suite', name: 'Suíte', desc: 'Suíte de 2,52 × 3,52 m com janela lateral de peitoril em granito e banheiro privativo.' },
    { id: 'banheiro', name: 'Banheiro', desc: 'Banheiro da suíte (2,52 × 1,20 m): pastilhas e nicho na parede do chuveiro, revestimento até o teto.' },
    { id: 'quarto', name: 'Quarto', desc: 'Segundo quarto, de 2,52 × 3,50 m, com janela para a frente da casa.' }
  ],
  premier: [
    { id: 'sala', name: 'Sala pé-direito duplo', desc: 'Estar/jantar de 3,42 × 5,07 m com pé-direito duplo, janela de 1,50 × 3,00 m, sanca com LED e bancada ripada.' },
    { id: 'cozinha', name: 'Cozinha', desc: 'Cozinha em “L” (2,40 × 2,81 m) com janela em fita sobre a pia e porta de correr para a área de serviço.' },
    { id: 'suite', name: 'Suíte master', desc: 'Suíte casal de 4,20 × 2,87 m: cabeceira estofada com LED, janela de 2,00 m e acesso ao closet.' },
    { id: 'quarto2', name: 'Quarto 2', desc: 'Quarto de 3,18 × 2,80 m com painel ripado e LED na cabeceira.' },
    { id: 'closet', name: 'Closet', desc: 'Closet de 2,40 × 1,55 m com marcenaria iluminada, ligado à suíte e ao banheiro.' },
    { id: 'banheiro', name: 'Banheiro', desc: 'Banheiro da suíte (2,40 × 1,20 m) em porcelanato marmorizado, bancada esculpida em mármore e chuveiro de teto.' }
  ]
};

/* ============================================
   Viewer
   ============================================ */
const ICONS = {
  expand: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  drag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h8M5 9l-3 3 3 3M19 9l3 3-3 3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
};

export function initTour360(rootEl) {
  if (!rootEl || rootEl.dataset.tourReady) return;
  rootEl.dataset.tourReady = '1';
  const house = HOUSES[rootEl.dataset.house] ? rootEl.dataset.house : 'standard';
  const rooms = HOUSES[house];

  rootEl.classList.add('tour360');
  rootEl.innerHTML = `
    <div class="tour360-stage" tabindex="0" aria-label="Tour 360° — use as setas do teclado ou arraste para olhar ao redor">
      <canvas class="tour360-canvas"></canvas>
      <div class="tour360-hotspots"></div>
      <div class="tour360-fade"></div>
      <span class="tour360-badge"><i class="fas fa-cube" aria-hidden="true"></i> ${BADGES[house]}</span>
      <button type="button" class="tour360-fs" aria-label="Tela cheia">${ICONS.expand}</button>
      <div class="tour360-hint">${ICONS.drag}<span>Arraste para olhar ao redor</span></div>
      <div class="tour360-caption"><strong></strong><span></span></div>
      <div class="tour360-loading"><span></span></div>
    </div>
    <div class="tour360-tabs" role="tablist" aria-label="Ambientes">
      ${rooms.map((r, i) => `<button type="button" role="tab" class="tour360-tab" data-room="${r.id}" aria-selected="${i === 0}">${r.name}</button>`).join('')}
    </div>`;

  const stage = rootEl.querySelector('.tour360-stage');
  if (!webglAvailable()) {
    stage.innerHTML = '<div class="tour360-fallback"><i class="fas fa-vr-cardboard" aria-hidden="true"></i><p>Seu navegador não suporta visualização 3D. Veja as fotos reais na galeria acima.</p></div>';
    return;
  }

  let viewer = null;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !viewer) viewer = createViewer(rootEl, house, rooms);
      if (viewer) viewer.setVisible(e.isIntersecting);
    }
  }, { rootMargin: '200px 0px' });
  io.observe(rootEl);
}

function createViewer(rootEl, house, rooms) {
  const stage = rootEl.querySelector('.tour360-stage');
  const canvas = rootEl.querySelector('.tour360-canvas');
  const hsLayer = rootEl.querySelector('.tour360-hotspots');
  const fade = rootEl.querySelector('.tour360-fade');
  const hint = rootEl.querySelector('.tour360-hint');
  const loading = rootEl.querySelector('.tour360-loading');
  const capTitle = rootEl.querySelector('.tour360-caption strong');
  const capDesc = rootEl.querySelector('.tour360-caption span');
  const tabs = [...rootEl.querySelectorAll('.tour360-tab')];
  const fsBtn = rootEl.querySelector('.tour360-fs');

  const renderer = makeRenderer(canvas, { shadows: true });
  renderer.toneMappingExposure = house === 'premier' ? 1.0 : 1.12;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeeae4);
  scene.environment = roomEnv(renderer);
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.03, 60);
  camera.rotation.order = 'YXZ';
  autoResize(renderer, camera, stage);

  const cache = new Map();
  const builds = new Map();
  let current = null, currentId = null;
  let yaw = 0, pitch = -4 * DEG, vYaw = 0, vPitch = 0, fov = 72;
  let interacted = false, visible = true, running = false, switching = false;
  let hotspots = [];
  let last = performance.now();

  function getRoom(id) {
    if (cache.has(id)) return cache.get(id);
    const meta = rooms.find((r) => r.id === id);
    let entry;
    if (meta.pano) {
      const geo = new THREE.SphereGeometry(30, 64, 32);
      geo.scale(-1, 1, 1);
      const tex = new THREE.TextureLoader().load(meta.pano);
      tex.colorSpace = THREE.SRGBColorSpace;
      const group = G();
      group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex })));
      entry = { group, eye: new THREE.Vector3(0, 0, 0), yaw: (meta.yaw || 0) * DEG, links: (meta.links || []).map((l) => ({ ...l, pos: new THREE.Vector3(...l.pos) })) };
    } else {
      const key = meta.build || id;
      if (!builds.has(key)) builds.set(key, ROOMS[`${house}-${key}`]());
      const built = builds.get(key);
      const eye = meta.eye || built.eye;
      const extra = (meta.links || []).map((l) => ({ ...l, pos: new THREE.Vector3(...l.pos) }));
      entry = {
        group: built.ctx.room,
        eye: new THREE.Vector3(eye[0], EYE, eye[1]),
        yaw: meta.yaw != null ? meta.yaw * DEG : built.yaw,
        pitch: built.pitch ?? -4 * DEG,
        links: built.ctx.links.concat(extra).filter((l) => l.to !== id && !(meta.hide || []).includes(l.to))
      };
    }
    cache.set(id, entry);
    return entry;
  }

  function setHotspots(entry) {
    hsLayer.innerHTML = '';
    hotspots = entry.links.map((l) => {
      const meta = rooms.find((r) => r.id === l.to);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tour360-hotspot';
      el.innerHTML = `<span class="tour360-hotspot-dot">${ICONS.arrow}</span><span class="tour360-hotspot-label">${l.label || (meta && meta.name) || ''}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); go(l.to); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      hsLayer.appendChild(el);
      return { el, pos: l.pos };
    });
  }

  function show(id) {
    const entry = getRoom(id);
    if (current) scene.remove(current.group);
    current = entry;
    currentId = id;
    scene.add(entry.group);
    camera.position.copy(entry.eye);
    yaw = entry.yaw; pitch = entry.pitch ?? -4 * DEG; vYaw = vPitch = 0;
    setHotspots(entry);
    const meta = rooms.find((r) => r.id === id);
    capTitle.textContent = meta.name;
    capDesc.textContent = meta.desc;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.room === id)));
  }

  function go(id) {
    if (switching || id === currentId) return;
    switching = true;
    fade.classList.add('on');
    loading.classList.toggle('on', !cache.has(id));
    setTimeout(() => {
      show(id);
      renderer.compile(scene, camera);
      loading.classList.remove('on');
      setTimeout(() => { fade.classList.remove('on'); switching = false; }, 30);
    }, 260);
  }

  tabs.forEach((t) => t.addEventListener('click', () => go(t.dataset.room)));

  /* ---- controles ---- */
  const pointers = new Map();
  let pinchDist = 0;
  const markInteract = () => {
    if (!interacted) { interacted = true; hint.classList.add('off'); }
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    markInteract();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const dd = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) fov = clamp(fov * (pinchDist / dd), 35, 85);
      pinchDist = dd;
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const k = (camera.fov / 72) * 0.0042 * (e.pointerType === 'touch' ? 1.25 : 1);
    vYaw = dx * k; vPitch = dy * k;
    yaw += vYaw; pitch += vPitch;
  });
  const up = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinchDist = 0; };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    markInteract();
    fov = clamp(fov + e.deltaY * 0.03, 35, 85);
  }, { passive: false });
  stage.addEventListener('keydown', (e) => {
    const s = 6 * DEG;
    if (e.key === 'ArrowLeft') { yaw += s; markInteract(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { yaw -= s; markInteract(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pitch += s; markInteract(); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { pitch -= s; markInteract(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') fov = clamp(fov - 4, 35, 85);
    else if (e.key === '-') fov = clamp(fov + 4, 35, 85);
  });

  /* ---- tela cheia ---- */
  const isFs = () => document.fullscreenElement === rootEl || rootEl.classList.contains('is-fs');
  fsBtn.addEventListener('click', () => {
    if (isFs()) {
      if (document.fullscreenElement) document.exitFullscreen();
      rootEl.classList.remove('is-fs');
      document.body.style.overflow = '';
    } else if (rootEl.requestFullscreen) {
      rootEl.requestFullscreen().catch(() => { rootEl.classList.add('is-fs'); document.body.style.overflow = 'hidden'; });
    } else {
      rootEl.classList.add('is-fs');
      document.body.style.overflow = 'hidden';
    }
  });
  const syncFs = () => {
    const fs = isFs();
    fsBtn.innerHTML = fs ? ICONS.shrink : ICONS.expand;
    fsBtn.setAttribute('aria-label', fs ? 'Sair da tela cheia' : 'Tela cheia');
  };
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rootEl.classList.contains('is-fs')) { rootEl.classList.remove('is-fs'); document.body.style.overflow = ''; syncFs(); }
  });

  /* ---- loop ---- */
  const v = new THREE.Vector3();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!pointers.size) {
      yaw += vYaw; pitch += vPitch;
      vYaw *= 0.9; vPitch *= 0.9;
      if (!interacted) yaw += 0.06 * dt;
    }
    pitch = clamp(pitch, -80 * DEG, 80 * DEG);
    camera.rotation.set(pitch, yaw, 0);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * 0.2; camera.updateProjectionMatrix(); }
    renderer.render(scene, camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const hs of hotspots) {
      v.copy(hs.pos).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      hs.el.style.display = vis ? '' : 'none';
      if (vis) hs.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
    }
  }

  show(rooms[0].id);
  fade.classList.remove('on');

  rootEl.tour360 = {
    go,
    look(yawDeg, pitchDeg = -4) { markInteract(); yaw = yawDeg * DEG; pitch = pitchDeg * DEG; vYaw = vPitch = 0; },
    get room() { return currentId; }
  };

  return {
    setVisible(vis) {
      visible = vis;
      if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!visible) running = false;
    }
  };
}
