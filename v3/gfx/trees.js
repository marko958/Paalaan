// PAALAAN! 3.0 – puut: kuusi, mänty ja koivu. Geometria ja lehvästön tekstuurit syntyvät koodissa, kaarna on Poly Havenista.
import * as THREE from 'three';
import { canvasTex, rng, tex } from './assets.js';

// ---------- tekstuurit ----------
// Havupuun oksisto: yläosa (v 0.25..1) riippuvia havuja läpinäkyvällä reunalla, alaosa (v 0..0.25) kaarnaa runkoa varten.
function coniferTex(seed, o) {
  return canvasTex(512, 512, (g, W, H) => {
    const r = rng(seed), top = 0, bot = H * 0.75;
    g.clearRect(0, 0, W, H);
    for (let pass = 0; pass < 3; pass++) {
      const n = pass === 0 ? 70 : 46;
      for (let i = 0; i < n; i++) {
        const x = r() * W, len = (0.45 + r() * 0.55) * (bot - top) * (pass === 0 ? 0.75 : 1), w = 14 + r() * 22;
        const sway = (r() - 0.5) * 26, shade = 0.55 + pass * 0.2 + r() * 0.2;
        for (let dx = -W; dx <= W; dx += W) {
          // oksan ranka
          g.strokeStyle = `rgba(${o.twig[0] * shade | 0},${o.twig[1] * shade | 0},${o.twig[2] * shade | 0},1)`; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(x + dx, top); g.quadraticCurveTo(x + dx + sway * 0.3, top + len * 0.5, x + dx + sway, top + len); g.stroke();
          // neulaset: lyhyitä viivoja rangan molemmin puolin, kärkeä kohti lyhyempiä
          const steps = Math.floor(len / 3.2);
          for (let k = 0; k < steps; k++) {
            const t = k / steps, px = x + dx + sway * t * t, py = top + len * t, nl = w * (1 - t * 0.75) * (0.5 + r() * 0.5);
            const c = o.needle, l = shade * (0.75 + r() * 0.45) * (0.8 + t * 0.35);
            g.strokeStyle = `rgba(${Math.min(255, c[0] * l) | 0},${Math.min(255, c[1] * l) | 0},${Math.min(255, c[2] * l) | 0},1)`; g.lineWidth = 1.6;
            for (const s of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + s * nl * (0.5 + r() * 0.5), py + nl * (0.35 + r() * 0.5)); g.stroke(); }
          }
          if (o.snow) { // lumi oksien päällä: valkoisia läiskiä rangan yläosassa
            for (let k = 0; k < steps; k += 2) {
              const t = k / steps; if (r() < 0.25) continue;
              const px = x + dx + sway * t * t + (r() - 0.5) * w * 0.9, py = top + len * t + (r() - 0.5) * 6, v = 225 + r() * 30 | 0;
              g.fillStyle = `rgba(${v},${v},${Math.min(255, v + 6)},${0.75 + r() * 0.25})`; g.beginPath(); g.ellipse(px, py, 5 + r() * 9, 3 + r() * 4, 0, 0, 7); g.fill();
            }
          }
        }
      }
    }
    // kaarnakaista
    for (let y = bot; y < H; y++) for (let x = 0; x < W; x += 4) {
      const v = 0.75 + r() * 0.5; g.fillStyle = `rgb(${o.bark[0] * v | 0},${o.bark[1] * v | 0},${o.bark[2] * v | 0})`; g.fillRect(x, y, 4, 1);
    }
  });
}
// Koivun lehvästö: pieniä lehtiä riippuvissa oksissa. Harmaasävy, jotta materiaalin väri voi sävyttää sen kesästä ruskaan.
function leafTex(seed) {
  return canvasTex(256, 256, (g, W, H) => {
    const r = rng(seed);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < 17; i++) {
      let x = W * (0.12 + r() * 0.76), y = H * (0.02 + r() * 0.3);
      const len = H * (0.45 + r() * 0.5), sway = (r() - 0.5) * 60, n = Math.floor(len / 5);
      for (let k = 0; k < n; k++) {
        const t = k / n, px = x + sway * t * t, py = y + len * t;
        for (let j = 0; j < 3; j++) {
          const v = 95 + r() * 160 | 0, a = r() * 6.28, s = 3.2 + r() * 3.6;
          g.fillStyle = `rgb(${v * 0.93 | 0},${v},${v * 0.8 | 0})`;
          g.beginPath(); g.ellipse(px + (r() - 0.5) * 22, py + (r() - 0.5) * 8, s, s * 0.62, a, 0, 7); g.fill();
        }
      }
    }
  }, { clamp: true });
}
// Lehdetön koivu: ohuita riippuvia oksia
function twigTex(seed) {
  return canvasTex(256, 256, (g, W, H) => {
    const r = rng(seed);
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x0 = W * (0.25 + r() * 0.5), y0 = H * 0.02;
      const branch = (x, y, ang, len, w, d) => {
        const x2 = x + Math.sin(ang) * len, y2 = y + Math.cos(ang) * len;
        const v = 200 + r() * 55 | 0;
        g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = w;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 10, (y + y2) / 2, x2, y2); g.stroke();
        if (d > 0) for (let k = 0; k < 3; k++) branch(x + (x2 - x) * (0.3 + r() * 0.6), y + (y2 - y) * (0.3 + r() * 0.6), ang + (r() - 0.5) * 1.5, len * (0.45 + r() * 0.3), Math.max(0.8, w * 0.6), d - 1);
      };
      branch(x0, y0, (r() - 0.5) * 0.9, H * (0.5 + r() * 0.35), 2.4, 3);
    }
  }, { clamp: true });
}
// Koivun tuohi: valkoinen pinta, tummat vaakajuovat ja tyvi
function birchBarkTex() {
  return canvasTex(128, 512, (g, W, H) => {
    const r = rng(77);
    g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { const v = 200 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v - 8},0.5)`; g.fillRect(r() * W, r() * H, 6 + r() * 20, 1 + r() * 2); }
    for (let i = 0; i < 70; i++) {
      const y = r() * H, x = r() * W, w = 8 + r() * 40, h = 1.5 + r() * 5;
      g.fillStyle = `rgba(${25 + r() * 30 | 0},${22 + r() * 25 | 0},${20 + r() * 20 | 0},${0.7 + r() * 0.3})`;
      for (const dx of [-W, 0, W]) { g.beginPath(); g.ellipse(x + dx, y, w / 2, h / 2, 0, 0, 7); g.fill(); }
    }
    const gr = g.createLinearGradient(0, H * 0.8, 0, H); gr.addColorStop(0, 'rgba(40,34,28,0)'); gr.addColorStop(1, 'rgba(40,34,28,0.92)');
    g.fillStyle = gr; g.fillRect(0, H * 0.8, W, H * 0.2);
  });
}

// ---------- geometria ----------
function merge(parts) { // parts: [{pos, nor, uv, col?, idx}]
  let nv = 0, ni = 0; for (const p of parts) { nv += p.pos.length / 3; ni += p.idx.length; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3).fill(1), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const p of parts) {
    pos.set(p.pos, vo * 3); nor.set(p.nor, vo * 3); uv.set(p.uv, vo * 2);
    if (p.col) col.set(p.col, vo * 3);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += p.pos.length / 3; io += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); // varjostus: lehvästön sisäosat tummempia
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
// kartiomainen runko tai oksa pisteestä a pisteeseen b
function limb(a, b, ra, rb, sides, v0, v1, uRep = 1) {
  const pos = [], nor = [], uv = [], idx = [];
  const d = new THREE.Vector3().subVectors(b, a), len = d.length(); d.normalize();
  const up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3().crossVectors(d, up).normalize(), t = new THREE.Vector3().crossVectors(s, d);
  for (let j = 0; j <= 1; j++) for (let i = 0; i <= sides; i++) {
    const an = i / sides * Math.PI * 2, r = j ? rb : ra, c = Math.cos(an), sn = Math.sin(an);
    const nx = s.x * c + t.x * sn, ny = s.y * c + t.y * sn, nz = s.z * c + t.z * sn;
    const p = j ? b : a;
    pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); nor.push(nx, ny, nz); uv.push(i / sides * uRep, j ? v1 : v0);
  }
  for (let i = 0; i < sides; i++) idx.push(i, i + 1, i + sides + 1, i + 1, i + sides + 2, i + sides + 1);
  return { pos, nor, uv, idx };
}
// havupuun oksakerros: riippuva kartiohelma, jonka alareuna on rosoinen (tekstuurin läpinäkyvyys)
function skirt(r, y, rad, drop, rise, segs, uRep, uOff) {
  const pos = [], nor = [], uv = [], idx = [], col = [];
  const kr = [], kd = [];
  for (let i = 0; i < segs; i++) { kr.push(0.82 + r() * 0.36); kd.push(0.7 + r() * 0.6); }
  for (let i = 0; i <= segs; i++) {
    const an = i / segs * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
    const ro = rad * kr[i % segs], yo = y - drop * kd[i % segs];
    pos.push(c * 0.05, y + rise, s * 0.05, c * ro * 0.55, y + rise * 0.35, s * ro * 0.55, c * ro, yo, s * ro);
    for (const ny of [0.75, 0.6, 0.35]) { const l = Math.hypot(1, ny); nor.push(c / l, ny / l, s / l); }
    const sh = 0.8 + 0.2 * kr[i % segs]; col.push(0.3, 0.32, 0.3, 0.62 * sh, 0.66 * sh, 0.62 * sh, sh, sh, sh);
    const u = uOff + i / segs * uRep;
    uv.push(u, 1, u, 0.66, u, 0.27);
  }
  for (let i = 0; i < segs; i++) { const a = i * 3, b = a + 3; idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); }
  return { pos, nor, uv, idx, col };
}

function coniferGeo(seed, o) {
  const r = rng(seed), parts = [];
  const H = o.h, n = o.tiers, y0 = o.clear * H;
  parts.push(limb(new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0, H * 0.96, 0), o.trunk, 0.03, o.sides, 0.02, 0.22, 1));
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), y = y0 + (H - y0 - H * 0.07) * Math.pow(t, o.bias);
    const rad = o.r * Math.pow(1 - t, o.taper) * (0.85 + r() * 0.3) + 0.12;
    parts.push(skirt(r, y, rad, rad * o.droop + 0.25, (H - y0) / n * 1.35, o.segs, Math.max(2, Math.round(rad * o.uDens)), r()));
  }
  // latva
  parts.push(skirt(r, H * 0.93, 0.22, 0.5, H * 0.08, 5, 1, r()));
  return merge(parts);
}
function birchGeo(seed, o) {
  const r = rng(seed), wood = [], crown = [];
  const H = o.h, lean = (r() - 0.5) * 0.5;
  // runko kolmessa osassa, hieman kaareva
  const pts = [0, 0.35, 0.7, 1].map(t => new THREE.Vector3(lean * t * t, H * t * 0.92 - (t === 0 ? 0.4 : 0), lean * 0.4 * t));
  const rads = [o.trunk, o.trunk * 0.72, o.trunk * 0.42, 0.02];
  for (let i = 0; i < 3; i++) wood.push(limb(pts[i], pts[i + 1], rads[i], rads[i + 1], o.sides, 1 - i / 3 * 0.9, 1 - (i + 1) / 3 * 0.9, 1));
  const cc = new THREE.Vector3(lean * 0.6, H * 0.66, lean * 0.2);
  const card = (p, w, h, yaw, tilt) => {
    const pos = [], nor = [], uv = [], col = [], idx = [0, 1, 2, 1, 3, 2], shade = 0.8 + r() * 0.35;
    const cx = Math.cos(yaw), sx = Math.sin(yaw);
    for (const [u, v] of [[0, 1], [1, 1], [0, 0], [1, 0]]) {
      const lx = (u - 0.5) * w, ly = (v - 1) * h, lz = (1 - v) * h * tilt;
      const x = p.x + cx * lx + sx * lz, z = p.z - sx * lx + cx * lz, y = p.y + ly;
      pos.push(x, y, z);
      const n = new THREE.Vector3(x - cc.x, (y - cc.y) * 0.6 + 0.5, z - cc.z).normalize(); nor.push(n.x, n.y, n.z);
      uv.push(u, v);
      const d = Math.min(1, Math.hypot(x - cc.x, z - cc.z) / o.r), sh = (0.5 + 0.5 * d) * (0.75 + 0.25 * v) * shade; col.push(sh, sh, sh);
    }
    return { pos, nor, uv, idx, col };
  };
  // oksat ja niiden päissä riippuvat lehvästökortit
  for (let i = 0; i < o.branches; i++) {
    const t = 0.38 + 0.6 * (i / o.branches) + r() * 0.04, an = i * 2.4 + r(), base = new THREE.Vector3().lerpVectors(pts[0], pts[3], t);
    base.x = lean * t * t;
    const len = o.r * (1.15 - t * 0.75) * (0.7 + r() * 0.5), rise = len * (0.5 + r() * 0.5);
    const tip = new THREE.Vector3(base.x + Math.cos(an) * len, base.y + rise, base.z + Math.sin(an) * len);
    if (o.limbs) wood.push(limb(base, tip, o.trunk * 0.22 * (1.1 - t), 0.012, 4, 0.5, 0.3, 0.5));
    for (let k = 0; k < o.cards; k++) {
      const q = 0.35 + 0.65 * (k + r()) / o.cards, p = new THREE.Vector3().lerpVectors(base, tip, q);
      p.y += 0.35 + r() * 0.5; p.x += (r() - 0.5) * 0.7; p.z += (r() - 0.5) * 0.7;
      const s = o.card * (0.8 + r() * 0.5);
      crown.push(card(p, s, s * (1.05 + r() * 0.5), r() * 6.28, (r() - 0.5) * 0.5));
    }
  }
  // latvus: muutama kortti huipulle
  for (let k = 0; k < o.top; k++) { const p = new THREE.Vector3(pts[3].x + (r() - 0.5) * 1.2, H * (0.93 + r() * 0.1), pts[3].z + (r() - 0.5) * 1.2); const s = o.card * (0.7 + r() * 0.4); crown.push(card(p, s, s * 1.3, r() * 6.28, (r() - 0.5) * 0.4)); }
  return { wood: merge(wood), crown: merge(crown) };
}

// ---------- kirjasto ----------
// Jokaisella lajilla on lähi- ja kaukomalli. mats päivittyy vuodenajan mukaan (applySeason).
export function makeTrees() {
  const T = {};
  const texK = coniferTex(11, { twig: [70, 52, 34], needle: [52, 92, 48], bark: [86, 66, 48] });
  const texKs = coniferTex(11, { twig: [70, 52, 34], needle: [58, 88, 62], bark: [86, 66, 48], snow: true });
  const texM = coniferTex(23, { twig: [96, 70, 44], needle: [78, 112, 62], bark: [150, 96, 58] });
  const texMs = coniferTex(23, { twig: [96, 70, 44], needle: [84, 108, 78], bark: [150, 96, 58], snow: true });
  const fol = map => new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, vertexColors: true });
  const mK = fol(texK), mM = fol(texM);
  const mLeaf = new THREE.MeshStandardMaterial({ map: leafTex(5), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, color: 0x7fb24a, vertexColors: true });
  const tLeaf = mLeaf.map, tTwig = twigTex(9);
  const mBirch = new THREE.MeshStandardMaterial({ map: birchBarkTex(), roughness: 0.8, metalness: 0 });
  T.mats = { mK, mM, mLeaf, mBirch };
  T.kuusi = { near: [{ geo: coniferGeo(1, { h: 10.5, tiers: 17, clear: 0.07, r: 2.5, taper: 0.85, droop: 0.5, bias: 0.95, segs: 12, sides: 6, trunk: 0.17, uDens: 2.4 }), mat: mK }],
    far: [{ geo: coniferGeo(1, { h: 10.5, tiers: 5, clear: 0.1, r: 2.6, taper: 0.9, droop: 0.5, bias: 0.9, segs: 6, sides: 4, trunk: 0.17, uDens: 2.0 }), mat: mK }] };
  T.manty = { near: [{ geo: coniferGeo(2, { h: 13, tiers: 6, clear: 0.62, r: 2.3, taper: 0.55, droop: 0.22, bias: 1.0, segs: 10, sides: 6, trunk: 0.2, uDens: 2.4 }), mat: mM }],
    far: [{ geo: coniferGeo(2, { h: 13, tiers: 3, clear: 0.64, r: 2.4, taper: 0.5, droop: 0.25, bias: 1.0, segs: 6, sides: 4, trunk: 0.2, uDens: 2.0 }), mat: mM }] };
  const bn = birchGeo(3, { h: 9.6, r: 2.3, trunk: 0.13, sides: 6, branches: 14, cards: 5, card: 1.35, top: 6, limbs: true });
  const bf = birchGeo(3, { h: 9.6, r: 2.3, trunk: 0.13, sides: 4, branches: 6, cards: 2, card: 2.6, top: 2, limbs: false });
  T.koivu = { near: [{ geo: bn.wood, mat: mBirch, plain: true }, { geo: bn.crown, mat: mLeaf, tint: true }], far: [{ geo: bf.wood, mat: mBirch, plain: true }, { geo: bf.crown, mat: mLeaf, tint: true }] };
  T.applySeason = (sea, road) => {
    mK.map = sea.snow ? texKs : texK; mM.map = sea.snow ? texMs : texM;
    mK.color.setScalar(sea.snow ? 1.15 : 1); mM.color.setScalar(sea.snow ? 1.15 : 1);
    const bare = sea.snow || sea.bare;
    mLeaf.map = bare ? tTwig : tLeaf;
    mLeaf.alphaTest = bare ? 0.3 : 0.35;
    if (sea.snow) mLeaf.color.setRGB(0.82, 0.84, 0.9);          // huurteiset oksat
    else if (sea.bare) mLeaf.color.setRGB(0.22, 0.17, 0.14);    // marraskuu
    else if (sea.autumn) mLeaf.color.setRGB(1.0, 0.72, 0.16);   // ruska
    else if (sea.m === 3 || sea.m === 4) mLeaf.color.setRGB(0.5, 0.68, 0.22); // hiirenkorvat
    else mLeaf.color.setRGB(0.36, 0.52, 0.17);
    T.leafVar = sea.autumn ? 0.5 : bare ? 0.08 : 0.2;
    for (const m of [mK, mM, mLeaf]) m.needsUpdate = true;
  };
  T.leafVar = 0.2;
  return T;
}
