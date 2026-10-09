/* ============================================
   BJRCON 3D — gerador procedural das casas
   Standard, Gold e Premier, com etapas de obra animáveis:
   terreno → fundação → alvenaria → esquadrias → estrutura
   → telhado → acabamento → entrega
   ============================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  clamp, range, easeOutCubic, easeOutBack, rng,
  plasterTex, roofTileTex, woodTex, concreteTex, gravelTex, grassTex, brickTex, tileTex, sandTex,
  worldUVBox
} from './lib.js';

/* ---------- Linha do tempo da obra (progresso 0..1) ---------- */
export const STAGES = [
  { id: 'terreno',    t0: 0.00, t1: 0.08, title: 'Planejamento e terreno', text: 'Estudo do solo, topografia e marcação precisa do lote antes do primeiro tijolo.' },
  { id: 'fundacao',   t0: 0.06, t1: 0.18, title: 'Fundação', text: 'Malha de aço e radier em concreto armado: uma base sólida e nivelada para toda a casa.' },
  { id: 'alvenaria',  t0: 0.16, t1: 0.44, title: 'Alvenaria', text: 'Paredes erguidas fiada por fiada, com blocos cerâmicos de qualidade e prumo conferido.' },
  { id: 'esquadrias', t0: 0.42, t1: 0.52, title: 'Portas e janelas', text: 'Portas em madeira e janelas em alumínio e vidro, instaladas sob medida.' },
  { id: 'estrutura',  t0: 0.50, t1: 0.60, title: 'Estrutura da cobertura', text: 'Madeiramento tratado — tesouras, caibros e ripas — dimensionado para durar.' },
  { id: 'telhado',    t0: 0.58, t1: 0.72, title: 'Telhado', text: 'Cobertura que garante conforto térmico e proteção contra a chuva.' },
  { id: 'acabamento', t0: 0.70, t1: 0.86, title: 'Acabamento', text: 'Reboco, textura e pintura com as cores marcantes das fachadas BJR.' },
  { id: 'entrega',    t0: 0.84, t1: 1.00, title: 'Pronta para morar', text: 'Muro, portão, calçada e paisagismo. Agora é só pegar a chave!' }
];
const S = Object.fromEntries(STAGES.map((s) => [s.id, s]));

const FLOOR = 0.15;     // nível do piso acabado
const WALL_T = 0.15;    // espessura da parede rebocada
const BRICK = { l: 0.39, h: 0.19, t: 0.115, step: 0.2 };

/* ============================================================
   ESPECIFICAÇÕES DAS CASAS
   x = largura (vista da rua), z = profundidade (+z = rua)
   ============================================================ */
const SPECS = {
  /* ---------- STANDARD — planta "Tipo 7, lado esquerdo" (lote 10 × 20) ----------
     Recuos: frente 7,87 · laterais 1,67 · fundo 1,50. Casa em "L" de 6,67 m de largura:
     varanda (2,73 × 1,20) + cozinha + serviço/BWC + quarto 02 à esquerda; estar + quarto 01 à direita. */
  standard: {
    name: 'Casa Standard',
    lot: { x0: -5, x1: 5, z0: -12, z1: 8 },
    center: [0, -4.6],
    colors: { wall: '#6cb24a', interior: '#f3f1ec', accent: '#e2c597', muro: '#dcc39a', muroAccent: '#5fae4c', trim: '#ffffff' },
    slabs: [{ x0: -3.33, x1: 3.34, z0: -8.14, z1: 0.13 }, { x0: -3.33, x1: -0.36, z0: -10.52, z1: -8.14 }],
    walls: [
      // 0 fachada: varanda aberta à esquerda + janela do estar
      { a: [-3.27, 0.07], b: [3.28, 0.07], h: 2.8, openings: [
        { u: 0.06, w: 2.73, y0: 0, y1: 2.35, kind: 'open' },
        { u: 3.96, w: 1.45, y0: 1.05, y1: 2.15, kind: 'window' }
      ] },
      // 1 lateral da varanda com a porta de entrada do estar
      { a: [-0.42, 0.07], b: [-0.42, -1.13], h: 2.8, ext: 'both', openings: [{ u: 0.2, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] },
      // 2-3 fundo e lateral esquerda da varanda
      { a: [-3.27, -1.13], b: [-0.42, -1.13], h: 2.8, ext: 'both', openings: [] },
      { a: [-3.27, 0.07], b: [-3.27, -1.13], h: 2.8, ext: 'both', openings: [] },
      // 4 lateral esquerda da cozinha (janela da pia)
      { a: [-3.27, -1.13], b: [-3.27, -4.42], h: 2.8, openings: [{ u: 0.18, w: 1.0, y0: 1.05, y1: 2.15, kind: 'window' }] },
      // 5-6 quarto 02 (a área de serviço fica aberta para a lateral)
      { a: [-3.27, -7.04], b: [-3.27, -10.46], h: 2.8, openings: [] },
      { a: [-3.27, -10.46], b: [-0.42, -10.46], h: 2.8, openings: [{ u: 0.63, w: 1.5, y0: 1.05, y1: 2.15, kind: 'window' }] },
      { a: [-0.42, -10.46], b: [-0.42, -8.08], h: 2.8, out: [1, 0], openings: [] },
      // 8 fundo do quarto 01 / circulação
      { a: [-0.42, -8.08], b: [3.28, -8.08], h: 2.8, out: [0, -1], openings: [] },
      // 9 lateral direita: janelas do quarto 01 e do estar
      { a: [3.28, -8.08], b: [3.28, 0.07], h: 2.8, openings: [
        { u: 1.09, w: 1.5, y0: 1.05, y1: 2.15, kind: 'window' },
        { u: 4.97, w: 1.42, y0: 1.05, y1: 2.15, kind: 'window' }
      ] },
      // paredes internas
      { a: [-3.27, -4.42], b: [-0.42, -4.42], h: 2.8, interior: true, openings: [{ u: 0.07, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [0.63, -4.42], b: [3.28, -4.42], h: 2.8, interior: true, openings: [] },
      { a: [-0.42, -1.13], b: [-0.42, -4.42], h: 2.8, interior: true, openings: [{ u: 0.98, w: 1.3, y0: 1.0, y1: 2.4, kind: 'open' }] },
      { a: [-0.42, -4.42], b: [-0.42, -7.04], h: 2.8, interior: true, openings: [{ u: 1.78, w: 0.7, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [-3.27, -7.04], b: [-0.42, -7.04], h: 2.8, interior: true, openings: [] },
      { a: [-0.42, -7.04], b: [-0.42, -8.08], h: 2.8, interior: true, openings: [{ u: 0.06, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [-1.85, -4.42], b: [-1.85, -7.04], h: 2.8, interior: true, openings: [{ u: 1.08, w: 0.75, y0: 1.6, y1: 2.2, kind: 'window' }] },
      { a: [0.63, -4.42], b: [0.63, -8.08], h: 2.8, interior: true, openings: [{ u: 2.68, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] }
    ],
    accents: [
      { wall: 0, u0: 3.93, u1: 5.44, y0: 0, y1: 2.8, color: 'accent' }
    ],
    roofs: [
      { type: 'hip', x0: -3.83, x1: 3.84, z0: -8.64, z1: 0.63, y: FLOOR + 2.8, slope: 0.36 },
      { type: 'hip', x0: -3.83, x1: 0.08, z0: -11.02, z1: -7.9, y: FLOOR + 2.8, slope: 0.36 }
    ],
    ground: [
      { kind: 'concrete', x0: -3.3, x1: -0.4, z0: 0.13, z1: 8 },
      { kind: 'concrete', x0: -0.4, x1: 3.34, z0: 0.13, z1: 0.8 },
      { kind: 'gravel', x0: -0.4, x1: 5, z0: 0.8, z1: 8 },
      { kind: 'gravel', x0: -5, x1: -3.3, z0: 0.13, z1: 8 }
    ],
    muro: { h: 2.3, openings: [
      { u: 2.0, w: 3.0, y0: 0, y1: 2.0, kind: 'gate' },
      { u: 1.0, w: 0.8, y0: 0, y1: 2.0, kind: 'gate' }
    ], accent: [[5.6, 0], [10, 0], [10, 2.3], [5.1, 2.3]] },
    sconces: [{ wall: 0, u: 1.4, y: 2.5 }, { wall: 0, u: 4.68, y: 2.45 }]
  },

  /* ---------- GOLD — planta "Tipo 4 Gold, lado esquerdo" (lote 10 × 20) ----------
     Recuos: frente 4,50 · direita 1,50 · fundo 4,92; garagem coberta de 2,60 à esquerda.
     Casa de 5,58 × 10,57: estar/cozinha/serviço à esquerda; quarto, hall + BWC, suíte + BWC à direita. */
  gold: {
    name: 'Casa Gold',
    lot: { x0: -5, x1: 5, z0: -12, z1: 8 },
    center: [0.7, -1.8],
    colors: { wall: '#8b8781', interior: '#f3f1ec', accent: '#f2a516', muro: '#8b8781', muroAccent: '#f2a516', trim: '#ffffff' },
    slabs: [{ x0: -2.08, x1: 3.5, z0: -7.07, z1: 3.5 }, { x0: -5, x1: -2.08, z0: -7.5, z1: 4, h: 0.06 }],
    walls: [
      // 0 fachada: janelas do estar e do quarto
      { a: [-2.02, 3.44], b: [3.44, 3.44], h: 2.8, openings: [
        { u: 0.65, w: 1.52, y0: 1.0, y1: 2.15, kind: 'window' },
        { u: 3.38, w: 1.52, y0: 1.0, y1: 2.15, kind: 'window' }
      ] },
      // 1 lateral da garagem: porta social, janela do estar, janela e porta da cozinha
      { a: [-2.02, 3.44], b: [-2.02, -7.01], h: 2.8, openings: [
        { u: 0.115, w: 0.85, y0: 0, y1: 2.1, kind: 'door' },
        { u: 2.67, w: 1.5, y0: 1.05, y1: 2.15, kind: 'window' },
        { u: 6.37, w: 1.6, y0: 1.05, y1: 2.15, kind: 'window' },
        { u: 8.14, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }
      ] },
      // 2 fundo (só sob o BWC da suíte; a área de serviço é aberta para o quintal)
      { a: [0.8, -7.01], b: [3.44, -7.01], h: 2.8, openings: [] },
      // 3 lateral direita: BWC da suíte, suíte, BWC social
      { a: [3.44, -7.01], b: [3.44, 3.44], h: 2.8, openings: [
        { u: 0.26, w: 0.7, y0: 1.6, y1: 2.2, kind: 'window' },
        { u: 2.455, w: 1.45, y0: 1.0, y1: 2.15, kind: 'window' },
        { u: 5.13, w: 0.6, y0: 1.6, y1: 2.2, kind: 'window' }
      ] },
      // paredes internas
      { a: [-2.02, -5.57], b: [0.8, -5.57], h: 2.8, interior: true, openings: [{ u: 0.06, w: 0.9, y0: 0, y1: 2.1, kind: 'open' }] },
      { a: [0.8, 3.44], b: [0.8, -0.18], h: 2.8, interior: true, openings: [] },
      { a: [0.8, -2.05], b: [0.8, -7.01], h: 2.8, interior: true, openings: [] },
      { a: [0.8, -0.18], b: [3.44, -0.18], h: 2.8, interior: true, openings: [{ u: 0.1, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [1.86, -0.18], b: [1.86, -2.05], h: 2.8, interior: true, openings: [{ u: 0.15, w: 0.65, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [0.8, -2.05], b: [3.44, -2.05], h: 2.8, interior: true, openings: [{ u: 0.08, w: 0.75, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [0.8, -5.69], b: [3.44, -5.69], h: 2.8, interior: true, openings: [{ u: 0.12, w: 0.65, y0: 0, y1: 2.1, kind: 'door' }] }
    ],
    accents: [
      { wall: 0, u0: -0.08, u1: 0.5, y0: 0, y1: 2.8, color: 'accent' },
      { wall: 0, u0: 2.42, u1: 3.2, y0: 0, y1: 2.8, color: 'accent' },
      { wall: 0, u0: 4.98, u1: 5.54, y0: 0, y1: 2.8, color: 'accent' }
    ],
    roofs: [
      { type: 'hip', x0: -2.58, x1: 4.0, z0: -7.57, z1: 4.0, y: FLOOR + 2.8, slope: 0.36 },
      { type: 'shed', x0: -5.0, x1: -2.08, z0: -7.5, z1: 4.0, yLow: 2.62, yHigh: 2.88 }
    ],
    carport: { x: -4.85, zs: [3.85, -1.6, -7.2], h: 2.62 },
    ground: [
      { kind: 'concrete', x0: -5, x1: -2.08, z0: 4, z1: 8 },
      { kind: 'gravel', x0: -2.08, x1: 5, z0: 3.5, z1: 8 },
      { kind: 'gravel', x0: 3.5, x1: 5, z0: -7.07, z1: 3.5 }
    ],
    muro: { h: 2.3, openings: [
      { u: 0.35, w: 2.9, y0: 0, y1: 2.0, kind: 'gate' },
      { u: 3.6, w: 0.9, y0: 0, y1: 2.0, kind: 'gate' }
    ], accent: [[5.4, 0], [10, 0], [10, 2.3], [6.3, 2.3]] },
    sconces: [{ wall: 0, u: 2.81, y: 2.45 }, { wall: 1, u: 1.2, y: 2.3, side: 1 }]
  },

  /* ---------- PREMIER — planta "Casa Premier, lado direito" (lote 10 × 20, platibanda) ----------
     Recuos: frente 4,12 · esquerda 1,50 · fundo 0,92; garagem coberta de 4,72 à direita.
     Casa de 6,96 × 14,94: sala pé-direito duplo na frente; cozinha, serviço, 2 BWC e closet à esquerda;
     hall, quarto 1, quarto 2 e suíte à direita. A porta de entrada abre da garagem para a sala. */
  premier: {
    name: 'Casa Premier',
    lot: { x0: -5, x1: 5, z0: -12, z1: 8 },
    center: [-0.2, -4.0],
    modern: true,
    colors: { wall: '#8e8f91', dark: '#4f5154', light: '#cdcac4', interior: '#f3f1ec', accent: '#4f5154', muro: '#4f5154', muroAccent: '#d6d3cd', trim: '#f4f4f2' },
    slabs: [
      { x0: -3.5, x1: 3.46, z0: -11.08, z1: -2.13 },
      { x0: -3.5, x1: 0.16, z0: -2.25, z1: 3.34 },
      { x0: 0.16, x1: 5.0, z0: -2.13, z1: 3.34, h: 0.08 }
    ],
    walls: [
      // 0-3 volume alto da sala: janela de 1,50 × 3,00 (peitoril 0,40) e porta pivotante voltada para a garagem
      { a: [-3.44, 3.28], b: [0.1, 3.28], h: 4.9, tone: 'dark', openings: [{ u: 1.09, w: 1.5, y0: 0.4, y1: 3.4, kind: 'tall' }] },
      { a: [0.1, 3.28], b: [0.1, -2.19], h: 4.9, tone: 'dark', out: [1, 0], openings: [{ u: 0.32, w: 1.1, y0: 0, y1: 2.5, kind: 'pivot' }] },
      { a: [-3.44, 3.28], b: [-3.44, -2.19], h: 4.9, tone: 'dark', out: [-1, 0], openings: [] },
      { a: [-3.44, -2.19], b: [0.1, -2.19], h: 4.9, ext: 'both', tone: 'dark', openings: [{ u: 0.06, w: 3.42, y0: 0, y1: 3.1, kind: 'open' }] },
      // 4 lateral esquerda: janela em fita da cozinha, basculantes dos BWC, janela do closet
      { a: [-3.44, -2.19], b: [-3.44, -11.02], h: 3.7, openings: [
        { u: 0.24, w: 2.3, y0: 1.25, y1: 1.75, kind: 'window' },
        { u: 4.88, w: 0.6, y0: 1.5, y1: 2.1, kind: 'window' },
        { u: 6.2, w: 0.6, y0: 1.5, y1: 2.1, kind: 'window' },
        { u: 7.61, w: 0.8, y0: 1.5, y1: 2.1, kind: 'window' }
      ] },
      // 5 fundo
      { a: [-3.44, -11.02], b: [3.4, -11.02], h: 3.7, openings: [] },
      // 6 lateral direita: suíte, quarto 2, quarto 1
      { a: [3.4, -11.02], b: [3.4, -2.19], h: 3.7, openings: [
        { u: 0.52, w: 2.0, y0: 1.1, y1: 2.1, kind: 'window' },
        { u: 3.62, w: 1.5, y0: 1.1, y1: 2.1, kind: 'window' },
        { u: 6.69, w: 1.5, y0: 1.1, y1: 2.1, kind: 'window' }
      ] },
      // 7 fundo da garagem (parede do quarto 1) e 8 muro alto lateral da garagem
      { a: [3.4, -2.19], b: [0.1, -2.19], h: 3.7, tone: 'light', out: [0, 1], openings: [] },
      { a: [4.93, 3.34], b: [4.93, -2.19], h: 3.3, ext: 'both', tone: 'dark', openings: [] },
      // internas
      { a: [-3.44, -5.12], b: [-0.92, -5.12], h: 3.7, interior: true, openings: [{ u: 0.72, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [-3.44, -6.71], b: [-0.92, -6.71], h: 3.7, interior: true, openings: [] },
      { a: [-3.44, -8.03], b: [3.4, -8.03], h: 3.7, interior: true, openings: [{ u: 2.58, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [-3.44, -9.35], b: [-0.92, -9.35], h: 3.7, interior: true, openings: [{ u: 1.79, w: 0.7, y0: 0, y1: 2.1, kind: 'door' }] },
      { a: [-0.92, -11.02], b: [-0.92, -3.89], h: 3.7, interior: true, openings: [
        { u: 0.47, w: 1.1, y0: 0, y1: 2.2, kind: 'open' }, { u: 3.6, w: 0.6, y0: 0, y1: 2.1, kind: 'door' }
      ] },
      { a: [0.1, -8.03], b: [0.1, -2.19], h: 3.7, interior: true, openings: [
        { u: 2.1, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }, { u: 3.01, w: 0.8, y0: 0, y1: 2.1, kind: 'door' }
      ] },
      { a: [0.1, -5.11], b: [3.4, -5.11], h: 3.7, interior: true, openings: [] }
    ],
    accents: [],
    roofs: [
      { type: 'slab', x0: -3.5, x1: 3.46, z0: -11.08, z1: -2.13, y: FLOOR + 3.25, th: 0.2 },
      { type: 'slab', x0: -3.5, x1: 0.16, z0: -2.25, z1: 3.34, y: FLOOR + 4.45, th: 0.2 },
      { type: 'slab', x0: 0.1, x1: 4.93, z0: -2.19, z1: 3.34, y: FLOOR + 3.0, th: 0.3, canopy: true }
    ],
    ground: [
      { kind: 'concrete', x0: 0.1, x1: 5, z0: 3.34, z1: 8 },
      { kind: 'grass', x0: -5, x1: -0.2, z0: 3.9, z1: 8 },
      { kind: 'pebbles', x0: -5, x1: 0.1, z0: 3.34, z1: 3.9 },
      { kind: 'pebbles', x0: -0.2, x1: 0.1, z0: 3.9, z1: 8 },
      { kind: 'grass', x0: -5, x1: -3.5, z0: -12, z1: 3.34 },
      { kind: 'grass', x0: -3.5, x1: 5, z0: -12, z1: -11.08 },
      { kind: 'grass', x0: 3.46, x1: 5, z0: -11.08, z1: -2.19 }
    ],
    muro: { h: 2.8, openings: [
      { u: 5.2, w: 3.3, y0: 0, y1: 2.45, kind: 'open' },
      { u: 8.75, w: 0.95, y0: 0, y1: 2.3, kind: 'whitegate' }
    ], niche: { u0: 0.4, u1: 4.3, y0: 0.25, y1: 2.45 } },
    sconces: []
  }
};

/* ============================================================
   CONSTRUÇÃO
   ============================================================ */
export function buildHouse(type = 'gold', { simple = false } = {}) {
  const spec = SPECS[type] || SPECS.gold;
  const root = new THREE.Group();
  root.name = spec.name;
  const anims = [];
  const r = rng(type.length * 977);

  /* ---- materiais (por casa: o reboco usa plano de corte p/ efeito de pintura) ---- */
  const paintPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
  const clip = simple ? null : [paintPlane];
  const P = plasterTex();
  const mk = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, map: P, roughness: 0.92, clippingPlanes: clip, clipShadows: !!clip, ...extra });
  const M = {
    ext: mk(spec.colors.wall),
    dark: mk(spec.colors.dark || spec.colors.wall),
    light: mk(spec.colors.light || spec.colors.wall),
    int: mk(spec.colors.interior),
    accent: mk(simple ? '#ffffff' : spec.colors.accent),
    muro: new THREE.MeshStandardMaterial({ color: spec.colors.muro, map: P, roughness: 0.95 }),
    muroAccent: new THREE.MeshStandardMaterial({ color: simple ? '#ffffff' : spec.colors.muroAccent, map: P, roughness: 0.95 }),
    boundary: new THREE.MeshStandardMaterial({ color: '#8d8984', map: P, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: spec.colors.trim, roughness: 0.5 }),
    brick: new THREE.MeshStandardMaterial({ map: brickTex(), roughness: 0.9 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: 0.95, color: '#d8d5cf' }),
    slab: new THREE.MeshStandardMaterial({ map: concreteTex(), roughness: 0.9, color: '#c9c6c0' }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex('#7a4a2a', 3), roughness: 0.75 }),
    door: new THREE.MeshStandardMaterial({ map: woodTex('#8a4b25', 9), roughness: 0.45 }),
    frame: new THREE.MeshStandardMaterial({ color: spec.modern ? '#f2f2f0' : '#e9e9e6', roughness: 0.35, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: '#2a3c4c', roughness: 0.04, metalness: 0.85, transparent: true, opacity: 0.72 }),
    gate: new THREE.MeshStandardMaterial({ color: '#1d1e20', roughness: 0.45, metalness: 0.6 }),
    tile: new THREE.MeshStandardMaterial({ map: roofTileTex(), color: '#c97a55', roughness: 0.8, side: THREE.DoubleSide }),
    ridge: new THREE.MeshStandardMaterial({ color: '#a24a26', roughness: 0.7 }),
    floorTile: new THREE.MeshStandardMaterial({ map: tileTex({ n: 4 }), roughness: 0.3 }),
    lights: new THREE.MeshStandardMaterial({ color: '#2a2a2a', emissive: '#ffd59a', emissiveIntensity: 0 }),
    sconce: new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.4, metalness: 0.5 }),
    plant: new THREE.MeshStandardMaterial({ color: '#3f7a2e', roughness: 0.85, flatShading: true }),
    plantDark: new THREE.MeshStandardMaterial({ color: '#2f5f24', roughness: 0.85, flatShading: true }),
    trunk: new THREE.MeshStandardMaterial({ color: '#7d6a55', roughness: 0.9 }),
    pebbles: new THREE.MeshStandardMaterial({ color: '#f1f0ec', map: gravelTex(), roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: '#7a7f86', roughness: 0.5, metalness: 0.8 }),
    stake: new THREE.MeshStandardMaterial({ color: '#c9a36b', roughness: 0.9 })
  };
  M.accent.userData.accent = true;
  M.muroAccent.userData.accent = true;
  const toneMat = { dark: M.dark, light: M.light };

  function anim(obj, stage, a, b, type = 'rise', opts = {}) {
    const st = S[stage];
    const t0 = st.t0 + (st.t1 - st.t0) * a;
    const t1 = st.t0 + (st.t1 - st.t0) * b;
    anims.push({ obj, t0, t1, type, opts, pos: obj.position.clone(), scl: obj.scale.clone() });
  }
  const add = (parent, o) => { parent.add(o); return o; };
  const mesh = (geo, material, cast = true) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast; m.receiveShadow = true;
    return m;
  };
  /** caixa com base em y=0 (para animação de "subir") */
  const baseBox = (w, h, d, material, uvScale = 1) => {
    const g = worldUVBox(w, h, d, uvScale);
    g.translate(0, h / 2, 0);
    return mesh(g, material);
  };

  /* ---------- solo do lote ---------- */
  const L = spec.lot;
  const lotW = L.x1 - L.x0, lotD = L.z1 - L.z0;
  const groundY = 0.012;
  const groundMats = {
    concrete: M.concrete,
    gravel: new THREE.MeshStandardMaterial({ map: gravelTex(), roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }),
    pebbles: M.pebbles
  };
  if (!simple) {
    // terreno do lote (areia mais clara, compactada)
    const lotTex = sandTex().clone(); lotTex.needsUpdate = true; lotTex.repeat.set(lotW / 6, lotD / 6);
    const lotGround = mesh(new THREE.PlaneGeometry(lotW, lotD), new THREE.MeshStandardMaterial({ map: lotTex, color: '#f0d2b0', roughness: 1 }), false);
    lotGround.rotation.x = -Math.PI / 2;
    lotGround.position.set((L.x0 + L.x1) / 2, 0.004, (L.z0 + L.z1) / 2);
    root.add(lotGround);
  }
  for (const gp of spec.ground) {
    const w = gp.x1 - gp.x0, d = gp.z1 - gp.z0;
    const g = new THREE.BoxGeometry(w, 0.04, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
    const m = mesh(g, groundMats[gp.kind] || M.concrete, false);
    m.position.set((gp.x0 + gp.x1) / 2, groundY, (gp.z0 + gp.z1) / 2);
    root.add(m);
    if (!simple) anim(m, 'entrega', 0.0, 0.35, 'grow');
  }

  /* ---------- terreno: estacas + linhas de marcação ---------- */
  if (!simple) {
    const marks = new THREE.Group();
    const s0 = spec.slabs[0];
    const pad = 0.6;
    const corners = [[s0.x0 - pad, s0.z0 - pad], [s0.x1 + pad, s0.z0 - pad], [s0.x1 + pad, s0.z1 + pad], [s0.x0 - pad, s0.z1 + pad]];
    corners.forEach(([x, z]) => {
      const st = mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), M.stake);
      st.position.set(x, 0.3, z);
      marks.add(st);
    });
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % 4];
      pts.push(new THREE.Vector3(x1, 0.45, z1), new THREE.Vector3(x2, 0.45, z2));
      pts.push(new THREE.Vector3(s0.x0 + (s0.x1 - s0.x0) * (i % 2), 0.02, s0.z0), new THREE.Vector3(s0.x0 + (s0.x1 - s0.x0) * (i % 2), 0.02, s0.z1));
    }
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e53935' }));
    marks.add(lines);
    root.add(marks);
    anims.push({ obj: marks, t0: S.terreno.t0 + 0.005, t1: S.terreno.t1, type: 'markers', pos: marks.position.clone(), scl: marks.scale.clone(), opts: { hideAt: S.fundacao.t1 } });
  }

  /* ---------- fundação: malha de aço + radier ---------- */
  spec.slabs.forEach((sl, i) => {
    const w = sl.x1 - sl.x0 + 0.1, d = sl.z1 - sl.z0 + 0.1;
    const h = sl.h || FLOOR + 0.05;
    const slab = baseBox(w, h, d, M.slab, 2);
    slab.position.set((sl.x0 + sl.x1) / 2, -0.05 + (sl.h ? 0.05 : 0), (sl.z0 + sl.z1) / 2);
    root.add(slab);
    if (!simple) {
      anim(slab, 'fundacao', 0.45 + i * 0.05, 0.95, 'rise');
      if (i === 0) {
        const pts = [];
        for (let x = sl.x0; x <= sl.x1 + 1e-3; x += 0.3) pts.push(new THREE.Vector3(x, 0.08, sl.z0), new THREE.Vector3(x, 0.08, sl.z1));
        for (let z = sl.z0; z <= sl.z1 + 1e-3; z += 0.3) pts.push(new THREE.Vector3(sl.x0, 0.08, z), new THREE.Vector3(sl.x1, 0.08, z));
        const rebar = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#5b6066' }));
        root.add(rebar);
        anims.push({ obj: rebar, t0: S.fundacao.t0, t1: S.fundacao.t0 + 0.04, type: 'markers', pos: rebar.position.clone(), scl: rebar.scale.clone(), opts: { hideAt: S.fundacao.t1 } });
      }
    }
  });
  // piso cerâmico interno
  if (!simple) {
    const s0 = spec.slabs[0];
    const fw = s0.x1 - s0.x0, fd = s0.z1 - s0.z0;
    const ft = tileTex({ n: 4 }).clone(); ft.needsUpdate = true; ft.repeat.set(fw / 2.4, fd / 2.4);
    const floor = mesh(new THREE.PlaneGeometry(fw, fd), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.25 }), false);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((s0.x0 + s0.x1) / 2, FLOOR + 0.006, (s0.z0 + s0.z1) / 2);
    root.add(floor);
    anim(floor, 'esquadrias', 0, 0.2, 'show');
  }

  /* ---------- paredes ---------- */
  const brickData = []; // {x,y,z,ry,len,t}
  const [cx, cz] = spec.center;
  const specMaxH = Math.max(...spec.walls.map((w) => w.h));
  let maxWallH = 0;

  spec.walls.forEach((w, wi) => {
    if (simple && w.interior) return;
    const ax = w.a[0], az = w.a[1], bx = w.b[0], bz = w.b[1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const theta = Math.atan2(-uz, ux);
    const g = new THREE.Group();
    g.position.set(ax, FLOOR, az);
    g.rotation.y = theta;
    root.add(g);
    w._group = g; w._len = len;
    maxWallH = Math.max(maxWallH, w.h);

    // qual lado (local +z) é externo?
    const nx = -uz, nz = ux; // local +z em coordenadas do mundo
    // `out` força a direção externa (paredes em "L", onde o centro da casa não serve de referência)
    const [mx, mz] = w.out || [ax + dx / 2 - cx, az + dz / 2 - cz];
    let plusExt = nx * mx + nz * mz > 0;
    w._plusExt = plusExt;
    const extMat = toneMat[w.tone] || M.ext;
    let matPlus, matMinus;
    if (w.interior) { matPlus = matMinus = M.int; }
    else if (w.ext === 'both') { matPlus = matMinus = extMat; }
    else { matPlus = plusExt ? extMat : M.int; matMinus = plusExt ? M.int : extMat; }
    if (simple) { matPlus = matMinus = extMat; }
    // ordem BoxGeometry: +x, -x, +y, -y, +z, -z
    const mats = simple ? extMat : [extMat, extMat, extMat, extMat, matPlus, matMinus];

    const ops = [...w.openings].sort((p, q) => p.u - q.u);
    const pieces = wallPieces(len, w.h, ops);
    for (const pc of pieces) {
      const pw = pc.u1 - pc.u0, ph = pc.y1 - pc.y0;
      if (pw < 0.01 || ph < 0.01) continue;
      const m = mesh(worldUVBox(pw, ph, WALL_T, 1), mats);
      m.position.set((pc.u0 + pc.u1) / 2, (pc.y0 + pc.y1) / 2, 0);
      g.add(m);
    }
    // platibanda moderna: rufo branco no topo
    if (spec.modern && !w.interior) {
      const cap = mesh(new THREE.BoxGeometry(len + WALL_T + 0.04, 0.05, WALL_T + 0.06), M.trim);
      cap.position.set(len / 2, w.h + 0.025, 0);
      g.add(cap);
      if (!simple) anim(cap, 'acabamento', 0.85, 1, 'show');
    }

    // blocos cerâmicos (só no modo animado)
    if (!simple) {
      const rows = Math.round(w.h / BRICK.step);
      for (let row = 0; row < rows; row++) {
        const y = row * BRICK.step;
        const yc = y + BRICK.step / 2;
        const shift = row % 2 ? BRICK.step : 0;
        const startU = -WALL_T / 2 - shift;
        for (let u = startU; u < len + WALL_T / 2; u += 0.4) {
          let segs = [[Math.max(u, -WALL_T / 2), Math.min(u + BRICK.l, len + WALL_T / 2)]];
          for (const op of ops) {
            if (yc > op.y0 && yc < op.y1) segs = subtract(segs, op.u, op.u + op.w);
          }
          for (const [s0, s1] of segs) {
            if (s1 - s0 < 0.04) continue;
            const mid = (s0 + s1) / 2;
            brickData.push({
              x: ax + ux * mid, z: az + uz * mid, y: FLOOR + y + BRICK.h / 2,
              ry: theta, len: s1 - s0,
              t: S.alvenaria.t0 + (y / specMaxH) * (S.alvenaria.t1 - S.alvenaria.t0) * 0.9 + (mid / Math.max(len, 1)) * 0.012 + r() * 0.006
            });
          }
        }
      }
    }

    // esquadrias
    for (const op of ops) {
      const piece = buildOpening(op, M, spec);
      if (!piece) continue;
      piece.position.set(op.u + op.w / 2, op.y0, 0);
      g.add(piece);
      if (!simple) anim(piece, 'esquadrias', r() * 0.4, 0.6 + r() * 0.4, 'grow');
      // peitoril de granito
      if (op.kind === 'window' && !w.interior) {
        const sill = mesh(new THREE.BoxGeometry(op.w + 0.1, 0.03, WALL_T + 0.08), M.trim);
        sill.position.set(op.u + op.w / 2, op.y0 - 0.015, 0);
        g.add(sill);
        if (!simple) anim(sill, 'acabamento', 0.6, 0.8, 'show');
      }
    }
  });

  /* faixas / pilares coloridos da fachada */
  for (const ac of spec.accents) {
    const w = spec.walls[ac.wall];
    if (!w._group) continue;
    const side = w._plusExt ? 1 : -1;
    const pw = ac.u1 - ac.u0, ph = ac.y1 - ac.y0;
    const m = mesh(worldUVBox(pw, ph, 0.03, 1), M.accent);
    m.position.set((ac.u0 + ac.u1) / 2, (ac.y0 + ac.y1) / 2, side * (WALL_T / 2 + 0.012));
    w._group.add(m);
    // recortes das janelas que atravessam a faixa: tampa com cor base nas aberturas
    for (const op of w.openings) {
      const o0 = Math.max(op.u, ac.u0), o1 = Math.min(op.u + op.w, ac.u1);
      if (o1 - o0 > 0.01) {
        // a faixa cobre a janela: cria a faixa "vazada" dividindo em pedaços
        m.visible = false; m.userData.noBake = true;
        const parts = wallPieces(pw, ph, [{ u: op.u - ac.u0, w: op.w, y0: op.y0 - ac.y0, y1: op.y1 - ac.y0 }]);
        for (const pc of parts) {
          const pm = mesh(worldUVBox(pc.u1 - pc.u0, pc.y1 - pc.y0, 0.03, 1), M.accent);
          pm.position.set(ac.u0 + (pc.u0 + pc.u1) / 2, ac.y0 + (pc.y0 + pc.y1) / 2, side * (WALL_T / 2 + 0.012));
          w._group.add(pm);
        }
      }
    }
  }

  /* arandelas */
  for (const sc of spec.sconces) {
    const w = spec.walls[sc.wall];
    if (!w._group) continue;
    const side = (sc.side || (w._plusExt ? 1 : -1));
    const s = new THREE.Group();
    s.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08), M.sconce));
    const glow = mesh(new THREE.BoxGeometry(0.12, 0.04, 0.06), M.lights, false);
    glow.position.y = -0.07;
    s.add(glow);
    s.position.set(sc.u, sc.y, side * (WALL_T / 2 + 0.05));
    w._group.add(s);
    if (!simple) anim(s, 'acabamento', 0.9, 1, 'show');
  }

  /* ---------- blocos instanciados ---------- */
  let brickMesh = null;
  if (!simple && brickData.length) {
    const bg = new THREE.BoxGeometry(1, BRICK.h, BRICK.t);
    brickMesh = new THREE.InstancedMesh(bg, M.brick, brickData.length);
    brickMesh.castShadow = true; brickMesh.receiveShadow = true;
    const col = new THREE.Color();
    brickData.forEach((b, i) => {
      col.setHSL(0.045 + (r() - 0.5) * 0.02, 0.5, 0.82 + (r() - 0.5) * 0.18);
      brickMesh.setColorAt(i, col);
    });
    brickMesh.frustumCulled = false;
    root.add(brickMesh);
  }

  /* ---------- coberturas ---------- */
  const rafters = []; // {a:Vector3,b:Vector3, size:[w,h]}
  const tileStrips = [];
  spec.roofs.forEach((rf, ri) => {
    if (rf.type === 'slab') {
      const w = rf.x1 - rf.x0, d = rf.z1 - rf.z0;
      const s = baseBox(w, rf.th, d, rf.canopy ? M.trim : M.slab, 2);
      s.position.set((rf.x0 + rf.x1) / 2, rf.y, (rf.z0 + rf.z1) / 2);
      root.add(s);
      if (!simple) anim(s, 'telhado', ri * 0.25, 0.4 + ri * 0.25, 'drop');
      if (rf.canopy) {
        // viga frontal escura (bandeira) + spots de LED
        const fascia = baseBox(w, 0.75, 0.25, M.dark, 1);
        fascia.position.set((rf.x0 + rf.x1) / 2, rf.y - 0.05, rf.z1 - 0.12);
        root.add(fascia);
        if (!simple) anim(fascia, 'acabamento', 0.3, 0.7, 'rise');
        const spots = new THREE.Group();
        const sg = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16);
        for (let x = rf.x0 + 1.2; x < rf.x1 - 0.5; x += 1.6) {
          for (let z = rf.z0 + 1.5; z < rf.z1 - 0.5; z += 2.2) {
            const sp = mesh(sg, M.lights, false);
            sp.position.set(x, rf.y - 0.011, z);
            spots.add(sp);
          }
        }
        root.add(spots);
        if (!simple) anim(spots, 'acabamento', 0.9, 1, 'show');
      }
      return;
    }
    const slopes = rf.type === 'hip' ? hipSlopes(rf) : shedSlopes(rf);
    const STRIPS = 7;
    slopes.forEach((sl, si) => {
      for (let k = 0; k < STRIPS; k++) {
        const t0 = k / STRIPS, t1 = (k + 1) / STRIPS;
        const geo = stripGeo(sl, t0, t1);
        const m = mesh(geo, M.tile);
        root.add(m);
        tileStrips.push(m);
        if (!simple) anim(m, 'telhado', ri * 0.08 + (k / STRIPS) * 0.7 + si * 0.025, ri * 0.08 + (k / STRIPS) * 0.7 + si * 0.025 + 0.18, 'drop', { h: 1.6 });
      }
      // estrutura de madeira
      if (!simple) {
        const e = new THREE.Vector3().subVectors(sl.p1, sl.p0);
        const eaveLen = e.length();
        e.normalize();
        const inward = sl.inward;
        for (let s = 0.2; s < eaveLen; s += 0.55) {
          const run = rf.type === 'hip' ? Math.min(sl.half, s, eaveLen - s) : sl.half;
          if (run < 0.15) continue;
          const a = sl.p0.clone().addScaledVector(e, s).add(new THREE.Vector3(0, -0.06, 0));
          const b = a.clone().addScaledVector(inward, run).add(new THREE.Vector3(0, run * sl.slope, 0));
          rafters.push({ a, b, w: 0.05, h: 0.1, t: S.estrutura.t0 + (si * 0.15 + s / eaveLen * 0.3) * (S.estrutura.t1 - S.estrutura.t0) + ri * 0.02 });
        }
        // ripas
        for (let t = 0.04; t < 0.98; t += 0.09) {
          const a = sl.p0.clone().lerp(sl.p3, t), b = sl.p1.clone().lerp(sl.p2, t);
          if (a.distanceTo(b) < 0.2) continue;
          a.y -= 0.02; b.y -= 0.02;
          rafters.push({ a, b, w: 0.04, h: 0.025, t: S.estrutura.t0 + (0.5 + t * 0.45) * (S.estrutura.t1 - S.estrutura.t0) + ri * 0.01 });
        }
      }
    });
    // cumeeira e espigões
    const capR = 0.085;
    const capLines = rf.type === 'hip' ? hipRidgeLines(rf) : [];
    for (const [a, b] of capLines) {
      const len = a.distanceTo(b);
      const cg = new THREE.CylinderGeometry(capR, capR, len, 10, 1, false, 0, Math.PI);
      const cm = mesh(cg, M.ridge);
      orientCylinder(cm, a, b);
      root.add(cm);
      if (!simple) anim(cm, 'telhado', 0.82, 1, 'show');
    }
    // testeira (beiral)
    for (const sl of slopes) {
      const a = sl.p0, b = sl.p1;
      const len = a.distanceTo(b);
      const fb = mesh(new THREE.BoxGeometry(len, 0.14, 0.03), M.wood);
      fb.position.copy(a).lerp(b, 0.5); fb.position.y -= 0.06;
      fb.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      root.add(fb);
      if (!simple) anim(fb, 'estrutura', 0.7, 1, 'show');
    }
    // frechal sobre as paredes (estrutura)
  });

  /* pilares da garagem (Gold) */
  if (spec.carport) {
    const cp = spec.carport;
    cp.zs.forEach((z, i) => {
      const col = baseBox(0.22, cp.h, 0.22, M.ext, 1);
      col.position.set(cp.x, 0, z);
      root.add(col);
      if (!simple) anim(col, 'alvenaria', 0.6 + i * 0.05, 0.95, 'rise');
    });
    const beam = baseBox(0.12, 0.16, cp.zs[0] - cp.zs[cp.zs.length - 1] + 0.3, M.wood, 1);
    beam.position.set(cp.x, cp.h - 0.16, (cp.zs[0] + cp.zs[cp.zs.length - 1]) / 2);
    root.add(beam);
    if (!simple) anim(beam, 'estrutura', 0, 0.3, 'show');
  }

  /* marquise com spots sobre a janela alta (Premier) */
  if (type === 'premier') {
    const ev = baseBox(3.86, 0.22, 0.6, M.dark, 1);
    ev.position.set(-1.67, FLOOR + 4.05, 3.64);
    root.add(ev);
    if (!simple) anim(ev, 'acabamento', 0.4, 0.8, 'rise');
    const spots = new THREE.Group();
    [-2.77, -1.67, -0.57].forEach((x) => {
      const sp = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), M.lights, false);
      sp.position.set(x, FLOOR + 4.04, 3.69);
      spots.add(sp);
    });
    root.add(spots);
    if (!simple) anim(spots, 'acabamento', 0.95, 1, 'show');
  }

  /* madeiramento instanciado */
  let rafterMesh = null;
  if (rafters.length) {
    rafterMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.wood, rafters.length);
    rafterMesh.castShadow = true;
    rafterMesh.frustumCulled = false;
    rafters.forEach((rr) => {
      const dir = new THREE.Vector3().subVectors(rr.b, rr.a);
      rr.len = dir.length();
      rr.mid = rr.a.clone().lerp(rr.b, 0.5);
      rr.q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
    });
    root.add(rafterMesh);
  }

  /* ---------- muro frontal, portões e muros laterais ---------- */
  const lotGroup = new THREE.Group();
  root.add(lotGroup);
  {
    const mu = spec.muro;
    const g = new THREE.Group();
    g.position.set(L.x0, 0, L.z1);
    lotGroup.add(g);
    const pieces = wallPieces(lotW, mu.h, [...mu.openings].sort((a, b) => a.u - b.u));
    for (const pc of pieces) {
      const m = mesh(worldUVBox(pc.u1 - pc.u0, pc.y1 - pc.y0, 0.15, 1), M.muro);
      m.position.set((pc.u0 + pc.u1) / 2, (pc.y0 + pc.y1) / 2, 0);
      g.add(m);
    }
    // painel colorido inclinado (marca registrada das fachadas)
    if (mu.accent) {
      const shape = new THREE.Shape(mu.accent.map(([x, y]) => new THREE.Vector2(x, y)));
      const sg = new THREE.ShapeGeometry(shape);
      const am = mesh(sg, M.muroAccent, false);
      am.position.z = 0.078;
      g.add(am);
    }
    if (mu.niche) {
      const n = mu.niche;
      const back = mesh(worldUVBox(n.u1 - n.u0, n.y1 - n.y0, 0.02, 1), M.muroAccent);
      back.position.set((n.u0 + n.u1) / 2, (n.y0 + n.y1) / 2, 0.06);
      g.add(back);
      // bambus iluminados
      for (let i = 0; i < 4; i++) {
        const bamboo = makeBamboo(M, r);
        bamboo.position.set(n.u0 + 0.5 + i * ((n.u1 - n.u0 - 1) / 3), n.y0, 0.35);
        g.add(bamboo);
        const up = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), M.lights, false);
        up.position.set(n.u0 + 0.5 + i * ((n.u1 - n.u0 - 1) / 3), n.y1 - 0.02, 0.12);
        g.add(up);
      }
      const planter = mesh(new THREE.BoxGeometry(n.u1 - n.u0, 0.25, 0.5), M.dark);
      planter.position.set((n.u0 + n.u1) / 2, n.y0 - 0.125 + 0.25, 0.32);
      g.add(planter);
    }
    for (const op of mu.openings) {
      if (op.kind === 'open') continue;
      const gate = buildGate(op, M);
      gate.position.set(op.u + op.w / 2, 0, 0);
      g.add(gate);
    }
    // muros laterais e de fundo
    const sideH = 2.1;
    const sides = [
      [L.x0, L.z1, L.x0, L.z0], [L.x1, L.z1, L.x1, L.z0], [L.x0, L.z0, L.x1, L.z0]
    ];
    sides.forEach(([x1, z1, x2, z2]) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const m = mesh(worldUVBox(len, sideH, 0.14, 1), M.boundary);
      m.position.set((x1 + x2) / 2, sideH / 2, (z1 + z2) / 2);
      m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
      lotGroup.add(m);
    });
    if (!simple) {
      lotGroup.children.forEach((c, i) => {
        // muro sobe junto (escala vertical a partir do chão)
        anim(c, 'entrega', 0.05 + i * 0.03, 0.5 + i * 0.03, 'riseGroup');
      });
    }
  }

  /* ---------- paisagismo ---------- */
  const garden = new THREE.Group();
  root.add(garden);
  if (type === 'premier') {
    const palm = makePalm(M);
    palm.position.set(-3.9, 0, 5.4);
    garden.add(palm);
    for (let i = 0; i < 9; i++) {
      const shrub = mesh(new THREE.IcosahedronGeometry(0.18 + r() * 0.08, 0), i % 2 ? M.plant : M.plantDark);
      shrub.position.set(-4.9 + i * 0.48, 0.15, 3.62);
      shrub.scale.y = 0.7;
      garden.add(shrub);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const shrub = mesh(new THREE.IcosahedronGeometry(0.3 + r() * 0.15, 0), i % 2 ? M.plant : M.plantDark);
      shrub.position.set(L.x1 - 0.6, 0.25, L.z1 - 0.6 - i * 0.8);
      garden.add(shrub);
    }
  }
  if (!simple) garden.children.forEach((c, i) => anim(c, 'entrega', 0.4 + i * 0.03, 0.75 + i * 0.03, 'grow'));

  /* ============================================================
     UPDATE — aplica o progresso da obra
     ============================================================ */
  const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let lastP = -1;

  function update(p) {
    if (simple || Math.abs(p - lastP) < 1e-5) return;
    lastP = p;
    for (const a of anims) {
      const e = range(p, a.t0, a.t1);
      const o = a.obj;
      switch (a.type) {
        case 'rise':
        case 'riseGroup':
          o.visible = e > 0.001;
          o.scale.y = a.scl.y * Math.max(easeOutCubic(e), 0.001);
          if (a.type === 'riseGroup') o.position.y = a.pos.y * Math.max(easeOutCubic(e), 0.001);
          break;
        case 'drop': {
          o.visible = e > 0.001;
          const ee = easeOutCubic(e);
          o.position.y = a.pos.y + (1 - ee) * (a.opts.h || 2.5);
          break;
        }
        case 'grow': {
          o.visible = e > 0.001;
          const s = Math.max(easeOutBack(e), 0.001);
          o.scale.set(a.scl.x * s, a.scl.y * s, a.scl.z * s);
          break;
        }
        case 'show':
          o.visible = e > 0.001;
          break;
        case 'markers':
          o.visible = e > 0.001 && p < a.opts.hideAt;
          o.scale.y = Math.max(easeOutCubic(e), 0.001);
          break;
      }
    }
    // blocos: caem fiada por fiada
    if (brickMesh) {
      const showBricks = p < S.acabamento.t1 + 0.01;
      brickMesh.visible = showBricks && p > S.alvenaria.t0;
      if (brickMesh.visible) {
        for (let i = 0; i < brickData.length; i++) {
          const b = brickData[i];
          const e = clamp((p - b.t) / 0.018);
          if (e <= 0) { tmpS.set(0, 0, 0); tmpP.set(b.x, b.y, b.z); }
          else {
            const ee = easeOutCubic(e);
            tmpP.set(b.x, b.y + (1 - ee) * 0.7, b.z);
            tmpS.set(b.len - 0.01, 1, 1);
          }
          tmpQ.setFromAxisAngle(yAxis, b.ry);
          tmpM.compose(tmpP, tmpQ, tmpS);
          brickMesh.setMatrixAt(i, tmpM);
        }
        brickMesh.instanceMatrix.needsUpdate = true;
      }
    }
    // madeiramento
    if (rafterMesh) {
      rafterMesh.visible = p > S.estrutura.t0;
      for (let i = 0; i < rafters.length; i++) {
        const rr = rafters[i];
        const e = clamp((p - rr.t) / 0.02);
        const ee = easeOutCubic(e);
        tmpS.set(Math.max(rr.len * ee, 0.0001), rr.h, rr.w);
        tmpP.copy(rr.a).lerp(rr.mid, ee);
        tmpM.compose(tmpP, rr.q, tmpS);
        rafterMesh.setMatrixAt(i, tmpM);
      }
      rafterMesh.instanceMatrix.needsUpdate = true;
    }
    // pintura subindo (plano de corte)
    const ep = range(p, S.acabamento.t0, S.acabamento.t0 + (S.acabamento.t1 - S.acabamento.t0) * 0.75);
    paintPlane.constant = ep <= 0 ? -10 : ep >= 1 ? 100 : FLOOR - 0.05 + ep * (maxWallH + 0.3);
    // luzes acendendo no fim
    M.lights.emissiveIntensity = range(p, 0.93, 1.0) * 3.0;
  }

  update(0);
  return {
    group: root,
    update,
    spec,
    materials: M,
    lot: spec.lot,
    focus: new THREE.Vector3(cx, 1.6, cz)
  };
}

/* ============================================================
   Bairro: casas simplificadas instanciadas (vista de drone)
   ============================================================ */
export function buildNeighborhood({ rows = [], types = ['gold', 'standard'], palette } = {}) {
  const group = new THREE.Group();
  const colors = palette || ['#f2a516', '#e53935', '#1e4fd1', '#d63ab0', '#5fae4c', '#f2c616', '#ff7a1a', '#7d4bd1', '#e2c597', '#2bb3a6'];
  const r = rng(99);
  const items = [];

  // distribui os lotes por tipo
  const byType = {};
  rows.forEach((row) => {
    for (let i = 0; i < row.count; i++) {
      const t = types[Math.floor(r() * types.length)];
      (byType[t] = byType[t] || []).push({
        x: row.x0 + i * row.step, z: row.z, rot: row.rot,
        color: new THREE.Color(colors[Math.floor(r() * colors.length)]),
        delay: r()
      });
    }
  });

  const meshes = [];
  for (const [t, list] of Object.entries(byType)) {
    const h = buildHouse(t, { simple: true });
    h.group.updateMatrixWorld(true);
    const buckets = new Map();
    h.group.traverse((o) => {
      if (!o.isMesh || o.userData.noBake || !o.visible) return;
      const material = Array.isArray(o.material) ? o.material[0] : o.material;
      let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) return;
      g.clearGroups();
      if (!buckets.has(material)) buckets.set(material, []);
      buckets.get(material).push(g);
    });
    for (const [material, geos] of buckets) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const im = new THREE.InstancedMesh(merged, material, list.length);
      im.castShadow = true; im.receiveShadow = true;
      im.frustumCulled = false;
      list.forEach((it, i) => { if (material.userData.accent) im.setColorAt(i, it.color); });
      group.add(im);
      meshes.push({ im, list });
    }
    items.push(...list);
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const yA = new THREE.Vector3(0, 1, 0);
  let lastP = -1;
  function update(prog) {
    if (Math.abs(prog - lastP) < 1e-5) return;
    lastP = prog;
    group.visible = prog > 0.001;
    for (const { im, list } of meshes) {
      list.forEach((it, i) => {
        const e = easeOutCubic(clamp((prog - it.delay * 0.55) / 0.45));
        q.setFromAxisAngle(yA, it.rot);
        p.set(it.x, 0, it.z);
        s.set(1, Math.max(e, 0.0001), 1);
        m4.compose(p, q, s);
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);
  return { group, update, count: items.length };
}

/* ============================================================
   Helpers geométricos
   ============================================================ */
function subtract(segs, a, b) {
  const out = [];
  for (const [s0, s1] of segs) {
    if (b <= s0 || a >= s1) { out.push([s0, s1]); continue; }
    if (a > s0) out.push([s0, a]);
    if (b < s1) out.push([b, s1]);
  }
  return out;
}

/** divide a parede em blocos sólidos ao redor das aberturas */
function wallPieces(len, h, ops) {
  const out = [];
  const ext = WALL_T / 2;
  let cur = -ext;
  for (const op of ops) {
    if (op.u > cur) out.push({ u0: cur, u1: op.u, y0: 0, y1: h });
    if (op.y0 > 0) out.push({ u0: op.u, u1: op.u + op.w, y0: 0, y1: op.y0 });
    if (op.y1 < h) out.push({ u0: op.u, u1: op.u + op.w, y0: op.y1, y1: h });
    cur = Math.max(cur, op.u + op.w);
  }
  if (cur < len + ext) out.push({ u0: cur, u1: len + ext, y0: 0, y1: h });
  return out;
}

/** telhado de 4 águas: retorna as águas como quadriláteros (p0,p1 = beiral; p3,p2 = topo) */
function hipSlopes({ x0, x1, z0, z1, y, slope }) {
  const w = x1 - x0, d = z1 - z0;
  const V = (x, yy, z) => new THREE.Vector3(x, yy, z);
  const out = [];
  if (d >= w) {
    const hs = w / 2, cxx = (x0 + x1) / 2, ry = y + hs * slope;
    const rz0 = z0 + hs, rz1 = z1 - hs;
    out.push({ p0: V(x1, y, z1), p1: V(x1, y, z0), p2: V(cxx, ry, rz0), p3: V(cxx, ry, rz1), inward: V(-1, 0, 0), half: hs, slope });
    out.push({ p0: V(x0, y, z0), p1: V(x0, y, z1), p2: V(cxx, ry, rz1), p3: V(cxx, ry, rz0), inward: V(1, 0, 0), half: hs, slope });
    out.push({ p0: V(x0, y, z1), p1: V(x1, y, z1), p2: V(cxx, ry, rz1), p3: V(cxx, ry, rz1), inward: V(0, 0, -1), half: hs, slope });
    out.push({ p0: V(x1, y, z0), p1: V(x0, y, z0), p2: V(cxx, ry, rz0), p3: V(cxx, ry, rz0), inward: V(0, 0, 1), half: hs, slope });
  } else {
    const hs = d / 2, czz = (z0 + z1) / 2, ry = y + hs * slope;
    const rx0 = x0 + hs, rx1 = x1 - hs;
    out.push({ p0: V(x0, y, z1), p1: V(x1, y, z1), p2: V(rx1, ry, czz), p3: V(rx0, ry, czz), inward: V(0, 0, -1), half: hs, slope });
    out.push({ p0: V(x1, y, z0), p1: V(x0, y, z0), p2: V(rx0, ry, czz), p3: V(rx1, ry, czz), inward: V(0, 0, 1), half: hs, slope });
    out.push({ p0: V(x1, y, z1), p1: V(x1, y, z0), p2: V(rx1, ry, czz), p3: V(rx1, ry, czz), inward: V(-1, 0, 0), half: hs, slope });
    out.push({ p0: V(x0, y, z0), p1: V(x0, y, z1), p2: V(rx0, ry, czz), p3: V(rx0, ry, czz), inward: V(1, 0, 0), half: hs, slope });
  }
  return out;
}

function hipRidgeLines({ x0, x1, z0, z1, y, slope }) {
  const w = x1 - x0, d = z1 - z0;
  const V = (x, yy, z) => new THREE.Vector3(x, yy, z);
  const lift = 0.05;
  if (d >= w) {
    const hs = w / 2, cxx = (x0 + x1) / 2, ry = y + hs * slope + lift;
    const a = V(cxx, ry, z0 + hs), b = V(cxx, ry, z1 - hs);
    return [[a, b], [V(x0, y + lift, z0), a], [V(x1, y + lift, z0), a], [V(x0, y + lift, z1), b], [V(x1, y + lift, z1), b]];
  }
  const hs = d / 2, czz = (z0 + z1) / 2, ry = y + hs * slope + lift;
  const a = V(x0 + hs, ry, czz), b = V(x1 - hs, ry, czz);
  return [[a, b], [V(x0, y + lift, z0), a], [V(x0, y + lift, z1), a], [V(x1, y + lift, z0), b], [V(x1, y + lift, z1), b]];
}

/** telhado de uma água: baixo em x0, alto em x1 */
function shedSlopes({ x0, x1, z0, z1, yLow, yHigh }) {
  const V = (x, yy, z) => new THREE.Vector3(x, yy, z);
  const run = x1 - x0;
  return [{ p0: V(x0, yLow, z0), p1: V(x0, yLow, z1), p2: V(x1, yHigh, z1), p3: V(x1, yHigh, z0), inward: V(1, 0, 0), half: run, slope: (yHigh - yLow) / run }];
}

/** faixa da água entre t0 e t1 (do beiral ao topo), com UV em escala real de telha */
function stripGeo(sl, t0, t1) {
  const a = sl.p0.clone().lerp(sl.p3, t0), b = sl.p1.clone().lerp(sl.p2, t0);
  const c = sl.p1.clone().lerp(sl.p2, t1), d = sl.p0.clone().lerp(sl.p3, t1);
  const e = new THREE.Vector3().subVectors(sl.p1, sl.p0).normalize();
  const up = new THREE.Vector3().subVectors(sl.p3.clone().lerp(sl.p2, 0.5), sl.p0.clone().lerp(sl.p1, 0.5));
  up.addScaledVector(e, -up.dot(e)).normalize();
  // normal apontando para cima
  const n = new THREE.Vector3().crossVectors(e, up);
  if (n.y < 0) n.negate();
  const lift = n.clone().multiplyScalar(0.03);
  const verts = [a, b, c, d].map((v) => v.clone().add(lift));
  const pos = [], uv = [], nor = [];
  const order = [0, 1, 2, 0, 2, 3];
  for (const i of order) {
    const v = verts[i];
    pos.push(v.x, v.y, v.z);
    const rel = new THREE.Vector3().subVectors(v, sl.p0);
    uv.push(rel.dot(e) / 1.44, rel.dot(up) / 1.52);
    nor.push(n.x, n.y, n.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function orientCylinder(m, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  // vira o meio-cilindro para cima
  m.rotateY(Math.PI / 2);
  const up = new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion);
  if (up.y < 0) m.rotateY(Math.PI);
}

/* ---------- esquadrias ---------- */
function buildOpening(op, M, spec) {
  const g = new THREE.Group();
  const w = op.w, h = op.y1 - op.y0;
  const box = (bw, bh, bd, mat, x, y, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const prof = 0.045;
  if (op.kind === 'open') return null;
  if (op.kind === 'window' || op.kind === 'tall' || op.kind === 'slide') {
    // marco
    box(w, prof, 0.08, M.frame, 0, prof / 2);
    box(w, prof, 0.08, M.frame, 0, h - prof / 2);
    box(prof, h, 0.08, M.frame, -w / 2 + prof / 2, h / 2);
    box(prof, h, 0.08, M.frame, w / 2 - prof / 2, h / 2);
    if (op.kind === 'tall') {
      // grade da janela alta (Premier)
      box(prof * 0.7, h, 0.06, M.frame, 0, h / 2);
      for (let k = 1; k < 3; k++) box(w, prof * 0.7, 0.06, M.frame, 0, (h / 3) * k);
    } else {
      box(prof * 0.8, h, 0.07, M.frame, 0, h / 2, 0.012);
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - prof, h - prof), M.glass);
    glass.position.set(0, h / 2, 0);
    g.add(glass);
    const glass2 = glass.clone();
    glass2.rotation.y = Math.PI;
    g.add(glass2);
    if (op.kind === 'tall') {
      // interior iluminado aparecendo pela janela
      const warm = new THREE.Mesh(new THREE.PlaneGeometry(w - prof, h - prof), M.lights);
      warm.position.set(0, h / 2, -0.06);
      warm.rotation.y = 0;
      g.add(warm);
    }
    return g;
  }
  if (op.kind === 'door' || op.kind === 'pivot') {
    box(w, 0.05, 0.12, M.door, 0, h - 0.025);
    box(0.05, h, 0.12, M.door, -w / 2 + 0.025, h / 2);
    box(0.05, h, 0.12, M.door, w / 2 - 0.025, h / 2);
    const leaf = box(w - 0.1, h - 0.05, 0.04, M.door, 0, (h - 0.05) / 2);
    leaf.receiveShadow = true;
    const handle = box(0.025, op.kind === 'pivot' ? 0.9 : 0.12, 0.05, M.steel, w / 2 - 0.18, op.kind === 'pivot' ? 1.1 : 1.0, 0.04);
    handle.castShadow = false;
    const handle2 = handle.clone(); handle2.position.z = -0.04; g.add(handle2);
    return g;
  }
  return null;
}

function buildGate(op, M) {
  const g = new THREE.Group();
  const w = op.w, h = op.y1 - op.y0;
  const mat = op.kind === 'whitegate' ? M.trim : M.gate;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h, 0.05), mat);
  frame.position.y = h / 2;
  frame.castShadow = true;
  g.add(frame);
  // lambris verticais
  const n = Math.floor(w / 0.12);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, h - 0.06, 0.02), mat);
    s.position.set(-w / 2 + 0.08 + i * ((w - 0.16) / Math.max(n - 1, 1)), h / 2, 0.035);
    g.add(s);
  }
  return g;
}

/* ---------- vegetação ---------- */
function makePalm(M) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.8, 8), M.trunk);
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.3, 4), M.plant);
    leaf.castShadow = true;
    leaf.geometry.translate(0, 0.65, 0);
    leaf.scale.set(1, 1, 0.25);
    leaf.position.y = 1.8;
    leaf.rotation.set(Math.PI / 2.6, (i / 9) * Math.PI * 2, 0, 'YXZ');
    g.add(leaf);
  }
  return g;
}

function makeBamboo(M, r) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const h = 1.6 + r() * 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 5), M.trunk);
    stem.position.set((r() - 0.5) * 0.2, h / 2, (r() - 0.5) * 0.1);
    g.add(stem);
    for (let k = 0; k < 4; k++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + r() * 0.06, 0), M.plant);
      leaf.position.set(stem.position.x + (r() - 0.5) * 0.25, h * (0.45 + k * 0.15), (r() - 0.5) * 0.15);
      leaf.scale.set(1, 1.4, 0.6);
      leaf.castShadow = true;
      g.add(leaf);
    }
  }
  return g;
}
