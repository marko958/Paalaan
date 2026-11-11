// PAALAAN! 3.0 – lohkon maisemointi: simulaation tienvarsikohteet (puut, paalut, merkit, mökit, ladot) oikeilla paikoillaan
// ja niiden taakse näkymän oma täytemetsä. Täytepuut ovat alueella, jonne pelaaja ei pääse (|x| > 3), joten niihin ei voi törmätä.
import * as THREE from 'three';
import { hash2 } from './assets.js';
import { CH, HALF, SEGM, groundY, zoneOf, verge } from './world.js';

const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), E3 = new THREE.Euler(), C3 = new THREE.Color();
const PT = { x: 0, y: 0, z: 0, th: 0, slope: 0 };
const TREES = ['kuusi', 'koivu', 'mökki', 'lato'];

// simulaation rakennelmien jalanjäljet (segmentteinä ja tien puolikkaina): niiden kohdalta puut piilotetaan
export function footprints(st, sim) {
  const out = [];
  for (const d of st.dyn) {
    const f = d.z / sim.SEG;
    if (d.station) out.push([f - 13, f + 13, 1.02, 3.6]);
    else if (d.lot) out.push([f - 15, f + 15, 1.02, 4.4]);
    else if (d.k === 'ravintola') out.push([f - 7, f + 7, 1.02, 3.2]);
    else if (d.k === 'muutto') out.push([f - 9, f + 9, 1.02, 3.8]);
    else if (d.k === 'romu') out.push([f - 5, f + 5, 1.02, 2.9]);
    else if (d.k === 'mainos') out.push([f - 6, f + 3, -3.6, -1.8]);
    else if (d.k === 'kyltti') out.push([f - 4, f + 2, 1.5, 3.1]);
    else if (d.k === 'asiakas' || d.k === 'kohde') out.push([f - 2, f + 2, 1.05, 1.9]);
  }
  if (st.ramp) out.push([st.ramp.start - 4, st.ramp.end + 50, 0.9, 5.2, 'ramp']);
  return out;
}
export function signature(c, st, sim, road, fps) {
  let n = 0; const i0 = c * CH;
  for (let i = i0; i < i0 + CH; i++) n += sim.seg(i).sprites.length;
  let s = n + '|' + road;
  for (const f of fps) if (f[1] >= i0 - 12 && f[0] <= i0 + CH + 12) s += '|' + Math.round(f[0]) + ':' + f[2];
  return s;
}

export function buildScenery(c, ctx) {
  const { track, sim, st, T, P, Q, road, fps, anchor } = ctx;
  const i0 = c * CH, lap = road === 'lappi' || road === 'kuusamo', bahn = road === 'autobahn';
  const group = new THREE.Group();
  const inst = { kuusi: [], manty: [], koivu: [], tolppa: [], viitta: [], kivi: [] };
  const signs = [], snowObjs = [], bareObjs = [];
  // rakennusten jalanjäljet tästä ja viereisistä lohkoista
  const ex = fps.slice();
  for (let i = Math.max(0, i0 - 12); i < i0 + CH + 12; i++) for (const o of sim.seg(i).sprites) {
    if (o.k === 'mökki') ex.push([i - 6, i + 7, o.x - 0.95, o.x + 0.95, 'b']);
    else if (o.k === 'lato') ex.push([i - 6, i + 7, o.x - 1.15, o.x + 1.15, 'b']);
  }
  const hidden = (f, x, self) => { for (const e of ex) if (e !== self && f >= e[0] && f <= e[1] && x >= e[2] && x <= e[3]) { if (e[4] === 'ramp') { const t = Math.max(0, f - st.ramp.end) / 46, cx = 1.4 + t * t * 2.6; if (f <= st.ramp.end + 2 ? x < 2.6 : Math.abs(x - cx) < 1.1) return true; } else return true; } return false; };
  const put = (list, f, xn, rot, sx, sy, r, g, b) => {
    track.at(f, xn, PT);
    list.push(PT.x - anchor.x, groundY(track, f, xn) - anchor.y, PT.z - anchor.z, rot, sx, sy, r, g, b);
  };
  const single = (pr, f, xn, yaw, lift = 0) => {
    track.at(f, xn, PT);
    const m = new THREE.Mesh(pr.geo, pr.mats);
    m.position.set(PT.x - anchor.x, groundY(track, f, xn) - anchor.y + lift, PT.z - anchor.z);
    m.rotation.y = -PT.th + yaw; m.castShadow = true; m.receiveShadow = true;
    group.add(m); return m;
  };
  const leafCol = h => { const v = T.leafVar; return [1 + (h - 0.5) * v * 0.6, 1 - (h - 0.35) * v, 1 - h * v * 0.6]; };

  for (let i = i0; i < i0 + CH; i++) {
    const seg = sim.seg(i), zone = zoneOf(seg);
    // --- simulaation kohteet: sijainti ja törmäysraja ovat pelin omat ---
    for (const o of seg.sprites) {
      if (st.ramp && sim.rampHides(seg, o)) continue;
      const h = hash2(i, Math.round(o.x * 1000)), h2 = hash2(i + 7, Math.round(o.x * 917));
      if (o.k === 'kuusi' || o.k === 'koivu') {
        if (hidden(i, o.x)) continue;
        const s = (lap ? 0.55 : 0.85) + h * 0.4;
        if (o.k === 'kuusi') put(inst.kuusi, i + 0.5, o.x, h2 * 6.28, s * (lap ? 0.6 : 1), s, 0.85 + h2 * 0.3, 0.85 + h2 * 0.3, 0.85 + h2 * 0.3);
        else put(inst.koivu, i + 0.5, o.x, h2 * 6.28, s, s, ...leafCol(h2));
      } else if (o.k === 'tolppa') {
        if (hidden(i, o.x)) continue;
        put(inst.tolppa, i + 0.5, o.x, 0, 1, 1, 1, 1, 1);
        put(inst.viitta, i + 0.5, o.x + Math.sign(o.x) * 0.05, 0, 1, 1, 1, 1, 1);
      } else if (o.k === 'raja' || o.k === 'valvonta') {
        track.at(i + 0.5, o.x, PT);
        const g = new THREE.Group();
        const pole = new THREE.Mesh(P.pole(3.05), P.poleM); pole.castShadow = true;
        const face = new THREE.Mesh(o.k === 'raja' ? P.disc : P.plate, o.k === 'raja' ? P.limitMat(sim.limTxt(sim.limitOf(o.lim))) : P.valvontaM);
        face.position.set(0, 2.6, 0.035);
        const back = new THREE.Mesh(o.k === 'raja' ? P.disc : P.plate, P.discBack); back.position.set(0, 2.6, 0.03); back.rotation.y = Math.PI;
        g.add(pole, face, back);
        g.position.set(PT.x - anchor.x, groundY(track, i + 0.5, o.x) - anchor.y - 0.1, PT.z - anchor.z); g.rotation.y = -PT.th;
        group.add(g);
        if (o.k === 'raja') signs.push({ face, lim: o.lim });
      } else if (o.k === 'kamera') {
        single(P.kamera, i + 0.5, o.x, Math.PI, -0.1);
      } else if (o.k === 'mökki' || o.k === 'lato') {
        if (fps.some(e => i >= e[0] - 6 && i <= e[1] + 6 && o.x + 1 >= e[2] && o.x - 1 <= e[3])) continue; // aseman tai liikkeen alle jäävä talo piilotetaan
        const pr = o.k === 'mökki' ? P.mokki : P.lato, yaw = o.x > 0 ? 0 : Math.PI;
        // talo seisoo tasaisella: korkeus otetaan tien puoleisesta reunasta
        const m = single(pr, i + 0.5, o.x, yaw, 0.25);
        const sn = new THREE.Mesh((o.k === 'mökki' ? P.mokkiSnow : P.latoSnow).geo, P.snowM);
        sn.position.copy(m.position); sn.rotation.copy(m.rotation); group.add(sn); snowObjs.push(sn);
      }
    }
    // --- täytemetsä: vyöhykkeen mukaan, vasta alueella johon ei voi ajaa ---
    for (const side of [-1, 1]) {
      for (let b = 0; b < 15; b++) {
        const lat = 23 + b * 6;
        if (lat > Q.far) break;
        const h = hash2(i * 16 + b, side * 31 + 5), hs = hash2(i * 16 + b, side * 77 + 9), hp = hash2(i * 16 + b, side * 131 + 1);
        let p = zone === 0 ? 0.30 : zone === 1 ? (lat > 74 ? 0.3 : lat < 30 ? 0.004 : 0) : (lat > 50 ? 0.22 : 0.035);
        if (lap) p *= zone === 0 ? 0.42 : 0.6; if (bahn && zone === 0) p *= 0.75;
        if (h >= p * Q.trees) { if (zone === 0 && !lap && h > 0.985 && lat < 70) { const xn = side * (lat + hp * 6) / HALF; if (!hidden(i, xn)) put(inst.kivi, i + hs, xn, hs * 6.28, 0.5 + hp * 1.3, 0.5 + hs * 0.9, 1, 1, 1); } continue; }
        const xn = side * (lat + hp * 6) / HALF, f = i + hs;
        if (hidden(f, xn)) continue;
        const s = (lap ? 0.5 : 0.8) + hp * 0.55, rot = hs * 6.28;
        const sp = lap ? (hs < 0.6 ? 0 : 2) : bahn ? (hs < 0.35 ? 0 : 2) : zone === 0 ? (hs < 0.55 ? 0 : hs < 0.84 ? 1 : 2) : (hs < 0.3 ? 0 : hs < 0.4 ? 1 : 2);
        const tone = 0.8 + hp * 0.35;
        if (sp === 0) put(inst.kuusi, f, xn, rot, s * (lap ? 0.55 : 1), s, tone, tone, tone);
        else if (sp === 1) put(inst.manty, f, xn, rot, s, s, tone, tone, tone);
        else put(inst.koivu, f, xn, rot, s * (lap ? 0.8 : 1), s * (lap ? 0.7 : 1), ...leafCol(hs));
      }
    }
    // --- sähkölinja pelloilla ja kylissä ---
    if (i % 45 === 0 && zone !== 0 && !bahn && Q.far > 30) {
      const xn = -3.55;
      if (!hidden(i, xn)) {
        single(P.pylvas, i, xn, 0);
        if (zoneOf(sim.seg(i + 45)) !== 0) wires(group, track, i, i + 45, xn, anchor, P);
      }
    }
  }
  // instanssit: kaukomalli heti, lähimalli vasta kun lohko on lähellä
  const lods = {};
  for (const k of ['kuusi', 'manty', 'koivu']) lods[k] = { far: instanced(T[k].far, inst[k], group, false), near: null, data: inst[k], lib: T[k] };
  const tol = instanced([{ geo: P.tolppa.geo, mat: P.tolppa.mats }], inst.tolppa, group, false);
  const vii = instanced([{ geo: P.viitta.geo, mat: P.viitta.mats }], inst.viitta, group, false); vii.forEach(m => snowObjs.push(m));
  instanced([{ geo: P.kivi.geo, mat: P.kivi.mats[0] }], inst.kivi, group, true);
  void tol;
  if (bahn) rails(group, track, i0, anchor, P);
  const bank = snowBank(track, i0, anchor, st, sim); if (bank) { const m = new THREE.Mesh(bank, P.snowM); m.receiveShadow = true; group.add(m); snowObjs.push(m); }
  return { group, lods, signs, snowObjs, near: false, count: inst.kuusi.length / 9 + inst.manty.length / 9 + inst.koivu.length / 9 };
}

function instanced(parts, data, group, shadow) {
  const n = data.length / 9, out = [];
  if (!n) return out;
  for (const p of parts) {
    const m = new THREE.InstancedMesh(p.geo, p.mat, n);
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      Q4.setFromEuler(E3.set(0, data[o + 3], 0));
      M4.compose(V3.set(data[o], data[o + 1], data[o + 2]), Q4, S3.set(data[o + 4], data[o + 5], data[o + 4]));
      m.setMatrixAt(i, M4);
      if (!p.plain) m.setColorAt(i, C3.setRGB(data[o + 6], data[o + 7], data[o + 8]));
    }
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = shadow; m.receiveShadow = true;
    m.computeBoundingSphere();
    group.add(m); out.push(m);
  }
  return out;
}
// lähi- ja kaukomallin vaihto etäisyyden mukaan
export function setLod(sc, near) {
  if (sc.near === near) return;
  sc.near = near;
  for (const k in sc.lods) {
    const L = sc.lods[k];
    if (near && !L.near) L.near = instanced(L.lib.near, L.data, sc.group, true);
    if (L.near) L.near.forEach(m => { m.visible = near; });
    L.far.forEach(m => { m.visible = !near; });
  }
}
export function disposeScenery(sc) {
  sc.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && o.userData.own) o.geometry.dispose(); });
}

function wires(group, track, i1, i2, xn, anchor, P) {
  const v = [], n = 8, a = { x: 0, y: 0, z: 0, th: 0 }, b = { x: 0, y: 0, z: 0, th: 0 };
  track.at(i1, xn, a); track.at(i2, xn, b);
  const ya = groundY(track, i1, xn) + 8.72, yb = groundY(track, i2, xn) + 8.72;
  for (const off of [-1, 0, 1]) {
    const ax = a.x + Math.cos(a.th) * off, az = a.z + Math.sin(a.th) * off, bx = b.x + Math.cos(b.th) * off, bz = b.z + Math.sin(b.th) * off;
    for (let k = 0; k < n; k++) for (const t of [k / n, (k + 1) / n]) v.push(ax + (bx - ax) * t - anchor.x, ya + (yb - ya) * t - 1.4 * 4 * t * (1 - t) - anchor.y, az + (bz - az) * t - anchor.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const l = new THREE.LineSegments(g, P.wireM); l.userData.own = true; group.add(l);
}
// Autobahnin kaiteet: aaltopelti ja tolpat molemmin puolin
function rails(group, track, i0, anchor, P) {
  const pos = [], idx = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= CH; j++) {
      const f = i0 + j, xn = side * 1.2; track.at(f, xn, PT);
      const y = groundY(track, f, xn) - anchor.y, x = PT.x - anchor.x, z = PT.z - anchor.z, ox = Math.cos(PT.th) * side * 0.04, oz = Math.sin(PT.th) * side * 0.04;
      pos.push(x, y + 0.5, z, x - ox, y + 0.6, z - oz, x, y + 0.7, z, x - ox, y + 0.8, z - oz, x, y + 0.9, z);
    }
    for (let j = 0; j < CH; j++) for (let k = 0; k < 4; k++) { const a = base + j * 5 + k, b = a + 5; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const mat = P.railM2 || (P.railM2 = P.railM.clone()); mat.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.userData.own = true; group.add(m);
  const posts = []; for (const side of [-1, 1]) for (let j = 0; j < CH; j += 4) { track.at(i0 + j, side * 1.21, PT); posts.push(PT.x - anchor.x, groundY(track, i0 + j, side * 1.21) - anchor.y - 0.1, PT.z - anchor.z, -PT.th, 1, 1, 1, 1, 1); }
  if (!P.railPost) { P.railPost = new THREE.BoxGeometry(0.08, 0.95, 0.12); P.railPost.translate(0, 0.475, 0); }
  instanced([{ geo: P.railPost, mat: P.railM }], posts, group, false);
}
// lumipenkka tien molemmin puolin (2.0:n penkat kohdassa x = ±1.22)
function snowBank(track, i0, anchor, st, sim) {
  const prof = [[1.03, 0.0], [1.1, 0.34], [1.2, 0.62], [1.3, 0.55], [1.44, 0.2], [1.6, -0.1]];
  const pos = [], uv = [], idx = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let j = 0; j <= CH; j++) {
      const f = i0 + j, k = 0.75 + 0.5 * hash2(f, side + 40);
      const hide = side > 0 && st.ramp && f >= st.ramp.start - 3 && f <= st.ramp.end + 48;
      for (const [xn, h] of prof) {
        track.at(f, side * xn, PT);
        pos.push(PT.x - anchor.x, groundY(track, f, side * xn) - anchor.y + (hide ? -0.6 : Math.max(-0.1, h * k)), PT.z - anchor.z);
        uv.push(f / 3, xn * 3);
      }
    }
    const m = prof.length;
    for (let j = 0; j < CH; j++) for (let k = 0; k < m - 1; k++) { const a = base + j * m + k, b = a + m; if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
void SEGM; void verge; void TREES;
