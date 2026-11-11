// PAALAAN! 3.0 – maailma: simulaation tiesegmentit muunnetaan 3D-keskilinjaksi, ja tie sekä maasto rakennetaan lohkoina.
// Simulaation koordinaatit: z = matka (SEG = 200 yksikköä per segmentti), x = sivusuunta tien puolikkaina (±1 = asfaltin reuna).
// 3D-maailma: 1 segmentti = 1 m, tien puolikas = 7 m, eli leveäkaistatie pientareineen.
import * as THREE from 'three';
import { tex, hash2 } from './assets.js';

export const SEGM = 1.0;      // metriä per segmentti
export const HALF = 7.0;      // metriä per tien puolikas (x = 1)
export const YS = 0.0009;     // simulaation korkeusyksikkö metreinä
export const KC = 0.00139;    // kaarteen jyrkkyys: radiaania per segmentti per curve-yksikkö (4.5 → säde noin 160 m)
export const CH = 40;         // lohkon pituus segmentteinä
export const SPR = 0.0035;    // 2.0:n sprite-yksikkö metreinä (sama kuin sivusuunnan mittakaava)

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- keskilinja ----------
export class Track {
  constructor(sim) { this.sim = sim; this.x = [0]; this.z = [0]; this.y = [0]; this.th = [0]; }
  ensure(n) {
    const { x, z, y, th } = this;
    while (x.length <= n + 1) {
      const i = x.length - 1, seg = this.sim.seg(i);
      const t2 = th[i] + seg.curve * KC, tm = (th[i] + t2) / 2;
      x.push(x[i] + Math.sin(tm) * SEGM); z.push(z[i] - Math.cos(tm) * SEGM);
      th.push(t2); y.push(seg.p2.world.y * YS);
    }
  }
  // f = segmentti-indeksi liukulukuna, xn = sivusuunta tien puolikkaina
  at(f, xn, out) {
    const i = Math.max(0, Math.floor(f)), t = f - i;
    this.ensure(i + 1);
    const th = lerp(this.th[i], this.th[i + 1], t), lat = xn * HALF;
    out.x = lerp(this.x[i], this.x[i + 1], t) + Math.cos(th) * lat;
    out.z = lerp(this.z[i], this.z[i + 1], t) + Math.sin(th) * lat;
    out.y = lerp(this.y[i], this.y[i + 1], t);
    out.th = th;
    out.slope = (this.y[i + 1] - this.y[i]) / SEGM;
    return out;
  }
}

// ---------- maaston korkeus ----------
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
// a = etäisyys asfaltin reunasta metreinä (≥ 0); wx, wz = maailman koordinaatit. Palauttaa korkeuden keskilinjaan nähden.
export function verge(a, wx, wz) {
  const edge = -0.02 * HALF;
  if (a <= 0.8) return edge - 0.05 * a;
  const ditch = lerp(edge - 0.04, -0.62, smooth(0.8, 3.4, a));
  const up = lerp(ditch, -0.2, smooth(3.6, 9, a));
  const hills = smooth(9, 85, a) * (vnoise(wx * 0.011, wz * 0.011) * 4.2 + vnoise(wx * 0.031 + 7, wz * 0.031) * 1.6);
  const bumps = smooth(2.5, 7, a) * vnoise(wx * 0.17, wz * 0.17) * 0.13;
  return up + hills + bumps;
}
const P = { x: 0, y: 0, z: 0, th: 0, slope: 0 };
// maan korkeus kohdassa (f, xn); tiellä tien pinta kuperuuksineen
export function groundY(track, f, xn) {
  track.at(f, xn, P);
  const a = Math.abs(xn) * HALF - HALF;
  return a <= 0 ? P.y - 0.02 * Math.abs(xn) * HALF : P.y + verge(a, P.x, P.z);
}

// ---------- materiaalit ----------
// Tien pinta: asfaltti, tiemerkinnät, ajourat, märkä kiilto ja talven polanne lasketaan varjostimessa tiekoordinaateista.
export function roadMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ map: tex('asfaltti', 'diff'), normalMap: tex('asfaltti', 'nor'), roughnessMap: tex('asfaltti', 'rough'), roughness: 1, metalness: 0 });
  m.normalScale = U.roadNormal;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uWet: U.wet, uSnow: U.snow, uPaint: U.paint, uSnowMap: { value: tex('lumi', 'diff') }, uRamp: U.rampFlag });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aRoad;\nvarying vec2 vRoad;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = aRoad;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vRoad;
        uniform float uWet, uSnow, uPaint;
        uniform sampler2D uSnowMap;
        float gSnow = 0.0, gTrack = 0.0, gBig = 0.5;
        float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float ax = abs(vRoad.x);
          float aa = max(fwidth(vRoad.x), 0.0006) * 1.2;
          float ay = max(fwidth(vRoad.y), 0.002) / 12.0;
          float nz = texture2D(map, vRoad.yx * vec2(0.37, 0.71)).g;
          gBig = rn(vec2(vRoad.y * 0.11, vRoad.x * 1.6)) * 0.65 + rn(vec2(vRoad.y * 0.37, vRoad.x * 5.0)) * 0.35;
          #ifdef RAMP
            float edgeL = 1.0 - smoothstep(0.02, 0.02 + aa, abs(vRoad.x - 0.90));
            float ph = fract(vRoad.y / 6.0);
            float dash = smoothstep(0.0, ay * 2.0, ph) * (1.0 - smoothstep(0.5, 0.5 + ay * 2.0, ph));
            float centerL = (1.0 - smoothstep(0.035, 0.035 + aa, abs(vRoad.x - 0.06))) * dash;
            gTrack = exp(-pow((vRoad.x - 0.38) / 0.09, 2.0)) + exp(-pow((vRoad.x - 0.66) / 0.09, 2.0));
            float shoulder = smoothstep(0.86, 1.0, vRoad.x);
          #else
            float edgeL = 1.0 - smoothstep(0.0105, 0.0105 + aa, abs(ax - 0.86));
            float ph = fract(vRoad.y / 12.0);
            float dash = smoothstep(0.0, ay, ph) * (1.0 - smoothstep(0.25, 0.25 + ay, ph));
            float centerL = (1.0 - smoothstep(0.0085, 0.0085 + aa, ax)) * dash;
            gTrack = exp(-pow((ax - 0.385) / 0.045, 2.0)) + exp(-pow((ax - 0.615) / 0.045, 2.0));
            float shoulder = smoothstep(0.82, 0.99, ax);
          #endif
          float paint = max(edgeL, centerL) * uPaint * (0.72 + 0.28 * smoothstep(0.1, 0.4, nz));
          diffuseColor.rgb *= 1.0 - 0.12 * gTrack;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.80, 0.76), paint);
          diffuseColor.rgb *= mix(1.0, 0.52, uWet);
          gSnow = uSnow * smoothstep(0.25, 0.75, 0.62 + 1.3 * (gBig - 0.5) - 0.6 * gTrack + shoulder * 0.9);
          vec3 sn = texture2D(uSnowMap, vec2(vRoad.y / 6.0, vRoad.x * 1.17)).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, sn * 0.95, gSnow);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.05 + 0.3 * gBig, uWet * 0.92);
        roughnessFactor = mix(roughnessFactor, 0.30, uSnow * min(1.0, gTrack) * 0.55);
        roughnessFactor = mix(roughnessFactor, 0.85, gSnow);`);
  };
  return m;
}
export function rampMaterial(U) {
  const m = roadMaterial(U);
  m.defines = { RAMP: 1 };
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  return m;
}
// Maasto: nurmi, metsän pohja, pelto ja sora sekoitetaan kärkien painoista, lumi tulee päälle talvella.
export function terrainMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ map: tex('nurmi', 'diff'), normalMap: tex('metsa', 'nor'), roughness: 0.95, metalness: 0 });
  m.normalScale = U.terrainNormal;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uSnow: U.snow, tForest: { value: tex('metsa', 'diff') }, tField: U.fieldMap, tGravel: { value: tex('sora', 'diff') },
      tSnow: { value: tex('lumi', 'diff') }, uGrassTint: U.grassTint, uFieldTint: U.fieldTint, uForestTint: U.forestTint });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMix;\nvarying vec3 vMix;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMix = aMix;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMix;
        uniform float uSnow;
        uniform sampler2D tForest, tField, tGravel, tSnow;
        uniform vec3 uGrassTint, uFieldTint, uForestTint;
        float gSnow = 0.0;`)
      .replace('#include <map_fragment>', `
        {
          vec2 uv = vMapUv;
          float macro = texture2D(map, uv * 0.037).g * 1.9;
          vec3 cg = texture2D(map, uv).rgb * uGrassTint;
          vec3 cf = texture2D(tForest, uv * 0.8).rgb * uForestTint;
          vec3 cp = texture2D(tField, uv * 0.7).rgb * uFieldTint;
          vec3 cr = texture2D(tGravel, uv * 1.7).rgb * vec3(0.27, 0.255, 0.235);
          vec3 col = mix(cg, cp, vMix.y);
          col = mix(col, cf, vMix.x);
          col *= 0.72 + 0.4 * macro;
          col = mix(col, cr, vMix.z);
          gSnow = uSnow * clamp(0.9 + 0.4 * (macro - 0.8) - vMix.z * 0.25, 0.0, 1.0);
          col = mix(col, texture2D(tSnow, uv * 0.6).rgb * vec3(0.93, 0.95, 1.0), gSnow);
          diffuseColor.rgb *= col;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.62, gSnow);');
  };
  return m;
}

// ---------- lohko: tie ja maasto ----------
// sivusuunnan sarakkeet: etäisyys keskilinjasta metreinä
const LAT = [6.85, 7.5, 8.2, 9.2, 10.4, 12, 14, 17, 21, 27, 35, 46, 60, 80, 112];
const ROADX = [-1, -0.86, -0.5, 0, 0.5, 0.86, 1];
const TSTEP = 2; // maaston rivit joka toinen segmentti

// vyöhykkeen laji nopeusrajoituksesta: 50/60 = kylä, 80 = pelto, H = metsä
export const zoneOf = seg => (seg.lim === 'H' ? 0 : seg.lim === 80 ? 1 : 2);

export function buildRoad(track, c) {
  const i0 = c * CH, n = CH + 1, m = ROADX.length;
  track.ensure(i0 + CH + 1);
  const ax = track.x[i0], az = track.z[i0], ay = track.y[i0];
  const pos = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2), road = new Float32Array(n * m * 2), nor = new Float32Array(n * m * 3);
  const base = i0 % 1200;
  for (let j = 0; j < n; j++) {
    const i = i0 + j, th = track.th[i], cx = Math.cos(th), sz = Math.sin(th);
    const sl = (track.y[Math.min(i + 1, track.y.length - 1)] - track.y[Math.max(0, i - 1)]) / (2 * SEGM);
    for (let k = 0; k < m; k++) {
      const o = j * m + k, lat = ROADX[k] * HALF;
      pos[o * 3] = track.x[i] + cx * lat - ax; pos[o * 3 + 1] = track.y[i] - 0.02 * Math.abs(lat) - ay; pos[o * 3 + 2] = track.z[i] + sz * lat - az;
      uv[o * 2] = lat / 2.5; uv[o * 2 + 1] = (base + j) / 2.5;
      road[o * 2] = ROADX[k]; road[o * 2 + 1] = base + j;
      // normaali: ylös, kallistettuna mäen ja kuperuuden mukaan
      const nx = Math.sin(th) * -sl + cx * 0.02 * Math.sign(lat), nz = -Math.cos(th) * -sl + sz * 0.02 * Math.sign(lat), l = Math.hypot(nx, 1, nz);
      nor[o * 3] = nx / l; nor[o * 3 + 1] = 1 / l; nor[o * 3 + 2] = nz / l;
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let k = 0; k < m - 1; k++) { const a = j * m + k, b = a + m; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aRoad', new THREE.BufferAttribute(road, 2));
  g.setIndex(idx);
  return { geometry: g, anchor: new THREE.Vector3(ax, ay, az) };
}

export function buildTerrain(track, c, sim, far) {
  const i0 = c * CH, rows = CH / TSTEP + 1;
  const lats = far < 80 ? LAT.filter(v => v <= far + 1) : LAT;
  const cols = lats.length * 2;
  const ax = track.x[i0], az = track.z[i0], ay = track.y[i0];
  const pos = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2), mix = new Float32Array(rows * cols * 3);
  for (let j = 0; j < rows; j++) {
    const i = i0 + j * TSTEP, th = track.th[i], cx = Math.cos(th), sz = Math.sin(th);
    // vyöhykkeen painot pehmennetään tien suunnassa
    let wF = 0, wP = 0, cnt = 0;
    for (let d = -8; d <= 8; d += 4) { const z = zoneOf(sim.seg(Math.max(0, i + d))); wF += z === 0; wP += z === 1; cnt++; }
    wF /= cnt; wP /= cnt;
    for (let k = 0; k < cols; k++) {
      const side = k < lats.length ? -1 : 1, li = k < lats.length ? lats.length - 1 - k : k - lats.length;
      const lat = lats[li], a = lat - HALF, o = j * cols + k;
      const wx = track.x[i] + cx * lat * side, wz = track.z[i] + sz * lat * side;
      const y = li === 0 ? track.y[i] - 0.02 * HALF - 0.035 : track.y[i] + verge(a, wx, wz);
      pos[o * 3] = wx - ax; pos[o * 3 + 1] = y - ay; pos[o * 3 + 2] = wz - az;
      uv[o * 2] = wx / 4; uv[o * 2 + 1] = wz / 4;
      const deep = smooth(6, 11, a);
      mix[o * 3] = wF * deep; mix[o * 3 + 1] = wP * smooth(8, 13, a); mix[o * 3 + 2] = 1 - smooth(0.3, 1.0, a);
    }
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) for (let k = 0; k < cols - 1; k++) {
    if (k === lats.length - 1) continue; // tien kohdalla ei maastoa
    const a = j * cols + k, b = a + cols; idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aMix', new THREE.BufferAttribute(mix, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// liittymäkaista: simulaation ramppi (start..end) ja sen perään näkymän oma jatke, joka kaartaa pois metsään
export function buildRamp(track, ramp, sim) {
  const lead = 10, tail = 46, i0 = ramp.start, n = sim.RAMP_LEN + tail + 1;
  track.ensure(i0 + n + 2);
  const ax = track.x[i0], az = track.z[i0], ay = track.y[i0];
  const X = [0, 0.25, 0.5, 0.75, 1], m = X.length + 1; // viimeinen sarake = reunan helma
  const pos = new Float32Array(n * m * 3), uv = new Float32Array(n * m * 2), road = new Float32Array(n * m * 2);
  for (let j = 0; j < n; j++) {
    const i = i0 + j, th = track.th[i], cx = Math.cos(th), sz = Math.sin(th);
    const k1 = Math.min(1, j / lead), w = sim.RAMP_W * (k1 * k1 * (3 - 2 * k1));
    const t = Math.max(0, j - sim.RAMP_LEN) / tail, off = t * t * 2.6, drop = t * t * 1.6;
    const inner = 0.84 + off, outer = Math.max(inner + 0.02, 1 + w + off);
    for (let k = 0; k < m; k++) {
      const o = j * m + k, u = X[Math.min(k, X.length - 1)], xn = inner + (outer - inner) * u, lat = xn * HALF;
      const skirt = k === m - 1;
      pos[o * 3] = track.x[i] + cx * (lat + (skirt ? 0.6 : 0)) - ax;
      pos[o * 3 + 1] = track.y[i] - 0.02 * Math.min(HALF, lat) - 0.02 * Math.max(0, lat - HALF) + 0.015 - drop - (skirt ? 1.1 : 0) - ay;
      pos[o * 3 + 2] = track.z[i] + sz * (lat + (skirt ? 0.6 : 0)) - az;
      uv[o * 2] = lat / 2.5; uv[o * 2 + 1] = (i0 % 1200 + j) / 2.5;
      road[o * 2] = skirt ? 1.3 : u; road[o * 2 + 1] = i0 % 1200 + j;
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let k = 0; k < m - 1; k++) { const a = j * m + k, b = a + m; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aRoad', new THREE.BufferAttribute(road, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return { geometry: g, anchor: new THREE.Vector3(ax, ay, az) };
}
