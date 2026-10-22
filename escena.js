/* =========================================================
   Bodega LAJA · escena 3D (three.js r186)

   - Botellas: «Wine Bottles 01» de Poly Haven (CC0). Se carga
     primero la versión 1K para que aparezca rápido y después
     se cambian las texturas por las de 4K (ordenador) o 2K
     (móvil). Si Poly Haven no responde, se dibujan botellas
     con código con las mismas medidas.
   - Etiquetas, corcho y uvas se generan aquí (lienzos 2D y
     una malla instanciada), así no hay que descargar nada más.
   - La botella sigue a los elementos [data-anchor] del HTML:
     para moverla o cambiar su tamaño basta con tocar el CSS.
   ========================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

/* ===================== CONFIG ===================== */
const POLY_HAVEN = 'https://dl.polyhaven.org/file/ph-assets/Models/';
// Si descargas el modelo de Poly Haven (formato glTF) a una carpeta de la web,
// pon aquí su ruta, p. ej. 'modelo/'. Vacío = se carga desde Poly Haven.
const MODELO_LOCAL = '';
const ETIQUETAS_ORIGINALES = /ftero|clearwater|intertwine/;   // se sustituyen por las de LAJA

// Medidas normalizadas (alto de la botella = 1). Los perfiles sirven para la versión dibujada con código.
const VINOS = {
  blanco: {
    nodo: 'alsace', sello: .837, liquido: .82,
    perfil: [[0, 0], [.098, 0], [.108, .01], [.108, .43], [.103, .5], [.093, .54], [.074, .64], [.062, .69], [.052, .75], [.045, .79], [.04, .82], [.033, .86], [.036, .96], [.041, .975], [.041, .995], [.034, 1], [0, 1]],
    vidrio: { color: 0x0e140a, opacidad: .24 },
    liquidoColor: 0xf0dc96,
    capsula: 0x23302a,
    etiqueta: { y0: .14, y1: .4, arco: 220, tema: 'cal', uva: 'PARDINA', linea: 'Blanco · 2024', numero: 'LOTE 24-B · 6.000 BOTELLAS', grado: '12,5 % vol.' }
  },
  rosado: {
    nodo: 'burgundy', sello: .793, liquido: .856,
    perfil: [[0, 0], [.12, 0], [.13, .01], [.131, .4], [.127, .45], [.116, .5], [.095, .55], [.079, .61], [.064, .65], [.053, .69], [.047, .72], [.042, .78], [.042, .96], [.045, .975], [.045, .995], [.038, 1], [0, 1]],
    vidrio: { color: 0x0b0c0c, opacidad: .16 },
    liquidoColor: 0xd9566b,
    capsula: 0x1c1c1e,
    etiqueta: { y0: .13, y1: .43, arco: 360, tema: 'rosa', uva: 'GARNACHA', linea: 'Rosado · 2024', numero: 'LOTE 24-R · 4.000 BOTELLAS', grado: '13 % vol.' }
  },
  tinto: {
    nodo: 'bordeaux', sello: .812, liquido: .896,
    perfil: [[0, 0], [.105, 0], [.117, .008], [.119, .05], [.123, .45], [.125, .6], [.121, .645], [.104, .68], [.073, .715], [.052, .75], [.046, .79], [.044, .95], [.047, .965], [.047, .995], [.04, 1], [0, 1]],
    vidrio: { color: 0x0b130e, opacidad: .86 },
    liquidoColor: 0x2b0710,
    capsula: 0x6a1724,
    etiqueta: { y0: .15, y1: .47, arco: 360, tema: 'pizarra', uva: 'TEMPRANILLO', linea: 'Crianza · 2021', numero: 'Nº 0417 / 2400', grado: '14,5 % vol.' }
  }
};
const TEMAS = {
  pizarra: { papel: '#2B2E33', tinta: '#ECE8E1', suave: 'rgba(236,232,225,.62)', foil: '#C9707D', vetas: true },
  cal: { papel: '#ECE8E1', tinta: '#22252A', suave: 'rgba(34,37,42,.6)', foil: '#8D2333', vetas: false },
  rosa: { papel: '#F0E4DF', tinta: '#7A1E2C', suave: 'rgba(122,30,44,.66)', foil: '#7A1E2C', vetas: false }
};
const UVA_TEMPRANILLO = [0x2b1d3a, 0x35213f, 0x22182e, 0x3c2747, 0x2f1b33];
const GLOW = new THREE.Color(0xff5f5a).multiplyScalar(.9);   // borde de la desintegración

// Cámara del inicio: puntos de vista en el espacio de la botella (alto = 1).
// t = progreso del scroll del inicio en el que se alcanza cada vista.
const VISTAS = [
  { t: 0 },                                                            // vista general (se calcula)
  { t: .235, pos: [.04, 1.19, .2], mira: [0, .985, 0], giro: 8 },       // 01 corcho
  { t: .485, pos: [.34, .86, .44], mira: [0, .8, 0], giro: -38 },       // 02 cuello y cápsula
  { t: .74, pos: [0, .32, .98], mira: [0, .31, 0], giro: 0 },           // 03 etiqueta
  { t: 1 }                                                             // vuelta a la vista general
];
const PAUSA = .065;   // tramo de scroll en el que la cámara se queda quieta en cada vista
/* ================================================== */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const DEG = Math.PI / 180;
const errText = e => (e && e.message) ? e.message : String(e);
function azar(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function nivelDispositivo() {
  const n = navigator, c = n.connection || {};
  const mem = n.deviceMemory || 8, nucleos = n.hardwareConcurrency || 8;
  const tactil = matchMedia('(pointer: coarse)').matches;
  const pequeno = Math.min(screen.width, screen.height) < 820 || tactil;
  if (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || '') || mem <= 2 || nucleos <= 2) {
    return { nombre: 'bajo', mejora: null, dpr: 1.25, uvas: 320, seg: [14, 10], etiqueta: 1024, corcho: 512 };
  }
  if (pequeno) return { nombre: 'medio', mejora: '2k', dpr: 1.75, uvas: 420, seg: [16, 12], etiqueta: 2048, corcho: 1024 };
  return { nombre: 'alto', mejora: '4k', dpr: 2, uvas: 600, seg: [22, 16], etiqueta: 4096, corcho: 1024 };
}

/* =========================================================
   Arranque
   ========================================================= */
export async function iniciar(api) {
  const canvas = api.canvas;
  const reducido = !!api.reducido;
  const nivel = nivelDispositivo();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: nivel.nombre !== 'bajo', alpha: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, nivel.dpr);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const maxTex = renderer.capabilities.maxTextureSize || 4096;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = estudio(pmrem);
  const camera = new THREE.PerspectiveCamera(30, 1, .02, 100);
  const BASE_Z = 10;
  camera.position.set(0, 0, BASE_Z);

  const key = new THREE.DirectionalLight(0xfff3e6, 1.1); key.position.set(-3, 4, 5); scene.add(key);
  const contra = new THREE.DirectionalLight(0xdfe6ff, .7); contra.position.set(4, 2, -3); scene.add(contra);
  scene.add(new THREE.HemisphereLight(0xece8e1, 0x22252a, .25));

  // place (posición y tamaño según el ancla) > giro (yaw) > botellas y uvas
  const place = new THREE.Group(), giro = new THREE.Group();
  place.add(giro); scene.add(place);
  const raizInv = new THREE.Matrix4();

  let ancho = 0, alto = 0;
  function medidas() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === ancho && h === alto) return;
    ancho = w; alto = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  medidas();
  let pendienteMedir = false;
  window.addEventListener('resize', () => { pendienteMedir = true; }, { passive: true });

  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); detener(); api.onError('Se ha perdido el contexto 3D.'); });

  /* ---------- Carga de fuentes, modelo y botellas ---------- */
  api.onProgress(.04, 'Cargando la escena 3D…');
  const fuentes = fuentesListas();
  let fuente = 'polyhaven';
  let gltf = null;
  try {
    gltf = await conTiempo(cargarPolyHaven('1k', (f) => api.onProgress(.08 + f * .82, 'Descargando las botellas de Poly Haven · ' + Math.round(f * 100) + ' %')), 20000);
  } catch (e) {
    console.warn('Modelo de Poly Haven no disponible → se usa la botella dibujada con código. ' + errText(e));
    fuente = 'procedural';
  }
  await fuentes;
  api.onProgress(.94, 'Preparando etiquetas…');

  const botellas = {};
  const materialesAtlas = new Set();
  for (const id of Object.keys(VINOS)) {
    let kit = null;
    if (gltf) {
      try { kit = botellaPolyHaven(gltf.scene, id); } catch (e) { console.warn('Botella ' + id + ' no encontrada en el modelo → ' + errText(e)); }
    }
    if (!kit) kit = botellaProcedural(id);
    vestir(kit, id);
    kit.grupo.visible = id === 'tinto';
    giro.add(kit.grupo);
    botellas[id] = kit;
  }
  if (document.fonts && document.fonts.check && !document.fonts.check('800 40px Syne')) {
    document.fonts.ready.then(() => { for (const id in botellas) botellas[id].redibujar(); }).catch(() => {});
  }

  /* ---------- Uvas ---------- */
  const uvas = crearUvas(botellas.tinto);
  giro.add(uvas.malla, uvas.rabillo);

  const sombra = crearSombra();
  giro.add(sombra);

  /* ---------- Estado ---------- */
  let seleccionado = (api.vino && api.vino()) || 'tinto';
  window.addEventListener('laja:vino', e => { if (e.detail && VINOS[e.detail]) seleccionado = e.detail; });

  const cambio = { visible: 'tinto', sale: null, entra: null, t: 0, pendiente: null };
  let intro = reducido ? 1 : 0, introActiva = false;
  api.esperarEntrada().then(() => { introActiva = true; });

  const actual = { x: 0, y: 0, s: 1, yaw: 0, init: false };
  const cam = { pos: new THREE.Vector3(0, 0, BASE_Z), mira: new THREE.Vector3(), init: false };
  const raton = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!reducido && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', e => { raton.x = e.clientX / window.innerWidth * 2 - 1; raton.y = e.clientY / window.innerHeight * 2 - 1; }, { passive: true });
  }
  const anclas = Array.from(document.querySelectorAll('[data-anchor]')).map(el => ({
    el, id: el.getAttribute('data-anchor'), yaw: parseFloat(el.getAttribute('data-yaw') || '0'), gira: el.getAttribute('data-spin') === '1'
  }));
  let giroLibre = 0, dAnterior = -1, ultimo = performance.now(), tiempo = 0, raf = 0, limpio = false;
  const rendimiento = { n: 0, suma: 0 };

  renderer.compile(scene, camera);
  api.onReady({ fuente, nivel: nivel.nombre });

  // Texturas en alta resolución, cuando la página ya está tranquila
  if (fuente === 'polyhaven' && nivel.mejora) {
    setTimeout(() => {
      mejorarTexturas(nivel.mejora).then(() => api.onQuality('Texturas ' + nivel.mejora.toUpperCase() + ' · Poly Haven'))
        .catch(e => console.warn('No se pudieron cargar las texturas ' + nivel.mejora + ' → ' + errText(e)));
    }, 2200);
  } else if (fuente === 'polyhaven') {
    api.onQuality('Texturas 1K · Poly Haven');
  }

  raf = requestAnimationFrame(bucle);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ultimo = performance.now(); });

  function detener() { cancelAnimationFrame(raf); raf = 0; }

  /* =========================================================
     Bucle
     ========================================================= */
  function bucle(ahora) {
    raf = requestAnimationFrame(bucle);
    if (document.hidden) return;
    const dt = Math.min(.25, Math.max(0, (ahora - ultimo) / 1000));   // tiempo real: en móviles lentos las animaciones duran lo mismo
    ultimo = ahora; tiempo += dt;
    if (pendienteMedir) { pendienteMedir = false; medidas(); }

    const halfH = Math.tan(camera.fov * DEG / 2) * BASE_Z;
    const halfW = halfH * camera.aspect;
    const est = medirAnclas();
    if (!est) { limpiar(); return; }
    const prog = api.progreso();

    /* --- dónde va la botella --- */
    const objetivo = destino(est, halfW, halfH, dt);
    const k = reducido || !actual.init ? 1 : 1 - Math.exp(-dt * 11);
    actual.x += (objetivo.x - actual.x) * k;
    actual.y += (objetivo.y - actual.y) * k;
    actual.s += (objetivo.s - actual.s) * k;
    actual.yaw += (objetivo.yaw - actual.yaw) * (reducido || !actual.init ? 1 : 1 - Math.exp(-dt * 7));
    actual.init = true;
    place.position.set(actual.x, actual.y - actual.s * .5, 0);
    place.scale.setScalar(actual.s);
    giro.rotation.y = actual.yaw;
    place.updateMatrixWorld(true);
    raizInv.copy(giro.matrixWorld).invert();

    /* --- cámara --- */
    const wHero = est.pesos.hero || 0;
    const base = { pos: new THREE.Vector3(raton.sx * .14, -raton.sy * .1, BASE_Z), mira: new THREE.Vector3(0, 0, 0) };
    const km = 1 - Math.exp(-dt * 2.5);
    raton.sx += (raton.x - raton.sx) * km; raton.sy += (raton.y - raton.sy) * km;
    let pos = base.pos, mira = base.mira;
    if (wHero > .001) {
      const h = vistaHero(prog.hero, base);
      pos = base.pos.clone().lerp(h.pos, wHero);
      mira = base.mira.clone().lerp(h.mira, wHero);
    }
    const kc = reducido || !cam.init ? 1 : 1 - Math.exp(-dt * 9);
    cam.pos.lerp(pos, kc); cam.mira.lerp(mira, kc); cam.init = true;
    camera.position.copy(cam.pos);
    camera.lookAt(cam.mira);

    /* --- desintegración en uvas --- */
    const wProd = est.pesos.producto || 0;
    let d = reducido ? (prog.producto > .3 ? 1 : 0) : smooth(.06, .7, prog.producto);
    d *= reducido ? (wProd > .6 ? 1 : 0) : smooth(.35, 1, wProd);
    if (Math.abs(d - dAnterior) > 1e-4 || d >= .999) { uvas.actualizar(d, tiempo); dAnterior = d; }

    /* --- qué vino se ve y cómo aparece --- */
    const wVinos = est.pesos.vinos || 0;
    const deseado = wVinos > .8 ? seleccionado : 'tinto';
    gestionarCambio(deseado, dt);
    if (introActiva && intro < 1) intro = Math.min(1, intro + dt / 1.9);
    for (const id in botellas) {
      const b = botellas[id];
      let corte = 1.5;
      if (cambio.sale === id) corte = lerp(1.5, -.14, easeInOut(clamp(cambio.t / .42, 0, 1)));
      else if (cambio.entra === id) corte = lerp(-.14, 1.5, easeOut(clamp((cambio.t - .42) / .7, 0, 1)));
      if (id === 'tinto') {
        corte = Math.min(corte, introActiva || reducido ? lerp(-.14, 1.5, easeOut(intro)) : -.2);
        if (d > 0) corte = Math.min(corte, 1.05 - d * 1.62);
      }
      b.uniformes.uCorte.value = corte;
      let visible;
      if (cambio.sale) visible = cambio.t < .42 ? id === cambio.sale : id === cambio.entra;
      else visible = id === cambio.visible;
      b.grupo.visible = visible && corte > -.13;
    }
    sombra.material.opacity = .55 * (1 - d) * (botellas[cambio.visible].grupo.visible ? 1 : 0) * clamp(intro * 1.4, 0, 1);

    /* --- dibujar solo si la botella está en pantalla --- */
    const arriba = actual.y + actual.s * .6, abajo = actual.y - actual.s * .6;
    const fuera = abajo > halfH * 1.05 || arriba < -halfH * 1.05 || Math.abs(actual.x) - actual.s * .4 > halfW * 1.05;
    if (fuera && wHero < .01) { limpiar(); return; }
    renderer.render(scene, camera);
    limpio = false;
    medirRendimiento(dt);
  }

  function limpiar() { if (!limpio) { renderer.clear(); limpio = true; } }

  function medirRendimiento(dt) {
    if (dpr <= 1) return;
    rendimiento.n++; rendimiento.suma += dt;
    if (rendimiento.n >= 90) {
      const media = rendimiento.suma / rendimiento.n;
      rendimiento.n = 0; rendimiento.suma = 0;
      if (media > .024) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); ancho = 0; medidas(); }
    }
  }

  function gestionarCambio(deseado, dt) {
    if (!cambio.sale && !cambio.entra) {
      if (deseado !== cambio.visible) {
        if (reducido) { cambio.visible = deseado; return; }
        cambio.sale = cambio.visible; cambio.entra = deseado; cambio.t = 0;
      }
      return;
    }
    cambio.t += dt;
    if (cambio.t >= .42 && cambio.visible !== cambio.entra) cambio.visible = cambio.entra;
    if (cambio.t >= 1.12) {
      cambio.sale = null; cambio.entra = null; cambio.t = 0;
    }
  }

  /* ---------- Anclas: dónde y de qué tamaño se dibuja la botella ---------- */
  function medirAnclas() {
    const vh = window.innerHeight, vc = vh / 2, lista = [];
    for (const a of anclas) {
      const r = a.el.getBoundingClientRect();
      if (r.height < 2 || r.width < 1) continue;
      const cy = r.top + r.height / 2;
      let s = (cy - vc) / vh;
      s = Math.sign(s) * Math.max(0, Math.abs(s) - .1);   // zona muerta: la botella se queda quieta en su ancla
      lista.push({ a, cx: r.left + r.width / 2, cy, h: r.height, s });
    }
    if (!lista.length) return null;
    let A = null, B = null;
    for (const it of lista) {
      if (it.s === 0) { if (!A || Math.abs(it.cy - vc) < Math.abs(A.cy - vc)) A = it; }
    }
    if (A) return { A, B: null, t: 0, pesos: { [A.a.id.replace(/-m$/, '')]: 1 } };
    for (const it of lista) {
      if (it.s < 0) { if (!A || it.s > A.s) A = it; } else if (!B || it.s < B.s) B = it;
    }
    if (!A || !B) { const u = A || B; return { A: u, B: null, t: 0, pesos: { [u.a.id.replace(/-m$/, '')]: 1 } }; }
    let t = (0 - A.s) / (B.s - A.s);
    t = smooth(0, 1, t);
    const pesos = {};
    pesos[A.a.id.replace(/-m$/, '')] = 1 - t;
    pesos[B.a.id.replace(/-m$/, '')] = (pesos[B.a.id.replace(/-m$/, '')] || 0) + t;
    return { A, B, t, pesos };
  }

  function aMundo(it, halfW, halfH) {
    const w = window.innerWidth, h = window.innerHeight;
    return { x: (it.cx / w * 2 - 1) * halfW, y: -(it.cy / h * 2 - 1) * halfH, s: it.h / h * 2 * halfH };
  }

  function yawAncla(it, dt) {
    let y = it.a.yaw * DEG;
    if (it.a.gira && !reducido) y += giroLibre;
    return y;
  }

  function destino(est, halfW, halfH, dt) {
    const enBodega = (est.pesos.bodega || 0) > .2;
    if (enBodega && !reducido) giroLibre += dt * .35;
    const a = aMundo(est.A, halfW, halfH);
    let x = a.x, y = a.y, s = a.s, yaw = yawAncla(est.A, dt);
    if (est.B) {
      const b = aMundo(est.B, halfW, halfH), t = est.t;
      x = lerp(a.x, b.x, t); y = lerp(a.y, b.y, t); s = lerp(a.s, b.s, t);
      yaw = lerp(yaw, yawAncla(est.B, dt), t);
      if (!reducido) { const arco = Math.sin(t * Math.PI); s *= 1 - arco * .1; yaw += arco * 1.1; }
    }
    const wHero = est.pesos.hero || 0;
    if (wHero > 0) {
      const p = api.progreso().hero;
      yaw = lerp(yaw, giroHero(p) + (reducido ? 0 : Math.sin(tiempo * .6) * .03), wHero);
    }
    const wProd = est.pesos.producto || 0;
    if (wProd > 0 && !reducido) yaw += wProd * (api.progreso().producto * 1.1 + Math.sin(tiempo * .5) * .05);
    return { x, y, s, yaw };
  }

  /* ---------- Cámara del inicio ---------- */
  function tramoHero(p) {
    if (reducido) {
      const tramo = p < .1 ? 0 : p < .37 ? 1 : p < .6 ? 2 : p < .88 ? 3 : 4;
      return { i: Math.min(tramo, 3), u: tramo === 4 ? 1 : 0 };
    }
    for (let i = 0; i < 4; i++) {
      const a = VISTAS[i].t + (i === 0 ? 0 : PAUSA), b = VISTAS[i + 1].t - (i + 1 === 4 ? 0 : PAUSA);
      if (p <= a) return { i, u: 0 };
      if (p < b) return { i, u: easeInOut((p - a) / (b - a)) };
    }
    return { i: 3, u: 1 };
  }
  function giroHero(p) {
    const { i, u } = tramoHero(p);
    const g = n => (VISTAS[n].giro !== undefined ? VISTAS[n].giro : -12) * DEG;
    return lerp(g(i), g(i + 1), u);
  }
  function vistaHero(p, base) {
    const { i, u } = tramoHero(p);
    const ajuste = clamp(.8 / camera.aspect, 1, 1.9);
    const local = n => {
      const v = VISTAS[n];
      if (!v.pos) return { pos: base.pos.clone(), mira: base.mira.clone() };
      const mira = new THREE.Vector3().fromArray(v.mira);
      const pos = new THREE.Vector3().fromArray(v.pos).sub(mira).multiplyScalar(ajuste).add(mira);
      return { pos: place.localToWorld(pos), mira: place.localToWorld(mira) };
    };
    const A = local(i), B = local(i + 1);
    return { pos: A.pos.lerp(B.pos, u), mira: A.mira.lerp(B.mira, u) };
  }

  /* =========================================================
     Materiales y botellas
     ========================================================= */
  function uniformesBotella() {
    return { uCorte: { value: 1.5 }, uRaizInv: { value: raizInv }, uBorde: { value: GLOW } };
  }

  // Añade a un material el corte por altura con borde incandescente (aparecer / desintegrarse)
  function parchear(mat, U, tipo) {
    const vidrio = tipo === 'vidrio', liquido = tipo === 'liquido';
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCorte = U.uCorte; sh.uniforms.uRaizInv = U.uRaizInv; sh.uniforms.uBorde = U.uBorde;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uRaizInv;\nvarying vec3 vRaiz;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRaiz = (uRaizInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform float uCorte;
uniform vec3 uBorde;
varying vec3 vRaiz;
float lajaHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float lajaRuido(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lajaHash(i), lajaHash(i + vec3(1, 0, 0)), f.x), mix(lajaHash(i + vec3(0, 1, 0)), lajaHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(lajaHash(i + vec3(0, 0, 1)), lajaHash(i + vec3(1, 0, 1)), f.x), mix(lajaHash(i + vec3(0, 1, 1)), lajaHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float lajaN = lajaRuido(vRaiz * 26.0) * .65 + lajaRuido(vRaiz * 74.0) * .35;
float lajaD = uCorte - (vRaiz.y + (lajaN - .5) * .09);
if (lajaD < 0.0) discard;
float lajaBorde = 1.0 - smoothstep(0.0, .03, lajaD);`)
        .replace('#include <opaque_fragment>', `${liquido ? 'outgoingLight *= mix(.38, 1.0, pow(clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), .7));' : ''}
outgoingLight += uBorde * lajaBorde * 3.0;
#include <opaque_fragment>
${vidrio ? 'gl_FragColor.a = clamp(max(gl_FragColor.a, max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) * 1.3), 0.0, 1.0);' : ''}
gl_FragColor.a = max(gl_FragColor.a, lajaBorde);`);
    };
    mat.customProgramCacheKey = () => 'laja-corte-' + (tipo || 'n');
    return mat;
  }

  function materialVidrio(cfg, original) {
    const m = new THREE.MeshPhysicalMaterial({
      color: cfg.vidrio.color, metalness: 0, roughness: .055, transparent: true, opacity: cfg.vidrio.opacidad,
      depthWrite: false, clearcoat: 1, clearcoatRoughness: .05, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.5
    });
    if (original && original.normalMap) { m.normalMap = original.normalMap; m.normalScale = new THREE.Vector2(.35, .35); materialesAtlas.add(m); }
    return m;
  }
  function materialLiquido(cfg) {
    const c = new THREE.Color(cfg.liquidoColor);
    return new THREE.MeshPhysicalMaterial({ color: c, emissive: c.clone().multiplyScalar(.2), roughness: .08, metalness: 0, clearcoat: .5, clearcoatRoughness: .1, envMapIntensity: .9 });
  }

  // Botella del modelo de Poly Haven
  function botellaPolyHaven(raiz, id) {
    const cfg = VINOS[id];
    const nodo = raiz.getObjectByName('wine_bottles_01_' + cfg.nodo);
    if (!nodo) throw new Error('falta el nodo ' + cfg.nodo);
    const copia = nodo.clone(true);
    copia.position.set(0, 0, 0); copia.rotation.set(0, 0, 0); copia.scale.set(1, 1, 1);
    copia.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(copia);
    const H = caja.max.y - caja.min.y;
    copia.scale.setScalar(1 / H);
    copia.position.y = -caja.min.y / H;
    const grupo = new THREE.Group();
    grupo.add(copia);
    grupo.updateMatrixWorld(true);

    let vidrio = null, sello = null, liquido = null;
    const quitar = [];
    copia.traverse(o => {
      if (!o.isMesh) return;
      const n = o.material.name || '';
      o.frustumCulled = false;
      if (/_glass_/.test(n)) vidrio = o;
      else if (/_seal/.test(n)) sello = o;
      else if (ETIQUETAS_ORIGINALES.test(n)) quitar.push(o);
      else if (/_wine_/.test(n)) liquido = o;
    });
    quitar.forEach(o => o.parent.remove(o));
    if (!vidrio || !sello || !liquido) throw new Error('primitivas incompletas');

    const original = vidrio.material;
    vidrio.material = materialVidrio(cfg, original);
    vidrio.renderOrder = 3;
    liquido.material = materialLiquido(cfg);
    liquido.renderOrder = 1;
    const sm = sello.material.clone();
    sm.transparent = false; sm.alphaTest = 0;
    if (sm.map) materialesAtlas.add(sm);
    sm.envMapIntensity = 1.2;
    sello.material = sm;

    return { grupo, vidrio, sello, materiales: [vidrio.material, liquido.material, sm], radio: perfilDesdeMalla(vidrio), tapa: tapaDesdeMalla(sello) };
  }

  // Botella dibujada con código (mismas proporciones)
  function botellaProcedural(id) {
    const cfg = VINOS[id];
    const pts = cfg.perfil.map(([r, y]) => new THREE.Vector2(r, y));
    const radio = interpolador(cfg.perfil.filter(p => p[0] > 0));
    const grupo = new THREE.Group();
    const geoV = new THREE.LatheGeometry(pts, 96);
    const vidrio = new THREE.Mesh(geoV, materialVidrio(cfg, null));
    vidrio.renderOrder = 3;
    const ptsL = [];
    for (let i = 0; i <= 40; i++) { const y = .012 + (cfg.liquido - .012) * i / 40; ptsL.push(new THREE.Vector2(Math.max(.002, radio(y) - .007), y)); }
    ptsL.unshift(new THREE.Vector2(0, .012)); ptsL.push(new THREE.Vector2(0, cfg.liquido));
    const liquido = new THREE.Mesh(new THREE.LatheGeometry(ptsL, 64), materialLiquido(cfg));
    liquido.renderOrder = 1;
    const ptsS = [];
    for (let i = 0; i <= 24; i++) { const y = cfg.sello + (1 - cfg.sello) * i / 24; ptsS.push(new THREE.Vector2(radio(Math.min(y, .998)) * 1.04 + .002, y)); }
    ptsS.push(new THREE.Vector2(0, 1.001));
    const sm = new THREE.MeshPhysicalMaterial({ color: cfg.capsula, metalness: .85, roughness: .3, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: 1.2 });
    const sello = new THREE.Mesh(new THREE.LatheGeometry(ptsS, 64), sm);
    grupo.add(liquido, vidrio, sello);
    [vidrio, liquido, sello].forEach(m => { m.frustumCulled = false; });
    return { grupo, vidrio, sello, materiales: [vidrio.material, liquido.material, sm], radio, tapa: { y: 1.001, r: radio(.998) * 1.04 + .002 } };
  }

  // Etiqueta, corcho y parche de corte
  function vestir(kit, id) {
    const cfg = VINOS[id], e = cfg.etiqueta, tema = TEMAS[e.tema];
    kit.uniformes = uniformesBotella();
    const arco = e.arco * DEG;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const y = e.y0 + (e.y1 - e.y0) * i / 24; pts.push(new THREE.Vector2(kit.radio(y) + .0028, y)); }
    const geo = new THREE.LatheGeometry(pts, 128, -arco / 2, arco);
    const largo = kit.radio((e.y0 + e.y1) / 2) * arco;
    const W = Math.min(id === 'tinto' ? nivel.etiqueta : Math.min(2048, nivel.etiqueta), maxTex);   // solo la del crianza se ve de cerca
    const H = Math.round(Math.min(maxTex, W * (e.y1 - e.y0) / largo));
    const lienzos = { color: lienzo(W, H), relieve: lienzo(W >> 1, H >> 1), orm: lienzo(W >> 1, H >> 1) };
    const dibujar = () => dibujarEtiqueta(lienzos, cfg, tema, e.arco);
    dibujar();
    const map = new THREE.CanvasTexture(lienzos.color); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = maxAniso;
    const bump = new THREE.CanvasTexture(lienzos.relieve); bump.anisotropy = maxAniso;
    const orm = new THREE.CanvasTexture(lienzos.orm); orm.anisotropy = maxAniso;
    const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, side: THREE.DoubleSide, envMapIntensity: 1.1, clearcoat: e.tema === 'pizarra' ? .15 : 0 });
    const etiqueta = new THREE.Mesh(geo, mat);
    etiqueta.renderOrder = 2; etiqueta.frustumCulled = false;
    kit.grupo.add(etiqueta);

    // Corcho visible en la boca de la cápsula, marcado a fuego
    const C = nivel.corcho;
    const lc = { color: lienzo(C, C), relieve: lienzo(C >> 1, C >> 1) };
    dibujarCorcho(lc);
    const tc = new THREE.CanvasTexture(lc.color); tc.colorSpace = THREE.SRGBColorSpace; tc.anisotropy = maxAniso;
    const tb = new THREE.CanvasTexture(lc.relieve);
    const corchoMat = new THREE.MeshStandardMaterial({ map: tc, bumpMap: tb, bumpScale: 2.2, roughness: .88, metalness: 0, envMapIntensity: .7 });
    const disco = new THREE.Mesh(new THREE.CircleGeometry(kit.tapa.r * .74, 72), corchoMat);
    disco.rotation.x = -Math.PI / 2;
    disco.position.y = kit.tapa.y + .0012;
    disco.frustumCulled = false;
    kit.grupo.add(disco);

    kit.materiales.push(mat, corchoMat);
    kit.materiales.forEach((m, i) => parchear(m, kit.uniformes, i === 0 ? 'vidrio' : i === 1 ? 'liquido' : null));
    kit.redibujar = () => { dibujar(); map.needsUpdate = true; bump.needsUpdate = true; orm.needsUpdate = true; dibujarCorcho(lc); tc.needsUpdate = true; tb.needsUpdate = true; };
  }

  async function mejorarTexturas(res) {
    const urls = urlsModelo(res);
    const nombres = { map: `wine_bottles_01_diff_${res}.jpg`, normal: `wine_bottles_01_nor_gl_${res}.jpg`, arm: `wine_bottles_01_arm_${res}.jpg` };
    const cargador = new THREE.TextureLoader();
    cargador.setCrossOrigin('anonymous');
    const cargar = f => new Promise((ok, ko) => cargador.load(urls.tex(f), ok, undefined, () => ko(new Error('no se pudo cargar ' + f))));
    const [map, normal, arm] = await Promise.all([cargar(nombres.map), cargar(nombres.normal), cargar(nombres.arm)]);
    map.colorSpace = THREE.SRGBColorSpace;
    [map, normal, arm].forEach(t => { t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso; renderer.initTexture(t); });
    const viejas = new Set();
    materialesAtlas.forEach(m => {
      if (m.map) { viejas.add(m.map); m.map = map; }
      if (m.normalMap) { viejas.add(m.normalMap); m.normalMap = normal; }
      if (m.roughnessMap) { viejas.add(m.roughnessMap); m.roughnessMap = arm; }
      if (m.metalnessMap) { viejas.add(m.metalnessMap); m.metalnessMap = arm; }
      if (m.aoMap) { viejas.add(m.aoMap); m.aoMap = arm; }
      m.needsUpdate = true;
    });
    viejas.forEach(t => { if (t !== map && t !== normal && t !== arm) t.dispose(); });
  }

  /* =========================================================
     Uvas: la botella se desgrana y forma un racimo
     ========================================================= */
  function crearUvas(kit) {
    const N = nivel.uvas;
    const R = .0285 * Math.cbrt(600 / N);
    const rnd = azar(1968);
    const geo = new THREE.SphereGeometry(1, nivel.seg[0], nivel.seg[1]);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .34, metalness: 0, clearcoat: .35, clearcoatRoughness: .4, sheen: .8, sheenColor: new THREE.Color(0x8d95b8), sheenRoughness: .65, envMapIntensity: 1 });
    const malla = new THREE.InstancedMesh(geo, mat, N);
    malla.frustumCulled = false;
    malla.visible = false;
    const color = new THREE.Color();
    for (let i = 0; i < N; i++) {
      color.setHex(UVA_TEMPRANILLO[Math.floor(rnd() * UVA_TEMPRANILLO.length)]).offsetHSL(0, 0, (rnd() - .5) * .04);
      malla.setColorAt(i, color);
    }

    // Origen: puntos sobre el vidrio de la botella
    kit.grupo.updateMatrixWorld(true);
    const sampler = new MeshSurfaceSampler(kit.vidrio).setRandomGenerator(rnd).build();
    const M = kit.vidrio.matrixWorld.clone();
    const ini = [], tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      sampler.sample(tmp);
      tmp.applyMatrix4(M);
      if (tmp.y > .985) tmp.y = .985;
      ini.push(tmp.clone());
    }

    // Destino: racimo con forma de cono invertido (relleno sin solapes, con una rejilla para ir rápido)
    const fin = racimo(N, R, rnd);
    const orden = (arr) => arr.map((v, i) => ({ i, k: v.y + (rnd() - .5) * .06 })).sort((a, b) => b.k - a.k).map(o => o.i);
    const oi = orden(ini), of = orden(fin);
    const S = [], E = [], C1 = [], C2 = [], suelta = [], escala = [], remolino = [];
    for (let n = 0; n < N; n++) {
      const s = ini[oi[n]], e = fin[of[n]];
      const dirS = new THREE.Vector3(s.x, 0, s.z); if (dirS.lengthSq() < 1e-6) dirS.set(rnd() - .5, 0, rnd() - .5); dirS.normalize();
      const dirE = new THREE.Vector3(e.x, 0, e.z); if (dirE.lengthSq() < 1e-6) dirE.copy(dirS); dirE.normalize();
      S.push(s); E.push(e);
      C1.push(s.clone().addScaledVector(dirS, .2 + rnd() * .24).add(new THREE.Vector3(0, .04 + rnd() * .12, 0)));
      C2.push(e.clone().addScaledVector(dirE, .14 + rnd() * .2).add(new THREE.Vector3(0, .05 + rnd() * .06, 0)));
      suelta.push((1.05 - s.y) / 1.62 + (rnd() - .5) * .04);
      escala.push(.88 + rnd() * .24);
      remolino.push(.9 + rnd() * .8);
    }

    // Rabillo del racimo
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(.0, 1.1, -.01), new THREE.Vector3(.012, 1.04, 0), new THREE.Vector3(0, .98, .006), new THREE.Vector3(-.006, .86, 0), new THREE.Vector3(0, .62, 0)]);
    const rabillo = new THREE.Mesh(new THREE.TubeGeometry(curva, 32, .009, 8), new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: .85, metalness: 0 }));
    rabillo.visible = false; rabillo.frustumCulled = false;

    const dummy = new THREE.Object3D(), p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    function actualizar(d) {
      if (d <= .0005) { malla.visible = false; rabillo.visible = false; return; }
      malla.visible = true;
      for (let i = 0; i < N; i++) {
        const q = clamp((d - suelta[i]) / .34, 0, 1);
        if (q <= 0) { dummy.position.copy(S[i]); dummy.scale.setScalar(0); dummy.updateMatrix(); malla.setMatrixAt(i, dummy.matrix); continue; }
        const u = easeInOut(q), v = 1 - u;
        // Bézier cúbica S → C1 → C2 → E
        p.copy(S[i]).multiplyScalar(v * v * v)
          .add(a.copy(C1[i]).multiplyScalar(3 * v * v * u))
          .add(b.copy(C2[i]).multiplyScalar(3 * v * u * u))
          .add(a.copy(E[i]).multiplyScalar(u * u * u));
        const ang = Math.sin(u * Math.PI) * remolino[i];
        const c = Math.cos(ang), s = Math.sin(ang), x = p.x, z = p.z;
        p.x = x * c - z * s; p.z = x * s + z * c;
        const k = R * escala[i] * (.35 + .65 * Math.min(1, q * 3));
        dummy.position.copy(p);
        dummy.scale.set(k, k * 1.07, k);
        dummy.updateMatrix();
        malla.setMatrixAt(i, dummy.matrix);
      }
      malla.instanceMatrix.needsUpdate = true;
      const r = smooth(.8, 1, d);
      rabillo.visible = r > .01;
      rabillo.scale.set(1, Math.max(.001, r), 1);
      rabillo.position.y = (1 - r) * 1.1;
    }
    return { malla, rabillo, actualizar };
  }

  function racimo(N, R, rnd) {
    const arriba = .96, altura = .84, Rmax = .27;
    const perfil = t => Rmax * Math.pow(1 - t, .72) * Math.pow(Math.min(1, t / .16), .5);
    const celda = 2 * R, rejilla = new Map(), pts = [];
    const clave = (x, y, z) => x + ',' + y + ',' + z;
    const ci = v => Math.floor(v / celda);
    let minD = 2 * R * .94, intentos = 0;
    while (pts.length < N) {
      intentos++;
      if (intentos > 2500) { minD *= .93; intentos = 0; }
      const t = rnd();
      const rt = perfil(t);
      if (rnd() > (rt * rt) / (Rmax * Rmax)) continue;
      const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * Math.max(0, rt - R * .5);
      const v = new THREE.Vector3(Math.cos(ang) * rr, arriba - t * altura, Math.sin(ang) * rr);
      const gx = ci(v.x), gy = ci(v.y), gz = ci(v.z);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx++) for (let dy = -1; dy <= 1 && ok; dy++) for (let dz = -1; dz <= 1 && ok; dz++) {
        const l = rejilla.get(clave(gx + dx, gy + dy, gz + dz));
        if (l) for (const o of l) { if (o.distanceToSquared(v) < minD * minD) { ok = false; break; } }
      }
      if (!ok) continue;
      pts.push(v);
      const k = clave(gx, gy, gz);
      if (!rejilla.has(k)) rejilla.set(k, []);
      rejilla.get(k).push(v);
      intentos = 0;
    }
    return pts;
  }

  function crearSombra() {
    const c = lienzo(256, 256), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.45, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.position.y = -.002; m.renderOrder = 0; m.frustumCulled = false;
    return m;
  }

  /* ---------- Carga del glTF de Poly Haven ---------- */
  async function cargarPolyHaven(res, alProgresar) {
    const urls = urlsModelo(res);
    const r = await fetch(urls.gltf, { mode: 'cors', credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + urls.gltf);
    const json = await r.json();
    // Rutas absolutas (Poly Haven guarda el .bin y las texturas en carpetas distintas)
    if (!MODELO_LOCAL) {
      json.buffers.forEach(b => { b.uri = urls.bin; });
      json.images.forEach(im => { im.uri = urls.tex(im.uri.split('/').pop()); });
    }
    // Las etiquetas originales se sustituyen: no hace falta descargar sus texturas
    json.materials.forEach(m => {
      if (!ETIQUETAS_ORIGINALES.test(m.name || '')) return;
      if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
      delete m.normalTexture;
    });
    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, hechos, total) => alProgresar(total ? hechos / total : 0);
    const loader = new GLTFLoader(manager);
    loader.setCrossOrigin('anonymous');
    return new Promise((ok, ko) => loader.parse(JSON.stringify(json), MODELO_LOCAL || '', ok, e => ko(new Error(errText(e)))));
  }
}

/* =========================================================
   Utilidades sin estado
   ========================================================= */
function urlsModelo(res) {
  if (MODELO_LOCAL) return { gltf: `${MODELO_LOCAL}wine_bottles_01_${res}.gltf`, bin: null, tex: f => `${MODELO_LOCAL}textures/${f}` };
  return {
    gltf: `${POLY_HAVEN}gltf/${res}/wine_bottles_01/wine_bottles_01_${res}.gltf`,
    bin: `${POLY_HAVEN}gltf/${res}/wine_bottles_01/wine_bottles_01.bin`,
    tex: f => `${POLY_HAVEN}jpg/${res}/wine_bottles_01/${f}`
  };
}

function conTiempo(promesa, ms) {
  return Promise.race([promesa, new Promise((_, ko) => setTimeout(() => ko(new Error('tiempo agotado (' + ms / 1000 + ' s)')), ms))]);
}

async function fuentesListas() {
  if (!document.fonts || !document.fonts.load) return;
  const espera = new Promise(r => setTimeout(r, 2500));
  try {
    await Promise.race([Promise.all(['800 64px Syne', '500 64px "JetBrains Mono"', '400 64px "JetBrains Mono"', 'italic 400 64px Newsreader'].map(f => document.fonts.load(f))), espera]);
  } catch (e) { /* se dibuja con la fuente de reserva */ }
}

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(2, w); c.height = Math.max(2, h); return c; }

// Radio exterior de la botella a cada altura, a partir de los anillos de vértices de la malla
function perfilDesdeMalla(malla) {
  const pos = malla.geometry.attributes.position, M = malla.matrixWorld, v = new THREE.Vector3(), anillos = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const k = Math.round(v.y * 400);
    const r = Math.hypot(v.x, v.z);
    if (!anillos.has(k) || anillos.get(k) < r) anillos.set(k, r);
  }
  const lista = Array.from(anillos.entries()).map(([k, r]) => [r, k / 400]).sort((a, b) => a[1] - b[1]);
  return interpolador(lista);
}
function tapaDesdeMalla(malla) {
  const pos = malla.geometry.attributes.position, M = malla.matrixWorld, v = new THREE.Vector3();
  let y = -1, r = 0;
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); if (v.y > y) y = v.y; }
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); if (v.y > y - .006) r = Math.max(r, Math.hypot(v.x, v.z)); }
  return { y, r };
}
// lista de [radio, altura] ordenada por altura → función radio(altura)
function interpolador(lista) {
  return (y) => {
    if (y <= lista[0][1]) return lista[0][0];
    for (let i = 1; i < lista.length; i++) {
      if (y <= lista[i][1]) {
        const [r0, y0] = lista[i - 1], [r1, y1] = lista[i];
        return y1 === y0 ? Math.max(r0, r1) : r0 + (r1 - r0) * (y - y0) / (y1 - y0);
      }
    }
    return lista[lista.length - 1][0];
  };
}

// Entorno de estudio: sala oscura con tiras de luz verticales (los reflejos largos del vidrio)
function estudio(pmrem) {
  const s = new THREE.Scene();
  const sala = new THREE.Mesh(new THREE.BoxGeometry(24, 16, 24), new THREE.MeshBasicMaterial({ color: 0x0c0d0f, side: THREE.BackSide }));
  s.add(sala);
  const tira = (w, h, x, y, z, intensidad, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensidad), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, y * .25, 0); s.add(m);
  };
  tira(1.6, 10, -7, .4, 3.5, 7, 0xfff1e2);    // principal, izquierda
  tira(.8, 10, 7.5, .4, 1.5, 4, 0xe6edff);    // recorte, derecha
  tira(.5, 9, 3.5, .4, 7, 2.2, 0xffffff);     // brillo fino frontal
  tira(9, 1.6, 0, 7.5, 0, 2.6, 0xffffff);     // cenital
  tira(6, 6, 0, 0, -10, .5, 0x7a1e2c);        // fondo granate muy tenue
  const tex = pmrem.fromScene(s, .02).texture;
  s.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

/* ---------- Etiquetas de LAJA (lienzo 2D) ---------- */
const LAJA_ICONO = 'M5 22.5L11 8.5l9.5-2.5 6.5 9-4 10.5-13 1.5z';

function dibujarEtiqueta(L, cfg, tema, arcoGrados) {
  const e = cfg.etiqueta;
  const W = L.color.width, H = L.color.height;
  const c = L.color.getContext('2d'), b = L.relieve.getContext('2d'), o = L.orm.getContext('2d');
  const rnd = azar(cfg.nodo.length * 97 + 11);
  // capas: color (W×H), relieve y ORM (mitad de resolución). orm: G = rugosidad, B = metal
  b.setTransform(.5, 0, 0, .5, 0, 0); o.setTransform(.5, 0, 0, .5, 0, 0);
  c.fillStyle = tema.papel; c.fillRect(0, 0, W, H);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
  o.fillStyle = 'rgb(0,160,0)'; o.fillRect(0, 0, W, H);

  // fibra del papel de algodón
  const fibra = lienzo(256, 256), fx = fibra.getContext('2d');
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    fx.fillStyle = v > .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
    fx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1);
  }
  c.fillStyle = c.createPattern(fibra, 'repeat'); c.fillRect(0, 0, W, H);
  b.fillStyle = b.createPattern(fibra, 'repeat'); b.fillRect(0, 0, W, H);

  // vetas de pizarra
  if (tema.vetas) {
    for (let i = 0; i < 9; i++) {
      const y = H * (.06 + i * .11 + (rnd() - .5) * .04), inc = (rnd() - .5) * H * .05;
      [c, b].forEach((ctx, k) => {
        ctx.strokeStyle = k ? 'rgba(170,170,170,1)' : 'rgba(236,232,225,.07)';
        ctx.lineWidth = H * (.002 + rnd() * .003);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(W * .3, y + inc, W * .6, y - inc, W, y + inc * .5); ctx.stroke();
      });
    }
  }

  const cx = W / 2;
  const frente = W * Math.min(1, 104 / arcoGrados);
  const texto = (ctx, str, x, y, size, font, color, espaciado) => {
    ctx.font = font.replace('{s}', Math.round(size) + 'px');
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) { ctx.letterSpacing = (espaciado || 0) * size + 'px'; ctx.fillText(str, x, y); ctx.letterSpacing = '0px'; }
    else if (espaciado) {
      const anchos = Array.from(str).map(ch => ctx.measureText(ch).width + espaciado * size);
      let xx = x - anchos.reduce((a, b2) => a + b2, 0) / 2;
      ctx.textAlign = 'left';
      Array.from(str).forEach((ch, i) => { ctx.fillText(ch, xx, y); xx += anchos[i]; });
      ctx.textAlign = 'center';
    } else ctx.fillText(str, x, y);
  };
  const MONO = '500 {s} "JetBrains Mono", ui-monospace, monospace';
  const MONO4 = '400 {s} "JetBrains Mono", ui-monospace, monospace';
  const SYNE = '800 {s} Syne, "Arial Black", sans-serif';
  const SERIF = 'italic 400 {s} Newsreader, Georgia, serif';

  // marco fino del frontal
  const mx = frente * .5;
  c.strokeStyle = tema.suave; c.lineWidth = Math.max(1, H * .003);
  c.strokeRect(cx - mx + H * .04, H * .04, mx * 2 - H * .08, H * .92);

  texto(c, 'D.O. RIBERA DEL GUADIANA', cx, H * .13, H * .034, MONO, tema.suave, .14);
  texto(c, 'CAÑAMERO · CÁCERES', cx, H * .185, H * .028, MONO4, tema.suave, .2);

  // icono de la laja en foil
  const icono = new Path2D(LAJA_ICONO);
  const tamI = H * .12;
  const dibujarIcono = (ctx, relleno, trazo) => {
    ctx.save(); ctx.translate(cx - tamI / 2, H * .225); ctx.scale(tamI / 32, tamI / 32);
    if (relleno) { ctx.fillStyle = relleno; ctx.fill(icono); }
    if (trazo) { ctx.strokeStyle = trazo; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke(icono); }
    ctx.restore();
  };
  dibujarIcono(c, tema.foil, null);
  dibujarIcono(b, '#c8c8c8', null);
  dibujarIcono(o, 'rgb(0,95,170)', null);

  // marca
  texto(c, 'LAJA', cx, H * .575, H * .2, SYNE, tema.tinta, -.03);
  texto(b, 'LAJA', cx, H * .575, H * .2, SYNE, '#ffffff', -.03);
  texto(o, 'LAJA', cx, H * .575, H * .2, SYNE, 'rgb(0,85,0)', -.03);
  c.fillStyle = tema.suave; c.fillRect(cx - frente * .2, H * .622, frente * .4, Math.max(1, H * .004));
  texto(c, e.uva, cx, H * .7, H * .044, MONO, tema.tinta, .3);
  texto(c, e.linea, cx, H * .785, H * .062, SERIF, tema.tinta, 0);
  texto(c, e.numero, cx, H * .87, H * .033, MONO, tema.foil, .12);
  texto(o, e.numero, cx, H * .87, H * .033, MONO, 'rgb(0,95,170)', .12);
  texto(b, e.numero, cx, H * .87, H * .033, MONO, '#b4b4b4', .12);

  // contraetiqueta (detrás) en etiquetas de vuelta completa
  if (arcoGrados >= 300) {
    const lineas = [
      'LAJA · ' + e.linea.toUpperCase(),
      'VINO DE PIZARRA DE CAÑAMERO',
      e.uva + ' DE CEPAS VIEJAS EN VASO',
      'VENDIMIA MANUAL NOCTURNA',
      '',
      'EMBOTELLADO POR BODEGA LAJA',
      'CAÑAMERO (CÁCERES) · ESPAÑA',
      'CONTIENE SULFITOS',
      '75 cl · ' + e.grado.toUpperCase()
    ];
    const dibujarDetras = (x0) => {
      lineas.forEach((t, i) => texto(c, t, x0, H * (.16 + i * .068), H * .032, MONO4, tema.suave, .08));
      // código de barras decorativo
      let bx = x0 - H * .17;
      for (let i = 0; i < 46; i++) { const w = H * (.004 + (i * 7 % 5) * .0022); c.fillStyle = tema.tinta; if (i % 3 !== 1) c.fillRect(bx, H * .84, w, H * .08); bx += w + H * .004; }
    };
    dibujarDetras(0); dibujarDetras(W);
  } else {
    texto(c, '75 cl', cx - frente * .26, H * .93, H * .026, MONO4, tema.suave, .1);
    texto(c, e.grado, cx + frente * .26, H * .93, H * .026, MONO4, tema.suave, .1);
  }
}

function dibujarCorcho(L) {
  const C = L.color.width, c = L.color.getContext('2d'), b = L.relieve.getContext('2d');
  const rnd = azar(49);
  b.setTransform(.5, 0, 0, .5, 0, 0);
  const g = c.createRadialGradient(C / 2, C / 2, C * .05, C / 2, C / 2, C * .5);
  g.addColorStop(0, '#C79D6E'); g.addColorStop(1, '#A57A4F');
  c.fillStyle = g; c.fillRect(0, 0, C, C);
  b.fillStyle = '#808080'; b.fillRect(0, 0, C, C);
  // grano
  for (let i = 0; i < C * 6; i++) {
    const x = rnd() * C, y = rnd() * C, r = C * (.0008 + rnd() * .0022), claro = rnd() > .55;
    c.fillStyle = claro ? 'rgba(222,186,140,.55)' : 'rgba(120,82,50,.45)';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    b.fillStyle = claro ? 'rgba(170,170,170,.6)' : 'rgba(80,80,80,.5)';
    b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
  }
  // lenticelas (poros alargados)
  for (let i = 0; i < 150; i++) {
    const x = rnd() * C, y = rnd() * C, w = C * (.004 + rnd() * .014), h = C * (.0015 + rnd() * .004), a = (rnd() - .5) * .6;
    [[c, 'rgba(86,56,32,.75)'], [b, 'rgba(30,30,30,.9)']].forEach(([ctx, col]) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }
  // marcado a fuego: icono, LAJA y texto en círculo
  const fuego = (ctx, col, blur) => {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = blur;
    ctx.fillStyle = col; ctx.strokeStyle = col;
    const s = C * .2;
    ctx.translate(C / 2 - s / 2, C * .25); ctx.scale(s / 32, s / 32);
    ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke(new Path2D(LAJA_ICONO));
    ctx.restore();
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.fillStyle = col;
    ctx.font = '800 ' + Math.round(C * .15) + 'px Syne, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('LAJA', C / 2, C * .63);
    ctx.font = '500 ' + Math.round(C * .045) + 'px "JetBrains Mono", monospace';
    const frase = 'CORCHO NATURAL · SIERRA DE SAN PEDRO · 2021 · ';
    const radio = C * .4;
    ctx.translate(C / 2, C / 2);
    const paso = (Math.PI * 2) / frase.length;
    for (let i = 0; i < frase.length; i++) {
      ctx.save(); ctx.rotate(i * paso - Math.PI / 2); ctx.translate(0, -radio); ctx.fillText(frase[i], 0, 0); ctx.restore();
    }
    ctx.restore();
  };
  fuego(c, 'rgba(58,32,18,.85)', C * .006);
  fuego(b, 'rgba(40,40,40,1)', C * .004);
  // borde biselado
  const gb = c.createRadialGradient(C / 2, C / 2, C * .42, C / 2, C / 2, C * .5);
  gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(40,24,12,.55)');
  c.fillStyle = gb; c.fillRect(0, 0, C, C);
}
