// PAALAAN! 3.0 – simulaation liikkuvat ja tilapäiset kohteet (st.dyn) 3D-malleina: muu liikenne, peurat ja porot,
// kuopat, kivet, musta jää, liittymäkyltit, mainostaulut, autoliike, asema, ravintola, taksiasiakas, muutto, romu ja kohde.
// Sijainti (z, x) ja törmäykset tulevat simulaatiosta; tämä tiedosto vain piirtää ne.
import * as THREE from 'three';
import { tex, canvasTex, rng } from './assets.js';
import { buildCar } from './cars.js';
import { box, cyl, group as merged, metricUV, gable, gableEnd } from './props.js';
import { HALF, groundY } from './world.js';

const PT = { x: 0, y: 0, z: 0, th: 0, slope: 0 }, V = new THREE.Vector3();
const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o));

// ---------- tekstit kyltteihin ----------
const texts = new Map();
function textTex(lines, o) {
  const key = JSON.stringify([lines, o]);
  if (texts.has(key)) return texts.get(key);
  const W = o.w || 512, H = o.h || 256;
  const t = canvasTex(W, H, g => {
    g.fillStyle = o.bg || '#1447a8'; g.fillRect(0, 0, W, H);
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = W * 0.016; g.strokeRect(W * 0.02, W * 0.02, W - W * 0.04, H - W * 0.04); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      if (!ln.t) return;
      let size = H * (ln.s || 0.3);
      g.font = `bold ${size}px Arial, Helvetica, sans-serif`;
      const w = g.measureText(ln.t).width; if (w > W * 0.9) { size *= W * 0.9 / w; g.font = `bold ${size}px Arial, Helvetica, sans-serif`; }
      g.fillStyle = ln.c || '#fff'; g.fillText(ln.t, W / 2, H * (ln.y !== undefined ? ln.y : (i + 0.5) / n) + size * 0.04);
    });
  }, { clamp: true });
  texts.set(key, t);
  return t;
}
const signMat = (lines, o = {}) => { const t = textTex(lines, o); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 }); };
function sprite(text, color, size) {
  const t = canvasTex(256, 64, (g, W, H) => { g.clearRect(0, 0, W, H); g.font = 'bold 44px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(text, W / 2, H / 2); g.fillStyle = color; g.fillText(text, W / 2, H / 2); }, { clamp: true });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: true })); s.scale.set(size * 4, size, 1);
  return s;
}

export class Dyn {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, track, sim, st, origin, env
    this.map = new Map(); this.ghosts = [];
    this.night = 0;
    const M = this.M = {
      steel: std({ color: 0x8d9296, metalness: 0.7, roughness: 0.45 }), dark: std({ color: 0x2a2c30, roughness: 0.7 }), white: std({ color: 0xe8e8e4 }),
      concrete: std({ map: tex('betoni', 'diff'), color: 0xb0aca6 }), asphalt: std({ map: tex('asfaltti', 'diff'), color: 0x9a9a9a, roughness: 0.92 }),
      glassB: new THREE.MeshPhysicalMaterial({ color: 0x4f7ea8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55, emissive: 0xffe9b0, emissiveIntensity: 0 }),
      red: std({ color: 0xb03a2e, roughness: 0.6 }), blue: std({ color: 0x2f6db5, roughness: 0.5 }), green: std({ color: 0x2f8f4f, roughness: 0.6 }), yellow: std({ color: 0xe8c32a, roughness: 0.6 }),
      beige: std({ map: tex('lauta', 'diff'), color: 0xc8b27a }), roof: std({ map: tex('pelti', 'diff'), color: 0x55595e, metalness: 0.3, roughness: 0.6 }),
      card: std({ color: 0xb08850, roughness: 0.9 }), sofa: std({ color: 0x7a2e2e, roughness: 0.95 }),
      rock: std({ map: tex('kivi', 'diff'), normalMap: tex('kivi', 'nor'), roughness: 0.95 }),
      deer: std({ color: 0x7a5a38, roughness: 0.95 }), poro: std({ color: 0x8c7d6a, roughness: 0.95 }), pale: std({ color: 0xe6dfd0, roughness: 0.95 }), antler: std({ color: 0x5a4a36, roughness: 0.8 }),
      eye: new THREE.MeshBasicMaterial({ color: 0xffffaa, fog: false }),
      skin: std({ color: 0xe8b890 }), coat: std({ color: 0x2f6db5, roughness: 0.9 }), trousers: std({ color: 0x2a2a3a }), hat: std({ color: 0x3a2a1a }),
      ice: new THREE.MeshPhysicalMaterial({ color: 0x0a1016, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.7, transparent: true, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      beacon: new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xffb020, emissiveIntensity: 2 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 0 }),
      charger: std({ color: 0x2f6db5, roughness: 0.4 }), screen: new THREE.MeshStandardMaterial({ color: 0x0c2030, emissive: 0x7fdcff, emissiveIntensity: 1.2 }), off: std({ color: 0x55585c }),
    };
    this.signs = [];
    // kuoppa: tumma rosoreunainen reikä ja lätäkkö
    M.hole = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (g, W, H) => {
      g.clearRect(0, 0, W, H); const r = rng(31);
      // murtunut vaalea reuna erottuu tummasta tiestä ja ajovaloissa, keskellä musta reikä ja lätäkkö
      for (let i = 0; i < 46; i++) { const v = 135 + r() * 55 | 0; g.fillStyle = `rgba(${v},${v},${v - 8},1)`; g.beginPath(); g.ellipse(W / 2 + (r() - 0.5) * 170, H / 2 + (r() - 0.5) * 70, 20 + r() * 26, 11 + r() * 16, r() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 34; i++) { g.fillStyle = `rgba(${6 + r() * 10 | 0},${6 + r() * 10 | 0},${8 + r() * 10 | 0},1)`; g.beginPath(); g.ellipse(W / 2 + (r() - 0.5) * 120, H / 2 + (r() - 0.5) * 40, 18 + r() * 24, 9 + r() * 13, r() * 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(70,92,125,1)'; g.beginPath(); g.ellipse(W / 2 - 14, H / 2 + 4, 44, 12, 0.1, 0, 7); g.fill();
    }, { clamp: true }), alphaTest: 0.3, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    M.glow = new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g, W) => { const gr = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,250,220,0.55)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, W); }, { clamp: true }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    M.glowR = M.glow.clone(); M.glowR.color.setRGB(1, 0.12, 0.08);
    this.geo = {};
    this.models = this.sim.MODELS;
  }
  // ----- yhteiset sijoitusapurit -----
  place(o, f, xn, yaw = 0, lift = 0, road = false) {
    this.track.at(f, xn, PT);
    const y = road ? PT.y - 0.02 * Math.abs(xn) * HALF : groundY(this.track, f, xn);
    o.position.set(PT.x - this.origin.x, y + lift, PT.z - this.origin.z);
    o.rotation.y = -PT.th + yaw;
    return PT;
  }
  // päällystetty piha tien reunasta rakennukselle (peittää ojan)
  pad(f, xn0, xn1, half, mat) {
    const pos = [], uv = [], idx = [], n = Math.max(2, Math.round(half)), a = { x: 0, y: 0, z: 0, th: 0, slope: 0 };
    this.track.at(f, 0, a); const ox = a.x, oz = a.z, oy = a.y;
    for (let j = 0; j <= n; j++) {
      const ff = f - half + 2 * half * j / n, taper = Math.min(1, Math.min(j, n - j) / (n * 0.18));
      for (const xn of [xn0, xn0 + (xn1 - xn0) * (0.35 + 0.65 * taper)]) { this.track.at(ff, xn, a); pos.push(a.x - ox, a.y - 0.02 * HALF + 0.02 - oy, a.z - oz); uv.push(xn * HALF / 3, ff / 3); }
    }
    for (let j = 0; j < n; j++) { const b = j * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData.abs = new THREE.Vector3(ox, oy, oz);
    return m;
  }
  mesh(parts, shadow = true) { const p = merged(parts), m = new THREE.Mesh(p.geo, p.mats); m.castShadow = shadow; m.receiveShadow = true; return m; }

  // ----- mallit -----
  animal(poro) {
    const M = this.M, body = poro ? M.poro : M.deer, G = new THREE.Group(), s = poro ? 1.08 : 1;
    const ell = (rx, ry, rz, x, y, z) => { const g = new THREE.SphereGeometry(1, 10, 8); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
    const parts = [{ geo: ell(0.26, 0.3, 0.62, 0, 1.0, 0), mat: body }, { geo: ell(0.24, 0.27, 0.3, 0, 1.03, 0.36), mat: body },
      { geo: (() => { const g = cyl(0.09, 0.13, 0.55, 7); g.rotateX(-0.75); g.translate(0, 1.12, -0.5); return g; })(), mat: poro ? M.pale : body },
      { geo: ell(0.1, 0.11, 0.2, 0, 1.62, -0.98), mat: body }, { geo: ell(0.06, 0.06, 0.1, 0, 1.58, -1.14), mat: poro ? M.pale : body },
      { geo: ell(0.03, 0.09, 0.05, -0.11, 1.74, -0.9), mat: body }, { geo: ell(0.03, 0.09, 0.05, 0.11, 1.74, -0.9), mat: body },
      { geo: ell(0.09, 0.12, 0.05, 0, 1.08, 0.63), mat: poro ? M.pale : M.white }];
    // sarvet: peuralla pienet, porolla isot haarat
    const tine = (x, y, z, rx, rz, len) => { const g = cyl(0.012, 0.022, len, 5); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return { geo: g, mat: M.antler }; };
    for (const sx of [-1, 1]) { parts.push(tine(sx * 0.06, 1.72, -0.95, 0.3, -sx * 0.35, poro ? 0.55 : 0.28)); if (poro) { parts.push(tine(sx * 0.2, 2.15, -0.86, -0.7, -sx * 0.1, 0.34), tine(sx * 0.14, 1.95, -0.92, -1.1, -sx * 0.5, 0.3), tine(sx * 0.07, 1.74, -1.0, -1.5, -sx * 0.2, 0.24)); } else parts.push(tine(sx * 0.13, 1.93, -0.9, -0.5, -sx * 0.2, 0.16)); }
    const b = this.mesh(parts); G.add(b);
    const legs = [];
    for (const [x, z] of [[-0.13, -0.42], [0.13, -0.42], [-0.13, 0.4], [0.13, 0.4]]) { const l = new THREE.Mesh(cyl(0.032, 0.05, 0.86, 6, 0, -0.86, 0), body); l.position.set(x, 0.88, z); l.castShadow = true; G.add(l); legs.push(l); }
    const eyes = [];
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), M.eye); e.position.set(sx * 0.085, 1.66, -1.02); e.visible = false; G.add(e); eyes.push(e); }
    G.scale.setScalar(s);
    return { group: G, legs, eyes, phase: Math.random() * 6 };
  }
  person() {
    const M = this.M, G = new THREE.Group();
    G.add(this.mesh([{ geo: cyl(0.075, 0.085, 0.85, 7, -0.1, 0, 0), mat: M.trousers }, { geo: cyl(0.075, 0.085, 0.85, 7, 0.1, 0, 0), mat: M.trousers }, { geo: (() => { const g = new THREE.CapsuleGeometry(0.2, 0.45, 4, 10); g.scale(1, 1, 0.7); g.translate(0, 1.2, 0); return g; })(), mat: M.coat },
      { geo: (() => { const g = new THREE.SphereGeometry(0.115, 10, 8); g.translate(0, 1.68, 0); return g; })(), mat: M.skin }, { geo: (() => { const g = new THREE.SphereGeometry(0.122, 10, 6, 0, 7, 0, 1.5); g.translate(0, 1.7, 0); return g; })(), mat: M.hat },
      { geo: (() => { const g = cyl(0.05, 0.055, 0.6, 6, 0, -0.6, 0); g.rotateZ(0.12); g.translate(-0.25, 1.45, 0); return g; })(), mat: M.coat }]));
    const arm = new THREE.Mesh(cyl(0.05, 0.055, 0.62, 6), M.coat); arm.position.set(0.24, 1.42, 0); arm.castShadow = true; G.add(arm);
    const lbl = sprite('TAKSI!', '#ffe94a', 0.55); lbl.position.set(0, 2.5, 0); G.add(lbl);
    return { group: G, arm };
  }
  board(w, h, legH, mat, lit) { // taulu kahdella jalalla
    const M = this.M, G = new THREE.Group();
    G.add(this.mesh([{ geo: cyl(0.09, 0.09, legH + h * 0.5, 8, -w * 0.36, 0, -0.06), mat: M.steel }, { geo: cyl(0.09, 0.09, legH + h * 0.5, 8, w * 0.36, 0, -0.06), mat: M.steel }, { geo: box(w + 0.16, h + 0.16, 0.1, 0, legH + h / 2, -0.03), mat: M.dark }]));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); face.position.set(0, legH + h / 2, 0.03); G.add(face);
    if (lit) for (const x of [-w * 0.3, 0, w * 0.3]) { const l = new THREE.Mesh(box(0.3, 0.06, 0.25, x, legH + h + 0.22, 0.3), M.lamp); G.add(l); }
    this.signs.push(mat);
    return G;
  }
  make(d) {
    const M = this.M, sim = this.sim, f = d.z / sim.SEG;
    const o = { d, group: null, kind: d.k, static: true };
    switch (d.k) {
      case 'auto': case 'vasta': {
        // noin joka kahdeksas on bussi tai kuorma-auto (vain näkymässä; simulaatio kohtelee niitä kuten muitakin autoja)
        const r = this.force && this.force.length ? this.force.shift() : Math.random(); // force: testejä varten
        let car;
        if (r < 0.06) car = buildCar({ b: 'bus', c: ['#C8C24A', '#1E5AA8', '#E8E8E4'][Math.floor(Math.random() * 3)], tl: 'wide' }, { name: 'Bussi', lod: 1, plate: Math.floor(Math.random() * 12) });
        else if (r < 0.12) car = buildCar({ b: 'van', c: ['#ECECEC', '#B03A2E', '#2F6DB5', '#3A3F44'][Math.floor(Math.random() * 4)], tl: 'vertical' }, { name: 'Kuorma-auto', lod: 1, type: 'b', plate: Math.floor(Math.random() * 12) });
        else {
          const m = this.models[Math.floor(Math.random() * this.models.length)];
          const spec = Object.assign({}, m[1], { c: d.col });
          delete spec.r;
          car = buildCar(spec, { name: m[0], lod: 1, plate: Math.floor(Math.random() * 12) });
        }
        o.car = car; o.group = car.group; o.static = false; o.len = car.S.L;
        // simulaation osumaraja on mitoitettu henkilöautolle (keskipisteet 4,4 m): pitkä ajoneuvo siirretään eteenpäin,
        // jolloin osuma tulee sen takapuskurin (tai vastaantulijan keulan) kohdalla
        o.shift = Math.max(0, (car.S.L - 4.6) / 2);
        if (d.k === 'vasta') { // vastaantulijan ajovalojen hehku
          for (const sx of [-1, 1]) { const s = new THREE.Sprite(M.glow); s.position.set(sx * car.S.W * 0.36, car.S.B.nose - 0.1, car.mid - car.S.L - 0.05); s.scale.setScalar(1.1); car.group.add(s); (o.glows = o.glows || []).push(s); }
        } else for (const sx of [-1, 1]) { const s = new THREE.Sprite(M.glowR); s.position.set(sx * car.S.W * 0.36, car.S.B.belt - 0.05, car.mid + 0.05); s.scale.setScalar(0.5); car.group.add(s); (o.glows = o.glows || []).push(s); }
        break; }
      case 'peura': case 'poro': { const a = this.animal(d.k === 'poro'); Object.assign(o, a); o.static = false; o.face = Math.random() < 0.5 ? 1 : -1; break; }
      case 'kuoppa': { const g = new THREE.PlaneGeometry(2.6, 2.5); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 2 * 0); o.group = new THREE.Mesh(g, M.hole); o.road = true; o.flat = true; o.lift = 0.03; break; }
      case 'kivi': { if (!this.geo.rock) { const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position; const h3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
          for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.75 + 0.45 * h3(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40)); p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); this.geo.rock = g; }
        o.group = new THREE.Mesh(this.geo.rock, M.rock); o.group.scale.set(0.8, 0.5, 0.7); o.group.castShadow = true; o.road = true; o.lift = 0.12; o.yaw = Math.random() * 6; break; }
      case 'jää': { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); o.group = new THREE.Mesh(g, M.ice); o.group.scale.set(d.w * HALF, 1, 3.6); o.road = true; o.flat = true; o.lift = 0.035; break; }
      case 'kyltti': { // liittymäkyltti: tolpat ovat simulaation törmäyskohdissa (x ja x + 0.52)
        const w = 0.52 * HALF + 0.5, mat = signMat([{ t: d.t, s: d.s ? 0.34 : 0.44, y: d.s ? 0.36 : 0.5 }, { t: d.s || '', s: 0.2, y: 0.72 }], { bg: '#1447a8', border: '#fff' });
        const G = new THREE.Group(), b = this.board(w, 1.9, 1.9, mat, false); b.position.x = 0.26 * HALF; G.add(b); o.group = G; break; }
      case 'mainos': {
        const mat = signMat([{ t: d.t, s: 0.36, c: '#ffe94a', y: 0.36 }, { t: d.s, s: 0.2, y: 0.74 }], { bg: d.hot ? '#b03a2e' : '#352879', border: '#fff', w: 1024, h: 384 });
        o.group = this.board(8.6, 3.2, 2.6, mat, true); o.yaw = -0.3; o.lit = mat; break; }
      case 'ravintola': {
        const G = new THREE.Group(), mat = signMat([{ t: d.t, s: 0.5 }], { bg: '#b03a2e', border: '#fff', h: 192 });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.3), mat); sign.position.set(0, 4.0, 0.08); this.signs.push(mat);
        G.add(this.mesh([{ geo: cyl(0.08, 0.1, 4.6, 8), mat: M.steel }, { geo: box(3.56, 1.46, 0.12, 0, 4.0, 0), mat: M.dark },
          { geo: metricUV(box(5.2, 2.8, 4.2, 4.2, 1.4, -1.5), 0.6), mat: M.beige }, { geo: box(5.6, 0.18, 4.8, 4.2, 2.9, -1.5), mat: M.roof }, { geo: box(0.06, 1.2, 2.6, 1.58, 1.6, -1.5), mat: M.glassB }, { geo: box(0.9, 0.5, 2.9, 1.3, 2.35, -1.5), mat: M.red }]), sign);
        o.group = G; o.padW = [1, 2.6, 9]; break; }
      case 'asiakas': { const p = this.person(); o.group = p.group; o.arm = p.arm; o.static = false; o.fixed = true; o.yaw = Math.PI / 2; break; }
      case 'muutto': {
        const G = new THREE.Group();
        G.add(this.mesh([{ geo: metricUV(box(8.4, 3.2, 6.4, 0, 1.6, 0), 0.9), mat: M.beige }, { geo: gableEnd(8.4, 3.2, 5.8, 3.2), mat: M.beige }, { geo: gableEnd(8.4, 3.2, 5.8, -3.2), mat: M.beige }, { geo: gable(8.4, 6.4, 3.2, 5.88), mat: M.roof },
          { geo: box(0.08, 1.2, 1.1, -4.22, 1.9, 1.6), mat: M.glassB }, { geo: box(0.08, 1.2, 1.1, -4.22, 1.9, -1.6), mat: M.glassB }, { geo: box(0.08, 2.0, 0.95, -4.22, 1.0, 0), mat: M.dark },
          { geo: box(0.9, 0.8, 0.9, -6.2, 0.4, 1.8), mat: M.card }, { geo: box(0.8, 0.7, 0.8, -6.1, 1.15, 1.75), mat: M.card }, { geo: box(0.9, 0.8, 0.9, -5.2, 0.4, 2.6), mat: M.card },
          { geo: box(0.9, 0.75, 2.1, -6.0, 0.38, -1.9), mat: M.sofa }, { geo: box(0.3, 0.6, 2.1, -5.6, 0.95, -1.9), mat: M.sofa }]));
        const lbl = sprite('MUUTTO', '#ffe94a', 0.9); lbl.position.set(-5.5, 3.2, 0); G.add(lbl);
        o.group = G; o.padW = [1, 1.25, 8]; o.padMat = 'gravel'; break; }
      case 'romu': {
        const G = new THREE.Group(), wreck = buildCar({ b: 'sedan', c: '#7A4A1E', tl: 'corner' }, { lod: 1, name: '' });
        wreck.wheels.forEach((w, i) => { if (i !== 1) w.pivot.visible = false; });
        wreck.group.rotation.set(0.06, 0.5, 0.09); wreck.group.position.y = -0.12; G.add(wreck.group);
        const lbl = sprite('ROMU', '#ffe94a', 0.9); lbl.position.set(0, 2.6, 0); G.add(lbl);
        o.group = G; break; }
      case 'kohde': {
        const G = new THREE.Group();
        G.add(this.mesh([{ geo: cyl(0.05, 0.06, 3.2, 8), mat: M.yellow }, { geo: box(1.5, 0.6, 0.06, 0.8, 2.75, 0), mat: M.dark }]));
        const bc = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.beacon.clone()); bc.position.y = 3.3; G.add(bc); o.beacon = bc.material;
        const mat = signMat([{ t: d.t, s: 0.6 }], { bg: '#e8c32a', h: 128 }); mat.map.needsUpdate = true;
        const mt = signMat([{ t: d.t, s: 0.62, c: '#111' }], { bg: '#e8c32a', h: 128 });
        for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.54), mt); p.position.set(0.8, 2.75, s * 0.035); if (s < 0) p.rotation.y = Math.PI; G.add(p); }
        this.signs.push(mt); o.group = G; o.static = false; o.fixed = true; break; }
      case 'asema': {
        // lataus- ja huoltoasema: katos, pikalaturi ja polttoainemittari (bränditön)
        const G = new THREE.Group(), cw = 11.5, ch = 5.2;
        const evBroken = d.broken;
        const sm = signMat([{ t: 'ASEMA', s: 0.4, c: '#111', y: 0.3 }, { t: `LATAUS ${d.kw} kW`, s: 0.3, c: '#111', y: 0.72 }], { bg: '#e8e8e8', w: 1024, h: 192 });
        this.signs.push(sm);
        G.add(this.mesh([{ geo: cyl(0.16, 0.18, ch, 10, -cw * 0.38, 0, 0), mat: M.steel }, { geo: cyl(0.16, 0.18, ch, 10, cw * 0.38, 0, 0), mat: M.steel },
          { geo: box(cw, 0.55, 6.4, 0, ch + 0.27, 0), mat: M.white }, { geo: box(cw + 0.04, 0.2, 6.44, 0, ch + 0.1, 0), mat: M.green },
          { geo: box(cw * 0.7, 0.16, 1.6, 0, 0.08, 0), mat: M.concrete },
          { geo: box(0.7, 2.1, 0.5, -1.4, 1.2, 0), mat: evBroken ? M.off : M.charger }, { geo: box(0.44, 0.5, 0.04, -1.4, 1.75, -0.27), mat: evBroken ? M.dark : M.screen },
          { geo: box(0.6, 1.5, 0.45, 1.8, 0.9, 0), mat: M.red }, { geo: box(0.4, 0.3, 0.04, 1.8, 1.3, -0.245), mat: M.white },
          { geo: metricUV(box(7, 3.2, 5, 0, 1.6, 8.4), 0.5), mat: M.concrete }, { geo: box(7.4, 0.25, 5.4, 0, 3.3, 8.4), mat: M.dark }, { geo: box(5.4, 2.0, 0.08, 0, 1.4, 5.86), mat: M.glassB }]));
        for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(cw * 0.86, 0.44), sm); p.position.set(0, ch + 0.33, s * 3.215); if (s < 0) p.rotation.y = Math.PI; G.add(p); }
        const lampG = new THREE.Mesh(box(cw * 0.8, 0.05, 4.6, 0, ch - 0.03, 0), M.lamp); G.add(lampG);
        if (evBroken) { const lbl = sprite('LATURI RIKKI', '#ff4030', 0.5); lbl.position.set(-1.4, 2.9, -0.4); G.add(lbl); o.brokenLbl = lbl; }
        G.rotation.order = 'YXZ';
        o.group = G; o.yaw = Math.PI / 2; o.padW = [1, 3.0, 13]; break; }
      case 'liike': {
        // autoliike: lasinen näyttelytila, liput ja kaksi autoa pihassa
        const G = new THREE.Group(), w = 12.6, h = 5.2, dp = 8;
        const sm = signMat([{ t: 'AUTOLIIKE', s: 0.62 }], { bg: '#b03a2e', w: 1024, h: 128 });
        const used = signMat([{ t: 'KÄYTY', s: 0.62 }], { bg: '#55585c', w: 1024, h: 128 });
        this.signs.push(sm, used);
        const parts = [{ geo: metricUV(box(w, h, dp, 0, h / 2, 0), 0.4), mat: M.white }, { geo: box(w - 0.6, h - 1.9, 0.12, 0, (h - 1.9) / 2 + 0.25, -dp / 2 - 0.02), mat: M.glassB }, { geo: box(w + 0.5, 1.1, dp + 0.5, 0, h + 0.2, 0), mat: M.red }];
        for (const x of [-4.2, -1.4, 1.4, 4.2]) parts.push({ geo: box(0.14, h - 1.9, 0.18, x, (h - 1.9) / 2 + 0.25, -dp / 2 - 0.04), mat: M.dark });
        for (const [x, mt] of [[-w / 2 - 1.4, M.yellow], [w / 2 + 1.4, M.blue]]) parts.push({ geo: cyl(0.045, 0.06, 8, 8, x, 0, -dp / 2 - 2), mat: M.steel }, { geo: box(1.5, 0.95, 0.03, x + 0.78, 7.4, -dp / 2 - 2), mat: mt });
        G.add(this.mesh(parts));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.9), sm); face.position.set(0, h + 0.2, -dp / 2 - 0.27); face.rotation.y = Math.PI; G.add(face); o.face = face; o.sm = sm; o.used = used;
        const cols = ['#A3121A', '#ECECEC'], names = ['hatch', 'suv'];
        [-3.4, 3.4].forEach((x, i) => { const c = buildCar({ b: names[i], c: cols[i], tl: i ? 'bar' : 'wide' }, { lod: 1, name: '' }); c.group.position.set(x, 0.03, -dp / 2 - 4.2); c.group.rotation.y = i ? 0.35 : -0.3; G.add(c.group); });
        o.group = G; o.yaw = -Math.PI / 2; o.padW = [1, 3.4, 15]; break; }
      default: return null;
    }
    if (!o.group) return null;
    this.scene.add(o.group);
    if (o.padW) { const p = this.pad(f, o.padW[0] - 0.02, Math.abs(d.x) + (o.padW[1] - Math.abs(d.x)) + 0.9, o.padW[2], o.padMat === 'gravel' ? this.M.concrete : this.M.asphalt); o.padMesh = p; this.scene.add(p); }
    if (o.static || o.fixed) this.settle(o);
    // kaukana syntyvä kohde häivytetään näkyviin (simulaatio tuo kohteet 110–150 metrin päähän)
    if ((d.z - (this.st.pos + sim.PZ)) / sim.SEG > 35) this.fadeIn(o);
    return o;
  }
  // Valojen hehku pienenee auton lähestyessä ja sammuu lähellä: iso läikkä kameran vieressä välähdytti koko ruudun.
  glow(o, rel, night) {
    if (!o.glows) return;
    const on = o.d.k === 'vasta', k = Math.max(0, Math.min(1, (rel - 10) / 30));
    for (const s of o.glows) { s.visible = k > 0.02 && (on || night > 0.3); s.scale.setScalar((on ? 0.45 + night * 0.75 : 0.35 + night * 0.25) * k); }
  }
  // Häivytys: materiaalit vaihdetaan hetkeksi rasteroiduiksi kopioiksi (alphaHash), jolloin läpinäkyvyys ei vaadi lajittelua.
  fadeIn(o) {
    const swaps = [];
    o.group.traverse(m => {
      if (!m.material || m.isSprite) return;
      const orig = m.material, arr = Array.isArray(orig) ? orig : [orig];
      const tmp = arr.map(x => { const c = x.clone(); c.alphaHash = true; c.opacity = 0; c.transparent = false; c.depthWrite = true; return c; });
      m.material = Array.isArray(orig) ? tmp : tmp[0];
      swaps.push({ m, orig, tmp });
    });
    o.fade = { t: 0, swaps };
  }
  fadeStep(o, dt) {
    const F = o.fade; if (!F) return;
    F.t += dt / 0.9;
    const a = Math.min(1, F.t);
    for (const s of F.swaps) for (const c of s.tmp) c.opacity = a * (s.orig.opacity !== undefined ? s.orig.opacity : 1);
    if (a < 1) return;
    for (const s of F.swaps) { s.m.material = s.orig; s.tmp.forEach(c => c.dispose()); }
    o.fade = null;
  }
  settle(o) {
    const d = o.d, f = d.z / this.sim.SEG;
    // rakennukset seisovat tien tasossa pihan päällä, muut maan pinnalla
    const P = this.place(o.group, f, d.x, o.yaw || 0, o.lift || 0, !!o.road || !!o.padW);
    // tien pinnalla makaavat läikät kallistetaan mäen ja tien kuperuuden mukaan, muuten ne jäävät asfaltin alle
    if (o.flat) { o.group.rotation.order = 'YXZ'; o.group.rotation.x = Math.atan(P.slope); o.group.rotation.z = -Math.sign(d.x) * 0.02; }
    if (o.padW) o.group.position.y += 0.03;
    if (o.padMesh) o.padMesh.position.copy(o.padMesh.userData.abs).sub(this.origin);
  }
  rebase() { for (const o of this.map.values()) if (o.static || o.fixed) this.settle(o); for (const g of this.ghosts) this.settle(g); }
  remove(o) {
    if (o.fade) { for (const s of o.fade.swaps) { s.m.material = s.orig; s.tmp.forEach(c => c.dispose()); } o.fade = null; }
    this.scene.remove(o.group); if (o.padMesh) { this.scene.remove(o.padMesh); o.padMesh.geometry.dispose(); }
    o.group.traverse(m => { if (m.isMesh && m.geometry && !m.geometry.userData.shared && (o.car || m.geometry.type === 'BufferGeometry') && m.geometry !== this.geo.rock) m.geometry.dispose(); });
  }
  clear() { for (const o of this.map.values()) this.remove(o); this.map.clear(); for (const g of this.ghosts) this.remove(g); this.ghosts.length = 0; }

  update(dt, pz, carPos, carTh, night, flash) {
    const { st, sim, map } = this, SEG = sim.SEG, now = performance.now() / 1000;
    this.night = night;
    const seen = new Set();
    for (const d of st.dyn) {
      let o = map.get(d);
      if (!o) { o = this.make(d); if (!o) continue; map.set(d, o); }
      seen.add(d);
      if (o.fade) this.fadeStep(o, dt);
      const f = d.z / SEG;
      if (o.car) {
        const P = this.place(o.group, f + (o.shift || 0), d.x, d.k === 'vasta' ? Math.PI : 0, 0, true);
        o.group.rotation.x = Math.atan(P.slope) * (d.k === 'vasta' ? -1 : 1);
        o.car.update({ dt, speed: Math.abs(d.v) / SEG });
        this.glow(o, (d.z - pz) / SEG, night);
      } else if (o.legs) {
        // eläin: kävelee tien yli tai seisoo tiellä; silmät heijastavat ajovaloissa
        const moving = Math.abs(d.vx) > 0.01 && ((d.z - pz) / SEG < d.wake || d.k === 'poro');
        this.place(o.group, f, d.x, (d.vx > 0 ? -1 : d.vx < 0 ? 1 : o.face) * Math.PI / 2 * (Math.abs(d.vx) > 0.2 ? 1 : 0.6));
        o.phase += dt * (moving ? 9 * Math.min(1.5, Math.abs(d.vx) + 0.4) : 0);
        o.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(o.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * 0.5 : 0; });
        const dist = (d.z - pz) / SEG;
        const lit = night > 0.3 && dist > 2 && dist < 95;
        o.eyes.forEach(e => { e.visible = lit; if (lit) e.scale.setScalar(1 + dist * 0.035); });
      } else if (o.arm) { o.arm.rotation.z = -2.2 + Math.sin(now * 7) * 0.5; }
      else if (o.beacon) { o.beacon.emissiveIntensity = Math.floor(now * 3.3) % 2 ? 4 : 0.6; }
      if (d.k === 'liike' && o.face) { const want = d.used ? o.used : o.sm; if (o.face.material !== want) o.face.material = want; }
    }
    // poistuneet: ohitetut kohteet ja liikenne jäävät näkyviin, kunnes ne ovat kameran takana (simulaatio poistaa ne heti)
    for (const [d, o] of map) {
      if (seen.has(d)) continue;
      map.delete(d);
      const behind = d.z < pz + SEG * 1.5;
      if (o.car || (behind && d.k !== 'peura' && d.k !== 'poro' && d.k !== 'kuoppa' && d.k !== 'kivi')) { o.t = 0; this.ghosts.push(o); }
      else this.remove(o);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const o = this.ghosts[i], d = o.d; o.t += dt;
      if (o.car) { d.z += d.v * dt; const P = this.place(o.group, d.z / SEG + (o.shift || 0), d.x, d.k === 'vasta' ? Math.PI : 0, 0, true); o.group.rotation.x = Math.atan(P.slope) * (d.k === 'vasta' ? -1 : 1); o.car.update({ dt, speed: Math.abs(d.v) / SEG }); this.glow(o, (d.z - pz) / SEG, night); }
      const rel = (d.z - pz) / SEG;
      if (rel < -45 || rel > 400 || o.t > 12) { this.remove(o); this.ghosts.splice(i, 1); }
    }
    // kyltit ja valot pimeällä
    const e = night > 0.3 ? 0.55 : 0;
    for (const m of this.signs) m.emissiveIntensity = e;
    this.M.hole.emissiveMap = this.M.hole.map; this.M.hole.emissiveIntensity = 0.04 + night * 0.3; // kuopan vaalea reuna erottuu myös pimeällä
    this.M.lamp.emissiveIntensity = night > 0.3 ? 3 : 0; this.M.glassB.emissiveIntensity = night > 0.3 ? 0.9 : 0;
    void carPos; void carTh; void flash; void V;
  }
}
