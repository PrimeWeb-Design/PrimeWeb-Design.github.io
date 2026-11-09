/* PrimeWeb Design – Entwurf 11 „Obsidian Gallery“ – WebGL-Hero (three.js 0.160.0) */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const hero = document.querySelector('.hero');
const canvas = document.getElementById('hero-canvas');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = window.matchMedia('(max-width: 760px)').matches;

function webglOk() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    // Software-Renderer (z. B. SwiftShader) erkennen: dann lieber den CSS-Fallback zeigen
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    if (/[?&]gl=1/.test(location.search)) return true; // Test: WebGL erzwingen
    return !/swiftshader|software|llvmpipe|basic render driver/i.test(String(renderer));
  } catch (e) { return false; }
}

if (!hero || !canvas || reduced || !webglOk()) {
  // Fallback bleibt sichtbar (CSS-Monolith)
} else {
  try {
    init();
  } catch (err) {
    console.warn('Hero 3D konnte nicht starten, Fallback bleibt aktiv.', err);
    hero.classList.remove('is-3d');
  }
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0.2, 10.5);

  // Umgebungslicht aus RoomEnvironment (PMREM)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  // Lichter: kühles Key-Licht links, goldene Kante rechts hinten
  const key = new THREE.DirectionalLight(0xcfd8ff, 1.6);
  key.position.set(-4, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd8b56a, 3.2);
  rim.position.set(5, 3, -4);
  scene.add(rim);
  const fill = new THREE.PointLight(0xd8b56a, 6, 12, 2);
  fill.position.set(2.6, -1.5, 2.5);
  scene.add(fill);

  // Monolith aus Obsidian-Glas
  const group = new THREE.Group();
  scene.add(group);

  const geo = new RoundedBoxGeometry(1.7, 3.9, 0.55, 7, 0.09);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0b0c12,
    metalness: 0.05,
    roughness: 0.14,
    transmission: small ? 0 : 0.92,
    thickness: 1.6,
    ior: 1.48,
    attenuationColor: new THREE.Color(0x3b3018),
    attenuationDistance: 1.6,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.5,
    specularIntensity: 1,
    specularColor: new THREE.Color(0xd8b56a),
    iridescence: 0.25,
    iridescenceIOR: 1.3
  });
  const monolith = new THREE.Mesh(geo, mat);
  group.add(monolith);

  // Goldene Lichtkante: dünner Leuchtstab hinter dem Glas (wird gebrochen)
  const barMat = new THREE.MeshBasicMaterial({ color: 0xead5a7 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 4.6, 0.035), barMat);
  bar.position.set(0.95, 0.1, -0.9);
  group.add(bar);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 3.2, 0.02), barMat);
  bar2.position.set(-1.05, -0.3, -0.7);
  group.add(bar2);

  // Feiner goldener Ring um den Monolithen
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.55, 0.012, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xd8b56a, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2.4;
  ring.rotation.y = 0.3;
  group.add(ring);

  // Platzierung: rechts der Headline auf dem Desktop, mittig-oben am Handy
  const place = () => {
    if (window.innerWidth < 760) { group.position.set(0.9, 2.4, 0); group.scale.setScalar(0.55); }
    else if (window.innerWidth < 1100) { group.position.set(2.2, 0.9, 0); group.scale.setScalar(0.85); }
    else { group.position.set(3.1, 0.55, 0); group.scale.setScalar(1); }
  };
  place();

  // Goldene Partikel
  const count = small ? 350 : 1600;
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 22;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    speed[i] = 0.08 + Math.random() * 0.25;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sprite = makeSprite();
  const pMat = new THREE.PointsMaterial({
    color: 0xd8b56a, size: small ? 0.07 : 0.055, map: sprite, transparent: true,
    opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  // Maus-Parallaxe
  const mouse = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Größe
  const resize = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    place();
  };
  resize();
  window.addEventListener('resize', resize);

  // Nur rendern, wenn der Hero sichtbar ist
  let visible = true;
  let running = false;
  const io = new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible && !running) loop(); }, { threshold: 0.02 });
  io.observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !running) loop(); });

  const clock = new THREE.Clock();
  function loop() {
    if (!visible || document.hidden) { running = false; return; }
    running = true;
    const t = clock.getElapsedTime();
    const dt = 0.016;

    monolith.rotation.y = t * 0.22;
    monolith.rotation.x = Math.sin(t * 0.35) * 0.09;
    monolith.rotation.z = Math.sin(t * 0.2) * 0.04;
    group.position.y += Math.sin(t * 0.7) * 0.0022;
    ring.rotation.z = t * 0.12;
    ring.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.3) * 0.15;
    bar.rotation.y = -t * 0.22;

    // Partikel driften langsam aufwärts
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speed[i] * dt * 0.6;
      arr[i * 3] += Math.sin(t * 0.5 + i) * 0.0006;
      if (arr[i * 3 + 1] > 6.5) arr[i * 3 + 1] = -6.5;
    }
    pGeo.attributes.position.needsUpdate = true;
    points.rotation.y = t * 0.012;

    target.x += (mouse.x * 0.75 - target.x) * 0.04;
    target.y += (-mouse.y * 0.45 - target.y) * 0.04;
    camera.position.x = target.x;
    camera.position.y = 0.2 + target.y;
    camera.lookAt(0.6, 0.3, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // Erster Frame, dann Canvas einblenden
  renderer.render(scene, camera);
  hero.classList.add('is-3d');
  loop();
}

function makeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.35, 'rgba(234,213,167,0.7)');
  g.addColorStop(1, 'rgba(216,181,106,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
