// PAALAAN! 3.0 – three.js-näkymä. Lukee simulaation tilan (Drive.sim) ja piirtää sen; ei muuta pelin tilaa.
import * as THREE from 'three';
import { loadManifest, initSky, busy, setTextureQuality, tex } from './assets.js';
import { Track, SEGM, HALF, CH, groundY, roadMaterial, rampMaterial, terrainMaterial, buildRoad, buildTerrain, buildRamp } from './world.js';
import { Env } from './env.js';
import { buildCar } from './cars.js';

const sim = Drive.sim, st = sim.st;
const canvas = document.getElementById('road');

// ---------- laatutasot ----------
const QUALITY = {
  low:  { dpr: 1,    shadow: 0,    range: 0,  draw: 6,  far: 60,  trees: 0.35, small: true,  aniso: 2, post: false, bloom: false, ao: false, blur: false, msaa: 0, carLod: 1, fx: 0.4 },
  med:  { dpr: 1.5,  shadow: 1024, range: 55, draw: 9,  far: 112, trees: 0.7,  small: false, aniso: 4, post: true,  bloom: true,  ao: false, blur: false, msaa: 2, carLod: 0, fx: 0.7 },
  high: { dpr: 2,    shadow: 2048, range: 70, draw: 13, far: 112, trees: 1,    small: false, aniso: 8, post: true,  bloom: true,  ao: true,  blur: true,  msaa: 4, carLod: 0, fx: 1 },
};
let setting = 'auto', level = 'med', Q = QUALITY.med;
const auto = { t: 0, frames: 0, locked: false, tried: {} };

let renderer, scene, camera, env, track, ready = false, failed = false, prepared = false;
const U = { // varjostimien yhteiset muuttujat
  wet: { value: 0 }, snow: { value: 0 }, paint: { value: 1 }, rampFlag: { value: 0 },
  roadNormal: new THREE.Vector2(1, 1), terrainNormal: new THREE.Vector2(0.7, 0.7),
  fieldMap: { value: null }, grassTint: { value: new THREE.Color(1, 1, 1) }, fieldTint: { value: new THREE.Color(1, 1, 1) }, forestTint: { value: new THREE.Color(1, 1, 1) },
};
const mats = {};
const origin = new THREE.Vector3();
const chunks = new Map();
const P = { x: 0, y: 0, z: 0, th: 0, slope: 0 }, P2 = { x: 0, y: 0, z: 0, th: 0, slope: 0 };
const car = { obj: null, name: '', yaw: 0, prevX: 0.5, pos: new THREE.Vector3() };
const cam = { th: 0, init: false, roll: 0, override: null };
let rampMesh = null, rampKey = '';
const stats = { fps: 0, acc: 0, n: 0, ms: 0 };

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { failed = true; Drive.fail(''); return; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, 16 / 10, 0.3, 1400);
  scene.add(camera);
  env = new Env(scene, camera);
  track = new Track(sim);
  initSky(renderer);
  loadManifest().then(() => {
    U.fieldMap.value = tex('nurmi', 'diff');
    mats.road = roadMaterial(U); mats.ramp = rampMaterial(U); mats.terrain = terrainMaterial(U);
    applyQuality();
    ready = true;
  }).catch(e => { failed = true; Drive.fail('Resurssien lataus ei onnistunut.'); console.error(e); });
  new ResizeObserver(resize).observe(canvas);
}

function resize() {
  if (!renderer) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}

function applyQuality() {
  Q = QUALITY[level];
  if (!ready && !mats.road) return;
  setTextureQuality(Q.small, Q.aniso);
  env.setShadow(Q.shadow, Q.range);
  for (const c of chunks.values()) disposeChunk(c);
  chunks.clear();
  resize();
}
function setQuality(s) {
  setting = s;
  level = s === 'auto' ? (auto.level || guess()) : s;
  auto.t = 0; auto.frames = 0;
  if (renderer) applyQuality();
}
// ensimmäinen arvaus ennen mittausta: kosketuslaite aloittaa matalalta
function guess() { return (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900) ? 'low' : 'med'; }

// ---------- kausi ----------
let seasonKey = '';
function applySeason() {
  const sea = sim.season(), wx = sim.weather(), S = sim.game();
  const key = S.m + ':' + (st.trip ? st.trip.road : '') + ':' + wx.kind;
  if (key === seasonKey) return;
  seasonKey = key;
  const m = sea.m, foggy = !sea.snow && (sea.autumn || sea.bare) && ((S.m * 7 + 3) % 5 < 3);
  env.set(env.pick(sea, wx, foggy));
  env.fogMul = wx.kind === 'lumi' ? 5.5 : wx.kind === 'sade' ? 3.2 : foggy ? 7 : 1;
  U.snow.value = sea.snow ? 1 : 0;
  U.wet.value = wx.kind === 'sade' ? 1 : sea.bare ? 0.45 : (!sea.snow && sea.temp <= 1) ? 0.25 : 0;
  U.paint.value = sea.snow ? 0.55 : 1;
  U.roadNormal.setScalar(wx.kind === 'sade' ? 0.35 : 1);
  // maan sävyt: kevät vaalea, kesä vihreä, ruska kellertävä, marraskuu ruskea
  const g = U.grassTint.value, f = U.fieldTint.value;
  if (sea.bare) { g.setRGB(0.95, 0.78, 0.5); f.setRGB(0.8, 0.7, 0.55); U.fieldMap.value = tex('multa', 'diff'); }
  else if (sea.autumn) { g.setRGB(1.15, 0.95, 0.55); f.setRGB(1.0, 0.92, 0.7); U.fieldMap.value = tex('kulo', 'diff'); }
  else if (m === 3 || m === 4) { g.setRGB(1.05, 1.08, 0.75); f.setRGB(0.9, 1.0, 0.6); U.fieldMap.value = tex('nurmi', 'diff'); }
  else { g.setRGB(0.85, 1.12, 0.7); f.setRGB(1.25, 1.35, 0.62); U.fieldMap.value = tex('nurmi', 'diff'); }
  U.forestTint.value.setRGB(0.8, 0.85, 0.7);
}

// ---------- lohkot ----------
function makeChunk(c) {
  const r = buildRoad(track, c);
  const group = new THREE.Group();
  const road = new THREE.Mesh(r.geometry, mats.road); road.receiveShadow = true;
  const ter = new THREE.Mesh(buildTerrain(track, c, sim, Q.far), mats.terrain); ter.receiveShadow = true;
  group.add(road, ter);
  group.position.copy(r.anchor).sub(origin);
  scene.add(group);
  return { c, group, anchor: r.anchor, geos: [r.geometry, ter.geometry] };
}
function disposeChunk(ch) { scene.remove(ch.group); ch.geos.forEach(g => g.dispose()); }
function updateChunks(cur, all) {
  const c0 = Math.max(0, Math.floor(cur / CH) - 1), c1 = c0 + Q.draw + 1;
  for (const [c, ch] of chunks) if (c < c0 || c > c1) { disposeChunk(ch); chunks.delete(c); }
  let built = 0;
  for (let c = c0; c <= c1; c++) if (!chunks.has(c)) { chunks.set(c, makeChunk(c)); if (!all && ++built >= 1) break; }
}
function updateRamp() {
  const r = st.ramp, key = r ? r.start + ':' + origin.x + ':' + origin.z : '';
  if (key === rampKey) return;
  rampKey = key;
  if (rampMesh) { scene.remove(rampMesh); rampMesh.geometry.dispose(); rampMesh = null; }
  if (!r) return;
  const b = buildRamp(track, r, sim);
  rampMesh = new THREE.Mesh(b.geometry, mats.ramp); rampMesh.receiveShadow = true;
  rampMesh.position.copy(b.anchor).sub(origin);
  scene.add(rampMesh);
}
function rebase(x, z) {
  const nx = Math.round(x / 256) * 256, nz = Math.round(z / 256) * 256;
  if (Math.abs(nx - origin.x) < 1024 && Math.abs(nz - origin.z) < 1024) return;
  origin.set(nx, 0, nz);
  for (const ch of chunks.values()) ch.group.position.copy(ch.anchor).sub(origin);
  cam.init = false;
}

// ---------- pelaajan auto ----------
function playerCar() {
  const v = st.veh;
  const name = v.bus ? 'Bussi' : v.name;
  if (car.obj && car.name === name) return;
  if (car.obj) scene.remove(car.obj.group);
  car.obj = buildCar(v.bus ? { b: 'bus', c: '#C8C24A' } : v.spec, { name, lod: Q.carLod });
  car.name = name;
  scene.add(car.obj.group);
}
// pelaajan sijainti maailmassa: f = segmentti, x = sivusuunta
function onRamp(f, x) { const r = st.ramp; return r && f >= r.start && f <= r.end + 2 && x > 0.84; }
function surfaceY(f, x) { return onRamp(f, x) ? (track.at(f, x, P2), P2.y - 0.02 * HALF + 0.015) : groundY(track, f, x); }

function frame(dt) {
  const t0 = performance.now();
  applySeason();
  const f = (st.pos + sim.PZ) / sim.SEG;
  track.at(f, st.x, P);
  rebase(P.x, P.z);
  updateChunks(f, false);
  updateRamp();
  playerCar();

  // auto: sijainti tiellä, kallistus mäen mukaan ja sortokulma sivuttaisliikkeestä
  const speed = st.speed / sim.SEG * SEGM; // m/s
  const vlat = dt > 0 ? (st.x - car.prevX) * HALF / dt : 0; car.prevX = st.x;
  const yawT = Math.max(-0.3, Math.min(0.3, Math.atan2(vlat, Math.max(6, speed))));
  car.yaw += (yawT - car.yaw) * Math.min(1, dt * 9);
  const y = surfaceY(f, st.x);
  car.pos.set(P.x - origin.x, y, P.z - origin.z);
  const g = car.obj.group;
  g.position.copy(car.pos);
  g.rotation.set(0, 0, 0); g.rotation.order = 'YXZ';
  g.rotation.y = -(P.th + car.yaw); g.rotation.x = Math.atan(P.slope);
  car.obj.update({ dt, speed, st, sim, yaw: car.yaw });

  // kamera: takaa ja yläviistosta, pehmeä seuranta, pieni kallistus mutkassa, tärähdys törmäyksessä
  const seg = sim.seg(Math.floor(f));
  const sp = Math.min(1, speed / 45);
  if (!cam.init) { cam.th = P.th; cam.init = true; cam.roll = 0; }
  cam.th += (P.th + car.yaw * 0.35 - cam.th) * Math.min(1, dt * 3.2 + (dt ? 0 : 1));
  const dist = 6.6 + sp * 1.2, h = 2.25 + sp * 0.25;
  const fx = Math.sin(cam.th), fz = -Math.cos(cam.th);
  let cx = car.pos.x - fx * dist, cz = car.pos.z - fz * dist, cy = car.pos.y + h - P.slope * dist * 0.6;
  const fb = f - dist / SEGM;
  if (fb > 0) cy = Math.max(cy, surfaceY(fb, st.x) + 1.1);
  const sh = st.shake > 0 ? st.shake : 0;
  camera.position.set(cx + (Math.random() - 0.5) * sh * 0.5, cy + (Math.random() - 0.5) * sh * 0.4, cz + (Math.random() - 0.5) * sh * 0.5);
  camera.up.set(0, 1, 0);
  camera.lookAt(car.pos.x + fx * 7, car.pos.y + 1.05 + P.slope * 7, car.pos.z + fz * 7);
  const rollT = -seg.curve * 0.011 * sp;
  cam.roll += (rollT - cam.roll) * Math.min(1, dt * 2.5);
  camera.rotateZ(cam.roll);
  const fov = 56 + sp * 7;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (cam.override) cam.override(camera, car, P);

  env.update(car.pos, env.fogMul || 1);
  renderer.render(scene, camera);

  // mittaus ja automaattinen laatutaso
  stats.ms = performance.now() - t0;
  if (dt > 0) { stats.acc += dt; stats.n++; if (stats.acc >= 1) { stats.fps = stats.n / stats.acc; stats.acc = 0; stats.n = 0; autoTune(); } }
}
// Auto: mitataan ruudunpäivitys ensimmäisten sekuntien aikana. Alle 28 fps pudottaa tason, yli 55 fps nostaa sitä kerran.
function autoTune() {
  if (setting !== 'auto' || auto.locked) return;
  auto.t++;
  if (auto.t < 3) return; // lataus ja varjostimien käännös tasaantuvat ensin
  const f = stats.fps, order = ['low', 'med', 'high'], i = order.indexOf(level);
  let next = level;
  if (f < 28 && i > 0) next = order[i - 1];
  else if (f > 55 && i < 2 && !auto.tried[order[i + 1]] && auto.t >= 5) next = order[i + 1];
  else if (auto.t >= 8) auto.locked = true;
  if (next !== level) {
    auto.tried[level] = true; if (order.indexOf(next) < i) auto.tried[next] = true, auto.locked = i - 1 === 0 || auto.tried[next];
    level = auto.level = next; auto.t = 0; applyQuality();
  }
}

const api = {
  ready() {
    if (failed) return false;
    if (!ready) return false;
    applySeason();
    if (!env.ready() || busy()) return false;
    if (!prepared) { const f = (st.pos + sim.PZ) / sim.SEG; track.at(f, st.x, P); rebase(P.x, P.z); updateChunks(f, true); prepared = true; }
    return true;
  },
  render(dt) { if (ready && !failed) frame(dt); },
  enter() { prepared = false; cam.init = false; seasonKey = ''; car.prevX = st.x; resize(); },
  leave() {},
  setQuality,
  autoLevel: () => level,
};

init();
if (!failed) Drive.attachView(api);
window.__gfx = { get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, track, cam, car, stats, U, env: () => env, level: () => level, chunks, origin, QUALITY };
