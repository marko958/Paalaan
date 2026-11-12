// PAALAAN! 3.0 – three.js-näkymä. Lukee simulaation tilan (Drive.sim) ja piirtää sen; ei muuta pelin tilaa.
import * as THREE from 'three';
import { loadManifest, initSky, busy, setTextureQuality, tex } from './assets.js';
import { Track, SEGM, HALF, CH, groundY, roadMaterial, rampMaterial, terrainMaterial, buildRoad, buildTerrain, buildRamp } from './world.js';
import { Env } from './env.js';
import { buildCar, setCarWeather } from './cars.js';
import { makeTrees } from './trees.js';
import { makeProps } from './props.js';
import { buildScenery, setLod, disposeScenery, footprints, signature } from './scenery.js';
import { canvasTex, rng, avgColor } from './assets.js';
import { Dyn } from './dyn.js';
import { Weather, Puffs } from './fx.js';
import { Post } from './post.js';

const sim = Drive.sim, st = sim.st;
const canvas = document.getElementById('road');

// ---------- laatutasot ----------
const QUALITY = {
  low:  { dpr: 1.5,    shadow: 0,    range: 0,  near: 1, draw: 6,  far: 60,  trees: 0.35, small: true,  aniso: 2, post: false, bloom: false, ao: false, blur: false, msaa: 0, carLod: 1, fx: 0.4 },
  med:  { dpr: 2,  shadow: 1024, range: 55, near: 2, draw: 9,  far: 112, trees: 0.7,  small: false, aniso: 4, post: true,  bloom: true,  ao: false, blur: false, msaa: 2, carLod: 0, fx: 0.7 },
  high: { dpr: 2,    shadow: 2048, range: 70, near: 3, draw: 13, far: 112, trees: 1,    small: false, aniso: 8, post: true,  bloom: true,  ao: true,  blur: true,  msaa: 4, carLod: 0, fx: 1 },
};
let setting = 'auto', level = 'med', Q = QUALITY.med;
const auto = { t: 0, locked: false, from: '', noUp: false, level: '' };

let renderer, scene, camera, env, track, ready = false, failed = false, prepared = false;
const U = { // varjostimien yhteiset muuttujat
  wet: { value: 0 }, snow: { value: 0 }, paint: { value: 1 }, rampFlag: { value: 0 },
  roadNormal: new THREE.Vector2(1, 1), terrainNormal: new THREE.Vector2(0.7, 0.7),
  fieldMap: { value: null }, grassTint: { value: new THREE.Color(1, 1, 1) }, fieldTint: { value: new THREE.Color(1, 1, 1) }, forestTint: { value: new THREE.Color(1, 1, 1) },
};
const mats = {};
let dyn = null, weather = null, puffs = null, post = null, usePost = false;
let T = null, PR = null, backdrop = null, floor = null, fps = [], roadKind = '';
const origin = new THREE.Vector3();
const chunks = new Map();
const P = { x: 0, y: 0, z: 0, th: 0, slope: 0 }, P2 = { x: 0, y: 0, z: 0, th: 0, slope: 0 };
const car = { obj: null, name: '', key: '', yaw: 0, vlat: 0, slope: 0, prevX: 0.5, pos: new THREE.Vector3(), v: 0 };
const lamps = { group: new THREE.Group(), spot: null };
const FELL_TINT = new THREE.Color(0.2, 0.24, 0.34);
const cam = { th: 0, init: false, roll: 0, override: null, lag: 0.5, y: null };
let rampMesh = null, rampKey = '';
const stats = { fps: 0, acc: 0, n: 0, ms: 0 };
const fxState = { snow: false, cold: false, wet: false, acc: 0 };

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
  // ajovalojen keila: yksi leveä kohdevalo keulassa (pimeinä kuukausina)
  lamps.spot = new THREE.SpotLight(0xfff1dc, 0, 120, 0.5, 0.8, 1.35);
  lamps.spot.position.set(0, 0, 0); lamps.spot.target.position.set(0, -0.62, -30);
  lamps.group.add(lamps.spot, lamps.spot.target);
  // täytevalo pimeällä: heikko viileä valo auton takana ja yläpuolella, jotta oma auto ei ole musta siluetti
  lamps.fill = new THREE.PointLight(0xc4d2ff, 0, 13, 2);
  scene.add(lamps.fill);
  track = new Track(sim);
  initSky(renderer);
  loadManifest().then(() => {
    Q = QUALITY[level]; setTextureQuality(Q.small, Q.aniso); // tekstuurikoko ennen ensimmäistä latausta
    U.fieldMap.value = tex('nurmi', 'diff');
    mats.road = roadMaterial(U); mats.ramp = rampMaterial(U); mats.terrain = terrainMaterial(U);
    T = makeTrees(); PR = makeProps(U); makeBackdrop();
    dyn = new Dyn({ scene, track, sim, st, origin });
    weather = new Weather(scene); puffs = new Puffs(scene); post = new Post(renderer, scene, camera);
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
  if (post) usePost = post.setup(Q, w, h, renderer.getPixelRatio());
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
  auto.t = 0; auto.locked = false; auto.from = ''; auto.noUp = false;
  if (renderer) applyQuality();
}
// ensimmäinen arvaus ennen mittausta: kosketuslaite aloittaa matalalta
function guess() { return (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900) ? 'low' : 'med'; }

// ---------- kausi ----------
let seasonKey = '';
function applySeason() {
  const sea = sim.season(), wx = sim.weather(), S = sim.game();
  const key = S.m + ':' + (st.trip ? st.trip.road : '') + ':' + wx.kind + ':' + sim.towing();
  if (key === seasonKey) return;
  seasonKey = key;
  roadKind = st.trip ? st.trip.road || '' : '';
  const m = sea.m, foggy = !sea.snow && (sea.autumn || sea.bare) && ((S.m * 7 + 3) % 5 < 3);
  env.set(env.pick(sea, wx, foggy));
  env.fogMul = wx.kind === 'lumi' ? 5.5 : wx.kind === 'sade' ? 3.2 : foggy ? 7 : 1;
  weather.set(wx.kind, Q.fx, sea.dark);
  fxState.snow = sea.snow; fxState.cold = sea.temp <= 0; fxState.wet = wx.kind === 'sade';
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
  // autojen lika: talvella suolaa ja kuraa helmoissa, marraskuussa kuraa, sateella pisarat ja kiilto
  setCarWeather(sea.snow ? 0.85 : sea.bare ? 0.6 : wx.kind === 'sade' ? 0.3 : sea.autumn ? 0.2 : 0.06, sea.snow ? [0.62, 0.6, 0.57] : [0.26, 0.22, 0.17], wx.kind === 'sade' ? 1 : 0);
  T.applySeason(sea, roadKind);
  env.nightWant = sea.dark > 0.6 ? 1 : sea.dark > 0 ? 0.45 : 0;
  PR.applySeason(sea, env.nightWant);
  for (const ch of chunks.values()) { ch.sc.snowObjs.forEach(o => { o.visible = sea.snow; }); refreshSigns(ch); }
  // kaukometsä ja maan jatke
  const lap = roadKind === 'lappi' || roadKind === 'kuusamo';
  backdrop.material.map = lap ? backdrop.userData.fell : backdrop.userData.forest;
  backdrop.material.color.copy(sea.snow ? new THREE.Color(0.62, 0.66, 0.72) : sea.autumn ? new THREE.Color(0.2, 0.19, 0.1) : sea.bare ? new THREE.Color(0.13, 0.12, 0.1) : new THREE.Color(0.1, 0.17, 0.09));
  if (lap) backdrop.material.color.setRGB(0.42, 0.47, 0.58); // lumiset tunturit sinisenharmaina, jotta ne erottuvat vaaleasta taivaasta
  backdrop.userData.lap = lap;
  const fogOn = !(lap && !wx.kind); // selkeällä säällä tunturit erottuvat terävinä, sateessa ne häviävät sumuun
  if (backdrop.material.fog !== fogOn) { backdrop.material.fog = fogOn; backdrop.material.needsUpdate = true; }
  floor.material.color.copy(sea.snow ? new THREE.Color(0.8, 0.82, 0.86) : avgColor(sea.bare ? 'multa' : 'metsa').multiplyScalar(0.8));
}
function refreshSigns(ch) { for (const s of ch.sc.signs) s.face.material = PR.limitMat(sim.limTxt(sim.limitOf(s.lim))); }
// kaukometsä: kameraa seuraava rengas, jossa on puiden siluetti; Lapissa tunturit
function makeBackdrop() {
  const sil = (seed, fell) => canvasTex(2048, 256, (g, W, H) => {
    const r = rng(seed); g.clearRect(0, 0, W, H); g.fillStyle = '#fff';
    if (fell) {
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) { const t = x / W * 6.28318; g.lineTo(x, H * (0.62 - 0.22 * Math.sin(t * 2 + 1) * Math.sin(t * 3) - 0.14 * Math.sin(t * 5 + 2) - 0.05 * Math.sin(t * 13))); }
      g.lineTo(W, H); g.fill();
    } else {
      for (let x = -10; x < W + 10; x += 5 + r() * 9) { const h = H * (0.35 + r() * 0.5), w = 7 + r() * 9; g.beginPath(); g.moveTo(x - w, H); g.lineTo(x, H - h); g.lineTo(x + w, H); g.fill(); }
      g.fillRect(0, H * 0.72, W, H * 0.28);
    }
  });
  const forest = sil(3, false), fell = sil(8, true);
  const geo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true);
  const mat = new THREE.MeshBasicMaterial({ map: forest, alphaTest: 0.5, side: THREE.BackSide, color: 0x16240f, fog: true });
  forest.repeat.set(6, 1); fell.repeat.set(1, 1);
  backdrop = new THREE.Mesh(geo, mat); backdrop.userData = { forest, fell }; backdrop.frustumCulled = false;
  scene.add(backdrop);
  floor = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x223018, fog: true }));
  floor.rotation.x = -Math.PI / 2; floor.frustumCulled = false; scene.add(floor);
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
  const ch = { c, group, anchor: r.anchor, geos: [r.geometry, ter.geometry], sc: null, sig: '' };
  scenerize(ch);
  return ch;
}
function scenerize(ch) {
  if (ch.sc) { ch.group.remove(ch.sc.group); disposeScenery(ch.sc); }
  ch.sig = signature(ch.c, st, sim, roadKind, fps);
  ch.sc = buildScenery(ch.c, { track, sim, st, T, P: PR, Q, road: roadKind, fps, anchor: ch.anchor });
  ch.group.add(ch.sc.group);
  const snow = sim.season().snow;
  ch.sc.snowObjs.forEach(o => { o.visible = snow; });
}
function disposeChunk(ch) { scene.remove(ch.group); ch.geos.forEach(g => g.dispose()); if (ch.sc) disposeScenery(ch.sc); }
let sigTick = 0;
function updateChunks(cur, all) {
  const c0 = Math.max(0, Math.floor(cur / CH) - 1), c1 = c0 + Q.draw + 1;
  for (const [c, ch] of chunks) if (c < c0 || c > c1) { disposeChunk(ch); chunks.delete(c); }
  let built = 0;
  for (let c = c0; c <= c1; c++) if (!chunks.has(c)) { chunks.set(c, makeChunk(c)); if (!all && ++built >= 1) break; }
  // simulaatio voi raivata puita taulun tai liikkeen edestä ja tuoda liittymän: muuttunut lohko rakennetaan uudelleen
  if (all || ++sigTick % 6 === 0) {
    fps = footprints(st, sim);
    for (const ch of chunks.values()) if (signature(ch.c, st, sim, roadKind, fps) !== ch.sig) { scenerize(ch); if (!all) break; }
  }
  for (const [c, ch] of chunks) setLod(ch.sc, c - c0 <= Q.near);
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
  const ox = origin.x, oz = origin.z;
  origin.set(nx, 0, nz);
  for (const ch of chunks.values()) ch.group.position.copy(ch.anchor).sub(origin);
  if (dyn) dyn.rebase();
  if (puffs) puffs.shift(ox - origin.x, 0, oz - origin.z);
  cam.init = false;
}

// ---------- pelaajan auto ----------
function playerCar() {
  const v = st.veh, S = sim.game();
  const name = v.bus ? 'Bussi' : v.name;
  const src = v.car || (v.tsa ? S.tsa : null);
  const type = v.bus || v.rental ? 'b' : src ? sim.carOf(src.c).type : 'b';
  // peräkärry: autotraileri romukeikoilla, muuten laatikkokärry (kuten 2.0:ssa: näkyy, kun kärry on käytössä)
  const tow = !v.bus && !v.tsa && sim.towing() ? ((typeof TT === 'function' && typeof TRAILERS !== 'undefined' && S.trailer && TT() === TRAILERS.auto) ? 'romu' : 'muutto') : '';
  const key = [name, v.mb || 0, (v.car && v.car.dent) || 0, v.box ? 1 : 0, tow, Q.carLod].join('|');
  if (car.obj && car.key === key) return;
  if (car.obj) { scene.remove(car.obj.group); disposeCar(car.obj); }
  car.obj = buildCar(v.bus ? { b: 'bus', c: '#C8C24A', tl: 'wide' } : v.spec, { name, lod: 0, detail: Q.carLod === 0, type, mb: v.mb || 0, dent: (v.car && v.car.dent) || 0, box: !!v.box, tow });
  car.key = key; car.name = name;
  car.obj.group.add(lamps.group);
  lamps.group.position.set(0, 0.72, car.obj.mid - car.obj.S.L + 0.3);
  scene.add(car.obj.group);
}
function disposeCar(o) { o.group.traverse(m => { if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); }); }
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
  car.vlat += (vlat - car.vlat) * Math.min(1, dt * 8); // sivuttaisnopeus suodatettuna (ruudunpäivityksen vaihtelu ei heiluta autoa)
  const yawT = Math.max(-0.22, Math.min(0.22, Math.atan2(car.vlat, Math.max(8, speed))));
  car.yaw += (yawT - car.yaw) * Math.min(1, dt * 6);
  const y = surfaceY(f, st.x), seg0 = sim.seg(Math.floor(f));
  car.pos.set(P.x - origin.x, y, P.z - origin.z);
  const g = car.obj.group;
  g.position.copy(car.pos);
  g.rotation.set(0, 0, 0); g.rotation.order = 'YXZ';
  car.slope += (P.slope - car.slope) * Math.min(1, dt * 6 + (dt ? 0 : 1));
  g.rotation.y = -(P.th + car.yaw); g.rotation.x = Math.atan(car.slope);
  { const G = st.gig, cargo = !!((G && G.phase === 'deliver' && (G.kind === 'romu' || G.kind === 'muutto')) || (st.trip && st.trip.trailer));
    const lat = seg0.curve * 0.0014 * speed * speed * 0.6 + car.vlat * 1.2;
    car.obj.update({ dt, speed, brake: !!st.keys.brake && !st.veh.bus, steer: st.steerIn || 0, lat, night: env.nightWant || 0, charge: !!(st.chg && !st.chg.broken && !(st.chg.q > 0)), cargo, rough: (st.x < -1 || st.x > 1) && !onRamp(f, st.x) ? 2.5 : 0 }); }
  dyn.update(dt, st.pos + sim.PZ, car.pos, P.th, env.nightWant || 0, st.flash);
  PR.camFlash.emissiveIntensity = st.flash > 0.55 ? st.flash * 10 : 0; // vain kameran salama (0.8), ei törmäyksen välähdys (0.5)
  if (lamps.fill) {
    const n = env.nightWant || 0, bx = -Math.sin(P.th), bz = Math.cos(P.th);
    // valo auton yläpuolella hieman perän puolella: valaisee katon, kyljet ja perän, mutta heijastus lasista ei osu kameraan
    // valo auton takana viistosti sivulla (kuin kuunvalo): valaisee perän ja kyljen, mutta peilautuu takalasista sivuun eikä kameraan
    const rx = Math.cos(P.th), rz = Math.sin(P.th), back = car.obj.mid + 3.2;
    lamps.fill.position.set(car.pos.x + bx * back - rx * 3.6, car.pos.y + car.obj.S.H + 0.9, car.pos.z + bz * back - rz * 3.6);
    lamps.fill.intensity = n > 0.6 ? 10 : n > 0.3 ? 5 : 0;
  }
  if (lamps.spot) lamps.spot.intensity = (env.nightWant || 0) > 0.3 ? 420 * (env.nightWant > 0.6 ? 1 : 0.6) : 0;

  // kamera: takaa ja yläviistosta, pehmeä seuranta, pieni kallistus mutkassa, tärähdys törmäyksessä
  const seg = seg0;
  const sp = Math.min(1, speed / 45);
  if (!cam.init) { cam.th = P.th; cam.init = true; cam.roll = 0; cam.lag = st.x; cam.y = null; }
  cam.th += (P.th + car.yaw * 0.2 - cam.th) * Math.min(1, dt * 3.2);
  const tr = car.obj.trailer ? (car.obj.trailer.kind === 'romu' ? 5.2 : 3.4) : 0; // kärryn kanssa kamera kauempaa ja korkeammalta
  // etäisyys lasketaan auton perästä ja korkeus auton korkeudesta, jotta bussi ja paku eivät peitä näkymää
  const big = Math.max(0, car.obj.S.H - 1.7);
  const dist = car.obj.mid + 3.5 + sp * 0.7 + tr + big * 4.2, h = 2.0 + sp * 0.2 + tr * 0.22 + big * 2.3;
  const fx = Math.sin(cam.th), fz = -Math.cos(cam.th);
  // kamera seuraa sivusuunnassa viiveellä: auto liikkuu ruudulla, maailma ei nyi
  cam.lag += (st.x - cam.lag) * Math.min(1, dt * 3.2 + (dt ? 0 : 0));
  const lagM = Math.max(-5, Math.min(5, (cam.lag - st.x) * HALF)), rx = Math.cos(cam.th), rz = Math.sin(cam.th);
  let cx = car.pos.x - fx * dist + rx * lagM * 0.8, cz = car.pos.z - fz * dist + rz * lagM * 0.8, cy = car.pos.y + h - P.slope * dist * 0.6;
  const fb = f - dist / SEGM;
  if (fb > 0) cy = Math.max(cy, surfaceY(fb, st.x) + 1.1);
  const sh = st.shake > 0 ? st.shake : 0;
  cam.y = cam.y === null || cam.y === undefined ? cy : cam.y + (cy - cam.y) * Math.min(1, dt * 5); cy = cam.y; // korkeus pehmennettynä
  camera.position.set(cx + (Math.random() - 0.5) * sh * 0.5, cy + (Math.random() - 0.5) * sh * 0.4, cz + (Math.random() - 0.5) * sh * 0.5);
  camera.up.set(0, 1, 0);
  camera.lookAt(car.pos.x + fx * 7 + rx * lagM * 0.35, cy - h + 1.05 + big * 0.9 + P.slope * 7, car.pos.z + fz * 7 + rz * lagM * 0.35);
  const rollT = -seg.curve * 0.011 * sp;
  cam.roll += (rollT - cam.roll) * Math.min(1, dt * 2.5);
  camera.rotateZ(cam.roll);
  const fov = 56 + sp * 7;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (cam.override) cam.override(camera, car, P);

  env.update(car.pos, env.fogMul || 1);
  const R = Q.draw * CH * 0.93;
  const bh = backdrop.userData.lap ? 0.22 : 0.09; // tunturit nousevat metsänrajaa korkeammalle
  // tunturien väri taivaanrannasta tummennettuna, jotta ne erottuvat päivällä, hämärässä ja kaamoksessa
  if (backdrop.userData.lap) backdrop.material.color.copy(env.fogColor).multiplyScalar(0.36).lerp(FELL_TINT, 0.15);
  backdrop.position.set(camera.position.x, car.pos.y + R * bh / 2 - 6, camera.position.z); backdrop.scale.set(R, R * bh, R);
  floor.position.set(camera.position.x, car.pos.y - 7, camera.position.z); floor.scale.setScalar(R * 1.02);
  // hiukkaset: pöllyävä lumi ja vesisumu renkaista, pakokaasun höyry pakkasella, vian savu, pöly pientareella
  if (dt > 0) {
    fxState.acc += dt;
    const o = car.obj, th = P.th + car.yaw, bx = -Math.sin(th), bz = Math.cos(th), rx = Math.cos(th), rz = Math.sin(th);
    const rear = o.mid + 0.1, off = (st.x < -1 || st.x > 1) && !onRamp(f, st.x);
    const at = (side, back, h) => [car.pos.x + rx * side + bx * back, car.pos.y + h, car.pos.z + rz * side + bz * back];
    while (fxState.acc > 0.03) {
      fxState.acc -= 0.03;
      const kmh = speed * 3.6, hw = o.S.W * 0.42;
      if (!st.veh.bus || true) {
        // pöllyävä lumi ja vesisumu: ilmavirta kuljettaa pölyä auton mukana, joten se jää perään matalaksi verhoksi eikä lennä kameraan
        if ((fxState.snow || fxState.wet) && kmh > 35 && Math.random() < Q.fx) for (const s of [-1, 1]) { const p = at(s * hw * (0.6 + Math.random() * 0.4), rear - 0.25, 0.18), c = fxState.snow ? [0.92, 0.94, 0.98] : [0.7, 0.74, 0.8], fw = -speed * 0.82; puffs.emit(p[0], p[1], p[2], bx * fw + rx * s * (0.4 + Math.random() * 0.6), 0.35 + Math.random() * 0.45, bz * fw + rz * s * (0.4 + Math.random() * 0.6), 0.16, c, fxState.snow ? 0.2 : 0.1, 0.55 + Math.random() * 0.35, 1.3); }
        if (off && kmh > 20 && !fxState.snow && Math.random() < 0.7) { const p = at((Math.random() - 0.5) * 1.4, rear - 0.2, 0.2); puffs.emit(p[0], p[1], p[2], bx * 1.5, 0.8, bz * 1.5, 0.6, [0.5, 0.42, 0.32], 0.3, 1.1, 2.2); }
        if (o.exhaust && fxState.cold && Math.random() < 0.5) { const p = at(o.exhaust.x, rear + 0.05, o.exhaust.y + 0.02); puffs.emit(p[0], p[1], p[2], bx * 1.2, 0.5, bz * 1.2, 0.16, [0.95, 0.95, 0.97], 0.3, 1.0, 0.9); }
        if (st.veh.minor && Math.random() < 0.55) { const p = at(-hw * 0.6, rear, 0.35); puffs.emit(p[0], p[1], p[2], bx * 1.0 + (Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, bz * 1.0, 0.22, [0.2, 0.2, 0.21], 0.5, 1.6, 0.9); }
      }
    }
  }
  puffs.update(dt);
  weather.update(dt, camera);
  if (!usePost || !post.render(speed, env.nightWant || 0)) renderer.render(scene, camera);

  // mittaus ja automaattinen laatutaso
  stats.ms = performance.now() - t0;
  if (dt > 0) { stats.acc += dt; stats.n++; if (stats.acc >= 1) { stats.fps = stats.n / stats.acc; stats.acc = 0; stats.n = 0; autoTune(); } }
}
// Auto: ruudunpäivitys mitataan sekunnin jaksoissa ajon ensimmäisten sekuntien aikana.
// Alle 27 fps pudottaa tasoa. Yli 56 fps nostaa tasoa kerran; jos uusi taso jää alle 45 fps:n, palataan ja lukitaan.
function autoTune() {
  if (setting !== 'auto' || auto.locked) return;
  auto.t++;
  if (auto.t < 3) return; // lataus ja varjostimien käännös tasaantuvat ensin
  const f = stats.fps, order = ['low', 'med', 'high'], i = order.indexOf(level);
  let next = level;
  if (auto.from && f < 45) { next = auto.from; auto.locked = true; }
  else if (f < 27 && i > 0) { next = order[i - 1]; auto.noUp = true; }
  else if (f > 56 && i < 2 && !auto.noUp && !auto.from && auto.t >= 5) { next = order[i + 1]; auto.from = level; }
  else if (auto.t >= 10) auto.locked = true;
  if (next !== level) { level = auto.level = next; auto.t = 0; applyQuality(); }
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
  render(dt) { if (ready && !failed && !dbg.freeze) frame(dt); },
  enter() { prepared = false; cam.init = false; seasonKey = ''; car.prevX = st.x; if (dyn) dyn.clear(); resize(); },
  leave() {},
  setQuality,
  autoLevel: () => level,
};

init();
if (!failed) Drive.attachView(api);
// testejä ja lähikuvia varten: kamera kiertämään autoa (az = 0 takaa, el = korkeuskulma, d = etäisyys)
function orbit(az, el, d, h = 0.7) {
  cam.override = az === null ? null : (camera, car, P) => {
    const a = P.th + Math.PI + az, c = Math.cos(el);
    camera.position.set(car.pos.x + Math.sin(a) * d * c, car.pos.y + h + Math.sin(el) * d, car.pos.z - Math.cos(a) * d * c);
    camera.up.set(0, 1, 0); camera.lookAt(car.pos.x, car.pos.y + h, car.pos.z);
    if (camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); }
  };
}
const dbg = { freeze: false };
window.__gfx = { orbit, dbg, dyn: () => dyn, get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; }, track, cam, car, stats, U, env: () => env, level: () => level, chunks, origin, QUALITY };
