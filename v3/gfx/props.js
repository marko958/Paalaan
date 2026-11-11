// PAALAAN! 3.0 – tienvarren kalusteet ja rakennukset: reunapaalut, liikennemerkit, kamerat, mökit, ladot, sähkölinja ja kivet.
// Kaikki geometria syntyy koodissa; tekstuurit ovat Poly Havenista tai canvasilla piirrettyjä.
import * as THREE from 'three';
import { tex, canvasTex, rng } from './assets.js';

export const box = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
export const cyl = (r1, r2, h, n, x = 0, y = 0, z = 0) => { const g = new THREE.CylinderGeometry(r1, r2, h, n); g.translate(x, y + h / 2, z); return g; };
// yhdistää geometriat yhdeksi; jokainen osa saa oman materiaaliryhmän
export function group(parts) {
  const mats = [];
  for (const p of parts) if (!mats.includes(p.mat)) mats.push(p.mat);
  const geos = parts.map(p => (p.geo.index ? p.geo.toNonIndexed() : p.geo));
  let n = 0; geos.forEach(g => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const out = new THREE.BufferGeometry();
  let o = 0;
  mats.forEach((mat, mi) => { // saman materiaalin osat peräkkäin: yksi piirtokutsu per materiaali
    const start = o;
    parts.forEach((p, i) => {
      if (p.mat !== mat) return;
      const g = geos[i], c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      o += c;
    });
    out.addGroup(start, o - start, mi);
  });
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return { geo: out, mats };
}
// laatikon UV:t metreinä, jotta lauta- ja peltitekstuurit toistuvat oikeassa koossa
export function metricUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay > ax && ay > az) uv.setXY(i, p.getX(i) * s, p.getZ(i) * s);
    else if (ax > az) uv.setXY(i, p.getZ(i) * s, p.getY(i) * s);
    else uv.setXY(i, p.getX(i) * s, p.getY(i) * s);
  }
  return g;
}
// harjakatto: harja z-akselin suuntaan, leveys w, pituus d, räystään korkeus y0, harjan korkeus y1
export function gable(w, d, y0, y1, over = 0.35, thick = 0.12) {
  const hw = w / 2 + over, hd = d / 2 + over, g = new THREE.BufferGeometry();
  const yE = y0 - over * (y1 - y0) / (w / 2);
  const v = [], uv = [], quad = (a, b, c, e, len, wid) => { v.push(...a, ...b, ...c, ...a, ...c, ...e); uv.push(0, 0, len, 0, len, wid, 0, 0, len, wid, 0, wid); };
  const sl = Math.hypot(hw, y1 - yE);
  quad([-hw, yE, hd], [-hw, yE, -hd], [0, y1, -hd], [0, y1, hd], hd * 2, sl);
  quad([hw, yE, -hd], [hw, yE, hd], [0, y1, hd], [0, y1, -hd], hd * 2, sl);
  // alapinta, jotta räystäs ei ole läpinäkyvä alhaalta
  quad([-hw, yE - thick, -hd], [-hw, yE - thick, hd], [0, y1 - thick, hd], [0, y1 - thick, -hd], hd * 2, sl);
  quad([hw, yE - thick, hd], [hw, yE - thick, -hd], [0, y1 - thick, -hd], [0, y1 - thick, hd], hd * 2, sl);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
// päätykolmio seinään
export function gableEnd(w, y0, y1, z) {
  const g = new THREE.BufferGeometry(), hw = w / 2, s = z > 0 ? 1 : -1;
  const v = s > 0 ? [-hw, y0, z, hw, y0, z, 0, y1, z] : [hw, y0, z, -hw, y0, z, 0, y1, z];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([v[0] * 0.6, y0 * 0.6, v[3] * 0.6, y0 * 0.6, 0, y1 * 0.6], 2));
  g.computeVertexNormals();
  return g;
}

export function makeProps(U) {
  const P = {};
  const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o));
  const white = M({ color: 0xe9e9e4 }), black = M({ color: 0x151515 }), steel = M({ color: 0x8d9296, metalness: 0.7, roughness: 0.45 });
  const snowM = M({ map: tex('lumi', 'diff'), color: 0xf4f6fa, roughness: 0.65, side: THREE.DoubleSide });
  P.snowM = snowM;

  // --- reunapaalu: valkoinen paalu, musta vyö ja heijastin; talvella vieressä oranssi aurausviitta ---
  const refl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d0, emissiveIntensity: 0, roughness: 0.3 });
  P.reflM = refl;
  { const g = group([{ geo: box(0.12, 0.95, 0.05, 0, 0.475, 0), mat: white }, { geo: box(0.125, 0.22, 0.055, 0, 0.72, 0), mat: black }, { geo: box(0.07, 0.16, 0.012, 0, 0.72, 0.03), mat: refl }, { geo: box(0.07, 0.16, 0.012, 0, 0.72, -0.03), mat: refl }]);
    P.tolppa = g; }
  { const orange = M({ color: 0xe86a12, roughness: 0.6 });
    P.viitta = group([{ geo: cyl(0.014, 0.018, 1.9, 5), mat: orange }, { geo: cyl(0.016, 0.016, 0.12, 5, 0, 1.55, 0), mat: refl }]); }

  // --- liikennemerkit: pyöreä nopeusrajoitus (teksti vaihtuu), sininen valvontamerkki ---
  const signTex = new Map();
  P.limitMat = txt => {
    if (signTex.has(txt)) return signTex.get(txt);
    const t = canvasTex(256, 256, (g, W) => {
      g.clearRect(0, 0, W, W);
      g.fillStyle = '#c8161d'; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, 7); g.fill();
      g.fillStyle = '#f6c800'; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 34, 0, 7); g.fill();
      g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${txt.length > 2 ? 104 : 128}px Arial, Helvetica, sans-serif`; g.fillText(txt, W / 2, W / 2 + 8);
    }, { clamp: true });
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, transparent: false, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 });
    signTex.set(txt, m);
    return m;
  };
  P.signMats = signTex;
  P.pole = (h, r = 0.03) => cyl(r, r, h, 8);
  P.poleM = steel;
  P.disc = (() => { const g = new THREE.CircleGeometry(0.45, 28); return g; })();
  P.discBack = M({ color: 0x9a9da0, metalness: 0.5, roughness: 0.5 });
  { const t = canvasTex(256, 256, (g, W) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, W); g.fillStyle = '#1447a8'; g.fillRect(10, 10, W - 20, W - 20);
      g.fillStyle = '#fff'; g.fillRect(58, 96, 118, 78); g.beginPath(); g.moveTo(176, 118); g.lineTo(214, 100); g.lineTo(214, 170); g.lineTo(176, 152); g.fill();
      g.fillStyle = '#1447a8'; g.beginPath(); g.arc(104, 135, 22, 0, 7); g.fill();
    }, { clamp: true });
    P.valvontaM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 });
    P.plate = new THREE.PlaneGeometry(0.8, 0.8); }

  // --- nopeuskamera: harmaa pylväs ja kotelo, jossa tumma linssi-ikkuna ---
  { const body = M({ color: 0x9aa0a4, metalness: 0.4, roughness: 0.5 }), lens = M({ color: 0x0a0c10, roughness: 0.1, metalness: 0.6 });
    P.camFlash = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.2 });
    P.kamera = group([{ geo: cyl(0.11, 0.13, 3.3, 10), mat: body }, { geo: box(0.5, 0.95, 0.42, 0, 3.75, 0), mat: body }, { geo: box(0.36, 0.5, 0.02, 0, 3.85, -0.215), mat: lens },
      { geo: box(0.2, 0.12, 0.02, 0, 3.45, -0.216), mat: P.camFlash }, { geo: box(0.54, 0.05, 0.46, 0, 4.24, 0), mat: body }]); }

  // --- mökki: punamultaseinä, valkoiset nurkkalaudat ja ikkunanpuitteet, peltikatto, piippu ja kuisti ---
  { const red = M({ map: tex('lauta', 'diff'), normalMap: tex('lauta', 'nor'), color: 0x8a2a1f, roughness: 0.85 });
    const roof = M({ map: tex('pelti', 'diff'), normalMap: tex('pelti', 'nor'), color: 0x60656a, metalness: 0.35, roughness: 0.55 });
    const conc = M({ map: tex('betoni', 'diff'), color: 0x9a9690 });
    P.winM = new THREE.MeshStandardMaterial({ color: 0x1a232c, roughness: 0.15, metalness: 0.2, emissive: 0xffc46a, emissiveIntensity: 0 });
    const door = M({ color: 0x2f3b33, roughness: 0.6 });
    const W = 8.4, D = 6.6, H0 = 0.45, HW = 3.1, HR = 5.9;
    const parts = [{ geo: metricUV(box(W + 0.1, H0, D + 0.1, 0, H0 / 2 - 0.3, 0), 0.5), mat: conc },
      { geo: metricUV(box(W, HW, D, 0, H0 + HW / 2 - 0.3, 0), 0.9), mat: red },
      { geo: gableEnd(W, H0 + HW - 0.3, HR, D / 2), mat: red }, { geo: gableEnd(W, H0 + HW - 0.3, HR, -D / 2), mat: red },
      { geo: gable(W, D, H0 + HW - 0.3, HR + 0.08), mat: roof },
      { geo: box(0.55, 1.5, 0.55, 1.4, HR - 0.7, 0.6), mat: conc }];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ geo: box(0.16, HW, 0.16, sx * W / 2, H0 + HW / 2 - 0.3, sz * D / 2), mat: white });
    // ikkunat: puite ja lasi neljällä sivulla
    const win = (x, y, z, ry, w = 1.1, h = 1.3) => {
      const f = box(w + 0.18, h + 0.18, 0.06), gl = box(w, h, 0.07), b1 = box(0.05, h, 0.09), b2 = box(w, 0.05, 0.09);
      for (const g of [f, gl, b1, b2]) { g.rotateY(ry); g.translate(x, y, z); }
      parts.push({ geo: f, mat: white }, { geo: gl, mat: P.winM }, { geo: b1, mat: white }, { geo: b2, mat: white });
    };
    const yW = H0 + 1.75 - 0.3;
    for (const x of [-2.5, 2.5]) { win(x, yW, D / 2 + 0.01, 0); win(x, yW, -D / 2 - 0.01, 0); }
    for (const z of [-1.5, 1.5]) { win(W / 2 + 0.01, yW, z, Math.PI / 2); win(-W / 2 - 0.01, yW, z, Math.PI / 2); }
    win(0, H0 + HW + 0.9, D / 2 + 0.01, 0, 0.8, 0.9); win(0, H0 + HW + 0.9, -D / 2 - 0.01, 0, 0.8, 0.9);
    // kuisti tien puolella (−x)
    parts.push({ geo: metricUV(box(1.6, 2.4, 2.2, -W / 2 - 0.8, H0 + 1.2 - 0.3, 0), 0.9), mat: red }, { geo: box(0.95, 2.0, 0.06, -W / 2 - 1.62, H0 + 1.0 - 0.3, 0).rotateY(0), mat: door });
    { const g = gable(2.6, 2.0, H0 + 2.4 - 0.3, H0 + 3.2 - 0.3, 0.2); g.rotateY(Math.PI / 2); g.translate(-W / 2 - 0.8, 0, 0); parts.push({ geo: g, mat: roof }); }
    parts.push({ geo: box(0.08, 2.0, 0.95, -W / 2 - 1.62, H0 + 1.0 - 0.3, 0), mat: door });
    P.mokki = group(parts);
    const snowRoof = gable(W, D, H0 + HW - 0.3 + 0.14, HR + 0.3, 0.42, 0.2);
    P.mokkiSnow = group([{ geo: snowRoof, mat: snowM }]);
    P.roofM = roof; P.redM = red;
  }
  // --- lato: harmaantunut lautaseinä, ylöspäin levenevät seinät, ruostunut peltikatto ja musta oviaukko ---
  { const wood = M({ map: tex('hirsi', 'diff'), color: 0xb9b2a6, roughness: 0.95 });
    const roof = M({ map: tex('pelti', 'diff'), normalMap: tex('pelti', 'nor'), color: 0x8a5a44, metalness: 0.3, roughness: 0.7 });
    const dark = M({ color: 0x0c0b0a, roughness: 1 });
    const W = 11.2, D = 6.4, HW = 3.6, HR = 5.6, flare = 0.5;
    const body = metricUV(box(W, HW, D, 0, HW / 2 - 0.2, 0), 0.45);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 1) { p.setX(i, p.getX(i) + Math.sign(p.getX(i)) * flare); p.setZ(i, p.getZ(i) + Math.sign(p.getZ(i)) * flare); }
    body.computeVertexNormals();
    const rf = gable(D + flare * 2, W + flare * 2, HW - 0.2, HR, 0.3); rf.rotateY(Math.PI / 2);
    const g1 = gableEnd(D + flare * 2, HW - 0.2, HR, W / 2 + flare); g1.rotateY(Math.PI / 2);
    const g2 = gableEnd(D + flare * 2, HW - 0.2, HR, -W / 2 - flare); g2.rotateY(Math.PI / 2);
    P.lato = group([{ geo: body, mat: wood }, { geo: rf, mat: roof }, { geo: g1, mat: wood }, { geo: g2, mat: wood }, { geo: box(2.6, 2.6, 0.1, 0, 1.1, -D / 2 - 0.12), mat: dark }, { geo: box(2.6, 2.6, 0.1, 0, 1.1, D / 2 + 0.12), mat: dark }]);
    const sr = gable(D + flare * 2, W + flare * 2, HW - 0.06, HR + 0.22, 0.36, 0.2); sr.rotateY(Math.PI / 2);
    P.latoSnow = group([{ geo: sr, mat: snowM }]);
  }
  // --- sähköpylväs ja kivi ---
  { const wood = M({ map: tex('kaarna', 'diff'), color: 0x6a5a4c, roughness: 0.9 });
    P.pylvas = group([{ geo: cyl(0.1, 0.14, 9, 7), mat: wood }, { geo: box(2.2, 0.12, 0.12, 0, 8.5, 0), mat: wood }, { geo: cyl(0.04, 0.04, 0.16, 6, -1, 8.56, 0), mat: white }, { geo: cyl(0.04, 0.04, 0.16, 6, 0, 8.56, 0), mat: white }, { geo: cyl(0.04, 0.04, 0.16, 6, 1, 8.56, 0), mat: white }]);
    P.wireM = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
    const g = new THREE.IcosahedronGeometry(1, 2), r = rng(4), p = g.attributes.position;
    // sama kärki esiintyy monta kertaa (ei indeksoitu): siirtymä lasketaan paikasta, jotta saumat pysyvät kiinni
    const h3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + 0.4 * h3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)); p.setXYZ(i, x * k, y * k * 0.72, z * k); }
    g.computeVertexNormals(); metricUV(g, 0.5); void r;
    P.kivi = { geo: g, mats: [M({ map: tex('kivi', 'diff'), normalMap: tex('kivi', 'nor'), roughness: 0.9 })] };
  }
  // --- kaide (Autobahn) ---
  P.railM = steel;

  P.applySeason = (sea, night) => {
    const e = night > 0.3 ? 1 : 0;
    P.winM.emissiveIntensity = night > 0.3 ? 1.6 : 0;
    refl.emissiveIntensity = night * 1.4;
    for (const m of signTex.values()) m.emissiveIntensity = e * 0.16;
    P.valvontaM.emissiveIntensity = e * 0.16;
    P.signGlow = e * 0.16;
  };
  return P;
}
