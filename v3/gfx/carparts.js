// PAALAAN! 3.0 – auton osat: pyörät (rengas, vanne, jarrulevy), valot, peilit ja muut varusteet.
import * as THREE from 'three';
import { canvasTex } from './assets.js';

const rubber = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.88, metalness: 0 });
const alloy = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.28, metalness: 0.95 });
const darkAlloy = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.35, metalness: 0.9 });
const steelM = new THREE.MeshStandardMaterial({ color: 0x6a6d70, roughness: 0.5, metalness: 0.9 });
const caliperRed = new THREE.MeshStandardMaterial({ color: 0xb01818, roughness: 0.4, metalness: 0.3 });
const caliperGrey = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.5, metalness: 0.6 });
let treadTex = null;
function tread() {
  if (treadTex) return treadTex;
  // renkaan kuvio normaalikarttana: pitkittäisurat ja vinot lamellit
  treadTex = canvasTex(256, 64, (g, W, H) => {
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, W, H);
    for (const y of [12, 26, 38, 52]) { g.fillStyle = 'rgb(128,60,200)'; g.fillRect(0, y - 2, W, 2); g.fillStyle = 'rgb(128,196,200)'; g.fillRect(0, y, W, 2); }
    for (let x = 0; x < W; x += 16) { g.strokeStyle = 'rgb(70,128,200)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 7, 12); g.moveTo(x + 7, 52); g.lineTo(x, 64); g.stroke();
      g.strokeStyle = 'rgb(186,128,200)'; g.beginPath(); g.moveTo(x + 2, 0); g.lineTo(x + 9, 12); g.moveTo(x + 9, 52); g.lineTo(x + 2, 64); g.stroke(); }
  }, { data: true });
  return treadTex;
}
const geoCache = new Map();
// Rengas: pyörähdyskappale, jossa pyöristetty olka ja sivun kohouma; akseli = x
function tireGeo(R, w, lod) {
  const key = `t${R.toFixed(3)}:${w.toFixed(3)}:${lod}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const rim = R * 0.64, h = w / 2, pts = [];
  const prof = [[rim, -h * 0.82], [rim + 0.012, -h * 0.9], [R * 0.80, -h * 1.02], [R * 0.93, -h * 0.98], [R * 0.985, -h * 0.82], [R, -h * 0.6], [R, 0], [R, h * 0.6], [R * 0.985, h * 0.82], [R * 0.93, h * 0.98], [R * 0.80, h * 1.02], [rim + 0.012, h * 0.9], [rim, h * 0.82]];
  for (const [r, x] of prof) pts.push(new THREE.Vector2(r, x));
  const g = new THREE.LatheGeometry(pts, lod ? 14 : 36);
  g.userData.shared = true;
  g.rotateZ(-Math.PI / 2); // akseli y → x
  // UV: kulutuspinta toistuu kehällä
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i));
  geoCache.set(key, g);
  return g;
}
// Vanne: kehä, napa ja puolat. style: spoke5, multi, aero, steel, turbine, star
function rimGeo(R, w, style, lod) {
  const key = `r${R.toFixed(3)}:${w.toFixed(3)}:${style}:${lod}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const r = R * 0.64, parts = [];
  // kehä (tynnyri) ja ulkoreunan laippa
  const barrel = new THREE.LatheGeometry([new THREE.Vector2(r * 0.9, -w * 0.4), new THREE.Vector2(r * 0.86, -w * 0.1), new THREE.Vector2(r * 0.9, w * 0.3), new THREE.Vector2(r + 0.004, w * 0.42), new THREE.Vector2(r + 0.004, w * 0.46), new THREE.Vector2(r * 0.93, w * 0.44)], lod ? 12 : 30);
  barrel.rotateZ(-Math.PI / 2); parts.push(barrel);
  const face = w * 0.36; // puolien taso (ulkopinta x = +)
  const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.24, 0.05, lod ? 8 : 18); hub.rotateZ(-Math.PI / 2); hub.translate(face - 0.01, 0, 0); parts.push(hub);
  const spoke = (n, w0, w1, twin, lean, thick) => {
    for (let k = 0; k < n; k++) for (const s of twin ? [-1, 1] : [0]) {
      const sh = new THREE.Shape(), a0 = w0 / 2, a1 = w1 / 2;
      sh.moveTo(r * 0.16, -a0); sh.lineTo(r * 0.93, -a1); sh.lineTo(r * 0.93, a1); sh.lineTo(r * 0.16, a0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: !lod, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
      // shape on xy-tasossa (x = säde), pursotus z:aan → käännetään: säde → y, paksuus → x
      g.rotateY(Math.PI / 2); g.translate(face - thick, 0, 0); // nyt säde on −z:ssä? korjataan alla
      g.rotateX(Math.PI / 2);
      g.rotateX(k / n * Math.PI * 2 + s * (twin || 0) + lean);
      parts.push(g);
    }
  };
  if (style === 'spoke5') spoke(5, r * 0.34, r * 0.2, 0, 0, 0.03);
  else if (style === 'twin5') spoke(5, r * 0.11, r * 0.085, 0.2, 0, 0.028);
  else if (style === 'multi') spoke(10, r * 0.1, r * 0.07, 0, 0, 0.022);
  else if (style === 'turbine') spoke(9, r * 0.2, r * 0.1, 0, 0.0, 0.024);
  else if (style === 'star') spoke(6, r * 0.26, r * 0.13, 0, 0, 0.03);
  else if (style === 'aero') { const d = new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.012, lod ? 12 : 30); d.rotateZ(-Math.PI / 2); d.translate(face, 0, 0); parts.push(d); spoke(5, r * 0.5, r * 0.42, 0, 0, 0.02); }
  else { const d = new THREE.CylinderGeometry(r * 0.92, r * 0.8, 0.03, lod ? 12 : 30); d.rotateZ(-Math.PI / 2); d.translate(face - 0.01, 0, 0); parts.push(d); }
  const g = mergeGeos(parts);
  g.userData.shared = true;
  geoCache.set(key, g);
  return g;
}
export function mergeGeos(list) {
  const gs = list.map(g => (g.index ? g.toNonIndexed() : g));
  let n = 0; gs.forEach(g => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
let tireMat = null;
export function makeWheel(R, w, style, lod) {
  const group = new THREE.Group(), spin = new THREE.Group();
  if (!tireMat) { tireMat = rubber.clone(); tireMat.normalMap = tread(); tireMat.normalScale = new THREE.Vector2(0.9, 0.9); }
  const tire = new THREE.Mesh(tireGeo(R, w, lod), lod ? rubber : tireMat); tire.castShadow = true;
  const dark = style === 'steel' ? false : /dark/.test(style);
  const st = style.replace('dark-', '');
  const rim = new THREE.Mesh(rimGeo(R, w, st, lod), st === 'steel' ? steelM : dark ? darkAlloy : alloy); rim.castShadow = true;
  spin.add(tire, rim);
  if (!lod && st !== 'steel' && st !== 'aero') { // jarrulevy ja satula vanteen takana
    const disc = new THREE.CylinderGeometry(R * 0.5, R * 0.5, 0.022, 28); disc.rotateZ(-Math.PI / 2); disc.translate(w * 0.12, 0, 0);
    spin.add(new THREE.Mesh(disc, steelM));
    const cal = new THREE.BoxGeometry(0.05, R * 0.3, R * 0.22); cal.translate(w * 0.13, R * 0.1, -R * 0.42);
    group.add(new THREE.Mesh(cal, /red/.test(style) ? caliperRed : caliperGrey));
  }
  group.add(spin);
  return { group, spin };
}
export function wheelStyleFor(spec, opt) {
  const x = spec.x || [], b = spec.b;
  if (opt.rim) return opt.rim;
  if (b === 'van' || b === 'bus') return 'steel';
  if (b === 'coupe') return 'dark-twin5';
  if (b === 'truck') return 'dark-aero';
  if (x.includes('diff')) return 'turbine';
  if (b === 'mini') return 'steel';
  if (b === 'suv' || b === 'suvc') return 'star';
  if (b === 'fastback') return 'aero';
  if (x.includes('chrome')) return 'multi';
  return 'spoke5';
}

// ---------- valojen, kilpien ja maskien tekstuurit (piirretään koodissa, ei logoja) ----------
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
// Valosignatuuri koko auton leveydelle. kind = 'rear' | 'front'. Kuva peilataan, joten piirretään vain vasen puoli.
export function lampTex(kind, type) {
  const W = 512, H = 96;
  return canvasTex(W, H, g => {
    g.clearRect(0, 0, W, H);
    const rear = kind === 'rear';
    const lens = rear ? '#5a0a0c' : '#12161b', lit = rear ? '#ff2a1c' : '#f4f8ff', dim = rear ? '#b01410' : '#9aa6b4';
    const half = () => {
      const L = (x, y, w, h, r, c) => { g.fillStyle = c || lens; rr(g, x * 256, y * H, w * 256, h * H, r); g.fill(); };
      const S = (x, y, w, h, r, c) => { g.fillStyle = c || lit; rr(g, x * 256, y * H, w * 256, h * H, r); g.fill(); };
      if (rear) switch (type) {
        case 'bar': L(0.02, 0.2, 0.3, 0.62, 8); L(0.3, 0.38, 0.72, 0.26, 4); S(0.04, 0.44, 0.97, 0.13, 3); S(0.04, 0.26, 0.22, 0.1, 3); break;
        case 'wide': L(0.02, 0.18, 0.62, 0.62, 10); S(0.05, 0.3, 0.54, 0.13, 4); S(0.05, 0.56, 0.4, 0.1, 4, dim); break;
        case 'pixel': L(0.02, 0.12, 0.34, 0.76, 4); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) S(0.05 + i * 0.075, 0.2 + j * 0.22, 0.05, 0.15, 1); for (let i = 0; i < 9; i++) S(0.4 + i * 0.066, 0.45, 0.04, 0.1, 1, dim); break;
        case 'vertical': L(0.01, 0.02, 0.14, 0.96, 6); S(0.035, 0.06, 0.05, 0.88, 3); S(0.1, 0.5, 0.03, 0.42, 2, dim); break;
        case 'round': g.fillStyle = lens; g.beginPath(); g.arc(46, H / 2, 40, 0, 7); g.fill(); g.strokeStyle = lit; g.lineWidth = 9; g.beginPath(); g.arc(46, H / 2, 27, 0, 7); g.stroke(); g.fillStyle = dim; g.beginPath(); g.arc(46, H / 2, 10, 0, 7); g.fill(); break;
        case 'tri': L(0.02, 0.06, 0.36, 0.88, 4); for (let i = 0; i < 3; i++) S(0.05 + i * 0.11, 0.12, 0.065, 0.76, 2); break;
        case 'low': L(0.02, 0.0, 0.5, 0.14, 3); S(0.03, 0.03, 0.46, 0.07, 2); L(0.03, 0.72, 0.3, 0.26, 5); S(0.05, 0.78, 0.24, 0.13, 3); break;
        default: L(0.02, 0.1, 0.4, 0.8, 12); g.strokeStyle = lit; g.lineWidth = 8; rr(g, 16, 22, 78, 54, 10); g.stroke(); S(0.26, 0.4, 0.12, 0.22, 3, dim);
      } else switch (type) {
        case 'round': g.fillStyle = lens; g.beginPath(); g.arc(50, H / 2, 44, 0, 7); g.fill(); g.strokeStyle = lit; g.lineWidth = 8; g.beginPath(); g.arc(50, H / 2, 33, 0, 7); g.stroke(); g.fillStyle = '#cfd8e6'; g.beginPath(); g.arc(50, H / 2, 16, 0, 7); g.fill(); break;
        case 'pixel': L(0.02, 0.2, 0.44, 0.62, 3); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.strokeStyle = lit; g.lineWidth = 5; rr(g, 12 + i * 52, 26 + j * 0, 40, 46, 2); g.stroke(); } break;
        case 'bar': L(0.02, 0.3, 0.36, 0.5, 6); S(0.03, 0.38, 0.97, 0.1, 3); S(0.06, 0.56, 0.2, 0.14, 3, '#cfd8e6'); break;
        case 'hammer': L(0.02, 0.18, 0.42, 0.66, 6); S(0.05, 0.44, 0.34, 0.11, 2); S(0.2, 0.26, 0.05, 0.5, 2); break;
        case 'tri': L(0.02, 0.1, 0.4, 0.8, 5); g.strokeStyle = lit; g.lineWidth = 7; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(16 + i * 30, 80); g.lineTo(34 + i * 30, 18); g.stroke(); } break;
        case 'split': S(0.02, 0.06, 0.4, 0.1, 3); L(0.06, 0.42, 0.3, 0.5, 6); g.fillStyle = '#cfd8e6'; g.beginPath(); g.arc(58, 64, 14, 0, 7); g.fill(); break;
        case 'quad': L(0.02, 0.14, 0.42, 0.72, 8); for (let i = 0; i < 2; i++) { g.strokeStyle = lit; g.lineWidth = 7; g.beginPath(); g.arc(34 + i * 48, H / 2, 17, Math.PI * 0.75, Math.PI * 2.25); g.stroke(); } break;
        default: L(0.02, 0.22, 0.46, 0.56, 8); S(0.04, 0.28, 0.4, 0.1, 3); g.fillStyle = '#cfd8e6'; g.beginPath(); g.arc(40, 60, 12, 0, 7); g.fill(); g.beginPath(); g.arc(76, 60, 10, 0, 7); g.fill();
      }
    };
    half();
    g.save(); g.translate(W, 0); g.scale(-1, 1); half(); g.restore();
  }, { clamp: true });
}
// Suomalaisen kilven näköinen rekisterikilpi satunnaisella tunnuksella
export function plateTex(i) {
  const A = 'ABCEFGHIJKLMNOPRSTUVXYZ', h = n => { let x = Math.sin(n * 127.1 + i * 311.7) * 43758.5453; return x - Math.floor(x); };
  const txt = A[Math.floor(h(1) * A.length)] + A[Math.floor(h(2) * A.length)] + A[Math.floor(h(3) * A.length)] + '-' + Math.floor(100 + h(4) * 899);
  return canvasTex(256, 56, (g, W, H) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, W, H); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = '#1b3f95'; g.fillRect(3, 3, 24, H - 6); g.fillStyle = '#fff'; g.font = 'bold 10px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('FIN', 15, H - 9);
    g.fillStyle = '#111'; g.font = 'bold 40px Arial, Helvetica, sans-serif'; g.textBaseline = 'middle'; g.fillText(txt, W / 2 + 12, H / 2 + 2);
  }, { clamp: true });
}
export function grilleTex(kind) {
  return canvasTex(256, 64, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = kind === 'valance' || kind === 'diff' ? '#131415' : '#070708'; rr(g, 2, 2, W - 4, H - 4, kind === 'low' ? 14 : 10); g.fill();
    if (kind === 'low') { g.fillStyle = '#1c1d1f'; for (let y = 16; y < H - 8; y += 14) g.fillRect(10, y, W - 20, 4); }
    else if (kind === 'mesh') { g.strokeStyle = '#26282b'; g.lineWidth = 2; for (let x = -H; x < W; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.moveTo(x + H, 0); g.lineTo(x, H); g.stroke(); } g.strokeStyle = '#3a3d41'; g.lineWidth = 4; rr(g, 3, 3, W - 6, H - 6, 10); g.stroke(); }
    else if (kind === 'chrome') { g.fillStyle = '#c9ccd0'; for (let x = 12; x < W - 8; x += 13) g.fillRect(x, 6, 5, H - 12); g.strokeStyle = '#e6e8ea'; g.lineWidth = 6; rr(g, 4, 4, W - 8, H - 8, 9); g.stroke(); }
    else if (kind === 'diff') { g.fillStyle = '#2b2d30'; for (let x = 40; x < W - 30; x += 30) g.fillRect(x, 8, 5, H - 12); }
  }, { clamp: true });
}
// epäsäännöllinen läikkä: mikrobetonipaikka, ruoste tai naarmu
export function blobTex(seed, rgb) {
  return canvasTex(128, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    let s = seed * 9301 + 49297; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 26; i++) { const v = 0.82 + r() * 0.3; g.fillStyle = `rgb(${rgb[0] * v | 0},${rgb[1] * v | 0},${rgb[2] * v | 0})`; g.beginPath(); g.ellipse(W / 2 + (r() - 0.5) * 60, H / 2 + (r() - 0.5) * 56, 12 + r() * 20, 10 + r() * 16, r() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.18})`; g.fillRect(r() * W, r() * H, 2, 2); }
  }, { clamp: true });
}
// sadepisarat kirkaslakan päällä (normaalikartta)
export function dropsTex() {
  const t = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, W, H);
    let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 420; i++) {
      const x = r() * W, y = r() * H, rad = 2 + r() * r() * 9;
      for (const [dx, dy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) {
        const gr = g.createRadialGradient(x + dx - rad * 0.3, y + dy - rad * 0.3, 0, x + dx, y + dy, rad);
        gr.addColorStop(0, 'rgb(170,170,240)'); gr.addColorStop(0.7, 'rgb(90,90,225)'); gr.addColorStop(1, 'rgba(128,128,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 7); g.fill();
      }
    }
  }, { data: true });
  t.repeat.set(2.2, 2.2);
  return t;
}
