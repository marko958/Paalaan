// PAALAAN! 3.0 – autot: kori (carbody.js), pyörät, valot ja varusteet sekä auton liike (jousitus, pyörät, valot).
// Kaikki mallit syntyvät koodissa samasta parametrisesta korista. Mallit erottuvat mittasuhteista ja valosignatuurista;
// logoja tai merkkien tunnuksia ei ole.
import * as THREE from 'three';
import { shapeOf, buildBody, surface, BODY } from './carbody.js';
import { makeWheel, wheelStyleFor, mergeGeos, lampTex, plateTex, grilleTex, blobTex, dropsTex, blobShadow, flakeTex } from './carparts.js';

// Mallikohtaiset mittasuhteet (metreinä) ja piirteet. Avaimet ovat samat kuin korityypin mitat (carbody.js).
// front = etuvalojen signatuuri, rim = vanne, doors = ovien määrä.
export const TWEAK = {
  'Ford Mondeo':        { L: 4.73, H: 1.43, nose: 0.72, hDeck: 1.05, deck: 0.5, front: 'slim', rim: 'steel', solid: 0 },
  'Opel Astra':         { L: 4.25, H: 1.46, gate: 0.36, front: 'slim', rim: 'spoke5' },
  'Toyota Avensis':     { L: 4.70, H: 1.48, hDeck: 1.08, front: 'slim', rim: 'multi' },
  'Toyota Prius':       { front: 'tri', rim: 'aero' },
  'Volvo V70':          { L: 4.82, H: 1.50, gate: 0.14, tumble: 0.26, bowT: 0.08, bowN: 0.15, belt: 0.96, front: 'hammer', rim: 'spoke5' },
  'VW Passat':          { L: 4.77, gate: 0.24, front: 'slim', rim: 'multi' },
  'Audi A6':            { L: 4.93, wb: 2.91, H: 1.45, nose: 0.74, front: 'split', rim: 'twin5' },
  'BMW 530d':           { L: 4.91, wb: 2.97, fo: 0.82, cowl: 0.5, H: 1.46, front: 'quad', rim: 'twin5' },
  'Mitsubishi Outlander': { L: 4.66, H: 1.68, front: 'slim', rim: 'spoke5' },
  'Nissan Leaf':        { L: 4.45, H: 1.55, nose: 0.78, gate: 0.4, bowN: 0.3, front: 'round', rim: 'aero' },
  'Renault Zoe':        { L: 4.08, W: 1.73, H: 1.56, wb: 2.59, fo: 0.82, bowN: 0.3, front: 'slim', rim: 'aero' },
  'VW e-Golf':          { L: 4.27, H: 1.45, gate: 0.3, tumble: 0.3, front: 'slim', rim: 'aero' },
  'BMW i3':             { L: 4.0, W: 1.78, H: 1.58, wb: 2.57, R: 0.345, tw: 0.16, gate: 0.14, beltR: 1.12, front: 'slim', rim: 'dark-aero', blackPillars: 1 },
  'Hyundai Ioniq 5':    { L: 4.64, W: 1.89, H: 1.60, wb: 3.0, fo: 0.85, R: 0.36, gate: 0.42, tumble: 0.3, bowN: 0.12, bowT: 0.08, rs: 0.025, haunch: 0.02, belt: 1.02, nose: 0.86, hCowl: 1.1, front: 'pixel', rim: 'turbine', clad: 1 },
  'Hyundai Ioniq':      { front: 'slim', rim: 'aero' },
  'Hyundai Kona':       { L: 4.2, W: 1.8, H: 1.57, wb: 2.6, front: 'split', rim: 'spoke5' },
  'Kia e-Soul':         { L: 4.2, W: 1.8, H: 1.6, wb: 2.6, gate: 0.1, front: 'bar', rim: 'spoke5', blackPillars: 1 },
  'Kia e-Niro':         { L: 4.38, W: 1.8, H: 1.56, wb: 2.7, front: 'slim', rim: 'aero' },
  'Kia EV6':            { L: 4.68, W: 1.88, H: 1.55, wb: 2.9, front: 'slim', rim: 'turbine' },
  'Peugeot e-208':      { L: 4.06, W: 1.75, H: 1.43, wb: 2.54, front: 'tri', rim: 'twin5' },
  'Dacia Spring':       { L: 3.73, W: 1.58, H: 1.52, wb: 2.42, gc: 0.19, R: 0.28, front: 'split', rim: 'steel', clad: 1 },
  'Fiat Topolino':      { L: 2.53, W: 1.40, H: 1.53, wb: 1.73, fo: 0.42, R: 0.26, tw: 0.13, gc: 0.16, nose: 0.82, hCowl: 0.95, cowl: 0.1, ws: 0.5, gate: 0.14, noseLen: 0.13, tailLen: 0.1, bowN: 0.22, bowT: 0.2, roofR: 0.22, front: 'round', rim: 'steel', doors: 2 },
  'Fiat 500e':          { L: 3.63, W: 1.68, H: 1.53, wb: 2.32, bowN: 0.32, bowT: 0.2, gate: 0.3, nose: 0.8, front: 'round', rim: 'multi', doors: 2 },
  'MG4':                { L: 4.29, W: 1.84, H: 1.50, wb: 2.71, nose: 0.68, hCowl: 0.98, front: 'slim', rim: 'twin5' },
  'VW ID.3':            { L: 4.26, W: 1.81, H: 1.57, wb: 2.77, fo: 0.82, cowl: 0.12, ws: 0.9, nose: 0.82, hCowl: 1.05, front: 'bar', rim: 'aero', blackPillars: 1 },
  'Tesla Model 3':      { L: 4.72, W: 1.85, H: 1.44, wb: 2.88, nose: 0.64, hCowl: 0.95, bowN: 0.3, front: 'slim', rim: 'aero', glassRoof: 1, flush: 1 },
  'Tesla Model Y':      { L: 4.75, W: 1.92, H: 1.62, wb: 2.89, nose: 0.78, bowN: 0.3, front: 'slim', rim: 'dark-aero', glassRoof: 1, flush: 1, clad: 0 },
  'Tesla Model S':      { L: 4.98, W: 1.96, H: 1.44, wb: 2.96, nose: 0.66, hCowl: 0.94, bowN: 0.28, front: 'slim', rim: 'turbine', glassRoof: 1, flush: 1 },
  'Tesla Cybertruck':   { front: 'bar', rim: 'dark-aero', steel: 1, flush: 1 },
  'Skoda Enyaq':        { L: 4.65, H: 1.62, front: 'slim', rim: 'aero' },
  'VW ID.4':            { L: 4.58, H: 1.64, cowl: 0.2, ws: 0.84, front: 'bar', rim: 'aero', floating: 1 },
  'Polestar 2':         { L: 4.61, W: 1.86, H: 1.48, gc: 0.17, hDeck: 1.12, belt: 0.98, tumble: 0.34, rs: 0.03, bowT: 0.1, front: 'hammer', rim: 'dark-twin5' },
  'Polestar 3':         { L: 4.90, W: 1.97, H: 1.61, wb: 2.98, front: 'hammer', rim: 'dark-turbine' },
  'Ford Mustang Mach-E': { L: 4.71, W: 1.88, H: 1.62, wb: 2.98, nose: 0.9, front: 'tri', rim: 'dark-twin5' },
  'BYD Atto 3':         { L: 4.46, H: 1.62, wb: 2.72, bowN: 0.26, front: 'bar', rim: 'turbine' },
  'Volvo XC40':         { L: 4.43, W: 1.86, H: 1.65, wb: 2.70, gate: 0.2, tumble: 0.22, beltR: 1.2, front: 'hammer', rim: 'dark-spoke5', floating: 1 },
  'Audi Q4':            { L: 4.59, H: 1.63, wb: 2.76, front: 'split', rim: 'twin5' },
  'BMW i4':             { L: 4.78, W: 1.85, H: 1.45, wb: 2.86, fo: 0.84, cowl: 0.46, front: 'quad', rim: 'dark-twin5' },
  'Porsche Taycan':     { L: 4.96, H: 1.38, front: 'quad', rim: 'turbine', red: 1 },
  'Audi RS e-tron GT':  { L: 4.99, H: 1.40, front: 'split', rim: 'dark-turbine', red: 1 },
  'Audi e-tron GT':     { L: 4.99, H: 1.41, front: 'split', rim: 'turbine' },
  'BMW iX':             { L: 4.95, W: 1.97, H: 1.70, wb: 3.0, front: 'slim', rim: 'turbine', clad: 0 },
  'Jaguar I-Pace':      { L: 4.68, W: 1.90, H: 1.57, wb: 2.99, fo: 0.80, cowl: 0.12, ws: 0.95, front: 'slim', rim: 'twin5' },
  'Mercedes EQS SUV':   { L: 5.13, W: 1.96, H: 1.72, wb: 3.21, bowN: 0.3, front: 'bar', rim: 'multi', clad: 0 },
  'Mercedes EQS':       { L: 5.22, W: 1.93, H: 1.51, wb: 3.21, fo: 0.9, cowl: 0.05, ws: 1.2, nose: 0.7, hCowl: 0.96, bowN: 0.32, roofR: -1.0, rake: 1.45, front: 'bar', rim: 'multi' },
  'Maybach EQS SUV':    { L: 5.13, W: 2.0, H: 1.72, wb: 3.21, bowN: 0.3, front: 'bar', rim: 'multi', clad: 0 },
  'BMW i7':             { L: 5.39, W: 1.95, H: 1.54, wb: 3.22, fo: 0.9, cowl: 0.55, nose: 0.82, hCowl: 1.04, hDeck: 1.1, front: 'split', rim: 'multi' },
  'Porsche Macan':      { L: 4.78, W: 1.94, H: 1.62, wb: 2.89, front: 'quad', rim: 'turbine', clad: 0 },
  'Lucid Air':          { L: 4.98, W: 1.94, H: 1.41, wb: 2.96, cowl: 0.1, ws: 1.1, nose: 0.68, front: 'bar', rim: 'aero', floating: 1, glassRoof: 1 },
  'Lotus Eletre':       { L: 5.10, W: 2.0, H: 1.63, wb: 3.02, nose: 0.8, front: 'split', rim: 'dark-turbine', red: 1 },
  'Rolls-Royce Spectre': { L: 5.45, W: 2.08, H: 1.56, wb: 3.21, fo: 0.92, cowl: 0.85, nose: 0.9, hCowl: 1.08, belt: 1.02, hDeck: 1.0, tumble: 0.32, bowN: 0.1, noseLen: 0.14, front: 'split', rim: 'multi', doors: 2, upright: 1 },
  'Toyota Proace':      { front: 'slim', rim: 'steel' },
  'Audi e-tron 55':     { L: 4.90, W: 1.94, H: 1.63, wb: 2.93, front: 'split', rim: 'twin5' },
  'Citroën ë-SpaceTourer': { L: 4.96, H: 1.9, front: 'split', rim: 'spoke5', windows: 1 },
  'Kia PV5 Passenger':  { L: 4.70, H: 1.90, wb: 3.0, fo: 0.78, cowl: -0.3, bowN: 0.1, front: 'hammer', rim: 'aero', windows: 1, blackPillars: 1 },
  'Kia PV5 Cargo':      { L: 4.70, H: 1.90, wb: 3.0, fo: 0.78, cowl: -0.3, bowN: 0.1, front: 'hammer', rim: 'steel' },
  'Renault Fluence':    { L: 4.75, H: 1.46, front: 'slim', rim: 'multi' },
  'Ford Focus Electric': { L: 4.39, H: 1.48, front: 'slim', rim: 'spoke5' },
  'Elcat':              { L: 3.3, W: 1.4, H: 1.78, wb: 1.9, fo: 0.72, R: 0.25, tw: 0.13, gc: 0.17, nose: 0.9, hCowl: 1.05, cowl: -0.36, ws: 0.42, belt: 1.02, bowN: 0.08, front: 'round', rim: 'steel', solid: 1 },
};
const tweakOf = name => { if (!name) return {}; let best = ''; for (const k in TWEAK) if (name.startsWith(k) && k.length > best.length) best = k; return TWEAK[best] || {}; };

// ---------- materiaalit ----------
export const CU = { dirt: { value: 0 }, wet: { value: 0 }, dirtCol: { value: new THREE.Color(0.42, 0.4, 0.37) } }; // yhteiset: talven lika ja suola, sateen kiilto
const paintCache = new Map();
let drops = null, flakes = null;
// Autonmaali: pohjaväri, metallihohto ja kirkaslakka. Lika ja suola sekoitetaan helmoihin kärkiattribuutista.
export function paintMat(hex, kind = 'metal') {
  const key = hex + kind;
  if (paintCache.has(key)) return paintCache.get(key);
  const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); c.multiplyScalar(0.82); // maali hieman tummempana: heijastukset tuovat kirkkauden
  const solid = kind === 'solid' || (hsl.l > 0.82 && hsl.s < 0.1);
  const m = kind === 'steel'
    ? new THREE.MeshPhysicalMaterial({ color: 0xa9adb1, metalness: 1, roughness: 0.34, clearcoat: 0 })
    : new THREE.MeshPhysicalMaterial({ color: c, metalness: solid ? 0.05 : 0.5, roughness: solid ? 0.36 : 0.34, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0 });
  if (!drops) { drops = dropsTex(); flakes = flakeTex(); }
  if (!solid && kind !== 'steel') { m.normalMap = flakes; m.normalScale = new THREE.Vector2(0.22, 0.22); }
  m.clearcoatNormalMap = drops; m.clearcoatNormalScale = new THREE.Vector2(0, 0);
  m.userData.dropScale = m.clearcoatNormalScale;
  m.onBeforeCompile = sh => {
    sh.uniforms.uDirt = CU.dirt; sh.uniforms.uDirtCol = CU.dirtCol; sh.uniforms.uWet = CU.wet;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aDirt;\nvarying float vDirt;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirt = aDirt;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDirt;\nuniform float uDirt, uWet;\nuniform vec3 uDirtCol;\nfloat gDirt = 0.0;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n gDirt = clamp(vDirt * uDirt * 1.25 + (uDirt - 0.5) * 0.25 * vDirt, 0.0, 0.92);\n diffuseColor.rgb = mix(diffuseColor.rgb, uDirtCol, gDirt);\n diffuseColor.rgb *= 1.0 - 0.22 * smoothstep(0.55, 1.0, vDirt);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.95, gDirt);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n material.clearcoat *= 1.0 - gDirt; material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.012, uWet);\n#endif');
  };
  paintCache.set(key, m);
  return m;
}
// sää ja vuodenaika: lika (0…1), likaväri ja sadepisarat kaikille maalipinnoille
export function setCarWeather(dirt, col, wet) {
  CU.dirt.value = dirt; CU.dirtCol.value.setRGB(col[0], col[1], col[2]); CU.wet.value = wet;
  for (const m of paintCache.values()) if (m.userData.dropScale) m.userData.dropScale.setScalar(wet * 0.9);
}
const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0 }, o));
const M = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0a0e11, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.25 }),
  glassT: new THREE.MeshPhysicalMaterial({ color: 0x1c2a30, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, transparent: true, opacity: 0.58, depthWrite: false }),
  inner: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.95, side: THREE.BackSide }), hidden: new THREE.MeshBasicMaterial({ visible: false }),
  dash: std({ color: 0x121315, roughness: 0.8 }), seatL: std({ color: 0x7d6c58, roughness: 0.85 }), wiper: std({ color: 0x050505, roughness: 0.5 }),
  stop: null,
  black: std({ color: 0x08090a, roughness: 0.35, metalness: 0.2 }),
  plastic: std({ color: 0x17181a, roughness: 0.82 }),
  under: std({ color: 0x060606, roughness: 1 }),
  chrome: std({ color: 0xe6e8ea, roughness: 0.08, metalness: 1 }),
  seam: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  mirror: std({ color: 0x8898a8, roughness: 0.03, metalness: 1 }),
  concrete: null, rust: null, plate: new Map(), lamp: new Map(),
  seat: std({ color: 0x1b1c1f, roughness: 0.9 }),
  ply: std({ color: 0xa48a5e, roughness: 0.85 }), frame: std({ color: 0x3a3a3c, roughness: 0.6, metalness: 0.6 }),
  box1: std({ color: 0xa8824e, roughness: 0.9 }), sofa: std({ color: 0x6e2a2a, roughness: 0.95 }), strap: std({ color: 0xe8c32a, roughness: 0.7 }),
  rustBody: std({ color: 0x7a4a22, roughness: 0.95, metalness: 0.2 }),
  led: new THREE.MeshStandardMaterial({ color: 0x103018, emissive: 0x30ff80, emissiveIntensity: 0 }),
};
function lampMat(kind, type, own) {
  const key = kind + type;
  let base = M.lamp.get(key);
  if (!base) {
    const t = lampTex(kind, type);
    base = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1, alphaTest: 0.35, roughness: 0.12, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    M.lamp.set(key, base);
  }
  return own ? base.clone() : base;
}
const decal = (map, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ map, alphaTest: 0.4, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }, o));
const grilles = new Map();
function grilleMat(kind, o) { const k = kind + JSON.stringify(o); if (!grilles.has(k)) grilles.set(k, decal(grilleTex(kind), o)); return grilles.get(k); }

// ---------- pinnan päälle rakennettavat osat ----------
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
// ruudukko pinnalta: fn(a, b, out) antaa pisteen, a ja b välillä 0…1; pintaa nostetaan off metriä ulospäin
function patch(fn, na, nb, off, flip) {
  const pos = new Float32Array((na + 1) * (nb + 1) * 3), uv = new Float32Array((na + 1) * (nb + 1) * 2), idx = [];
  for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
    const o = j * (na + 1) + i; fn(i / na, j / nb, V);
    pos[o * 3] = V.x; pos[o * 3 + 1] = V.y; pos[o * 3 + 2] = V.z; uv[o * 2] = i / na; uv[o * 2 + 1] = j / nb;
  }
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) { const a = j * (na + 1) + i, b = a + na + 1; if (flip) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (off) { const n = g.attributes.normal; for (let i = 0; i < pos.length; i++) pos[i] += n.array[i] * off; }
  return g;
}
const rbox = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); const k = 1 - 0.12 * (Math.abs(V.x / w) + Math.abs(V.y / h) + Math.abs(V.z / d) > 1.2 ? 1 : 0); p.setXYZ(i, V.x * k, V.y * k, V.z * k); } g.computeVertexNormals(); return g; };

let plateN = 0;
const plates = [];
function plateMat(i) { if (!plates[i]) plates[i] = decal(plateTex(i), { roughness: 0.5, alphaTest: 0 }); return plates[i]; }

// ---------- auton rakentaminen ----------
// spec = MODELS-taulukon rivi (b, c, r, tl, x, w). opt: name, lod (0 = pelaaja, 1 = liikenne), type ('e' sähkö, 'b' bensa, 'h' hybridi),
// mb (mikrobetonipaikkoja), dent (lommoja), box (kattoboksi), tow ('' | 'tyhjä' | 'muutto' | 'romu')
export function buildCar(spec, opt = {}) {
  const type = BODY[spec.b] ? spec.b : 'sedan', x = spec.x || [], has = f => x.includes(f);
  const tk = tweakOf(opt.name), tw = Object.assign({}, tk);
  for (const k of ['front', 'rim', 'doors', 'solid', 'steel', 'flush', 'glassRoof', 'floating', 'blackPillars', 'red', 'upright', 'windows']) delete tw[k];
  if (spec.w && !tk.W) tw.W = BODY[type].W * (0.86 + 0.14 * spec.w) * (spec.w < 0.9 ? 0.2 + 0.8 * spec.w / 0.9 : 1);
  if (has('duck')) tw.duck = 1;
  const S = shapeOf(type, tw), B = S.B, lod = opt.lod || 0, hero = !lod;
  const ev = opt.type ? opt.type === 'e' : !(has('exh1') || has('exh2'));
  const dents = [];
  for (let i = 0; i < Math.min(3, opt.dent || 0); i++) dents.push({ X: S.ra + 0.75 + i * 0.7, z: S.B.gc + 0.2 + (i % 2) * 0.16, side: i % 2 ? -1 : 1, r: 0.26, depth: 0.05 });
  const bOpt = { lod, roof: !!spec.r && !has('twotone'), twotone: has('twotone'), blackHatch: has('blackhatch'), blackPillars: !!tk.blackPillars, glassRoof: !!tk.glassRoof && hero, floating: !!tk.floating, dents };
  if (tk.clad !== undefined) bOpt.clad = !!tk.clad;
  const isVan = type === 'van' || type === 'bus';
  if (isVan && !tk.windows && type === 'van') bOpt.glass = { sideR: S.fa - 1.32, pillarC: null }; // umpikylkinen paku: vain ohjaamon lasit
  if (type === 'truck') bOpt.glass = { sideR: S.uR + 0.75, pillarC: null };
  const body = buildBody(S, bOpt), sf = surface(S), mid = body.mid;
  const g = new THREE.Group(), bodyG = new THREE.Group(); g.add(bodyG);
  const paint = paintMat(spec.c || '#888888', tk.steel ? 'steel' : tk.solid ? 'solid' : 'metal');
  const roofM = spec.r ? paintMat(spec.r, 'solid') : paint;
  const lowM = has('twotone') ? paintMat(spec.r || '#222222') : M.plastic;
  // pelaajan autossa lasit ovat läpikuultavat ja sisällä on sisusta; liikenteessä ja bussissa tumma läpinäkymätön lasi
  const clear = hero && opt.detail !== false && type !== 'bus';
  const glassM = clear ? M.glassT : M.glass;
  const mesh = new THREE.Mesh(body.geometry, [paint, glassM, M.black, roofM, lowM]);
  if (clear) { const inner = new THREE.Mesh(body.geometry, [M.inner, M.hidden, M.inner, M.inner, M.inner]); bodyG.add(inner); bodyG.add(interior(S, body, type, has('chrome') ? M.seatL : M.seat, tk)); }
  mesh.castShadow = true; mesh.receiveShadow = hero;
  bodyG.add(mesh);
  const add = (geo, mat, shadow) => { const m = new THREE.Mesh(geo, mat); if (shadow) m.castShadow = true; bodyG.add(m); return m; };
  const yR0 = sf.sec(0.03).yR, W2 = S.W / 2;

  // pohja ja pyöränkotelot: musta kaukalo, joka peittää näkymän auton läpi
  { const parts = [], fl = new THREE.BoxGeometry(S.W * 0.8, 0.2, Math.min(S.fa - S.ra + 0.7, S.L - 0.8)); fl.translate(0, B.gc + 0.12, 0); parts.push(fl);
    for (const ax of [S.ra, S.fa]) { const l0 = Math.max(S.xR + 0.14, ax - S.Ra - 0.03), l1 = Math.min(S.xF - 0.2, ax + S.Ra + 0.03), wl = new THREE.BoxGeometry(S.W * 0.8, S.za + S.Ra - B.gc - 0.16, l1 - l0); wl.translate(0, B.gc + 0.13 + (S.za + S.Ra - B.gc - 0.16) / 2, mid - (l0 + l1) / 2); parts.push(wl); }
    add(mergeGeos(parts), M.under); }

  // --- takavalot: yksi leveä pinta perässä, kuvio mallin valosignatuurin mukaan ---
  const tl = spec.tl || 'corner', deck = B.tail === 'deck';
  const vert = tl === 'vertical';
  const zl1 = deck ? S.hD - 0.04 : S.gateZ - (vert ? -0.34 : 0.03), zl0 = vert ? (deck ? S.hD - 0.32 : S.gateZ - 0.24) : zl1 - (tl === 'low' ? 0.5 : tl === 'round' ? 0.22 : 0.19);
  const rear = lampMat('rear', tl, hero);
  add(patch((a, b, o) => sf.fasciaN(false, -0.985 + 1.97 * a, zl0 + (zl1 - zl0) * b, o), hero ? 36 : 12, hero ? 8 : 3, 0.004, false), rear);
  if (tl !== 'round' && tl !== 'low') { // takavalo jatkuu kulman yli kylkeen
    const cm = M.corner || (M.corner = new THREE.MeshStandardMaterial({ color: 0x5a0a0c, emissive: 0xff2a1c, emissiveIntensity: 0.4, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const cg = [], zc0 = tl === 'bar' || tl === 'pixel' ? zl0 + (zl1 - zl0) * 0.25 : zl0 + (zl1 - zl0) * 0.14, zc1 = tl === 'bar' ? zl0 + (zl1 - zl0) * 0.8 : zl1 - (zl1 - zl0) * 0.12, len = S.rcR * (tl === 'vertical' ? 0.8 : 1.05);
    for (const side of [-1, 1]) cg.push(patch((a, b, o) => sf.sideAtZ(S.xR + 0.012 + len * a, zc0 + (zc1 - zc0) * (tl === 'vertical' ? b : 0.25 * a + b * (1 - 0.5 * a)), side, o), 8, 3, 0.004, side < 0));
    add(mergeGeos(cg), cm); g.userData.cornerM = cm;
  }
  // --- etuvalot ---
  const fl = tk.front || (tl === 'bar' ? 'bar' : tl === 'pixel' ? 'pixel' : tl === 'round' ? 'round' : tl === 'tri' ? 'tri' : tl === 'vertical' ? 'hammer' : 'slim');
  const zh1 = B.nose - 0.025, zh0 = zh1 - (fl === 'round' ? 0.22 : fl === 'split' ? 0.24 : 0.17);
  const front = lampMat('front', fl, hero);
  add(patch((a, b, o) => sf.fasciaN(true, -0.985 + 1.97 * a, zh0 + (zh1 - zh0) * b, o), hero ? 36 : 12, hero ? 8 : 3, 0.004, true), front);
  if (fl !== 'round') { // etuvalon lasi jatkuu kulman yli lokasuojaan
    const hm = M.hcorner || (M.hcorner = new THREE.MeshStandardMaterial({ color: 0x12161b, emissive: 0xdfe8ff, emissiveIntensity: 0.06, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const cg = [], len = S.rcF * 0.85, z0 = zh0 + (zh1 - zh0) * 0.42, z1 = zh1 - (zh1 - zh0) * 0.12;
    for (const side of [-1, 1]) cg.push(patch((a, b, o) => sf.sideAtZ(S.xF - 0.012 - len * a, z0 + (z1 - z0) * (b * (1 - 0.5 * a) + 0.5 * a), side, o), 8, 3, 0.004, side > 0));
    add(mergeGeos(cg), hm);
  }

  // --- rekisterikilvet ---
  const pm = plateMat(opt.plate !== undefined ? opt.plate : (plateN++ % 12));
  const plate = (frontSide, z) => { const hw = 0.26 / Math.max(0.3, sf.sec(frontSide ? S.L - 0.03 : 0.03).yR); add(patch((a, b, o) => sf.fasciaN(frontSide, (frontSide ? -1 : 1) * (-hw + 2 * hw * a), z + 0.115 * b, o), 6, 2, 0.006, false), pm); };
  const zPlate = deck ? Math.min(zl0 - 0.16, S.hD - 0.34) : Math.min(zl0 - 0.2, S.gateZ - 0.36);
  plate(false, tl === 'low' ? zl1 - 0.3 : zPlate);
  plate(true, S.zf0 + 0.2);

  // --- keula: polttomoottorilla maski ja alaritilä, sähköautolla umpinainen keula ja kapea ilmanotto ---
  const gz0 = S.zf0 + 0.035, lowH = ev ? 0.07 : 0.12;
  add(patch((a, b, o) => sf.fasciaN(true, -0.62 + 1.24 * a, gz0 + lowH * b, o), 12, 2, 0.003, true), grilleMat('low', { roughness: 0.5 }));
  if (!ev) {
    const up = tk.upright ? 0.36 : (zh1 - zh0) * 0.82, gy = tk.upright ? 0.3 : 0.47;
    add(patch((a, b, o) => sf.fasciaN(true, -gy + 2 * gy * a, (tk.upright ? zh1 - 0.34 : zh0 + 0.01) + up * b, o), 12, 3, 0.003, true), grilleMat(has('chrome') || tk.upright ? 'chrome' : 'mesh', { roughness: 0.4, metalness: has('chrome') ? 0.6 : 0.1 }));
  } else if (tk.upright) add(patch((a, b, o) => sf.fasciaN(true, -0.3 + 0.6 * a, zh0 - 0.22 + 0.34 * b, o), 12, 3, 0.003, true), grilleMat('chrome', { roughness: 0.2, metalness: 0.8 }));
  // --- perän alaosa: musta helma, diffuusori ja pakoputket ---
  add(patch((a, b, o) => sf.fasciaN(false, -0.8 + 1.6 * a, S.zr0 + 0.015 + 0.1 * b, o), 12, 2, 0.003, false), grilleMat(has('diff') ? 'diff' : 'valance', { roughness: 0.7 }));
  const pipe = y => { const geo = new THREE.CylinderGeometry(0.036, 0.036, 0.12, hero ? 14 : 6, 1, true); geo.rotateX(Math.PI / 2); sf.fasciaN(false, y / yR0, S.zr0 + 0.04, V); geo.translate(V.x, V.y - 0.005, V.z - 0.01); add(geo, M.chrome); const inner = new THREE.CircleGeometry(0.032, 10); inner.translate(V.x, V.y - 0.005, V.z + 0.03); add(inner, M.under); };
  if (!ev || has('exh1') || has('exh2')) { if (has('exh2')) { pipe(-W2 * 0.55); pipe(W2 * 0.55); } else pipe(-W2 * 0.55); }

  if (hero && opt.detail !== false) {
    // --- ovien saumat, takaluukun ja konepellin saumat ---
    const doors = tk.doors || (type === 'coupe' && tk.doors === 2 ? 2 : 4);
    const gb = body.glassBounds, seamX = [S.fa - S.Ra - 0.09, gb.pillarB + 0.0];
    if (doors === 4 && type !== 'truck') seamX.push(S.ra + S.Ra + 0.07);
    if (type === 'truck') seamX.push(S.uR + 0.72);
    const seams = [];
    for (const side of [-1, 1]) {
      for (const X of seamX) seams.push(patch((a, b, o) => sf.side(X - 0.0035 + 0.007 * a, 0.03 + 0.97 * b, side, o), 1, 12, 0.0012, side < 0));
      // helmasauma ovien alla
      const X0 = seamX[seamX.length - 1], X1 = seamX[0];
      seams.push(patch((a, b, o) => sf.side(X0 + (X1 - X0) * a, 0.035 + 0.012 * b, side, o), 16, 1, 0.0012, side < 0));
    }
    // konepellin etureuna ja takaluukun sauma
    seams.push(patch((a, b, o) => sf.fasciaN(true, -0.86 + 1.72 * a, B.nose - 0.012 + 0.006 * b, o), 20, 1, 0.0012, true));
    if (deck) seams.push(patch((a, b, o) => sf.fasciaN(false, -0.8 + 1.6 * a, zl0 - 0.02 + 0.006 * b, o), 20, 1, 0.0012, false));
    // konepellin sivusaumat ja takakannen saumat
    for (const sd of [-1, 1]) {
      seams.push(patch((a, b, o) => sf.top(S.uCowl + 0.05 + (S.L - S.noseLen - 0.06 - S.uCowl - 0.05) * a, sd * (0.9 + 0.012 * b), o), 14, 1, 0.0012, sd < 0));
      if (deck && S.uD - S.tf > 0.25) seams.push(patch((a, b, o) => sf.top(S.tf + 0.06 + (S.uD - S.tf - 0.04) * a, sd * (0.86 + 0.012 * b), o), 8, 1, 0.0012, sd < 0));
    }
    if (deck && S.uD - S.tf > 0.25) seams.push(patch((a, b, o) => sf.top(S.uD + 0.02 + 0.008 * b, -0.87 + 1.74 * a, o), 16, 1, 0.0012, false));
    // tuulilasin alareunan musta paneeli (pyyhkijöiden kotelo)
    seams.push(patch((a, b, o) => sf.top(S.uCowl - 0.01 + 0.07 * b, -0.94 + 1.88 * a, o), 18, 1, 0.002, false));
    add(mergeGeos(seams), M.seam);

    // --- pyyhkijät, lisäjarruvalo, takaheijastimet, takapyyhkijä ---
    { const wp = [];
      for (const [y0, y1] of [[-0.78, -0.12], [-0.08, 0.6]]) wp.push(patch((a, b, o) => { sf.top(S.uCowl - 0.05 - 0.035 * a - 0.02 * b, y0 + (y1 - y0) * a, o); }, 8, 1, 0.012, false));
      if (!deck) wp.push(patch((a, b, o) => { sf.top(body.glassBounds.rgR + 0.03 + 0.012 * b + 0.01 * a, -0.05 + 0.5 * a, o); }, 6, 1, 0.012, false));
      add(mergeGeos(wp), M.wiper);
      const stopM = new THREE.MeshStandardMaterial({ color: 0x4a0606, emissive: 0xff1a10, emissiveIntensity: 0.25, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      const us = deck ? body.glassBounds.rgF - 0.035 : S.uR + 0.03;
      add(patch((a, b, o) => sf.top(us + 0.022 * b, -0.2 + 0.4 * a, o), 6, 1, 0.004, false), stopM); g.userData.stopM = stopM;
      const rf = [];
      for (const sd of [-1, 1]) rf.push(patch((a, b, o) => sf.fasciaN(false, sd * (0.6 + 0.26 * a), S.zr0 + 0.15 + 0.03 * b, o), 4, 1, 0.004, sd < 0));
      add(mergeGeos(rf), M.refl || (M.refl = new THREE.MeshStandardMaterial({ color: 0x8a0f0f, emissive: 0xff2010, emissiveIntensity: 0.15, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));
      // etupuskurin sivuilmanotot
      const iv = [];
      for (const sd of [-1, 1]) iv.push(patch((a, b, o) => sf.fasciaN(true, sd * (0.66 + 0.24 * a), S.zf0 + 0.06 + (0.12 - 0.05 * a) * b, o), 4, 2, 0.003, sd > 0));
      add(mergeGeos(iv), M.plastic);
    }
    // --- ovenkahvat: uppokahvat tai vetokahvat ---
    const hz = B.belt - 0.085, hx = [gb.pillarB + 0.06];
    if (doors === 4 && type !== 'truck') hx.push(S.ra + S.Ra + 0.13);
    const hg = [];
    for (const side of [-1, 1]) for (const X of hx) {
      const geo = tk.flush ? new THREE.BoxGeometry(0.012, 0.022, 0.2) : rbox(0.03, 0.03, 0.2);
      sf.sideAtZ(X + 0.1, hz, side, V); geo.translate(V.x + side * (tk.flush ? 0.002 : 0.012), V.y, V.z); hg.push(geo);
    }
    add(mergeGeos(hg), tk.flush ? M.black : has('chrome') ? M.chrome : paint);

    // --- sivupeilit: kotelo, jalka ja peililasi ---
    const mg = [], mgl = [], mb = [];
    for (const side of [-1, 1]) {
      sf.glassSide(S.uCowl - 0.2, 0.05, side, V);
      const pod = new THREE.SphereGeometry(1, 14, 10); pod.scale(0.1, 0.065, 0.055); pod.translate(V.x + side * 0.125, V.y + 0.05, V.z + 0.01); mg.push(pod);
      const stalk = new THREE.BoxGeometry(0.1, 0.022, 0.06); stalk.translate(V.x + side * 0.05, V.y + 0.012, V.z + 0.0); mb.push(stalk);
      const gl = new THREE.CircleGeometry(1, 14); gl.scale(0.085, 0.05, 1); gl.translate(V.x + side * 0.125, V.y + 0.05, V.z + 0.058); mgl.push(gl);
    }
    add(mergeGeos(mg), paint, true); add(mergeGeos(mb), M.black); add(mergeGeos(mgl), M.mirror);

    // --- pyöränkaarien reunat ---
    const lips = [];
    for (const side of [-1, 1]) for (const ax of [S.ra, S.fa]) {
      const pts = [];
      for (let k = 0; k <= 18; k++) { const an = -0.5 + (Math.PI + 1.0) * k / 18, zz = S.za + Math.sin(an) * (S.Ra + 0.004), X = ax + Math.cos(an) * (S.Ra + 0.004); if (zz < S.zBot(X) + 0.03 || X < S.xR + 0.05 || X > S.xF - 0.05) continue; sf.sideAtZ(X, zz, side, V); pts.push(new THREE.Vector3(V.x + side * 0.004, zz, V.z)); }
      if (pts.length < 4) continue;
      lips.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, B.clad && bOpt.clad !== false ? 0.022 : 0.012, 5));
    }
    add(mergeGeos(lips), (bOpt.clad !== undefined ? bOpt.clad : B.clad) ? M.plastic : paint);

    // --- kattokaiteet, hainevä, kattospoileri ---
    if (has('rails')) {
      const rails = [];
      for (const side of [-1, 1]) { const pts = []; for (let k = 0; k <= 10; k++) { const u = S.uR + 0.12 + (S.uA - 0.18 - S.uR - 0.12) * k / 10; sf.top(u, side * 0.84, V); pts.push(new THREE.Vector3(V.x, V.y + (k === 0 || k === 10 ? 0.005 : 0.045), V.z)); } rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.014, 6)); }
      add(mergeGeos(rails), has('chrome') ? M.chrome : M.black, true);
    }
    if (type !== 'van' && type !== 'bus' && type !== 'truck' && !tk.steel) { const fin = new THREE.ConeGeometry(0.03, 0.16, 8); fin.rotateX(-Math.PI / 2.6); fin.scale(0.7, 1, 1); sf.top(S.uR + 0.25, 0, V); fin.translate(V.x, V.y + 0.025, V.z); add(fin, M.black); }
    if (has('spoiler') && !deck) {
      const u0 = S.uR + 0.1;
      const wing = patch((a, b, o) => { sf.top(u0, -0.9 + 1.8 * a, o); o.z += 0.2 * b; o.y -= 0.012 * b + 0.02 * b * b - 0.012; }, 12, 2, 0, true);
      const wing2 = patch((a, b, o) => { sf.top(u0, -0.9 + 1.8 * a, o); o.z += 0.2 * b; o.y -= 0.03 * b + 0.035 * b * b + 0.0; }, 12, 2, 0, false);
      add(mergeGeos([wing, wing2]), has('blackhatch') || spec.r ? M.black : paint, true);
    }
    if (has('split')) add(patch((a, b, o) => sf.top(S.tf + 0.03 + (deck ? S.B.deck + 0.3 : B.gate * 0.4) + 0.03 * b, -0.9 + 1.8 * a, o), 12, 1, 0.003, false), M.black);
    if (has('chrome')) add(patch((a, b, o) => sf.fasciaN(false, -0.5 + a, zl0 - 0.05 + 0.014 * b, o), 12, 1, 0.004, false), M.chrome);
    if (has('orange')) { const st = []; for (const side of [-1, 1]) st.push(patch((a, b, o) => sf.side(S.ra + S.Ra + 0.1 + (S.fa - S.Ra - 0.1 - S.ra - S.Ra - 0.1) * a, 0.2 + 0.03 * b, side, o), 12, 1, 0.002, side < 0)); add(mergeGeos(st), M.orange || (M.orange = std({ color: 0xe07a1f, roughness: 0.5 }))); }

    // --- latausluukku (sähkö) tai tankin luukku: vasen takakulma, aukeaa asemalla ---
    { const X = S.ra + S.Ra * 0.2, z0 = S.za + S.Ra + 0.1, w = 0.15;
      sf.sideAtZ(X + w, z0 + w / 2, -1, V); sf.sideAtZ(X, z0 + w / 2, -1, V2);
      const flap = new THREE.Group(); flap.position.copy(V);
      const fg = patch((a, b, o) => { sf.sideAtZ(X + w * (1 - a), z0 + w * b, -1, o); o.sub(V); }, 3, 3, 0.003, false);
      flap.add(new THREE.Mesh(fg, paint));
      const rim = patch((a, b, o) => { sf.sideAtZ(X - 0.004 + (w + 0.008) * (1 - a), z0 - 0.004 + (w + 0.008) * b, -1, o); }, 3, 3, 0.0015, false);
      add(rim, M.seam);
      const port = patch((a, b, o) => { sf.sideAtZ(X + 0.03 + (w - 0.06) * (1 - a), z0 + 0.03 + (w - 0.06) * b, -1, o); }, 2, 2, 0.002, false);
      const led = M.led.clone(); add(port, led);
      bodyG.add(flap); g.userData.flap = flap; g.userData.led = led; }

    // --- kunto: mikrobetonipaikat harmaina läikkinä, ruoste, lommojen naarmut ---
    if (!M.concrete) { M.concrete = decal(blobTex(3, [150, 150, 146]), { roughness: 1 }); M.rust = decal(blobTex(8, [110, 62, 28]), { roughness: 1 }); M.scuff = decal(blobTex(5, [40, 40, 42]), { roughness: 0.9 }); }
    const spots = [[false, -0.55, S.zr0 + 0.3, 0.3], [false, 0.5, S.zr0 + 0.42, 0.26], [null, 1, S.ra - 0.55, 0.34], [null, -1, S.ra + 0.9, 0.3]];
    const mk = (sp, mat) => {
      if (sp[0] === null) add(patch((a, b, o) => sf.sideAtZ(sp[2] + sp[3] * (a - 0.5) * 1.3, B.gc + 0.32 + sp[3] * b, sp[1], o), 4, 4, 0.004, sp[1] < 0), mat);
      else add(patch((a, b, o) => sf.fasciaN(false, sp[1] - 0.2 + 0.4 * a, sp[2] + sp[3] * b, o), 4, 4, 0.005, false), mat);
    };
    for (let i = 0; i < Math.min(4, opt.mb || 0); i++) mk(spots[i], M.concrete);
    if (has('rust')) { mk([null, 1, S.ra + S.Ra + 0.2, 0.2], M.rust); mk([null, -1, S.fa - S.Ra - 0.25, 0.22], M.rust); mk([false, -0.7, S.zr0 + 0.16, 0.16], M.rust); }
    for (const d of dents) add(patch((a, b, o) => sf.sideAtZ(d.X + 0.5 * (a - 0.5), d.z - 0.12 + 0.24 * b, d.side, o), 5, 4, 0.004, d.side < 0), M.scuff);
  }

  // --- pyörät ---
  const wheels = [], tireW = B.tw || B.R * 0.66;
  const style = tk.rim || wheelStyleFor(spec, opt);
  for (const [ax, side] of [[S.fa, -1], [S.fa, 1], [S.ra, -1], [S.ra, 1]]) {
    const w = makeWheel(B.R, tireW, style + (tk.red ? '-red' : ''), lod);
    sf.sideAtZ(ax, S.za, side, V);
    const pivot = new THREE.Group();
    pivot.position.set(side * (Math.abs(V.x) - tireW / 2 - 0.022), B.R, mid - ax);
    w.group.rotation.y = side < 0 ? Math.PI : 0;
    pivot.add(w.group); g.add(pivot);
    wheels.push({ pivot, spin: w.spin, side, front: ax === S.fa });
  }

  // --- kattoboksi ja peräkärry ---
  let boxG = null, trailer = null;
  if (opt.box) { boxG = roofBox(S, sf); bodyG.add(boxG); }
  if (opt.tow) { trailer = makeTrailer(opt.tow, S, tireW, mid); g.add(trailer.group); }

  { if (!M.blob) M.blob = new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false, opacity: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sg = new THREE.PlaneGeometry(S.W * 1.28, S.L * 1.14); sg.rotateX(-Math.PI / 2); const sh = new THREE.Mesh(sg, M.blob); sh.position.y = 0.02; sh.renderOrder = 1; g.add(sh); }
  const state = { ang: 0, pitch: 0, roll: 0, steer: 0, heave: 0, v: 0, flap: 0, t: 0 };
  // u: { dt, speed (m/s), brake, steer (−1…1), accel (m/s²), lat (m/s²), night (0…1), charge, lights }
  function update(u) {
    const dt = u.dt || 0;
    state.t += dt;
    state.ang -= (u.speed || 0) / B.R * dt;
    state.steer += ((u.steer || 0) * 0.42 - state.steer) * Math.min(1, dt * 7);
    for (const w of wheels) { w.spin.rotation.x = state.ang * (w.side < 0 ? -1 : 1); if (w.front) w.pivot.rotation.y = -state.steer; }
    // jousitus: jarrutus painaa keulaa, kiihdytys perää, sivuttaiskiihtyvyys kallistaa
    const acc = u.accel !== undefined ? u.accel : dt > 0 ? ((u.speed || 0) - state.v) / dt : 0; state.v = u.speed || 0;
    const pT = Math.max(-0.035, Math.min(0.02, -acc * 0.0042)), rT = Math.max(-0.05, Math.min(0.05, (u.lat || 0) * 0.008));
    state.pitch += (pT - state.pitch) * Math.min(1, dt * 5); state.roll += (rT - state.roll) * Math.min(1, dt * 4);
    const rough = (u.rough || 0) + Math.min(1, (u.speed || 0) / 40) * 0.25;
    state.heave = Math.sin(state.t * 11.3) * 0.004 * rough + Math.sin(state.t * 7.1 + 1) * 0.004 * rough;
    bodyG.rotation.x = state.pitch + Math.sin(state.t * 9.1) * 0.002 * rough; bodyG.rotation.z = -state.roll; bodyG.position.y = state.heave - Math.abs(state.pitch) * 0.4;
    // valot: ajovalot palavat aina (Suomen laki), jarruvalo kirkastaa takavalot
    if (hero) { rear.emissiveIntensity = u.brake ? 5.5 : 1.1 + (u.night || 0) * 0.8; front.emissiveIntensity = 2.2 + (u.night || 0) * 3; if (g.userData.stopM) g.userData.stopM.emissiveIntensity = u.brake ? 7 : 0.2; }
    if (g.userData.flap) { state.flap += ((u.charge ? 1 : 0) - state.flap) * Math.min(1, dt * 3); g.userData.flap.rotation.y = -state.flap * 1.9; g.userData.led.emissiveIntensity = state.flap * (0.6 + 0.4 * Math.sin(state.t * 4)) * 3; }
    if (trailer) trailer.update(u, state);
  }
  return { group: g, S, sf, body, bodyG, wheels, update, rear, front, ev, tailZ: mid, mid, trailer, exhaust: ev ? null : new THREE.Vector3(-W2 * 0.55, S.zr0 + 0.04, mid + 0.02) };
}

// sisusta: lattia, kojelauta, ratti, etuistuimet niskatukineen ja takapenkki; näkyy lasien läpi
function interior(S, body, type, seatM, tk) {
  const G = new THREE.Group(), B = S.B, mid = body.mid, gb = body.glassBounds, zOf = X => mid - X;
  const fl = B.gc + 0.26, bw = S.W - 0.34, dark = [], seats = [], top = S.H - 0.16;
  const bx = (w, h, d, x, y, z, rx = 0) => { const g = rbox(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return g; };
  dark.push(bx(bw, 0.04, S.uCowl - S.ra + 0.3, 0, fl, zOf((S.uCowl + S.ra) / 2 - 0.15)));                 // lattia
  dark.push(bx(bw, 0.34, 0.42, 0, B.belt - 0.14, zOf(S.uCowl - 0.3)));                                         // kojelauta
  dark.push(bx(0.26, 0.3, S.uCowl - 0.6 - gb.pillarB, 0, fl + 0.15, zOf((S.uCowl - 0.6 + gb.pillarB) / 2))); // keskikonsoli
  { const wh = new THREE.TorusGeometry(0.175, 0.018, 8, 22); wh.rotateX(-0.42); wh.translate(-0.36, B.belt - 0.03, zOf(S.uCowl - 0.62)); dark.push(wh);
    const col = bx(0.05, 0.05, 0.3, -0.36, B.belt - 0.08, zOf(S.uCowl - 0.5), -0.42); dark.push(col); }
  const seat = (x, X, w) => {
    seats.push(bx(w, 0.13, 0.5, x, fl + 0.2, zOf(X + 0.27)));                                                  // istuinosa
    seats.push(bx(w, 0.56, 0.12, x, fl + 0.5, zOf(X - 0.03), 0.28));                                           // selkänoja
    seats.push(bx(w * 0.5, 0.17, 0.09, x, Math.min(top - 0.1, fl + 0.88), zOf(X - 0.12), 0.2));                // niskatuki
  };
  const Xf = gb.pillarB + 0.1;
  seat(-0.37, Xf, 0.5); seat(0.37, Xf, 0.5);
  const rear = type !== 'truck' && !(type === 'van' && !tk.windows) && S.ra + 0.42 < Xf - 0.55;
  if (rear) { const Xr = Math.max(S.ra + 0.3, gb.sideR + 0.25);
    seats.push(bx(bw - 0.1, 0.13, 0.5, 0, fl + 0.2, zOf(Xr + 0.27)), bx(bw - 0.1, 0.52, 0.12, 0, fl + 0.48, zOf(Xr - 0.03), 0.3));
    for (const x of [-0.42, 0.42]) seats.push(bx(0.25, 0.15, 0.09, x, Math.min(top - 0.14, fl + 0.84), zOf(Xr - 0.13), 0.2));
    if (S.B.tail === 'deck') dark.push(bx(bw - 0.1, 0.03, 0.4, 0, B.belt - 0.02, zOf(Xr - 0.4)));              // hattuhylly
  }
  G.add(new THREE.Mesh(mergeGeos(dark), M.dash), new THREE.Mesh(mergeGeos(seats), seatM));
  return G;
}
// kattoboksi: pitkulainen pyöristetty kotelo kahdella poikkitangolla
function roofBox(S, sf) {
  const G = new THREE.Group(), pts = [];
  const prof = t => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.45);
  const geo = new THREE.SphereGeometry(1, 20, 14); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { V.fromBufferAttribute(p, i); const k = prof((V.z + 1) / 2) * 0.25 + 0.75; p.setXYZ(i, V.x * 0.4 * k, Math.max(-0.35, V.y) * 0.19 * k, V.z * 1.0); }
  geo.computeVertexNormals();
  const uc = (S.uR + S.uA) / 2; sf.top(uc, 0, V);
  const box = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.1 })); box.position.set(0, V.y + 0.2, V.z); box.castShadow = true; G.add(box);
  for (const du of [-0.42, 0.42]) { sf.top(uc + du, 0, V); const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.06), M.frame); bar.position.set(0, V.y + 0.075, V.z); G.add(bar); }
  void pts;
  return G;
}
// peräkärry: runko, vanerilaidat, lokasuojat, aisa, valot ja kuorma (muuttokuorma tai romuauto)
function makeTrailer(kind, S, tireW, rearZ) {
  const G = new THREE.Group(), body = new THREE.Group(); G.add(body);
  const car = kind === 'romu' || kind === 'auto', w = car ? 1.9 : 1.5, len = car ? 4.2 : 2.6, h0 = 0.48, z0 = rearZ + 0.85;
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; body.add(o); return o; };
  m(new THREE.BoxGeometry(0.07, 0.07, 1.3), M.frame, 0, h0 - 0.04, z0 - 0.25);                      // aisa
  m(new THREE.BoxGeometry(w, 0.07, len), M.frame, 0, h0, z0 + len / 2 + 0.4);                       // pohja
  if (!car) for (const [bx, bz, bw, bl] of [[-w / 2, 0, 0.03, len], [w / 2, 0, 0.03, len], [0, -len / 2, w, 0.03], [0, len / 2, w, 0.03]]) m(new THREE.BoxGeometry(bw, 0.36, bl), M.ply, bx, h0 + 0.2, z0 + len / 2 + 0.4 + bz);
  const R = 0.3, wheels = [];
  for (const side of [-1, 1]) {
    const wh = makeWheel(R, tireW * 0.8, 'steel', 1); wh.group.position.set(side * (w / 2 + 0.14), R, z0 + len / 2 + 0.55); if (side < 0) wh.group.rotation.y = Math.PI; G.add(wh.group); wheels.push(wh);
    m(new THREE.BoxGeometry(0.26, 0.04, 0.8), M.frame, side * (w / 2 + 0.14), R * 2 + 0.05, z0 + len / 2 + 0.55);
  }
  const lampM = new THREE.MeshStandardMaterial({ color: 0x5a0808, emissive: 0xff2010, emissiveIntensity: 1 });
  for (const side of [-1, 1]) m(new THREE.BoxGeometry(0.2, 0.08, 0.03), lampM, side * (w / 2 - 0.14), h0 - 0.02, z0 + len + 0.42);
  m(new THREE.PlaneGeometry(0.4, 0.11), plateMat(11), 0, h0 - 0.02, z0 + len + 0.44);
  const load = new THREE.Group(); body.add(load);
  const lm = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; load.add(o); };
  const zc = z0 + len / 2 + 0.4;
  if (car) { // romuauto trailerilla: ruosteinen kori ilman pyöriä
    const wreck = buildCar({ b: 'sedan', c: '#7A4A1E', tl: 'corner' }, { lod: 1, name: '', type: 'b' });
    wreck.group.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.isMeshPhysicalMaterial) o.material = M.rustBody; if (o.isMesh && Array.isArray(o.material)) o.material = o.material.map((mm, i) => (i === 0 || i === 3 ? M.rustBody : mm)); });
    wreck.wheels.forEach(wl => { wl.pivot.visible = false; });
    wreck.group.position.set(0, h0 - 0.1, zc); wreck.group.rotation.z = 0.04; wreck.group.scale.setScalar(0.86); load.add(wreck.group);
  } else { // muuttokuorma: laatikot, sohva ja kuntopyörä liinojen alla
    lm(new THREE.BoxGeometry(0.5, 0.42, 0.5), M.box1, -0.42, h0 + 0.3, zc - 0.85); lm(new THREE.BoxGeometry(0.45, 0.4, 0.45), M.box1, -0.4, h0 + 0.72, zc - 0.82, 0.2); lm(new THREE.BoxGeometry(0.5, 0.42, 0.5), M.box1, 0.3, h0 + 0.3, zc - 0.9, 0.1);
    lm(new THREE.BoxGeometry(1.3, 0.38, 0.7), M.sofa, 0, h0 + 0.28, zc + 0.1); lm(new THREE.BoxGeometry(1.3, 0.5, 0.2), M.sofa, 0, h0 + 0.6, zc + 0.4); lm(new THREE.BoxGeometry(0.2, 0.3, 0.7), M.sofa, -0.6, h0 + 0.55, zc + 0.1); lm(new THREE.BoxGeometry(0.2, 0.3, 0.7), M.sofa, 0.6, h0 + 0.55, zc + 0.1);
    lm(new THREE.TorusGeometry(0.22, 0.03, 6, 14), M.frame, 0.35, h0 + 0.42, zc + 0.95, Math.PI / 2); lm(new THREE.BoxGeometry(0.05, 0.7, 0.05), M.frame, 0.35, h0 + 0.6, zc + 0.75); lm(new THREE.BoxGeometry(0.4, 0.04, 0.04), M.frame, 0.35, h0 + 0.95, zc + 0.75);
    lm(new THREE.BoxGeometry(w + 0.04, 0.02, 0.05), M.strap, 0, h0 + 0.4, zc - 0.5); lm(new THREE.BoxGeometry(w + 0.04, 0.02, 0.05), M.strap, 0, h0 + 0.4, zc + 0.6);
  }
  let sway = 0;
  return { group: G, load, lampM, kind, update(u, st) {
    for (const wh of wheels) wh.spin.rotation.x = st.ang * 0.9;
    sway += ((u.steer || 0) * -0.05 - sway) * Math.min(1, (u.dt || 0) * 2); G.position.set(Math.sin(sway) * -rearZ, 0, rearZ - Math.cos(sway) * rearZ); G.rotation.y = sway; // kääntyy vetokoukun ympäri
    lampM.emissiveIntensity = u.brake ? 5 : 1.2;
    body.position.y = Math.sin(st.t * 9) * 0.004 * Math.min(1, (u.speed || 0) / 20);
    load.visible = u.cargo !== false;
  } };
}
export { surface };
