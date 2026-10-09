/* ============================================
   BJRCON 3D — "construção no scroll"
   A casa é construída etapa por etapa conforme o usuário rola a página.
   Markup esperado:
     <section class="build3d" data-house="gold" data-mode="home|property">
       <div class="build3d-sticky"><canvas class="build3d-canvas"></canvas></div>
     </section>
   ============================================ */
import * as THREE from 'three';
import { buildHouse, buildNeighborhood, STAGES } from './houses.js';
import {
  clamp, lerp, range, smooth, rng, isMobile, webglAvailable,
  makeRenderer, roomEnv, autoResize, sandTex, concreteTex
} from './lib.js';

const HOOD_STAGE = {
  id: 'bairro', title: 'Bairros completos',
  text: 'Mais de 6.000 unidades entregues em 9 bairros planejados em Extremoz/RN. A próxima chave pode ser a sua.'
};

export function initBuildScroll(section) {
  const sticky = section.querySelector('.build3d-sticky');
  const canvas = section.querySelector('.build3d-canvas');
  if (!sticky || !canvas) return;
  if (!webglAvailable()) {
    section.classList.add('build3d--off');
    return;
  }

  const type = section.dataset.house || 'gold';
  const home = section.dataset.mode === 'home';
  const dusk = section.dataset.dusk === 'true';
  const HOUSE_END = home ? 0.8 : 1.0; // na home o fim do scroll mostra o bairro
  const stages = home ? [...STAGES, HOOD_STAGE] : STAGES;

  /* ---------- UI sobreposta ---------- */
  const ui = document.createElement('div');
  ui.className = 'build3d-ui';
  ui.innerHTML = `
    <ol class="build3d-steps" aria-label="Etapas da obra">
      ${stages.map((s, i) => `<li data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${s.title}</span></li>`).join('')}
    </ol>
    <div class="build3d-card" aria-live="polite">
      <span class="build3d-kicker">Etapa <b class="k-num">01</b> de ${stages.length}</span>
      <h3 class="build3d-title">${stages[0].title}</h3>
      <p class="build3d-text">${stages[0].text}</p>
      <div class="build3d-bar"><i></i></div>
    </div>
    <div class="build3d-meter"><span class="m-val">0%</span><small>da obra</small></div>
    <div class="build3d-hint"><i class="fas fa-computer-mouse"></i> Role para construir</div>
    <span class="build3d-badge">Modelo 3D ilustrativo</span>`;
  sticky.appendChild(ui);
  const stepEls = [...ui.querySelectorAll('.build3d-steps li')];
  const kNum = ui.querySelector('.k-num');
  const titleEl = ui.querySelector('.build3d-title');
  const textEl = ui.querySelector('.build3d-text');
  const barEl = ui.querySelector('.build3d-bar i');
  const meterEl = ui.querySelector('.m-val');
  const hintEl = ui.querySelector('.build3d-hint');
  const cardEl = ui.querySelector('.build3d-card');

  /* ---------- three.js ---------- */
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = roomEnv(renderer);
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(isMobile() ? 52 : 40, 1, 0.1, 900);

  // céu em degradê (cúpula) — permite transição para o entardecer
  const skyUniforms = {
    top: { value: new THREE.Color('#2e7bd6') },
    bottom: { value: new THREE.Color('#d7ecfa') }
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.05,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0); }'
    })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog('#d7ecfa', 90, 380);

  const hemi = new THREE.HemisphereLight('#d6ebff', '#d2a27a', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 2.8);
  sun.position.set(18, 30, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile() ? 1024 : 2048, isMobile() ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera;
  sc.near = 1; sc.far = 120;
  scene.add(sun, sun.target);
  setShadowSize(17);

  function setShadowSize(s) {
    sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s;
    sc.updateProjectionMatrix();
  }

  /* ---------- cenário: solo, rua, calçadas, vegetação ---------- */
  const house = buildHouse(type);
  scene.add(house.group);
  const L = house.lot;
  const streetZ0 = L.z1 + 2, streetZ1 = L.z1 + 10;

  const sand = sandTex().clone(); sand.needsUpdate = true; sand.repeat.set(140, 140);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const conc = concreteTex().clone(); conc.needsUpdate = true; conc.repeat.set(80, 3);
  const streetMat = new THREE.MeshStandardMaterial({ map: conc, color: '#d9cbb8', roughness: 1 });
  const walkMat = new THREE.MeshStandardMaterial({ map: concreteTex(), color: '#a9a7a3', roughness: 0.95 });
  const curbMat = new THREE.MeshStandardMaterial({ color: '#f4c51a', roughness: 0.6 });
  const streets = new THREE.Group();
  scene.add(streets);
  function addStreet(z0, z1, len = 360) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(len, z1 - z0), streetMat);
    st.rotation.x = -Math.PI / 2;
    st.position.set(0, 0.006, (z0 + z1) / 2);
    st.receiveShadow = true;
    streets.add(st);
    [[z0 - 2, z0], [z1, z1 + 2]].forEach(([a, b], i) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, b - a), walkMat);
      w.position.set(0, 0.06, (a + b) / 2);
      w.receiveShadow = true;
      streets.add(w);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.13, 0.14), curbMat);
      curb.position.set(0, 0.065, i === 0 ? b - 0.07 : a + 0.07);
      streets.add(curb);
    });
  }
  addStreet(streetZ0, streetZ1);

  // vizinhos + bairro
  let hood = null;
  if (home) {
    const step = 10;
    const n = 9;
    const rows = [
      { x0: 10, step, count: n, z: 0, rot: 0 },
      { x0: -10 - step * (n - 1), step, count: n, z: 0, rot: 0 },
      { x0: -step * n, step, count: n * 2 + 1, z: 28, rot: Math.PI },
      { x0: -step * n, step, count: n * 2 + 1, z: -24, rot: Math.PI },
      { x0: -step * n, step, count: n * 2 + 1, z: 52, rot: 0 }
    ];
    hood = buildNeighborhood({ rows, types: ['gold'] }); // como nas fotos de drone: casas cinza, muros coloridos
    scene.add(hood.group);
    addStreet(-34, -26);
    addStreet(62, 70);
  } else {
    // vizinhos do mesmo modelo, como na rua real de cada linha
    const w = L.x1 - L.x0;
    const rows = [
      { x0: w, step: w, count: 2, z: 0, rot: 0 },
      { x0: -2 * w, step: w, count: 2, z: 0, rot: 0 },
      { x0: -2.5 * w, step: w, count: 6, z: 2 * L.z1 + 12, rot: Math.PI }
    ];
    hood = buildNeighborhood({ rows, types: [type] });
    hood.update(1);
    scene.add(hood.group);
  }

  // vegetação nativa ao fundo (como nas fotos de drone) + dunas
  {
    const r = rng(5);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const matV = new THREE.MeshStandardMaterial({ color: '#4e7a32', roughness: 1, flatShading: true });
    const count = isMobile() ? 500 : 1100;
    const im = new THREE.InstancedMesh(geo, matV, count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x, z;
      do { x = (r() - 0.5) * 520; z = (r() - 0.5) * 520; } while (Math.abs(x) < 110 && z > -60 && z < 95);
      const sz = 1.5 + r() * 3.5;
      p.set(x, sz * 0.4, z);
      s.set(sz, sz * (0.6 + r() * 0.4), sz);
      q.setFromEuler(new THREE.Euler(0, r() * 6, 0));
      m4.compose(p, q, s);
      im.setMatrixAt(i, m4);
      col.setHSL(0.24 + r() * 0.06, 0.4 + r() * 0.15, 0.22 + r() * 0.12);
      im.setColorAt(i, col);
    }
    scene.add(im);
    const duneMat = new THREE.MeshStandardMaterial({ color: '#f1dcb8', roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), duneMat);
      d.scale.set(60 + r() * 60, 8 + r() * 10, 30 + r() * 20);
      d.position.set(-200 + i * 80, -2, -230 - r() * 40);
      scene.add(d);
    }
  }

  /* ---------- trajetória da câmera ---------- */
  const fx = house.focus.x, fz = house.focus.z;
  const kR = type === 'premier' ? 1.12 : 1;
  // [t, azimute°, elevação°, raio, alvo x, alvo y, alvo z] — órbita esférica (nunca atravessa a casa)
  const K = [
    [0.00, 30, 40, 32, 0, 0, 0],
    [0.12, 38, 30, 20, 0, 0.4, 0],
    [0.30, 40, 25, 17.5, 0, 1.2, 0],
    [0.46, -38, 25, 17.5, 0, 1.4, 0],
    [0.62, -68, 40, 19, 0, 2.0, 0],
    [0.76, 32, 17, 18, 0, 1.6, 1],
    [0.90, 18, 13, 21.5, 0, 1.8, 1.5],
    [1.00, -10, 11, 23, 0, 2.0, 1.5]
  ].map(([t, az, el, r, x, y, z]) => [t * HOUSE_END, az, el, r * kR, fx + x, y, fz + z]);
  if (home) {
    K.push([0.9, 47, 30, 48, 4, 0, 6]);
    K.push([1.0, 88, 16, 108, -30, 0, 12]);
  }
  const D2R = Math.PI / 180;
  function cameraAt(p, outPos, outTgt) {
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1];
    const e = smooth(clamp((p - a[0]) / (b[0] - a[0])));
    const az = lerp(a[1], b[1], e) * D2R, el = lerp(a[2], b[2], e) * D2R, r = lerp(a[3], b[3], e);
    outTgt.set(lerp(a[4], b[4], e), lerp(a[5], b[5], e), lerp(a[6], b[6], e));
    outPos.set(outTgt.x + r * Math.cos(el) * Math.sin(az), outTgt.y + r * Math.sin(el), outTgt.z + r * Math.cos(el) * Math.cos(az));
  }

  /* ---------- estado ---------- */
  let target = 0, current = 0, lastStage = -1, visible = false, raf = 0, lastT = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
  const duskTop = new THREE.Color('#1b3f8f'), duskBottom = new THREE.Color('#f2a66b');
  const dayTop = skyUniforms.top.value.clone(), dayBottom = skyUniforms.bottom.value.clone();

  function readScroll() {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    target = total > 0 ? clamp(-rect.top / total) : 0;
  }

  function setStage(i) {
    if (i === lastStage) return;
    lastStage = i;
    const s = stages[i];
    stepEls.forEach((el, k) => {
      el.classList.toggle('is-active', k === i);
      el.classList.toggle('is-done', k < i);
    });
    cardEl.classList.remove('swap');
    void cardEl.offsetWidth;
    cardEl.classList.add('swap');
    kNum.textContent = String(i + 1).padStart(2, '0');
    titleEl.textContent = s.title;
    textEl.textContent = s.text;
  }

  function stageIndex(p) {
    if (home && p > HOUSE_END + 0.01) return stages.length - 1;
    const hp = p / HOUSE_END;
    let idx = 0;
    STAGES.forEach((s, i) => { if (hp >= s.t0 + (i ? 0.02 : 0)) idx = i; });
    return idx;
  }

  function frame(t) {
    raf = visible ? requestAnimationFrame(frame) : 0;
    const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05);
    lastT = t;
    current += (target - current) * (1 - Math.exp(-dt * 5));
    if (Math.abs(target - current) < 1e-4) current = target;

    const hp = clamp(current / HOUSE_END);
    house.update(hp);
    if (home) {
      const np = range(current, HOUSE_END - 0.02, 0.97);
      hood.update(np);
      setShadowSize(lerp(17, 75, smooth(range(current, HOUSE_END, 1))));
    }

    // câmera
    cameraAt(current, camPos, camTgt);
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    camera.position.set(camPos.x + pointer.sx * 0.8, camPos.y + pointer.sy * 0.4, camPos.z);
    camera.lookAt(camTgt);
    sun.target.position.set(camTgt.x, 0, camTgt.z);
    sun.position.set(camTgt.x + 18, 30, camTgt.z + 16);

    // entardecer (Premier)
    if (dusk) {
      const e = smooth(range(hp, 0.9, 1));
      skyUniforms.top.value.copy(dayTop).lerp(duskTop, e);
      skyUniforms.bottom.value.copy(dayBottom).lerp(duskBottom, e);
      scene.fog.color.copy(skyUniforms.bottom.value);
      sun.intensity = lerp(2.8, 0.7, e);
      sun.color.set('#fff1dc').lerp(new THREE.Color('#ffb070'), e);
      hemi.intensity = lerp(0.9, 0.45, e);
      scene.environmentIntensity = lerp(0.35, 0.2, e);
    }

    // UI
    setStage(stageIndex(current));
    const pct = Math.round(hp * 100);
    meterEl.textContent = pct + '%';
    const st = stages[lastStage];
    const prog = st.id === 'bairro' ? range(current, HOUSE_END, 1) : range(hp, STAGES[lastStage].t0, STAGES[lastStage].t1);
    barEl.style.transform = `scaleX(${prog.toFixed(3)})`;
    hintEl.classList.toggle('is-hidden', current > 0.02);
    section.classList.toggle('build3d--done', current > 0.985);

    renderer.render(scene, camera);
  }

  /* ---------- eventos ---------- */
  autoResize(renderer, camera, sticky, () => renderer.render(scene, camera));
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll);
  sticky.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = sticky.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.y = -((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  sticky.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && !raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
  }, { rootMargin: '100px' });
  io.observe(section);

  readScroll();
  current = target;
  section.classList.add('build3d--ready');
}

document.querySelectorAll('.build3d').forEach(initBuildScroll);
