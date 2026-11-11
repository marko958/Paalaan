// PAALAAN! 3.0 – auton kori: parametrinen pinta sivuprofiilin ja poikkileikkausten käyristä.
// Kori on yksi "loft": pituussuunnassa asemia (u = 0 perä … L keula), jokaisella asemalla poikkileikkausrengas
// (helma → kylki → olkalinja → ikkunalinja → kattokaari). Katto-, konepelti- ja perälinja on yksi profiilikäyrä,
// joka laskeutuu päissä puskurin alareunaan, joten keula ja perä ovat samaa pintaa eivätkä erillisiä laatikoita.
// Pyöränkaaret leikataan nostamalla helman alareunaa kaaren muotoon. Koordinaatit metreinä: u pituus, y sivu, z korkeus.
import * as THREE from 'three';

// monotoninen kuutiollinen interpolaatio (PCHIP): ei ylilyöntejä, joten profiilit pysyvät hallinnassa
export function pchip(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = Math.max(1e-6, xs[i + 1] - xs[i]); d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
const lin = pts => x => { // paloittain lineaarinen
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(1e-6, b[0] - a[0]); }
  return pts[pts.length - 1][1];
};
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- korityypit ----------
// Mitat metreinä. fo = etuylitys, cowl = tuulilasin alareunan etäisyys etuakselista taaksepäin, ws = tuulilasin vaakamitta,
// roofR = katon takareuna taka-akselista (+ = taakse), tail: 'deck' (takakontti) tai 'gate' (takaluukku), tumble = lasien kallistus sisään.
export const BODY = {
  sedan:    { L: 4.76, W: 1.84, H: 1.45, wb: 2.80, fo: 0.93, gc: 0.165, R: 0.325, nose: 0.70, cowl: 0.40, hCowl: 0.99, ws: 0.80, belt: 0.93, roofR: -0.30, tail: 'deck', deck: 0.58, hDeck: 1.04, rake: 0.72, tumble: 0.36, bowN: 0.20, bowT: 0.15 },
  fastback: { L: 4.74, W: 1.86, H: 1.43, wb: 2.88, fo: 0.88, gc: 0.15, R: 0.335, nose: 0.68, cowl: 0.30, hCowl: 0.97, ws: 0.92, belt: 0.93, roofR: -0.72, tail: 'deck', deck: 0.26, hDeck: 1.05, rake: 1.28, tumble: 0.40, bowN: 0.24, bowT: 0.17 },
  prius:    { L: 4.50, W: 1.76, H: 1.48, wb: 2.70, fo: 0.92, gc: 0.15, R: 0.31, nose: 0.66, cowl: 0.10, hCowl: 0.98, ws: 1.02, belt: 0.95, roofR: -0.95, tail: 'deck', deck: 0.10, hDeck: 1.17, rake: 1.30, tumble: 0.34, bowN: 0.26, bowT: 0.12, kamm: 1 },
  hatch:    { L: 4.30, W: 1.80, H: 1.47, wb: 2.64, fo: 0.88, gc: 0.155, R: 0.32, nose: 0.72, cowl: 0.36, hCowl: 1.00, ws: 0.78, belt: 0.94, roofR: 0.32, tail: 'gate', gate: 0.34, tumble: 0.33, bowN: 0.22, bowT: 0.16 },
  wagon:    { L: 4.82, W: 1.85, H: 1.48, wb: 2.80, fo: 0.93, gc: 0.165, R: 0.325, nose: 0.71, cowl: 0.40, hCowl: 1.00, ws: 0.80, belt: 0.94, roofR: 0.72, tail: 'gate', gate: 0.26, tumble: 0.33, bowN: 0.20, bowT: 0.13 },
  suv:      { L: 4.62, W: 1.88, H: 1.66, wb: 2.75, fo: 0.90, gc: 0.215, R: 0.365, nose: 0.90, cowl: 0.38, hCowl: 1.17, ws: 0.72, belt: 1.07, roofR: 0.45, tail: 'gate', gate: 0.3, tumble: 0.27, bowN: 0.18, bowT: 0.13, clad: 1 },
  suvc:     { L: 4.72, W: 1.92, H: 1.60, wb: 2.90, fo: 0.87, gc: 0.19, R: 0.37, nose: 0.86, cowl: 0.30, hCowl: 1.13, ws: 0.86, belt: 1.06, roofR: -0.55, tail: 'deck', deck: 0.12, hDeck: 1.20, rake: 1.02, tumble: 0.33, bowN: 0.22, bowT: 0.15, clad: 1, kamm: 1 },
  coupe:    { L: 4.97, W: 1.96, H: 1.38, wb: 2.92, fo: 0.95, gc: 0.13, R: 0.35, nose: 0.62, cowl: 0.42, hCowl: 0.92, ws: 0.90, belt: 0.90, roofR: -0.70, tail: 'deck', deck: 0.34, hDeck: 0.97, rake: 1.25, tumble: 0.44, bowN: 0.28, bowT: 0.20 },
  mini:     { L: 3.62, W: 1.63, H: 1.51, wb: 2.36, fo: 0.68, gc: 0.15, R: 0.285, nose: 0.76, cowl: 0.22, hCowl: 1.02, ws: 0.62, belt: 0.95, roofR: 0.30, tail: 'gate', gate: 0.24, tumble: 0.26, bowN: 0.22, bowT: 0.14 },
  tall:     { L: 4.08, W: 1.78, H: 1.60, wb: 2.58, fo: 0.80, gc: 0.165, R: 0.33, nose: 0.86, cowl: 0.20, hCowl: 1.10, ws: 0.60, belt: 1.02, roofR: 0.42, tail: 'gate', gate: 0.16, tumble: 0.15, bowN: 0.16, bowT: 0.09 },
  van:      { L: 4.98, W: 1.93, H: 1.93, wb: 3.27, fo: 0.90, gc: 0.18, R: 0.34, nose: 0.92, cowl: -0.22, hCowl: 1.22, ws: 0.74, belt: 1.12, roofR: 0.70, tail: 'gate', gate: 0.07, tumble: 0.11, bowN: 0.16, bowT: 0.05 },
  truck:    { L: 5.65, W: 2.03, H: 1.80, wb: 3.63, fo: 0.96, gc: 0.30, R: 0.42, nose: 0.98, cowl: 0.05, hCowl: 1.08, ws: 1.45, belt: 1.10, roofR: -1.72, tail: 'deck', deck: 0.04, hDeck: 1.22, rake: 1.9, tumble: 0.22, bowN: 0.04, bowT: 0.02, angular: 1 },
  bus:      { L: 10.6, W: 2.5, H: 3.05, wb: 5.6, fo: 2.5, gc: 0.33, R: 0.48, nose: 1.25, cowl: -2.25, hCowl: 1.35, ws: 0.22, belt: 1.45, roofR: 2.35, tail: 'gate', gate: 0.05, tumble: 0.05, bowN: 0.12, bowT: 0.06 },
};

// Rakentaa muotofunktiot korityypin mitoista. o voi sisältää mallikohtaisia poikkeuksia samoilla avaimilla.
export function shapeOf(type, o = {}) {
  const B = Object.assign({}, BODY[type] || BODY.sedan, o);
  const { L, W, H } = B, fa = L - B.fo, ra = fa - B.wb;
  const zr0 = B.zr0 || B.gc + 0.16, zf0 = B.zf0 || B.gc + 0.08;
  const uCowl = fa - B.cowl, uA = uCowl - B.ws, hNose = B.nose, hC = B.hCowl;
  const uR = Math.max(0.3, ra - B.roofR), uPeak = Math.min(uA - 0.25, Math.max(uR + 0.2, B.peak !== undefined ? ra + B.peak : (uA + uR) / 2 + 0.15));
  const ang = !!B.angular;
  // keulan ja perän pituus ei saa ylittää kulman pyöristystä, jotta kulman reuna pysyy pystyssä
  const noseLen = Math.min(B.noseLen || 0.22, B.bowN + 0.02), tf = Math.min(B.tailLen || (B.tail === 'deck' ? 0.19 : 0.15), B.bowT + 0.02);
  const beltR = B.beltR !== undefined ? B.beltR : B.belt + 0.035;
  const top = [];
  let uD, hD, gateZ = 0;
  if (B.tail === 'deck') {
    uD = B.deck + tf; hD = B.hDeck;
    const lip = B.duck ? 0.04 : 0;
    // puskuri työntyy taakse, sen päällä porras ja takakannen pääty kallistuu eteenpäin
    const zb1 = Math.min(hD - 0.3, zr0 + 0.27);
    top.push([0, zr0], [tf * 0.05, zr0 + 0.1], [tf * 0.16, zb1], [tf * 0.38, zb1 + 0.05], [tf * 0.66, hD - 0.14], [tf * 0.92, hD - 0.03 + lip], [tf + 0.03, hD + lip * 1.15]);
    if (uD - tf > 0.2) top.push([tf + (uD - tf) * 0.55, hD + 0.014], [uD, hD + 0.03]);
    else top.push([uD + 0.04, hD + 0.02 - lip * 0.4]);
    const uEnd = Math.min(uR, uD + B.rake);
    top.push([(uD + uEnd) / 2 + 0.02, (hD + H) / 2 + (B.kamm ? 0.04 : 0.02)], [uEnd, H - 0.035]);
    B._uR = uEnd;
  } else {
    // takaluukku: puskuri, luukun alaosa, takalasi ja katon takareuna
    const g = B.gate, zg = B.zGate || beltR + 0.02;
    gateZ = zg;
    const zb1 = Math.min(zg - 0.3, zr0 + 0.29);
    top.push([0, zr0], [tf * 0.06, zr0 + 0.1], [tf * 0.2, zb1], [tf * 0.46, zb1 + 0.05], [tf * 0.8, zg - 0.12], [tf, zg]);
    top.push([tf + g * 0.5, zg + (H - zg) * 0.56], [tf + g, H - 0.07 - (B.gateDrop || 0)], [tf + g + 0.16, H - 0.028]);
    uD = tf; hD = zg; B._uR = tf + g + 0.03;
  }
  const uRoofR = B._uR;
  if (ang) top.push([uPeak - 0.02, H - 0.004], [uPeak, H], [uPeak + 0.02, H - 0.004]);
  else top.push([Math.max(uRoofR + 0.25, uPeak - 0.3), H - 0.008], [uPeak, H], [(uPeak + uA) / 2, H - 0.012]);
  top.push([uA, H - (ang ? 0.0 : 0.045) - (ang ? (uA - uPeak) * 0.0 : 0)]);
  if (ang) { top.pop(); } else top.push([(uA + uCowl) / 2, (H - 0.045 + hC) / 2 + 0.012]);
  top.push([uCowl, hC]);
  const hoodLen = L - noseLen - uCowl;
  top.push([uCowl + hoodLen * 0.5, hC - (hC - hNose) * (ang ? 0.5 : 0.36)], [L - noseLen - 0.1, hNose + 0.03], [L - noseLen, hNose - 0.015]);
  { const zb1 = Math.max(zf0 + 0.2, Math.min(hNose - 0.2, zf0 + 0.3));
    top.push([L - noseLen * 0.66, hNose - 0.11], [L - noseLen * 0.36, zb1 + 0.05], [L - noseLen * 0.15, zb1], [L - noseLen * 0.04, zf0 + 0.09], [L, zf0]); }
  top.sort((a, b) => a[0] - b[0]);
  const zTop = ang ? lin(top) : pchip(top);
  // olkalinja: kyljen yläreuna (konepellin reuna, ikkunalinja, takakannen reuna)
  const shPts = [[0, (B.tail === 'deck' ? hD : gateZ) - 0.07], [Math.max(0.3, ra - 0.2), B.tail === 'deck' ? Math.max(beltR, hD - 0.04) : beltR], [(ra + fa) / 2, B.belt], [uCowl - 0.1, hC - 0.05], [uCowl + hoodLen * 0.55, hC - (hC - hNose) * 0.42 - 0.035], [L - noseLen - 0.05, hNose - 0.03], [L, hNose - 0.13]];
  const zSh = ang ? lin(shPts) : pchip(shPts);
  const zBot = pchip([[0, zr0], [Math.max(0.12, ra - B.R - 0.3), B.gc + 0.07], [ra - B.R * 0.6, B.gc], [fa + B.R * 0.6, B.gc], [Math.min(L - 0.1, fa + B.R + 0.28), B.gc + 0.035], [L, zf0]]);
  // leveys ylhäältä katsottuna: loiva kavennus päitä kohti ja ympyrän kaari kulmissa (kylki kiertyy päädyn puolelle)
  const xR = B.bowT, xF = L - B.bowN, rcR = B.cornerR || (ang ? 0.03 : 0.24), rcF = B.cornerF || (ang ? 0.03 : 0.3);
  const plan0 = pchip([[xR, B.planR || 0.955], [xR + 0.45, 0.985], [ra, 1], [fa, 1], [xF - 0.5, 0.985], [xF, B.planF || 0.95]]);
  const plan = X => {
    let y = W / 2 * plan0(X);
    const dR = clamp(xR + rcR - X, 0, rcR), dF = clamp(X - (xF - rcF), 0, rcF);
    // kaarevuus alkaa vähitellen, jotta kyljen ja kulman rajaan ei jää näkyvää taitetta
    const sR = Math.pow(dR / rcR, 1.45), sF = Math.pow(dF / rcF, 1.45);
    y -= rcR * (1 - Math.sqrt(Math.max(0, 1 - sR * sR))) + rcF * (1 - Math.sqrt(Math.max(0, 1 - sF * sF)));
    return y / (W / 2);
  };
  const bowW = B.bowW !== undefined ? B.bowW : 0.15, bowG = B.bowG !== undefined ? B.bowG : 0.13;
  // bow = kuinka paljon reunat jäävät keskilinjasta jälkeen ylhäältä katsottuna. Keulassa ja perässä se kasvaa samaa tahtia
  // kuin profiili etenee, jolloin kyljen ja päädyn välinen kulma on pystysuora ja puskurin kulmat pyöristyvät.
  const bow = lin([[0, -B.bowT], [tf, -B.bowT + 0.96 * tf], [Math.max(tf + 0.12, uD + 0.1), -bowG], [uRoofR, -bowG * 0.7], [uPeak, 0], [uA, bowW], [uCowl, bowW],
    [L - noseLen - 0.4, Math.max(0.03, (B.bowN - noseLen) * 0.6 + 0.03)], [L - noseLen, B.bowN - 0.96 * noseLen], [L, B.bowN]].sort((a, b) => a[0] - b[0]));
  const cr = B.crown !== undefined ? B.crown : 1;
  const crown = pchip([[0, 0], [tf + 0.06, 0.012 * cr], [uD + 0.05, 0.02 * cr], [uRoofR + 0.1, 0.034 * cr], [uA, 0.034 * cr], [uCowl, 0.03 * cr], [L - noseLen - 0.08, 0.022 * cr], [L - noseLen * 0.5, 0.004], [L, 0]].sort((a, b) => a[0] - b[0]));
  const S = { xR, xF, rcR, rcF, B, L, W, H, fa, ra, uCowl, uA, uR: uRoofR, uPeak, uD, hD, tf, noseLen, zr0, zf0, zTop, zSh, zBot, plan, bow, crown, ang, gateZ, beltR };
  S.Ra = B.R + (B.archGap || 0.05);
  S.za = B.R;
  // pyöränkaari: helman alareuna nousee kaaren muotoon akselin kohdalla
  S.zBotE = X => {
    let z = zBot(X);
    for (const ax of [ra, fa]) { const d = Math.abs(X - ax); if (d < S.Ra) z = Math.max(z, S.za + Math.sqrt(S.Ra * S.Ra - d * d)); }
    return z;
  };
  S.tumble = B.tumble; S.rs = B.rs || (ang ? 0.012 : 0.05); S.rb = B.rb || (ang ? 0.02 : 0.07);
  S.ledge = B.ledge !== undefined ? B.ledge : 0.014; S.sideUp = B.sideUp !== undefined ? B.sideUp : (ang ? 0 : 0.03); S.sideLow = B.sideLow !== undefined ? B.sideLow : (ang ? 0.01 : 0.04);
  // kyljen X asemalla u: keula ja perä pyöristyvät ylhäältä katsottuna, koska reunat jäävät keskilinjasta jälkeen
  S.flare = B.flare !== undefined ? B.flare : (B.clad ? 0.03 : 0.018); S.haunch = B.haunch !== undefined ? B.haunch : (ang ? 0 : 0.013);
  S.kink = B.kink !== undefined ? B.kink : (ang ? 0 : 0.016); S.sill = B.sillIn !== undefined ? B.sillIn : (ang ? 0 : 0.012);
  S.xSide = u => u - bow(u);
  S.uOfX = X => { let lo = 0, hi = L; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (m - bow(m) < X) lo = m; else hi = m; } return (lo + hi) / 2; };
  S.fy = yn => { const a = yn * yn; return 0.45 * a + 0.55 * a * a * a; }; // päädyn muoto ylhäältä: keskeltä loiva, kulmista pyöreä
  return S;
}

// Poikkileikkauksen pisteiden määrät: A pohjan huuli, Bk helman pyöristys, C kylki, D olkapään pyöristys, E ikkunat, F katto (puolikas)
export const DETAIL = [
  { A: 2, Bk: 3, C: 11, D: 3, E: 7, F: 15, dens: 1.15 },      // pelaajan auto
  { A: 1, Bk: 2, C: 4, D: 2, E: 3, F: 6, dens: 0.42 },    // muu liikenne ja matala laatutaso
];

// kyljen muoto korkeuden mukaan: helman sisäänveto, oven kovera kohta, olkalinjan pullistus ja yläreunan kallistus
function sideY(S, yM, t) {
  return yM - S.sideLow * Math.pow(1 - t, 2.2) - S.sideUp * t * t * t - S.kink * Math.max(0, t - 0.8) * 5 - S.sill * Math.max(0, 0.1 - t) * 10 + S.haunch * Math.exp(-Math.pow((t - 0.74) / 0.11, 2)) - S.haunch * 0.6 * Math.exp(-Math.pow((t - 0.36) / 0.2, 2));
}
// Rengas asemalla u. Palauttaa puolikkaan pisteet järjestyksessä pohjasta kattoon: [X, y, z, osa, t] …
function ring(S, u, D, out) {
  const X = S.xSide(u), bw = S.bow(u);
  const yM = S.W / 2 * S.plan(X);
  const zb = S.zBotE(X);
  const zc = S.zTop(u), cw = S.crown(u);
  const zRail = Math.max(zb + 0.004, zc - cw);
  const zs = clamp(Math.min(S.zSh(X), zRail), zb + 0.003, 9);
  const hSide = zs - zb, gh = Math.max(0, zRail - zs);
  const rb = Math.min(S.rb, hSide * 0.42), rs = Math.min(S.rs, hSide * 0.36, yM * 0.3);
  let n = 0;
  const put = (x, y, z, part, t) => { out[n++] = x; out[n++] = y; out[n++] = z; out[n++] = part; out[n++] = t; };
  // A: pohjan huuli sisältä ulos
  for (let i = 0; i < D.A; i++) put(X, yM * (0.58 + 0.2 * i / D.A), zb, 0, i / D.A);
  // B: helman pyöristys
  for (let i = 0; i < D.Bk; i++) { const a = -Math.PI / 2 + (i / D.Bk) * Math.PI / 2; put(X, yM - rb + Math.cos(a) * rb - S.sideLow, zb + rb + Math.sin(a) * rb, 1, i / D.Bk); }
  // C: kylki, alhaalla sisäänveto ja ylhäällä kallistus sisään
  const zc0 = zb + rb, zc1 = zs - rs;
  for (let i = 0; i < D.C; i++) {
    const t = i / (D.C - 1), z = zc0 + (zc1 - zc0) * t;
    let y = sideY(S, yM, t);
    for (const ax of [S.ra, S.fa]) { const r = Math.hypot(X - ax, z - S.za) - S.Ra; if (r < 0.14) y += S.flare * Math.pow(1 - Math.max(0, r) / 0.14, 2); }
    put(X, y, z, 2, t);
  }
  // D: olkapää
  const yc = sideY(S, yM, 1);
  for (let i = 1; i <= D.D; i++) { const a = (i / D.D) * Math.PI / 2; put(X, yc - rs + Math.cos(a) * rs, zs - rs + Math.sin(a) * rs, 3, i / D.D); }
  // E: ikkunalinja kattokaareen
  const yB = yc - rs - S.ledge * Math.min(1, gh * 12);
  const yR = Math.max(0.05, yB - S.tumble * gh);
  for (let i = 0; i < D.E; i++) { const t = i / (D.E - 1), k = t + 0.10 * Math.sin(t * Math.PI) * Math.min(1, gh * 4); put(X, yB + (yR - yB) * t + 0.012 * Math.sin(t * Math.PI) * Math.min(1, gh * 3), zs + gh * k, 4, t); }
  // F: katto, konepelti tai takakansi reunasta keskelle; reuna pyöristyy
  for (let i = 1; i < D.F; i++) {
    const q = i / (D.F - 1), yn = 1 - q, y = yR * yn;
    put(u - bw * S.fy(yn), y, Math.max(zb, zRail + cw * (1 - Math.pow(yn, 2.4))), 5, q);
  }
  return { X, yM, zb, zs, zRail, gh, yB, yR, n: n / 5 };
}

// asemat: tiheämmin siellä, missä profiili on jyrkkä (keula, perä, lasit) ja pyöränkaarissa
function stations(S, dens, forcedX, forcedU) {
  const N = 1400, us = [], w = [0];
  for (let i = 0; i <= N; i++) us.push(S.L * i / N);
  for (let i = 1; i <= N; i++) {
    const u = us[i], du = us[i] - us[i - 1], dz = Math.abs(S.zTop(u) - S.zTop(us[i - 1])) + 0.6 * Math.abs(S.zBot(S.xSide(u)) - S.zBot(S.xSide(us[i - 1])));
    const X = S.xSide(u);
    let k = du / 0.085 + dz / 0.03;
    for (const ax of [S.ra, S.fa]) if (Math.abs(X - ax) < S.Ra + 0.04) k += du / 0.045;
    if (X < S.xR + S.rcR + 0.02 || X > S.xF - S.rcF - 0.02) k += du / 0.022; // kulmien kaaret
    w.push(w[i - 1] + k * dens);
  }
  const total = w[N], n = Math.ceil(total), out = [0];
  let j = 0;
  for (let i = 1; i < n; i++) { const target = total * i / n; while (w[j] < target) j++; out.push(us[j]); }
  out.push(S.L);
  const add = u => { if (u <= 0.004 || u >= S.L - 0.004) return; let bi = -1, bd = 0.012 / Math.max(0.3, dens); for (let i = 1; i < out.length - 1; i++) { const d = Math.abs(out[i] - u); if (d < bd) { bd = d; bi = i; } } if (bi >= 0) out[bi] = u; else out.push(u); };
  forcedU.forEach(add); forcedX.forEach(X => add(S.uOfX(X)));
  out.sort((a, b) => a - b);
  return out.filter((u, i) => i === 0 || u - out[i - 1] > 1e-4);
}

// Materiaalit: 0 maali, 1 lasi, 2 musta lista/muovi, 3 katon väri, 4 alaosan väri (kaksivärimaali tai helmamuovi)
export function buildBody(S, opt = {}) {
  const D = DETAIL[opt.lod || 0], B = S.B;
  const glass = opt.glass || {};
  // lasien rajat (tuulilasi ja takalasi profiilin u:na, sivulasit kyljen X:nä)
  const wsF = S.uCowl - 0.015, wsR = S.uA + 0.03;
  const rgF = B.tail === 'deck' ? S.uR - 0.04 : S.uR - 0.05, rgR = B.tail === 'deck' ? S.uD + 0.05 : S.tf + 0.012;
  const pillarB = glass.pillarB !== undefined ? glass.pillarB : S.fa - 1.13, pw = 0.045;
  const sideR = glass.sideR !== undefined ? glass.sideR : (B.tail === 'deck' ? S.uR + 0.02 : S.uR + 0.14);
  const pillarC = glass.pillarC !== undefined ? glass.pillarC : (B.tail === 'gate' && S.uR < S.ra + 0.1 ? S.ra + 0.12 : null);
  const sideF = S.uCowl - 0.02;
  const fX = [S.ra - S.Ra, S.ra + S.Ra, S.fa - S.Ra, S.fa + S.Ra, S.ra, S.fa, pillarB - pw, pillarB + pw, sideR, sideR - 0.03];
  if (pillarC !== null) fX.push(pillarC - pw, pillarC + pw);
  const fU = [wsF, wsR, rgF, rgR, S.uA, S.uCowl, S.uR];
  const st = stations(S, D.dens, fX, fU);
  const half = D.A + D.Bk + D.C + D.D + D.E + (D.F - 1), full = half * 2 - 1, nS = st.length;
  const pos = new Float32Array(nS * full * 3), uv = new Float32Array(nS * full * 2), dirt = new Float32Array(nS * full);
  const part = new Uint8Array(half), tpar = new Float32Array(half), buf = new Float32Array(half * 5);
  const info = [];
  for (let i = 0; i < nS; i++) {
    const r = ring(S, st[i], D, buf); info.push(r);
    let arc = 0;
    for (let j = 0; j < half; j++) {
      const x = buf[j * 5], y = buf[j * 5 + 1], z = buf[j * 5 + 2];
      if (i === 0) { part[j] = buf[j * 5 + 3]; tpar[j] = buf[j * 5 + 4]; }
      if (j > 0) arc += Math.hypot(y - buf[(j - 1) * 5 + 1], z - buf[(j - 1) * 5 + 2]);
      // oikea puoli (y > 0) indeksit half-1+… ja vasen peilattuna
      const a = i * full + (half - 1) + (half - 1 - j), b = i * full + j; // a: oikea puoli keskeltä ulos, b: vasen puoli pohjasta ylös
      const jj = half - 1 - j; void jj;
      let yl = y, yr = y;
      if (opt.dents && buf[j * 5 + 3] === 2) for (const d of opt.dents) { const k = d.depth * Math.exp(-(Math.pow(x - d.X, 2) + Math.pow((z - d.z) * 1.6, 2)) / (d.r * d.r)); if (d.side < 0) yl -= k; else yr -= k; }
      pos[b * 3] = x; pos[b * 3 + 1] = -yl; pos[b * 3 + 2] = z;
      pos[a * 3] = x; pos[a * 3 + 1] = yr; pos[a * 3 + 2] = z;
      uv[b * 2] = x; uv[b * 2 + 1] = -arc; uv[a * 2] = x; uv[a * 2 + 1] = arc;
      // lika: helmat ja pyörien takana enemmän
      let d = sstep(0.95, 0.25, z) * 0.9 + 0.1;
      for (const ax of [S.ra, S.fa]) { const dx = ax - x; if (dx > 0 && dx < 1.0 && z < 0.9) d += (1 - dx) * 0.5 * sstep(0.95, 0.3, z); }
      if (x < 0.25) d += 0.35 * sstep(1.3, 0.4, z);
      dirt[a] = dirt[b] = Math.min(1, d);
    }
  }
  // pintojen materiaalit solun keskipisteen mukaan
  const idx = [[], [], [], [], []];
  const E0 = D.A + D.Bk + D.C + D.D, F0 = E0 + D.E;
  const two = !!opt.twotone, clad = opt.clad !== undefined ? opt.clad : !!B.clad;
  for (let i = 0; i < nS - 1; i++) {
    const um = (st[i] + st[i + 1]) / 2, Xm = (info[i].X + info[i + 1].X) / 2, gh = Math.min(info[i].gh, info[i + 1].gh);
    for (let j = 0; j < half - 1; j++) {
      const p = part[j + 1] === part[j] ? part[j] : part[j + 1], p0 = part[j];
      let m = 0;
      if (p0 === 4 && part[j + 1] === 4) { // ikkunalinja: alin rivi on lista, ylin kattokaari
        const row = j - E0, last = D.E - 2;
        const inSide = Xm > sideR && Xm < sideF && gh > 0.085;
        const pil = Math.abs(Xm - pillarB) < pw || (pillarC !== null && Math.abs(Xm - pillarC) < pw);
        if (inSide && row === 0) m = 2;
        else if (inSide && row < last && !pil) m = 1;
        else if (inSide && row < last && pil) m = opt.bodyPillars ? 0 : 2; // B- ja C-pilari kiiltävän mustat
        else if (inSide && row === last) m = opt.roof ? 3 : 0;
        else m = (Xm <= sideR && opt.roof && gh > 0.1 && opt.floating) ? 3 : 0;
      } else if (p === 5 || p0 === 5) { // katto ja lasit
        const col = j - F0 + 1; // 0 = reunimmainen
        const ws = um > wsR && um < wsF, rg = um > rgR && um < rgF;
        if (ws) m = col <= 0 ? (opt.blackPillars ? 2 : opt.roof ? 3 : 0) : 1;
        else if (rg) m = col <= 0 ? (opt.roof && !opt.blackHatch ? 3 : opt.blackHatch ? 2 : 0) : 1;
        else if (um >= rgF && um <= wsR) m = opt.glassRoof ? (col <= 1 ? 0 : 1) : opt.roof ? 3 : 0;
        else if (opt.blackHatch && um < rgR && um > S.tf * 0.9 && B.tail === 'gate') m = 2;
        else m = 0;
      } else if (p0 <= 2) { // kylki ja helma
        const tm = part[j] === 2 ? (tpar[j] + (part[j + 1] === 2 ? tpar[j + 1] : 1)) / 2 : 0;
        if (part[j] < 2) m = clad || two ? 4 : 0;
        else if (clad && tm < 0.2) m = 4;
        else if (two && tm < 0.52) m = 4;
        else m = 0;
      }
      const a = i * full + j, b = (i + 1) * full + j;             // vasen puoli
      idx[m].push(a, a + 1, b, a + 1, b + 1, b);
      const jr = full - 2 - j, c = i * full + jr, d = (i + 1) * full + jr; // oikea puoli (peilattu järjestys)
      idx[m].push(c, c + 1, d, c + 1, d + 1, d);
    }
  }
  const all = [], g = new THREE.BufferGeometry();
  let o = 0; const groups = [];
  for (let m = 0; m < 5; m++) { groups.push([o, idx[m].length]); for (const v of idx[m]) all.push(v); o += idx[m].length; }
  // koordinaatit auton omaan kehykseen: x oikealle, y ylös, eteen = −z; origo maassa akselivälin keskellä
  const mid = (S.ra + S.fa) / 2, P = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { P[i] = pos[i + 1]; P[i + 1] = pos[i + 2]; P[i + 2] = mid - pos[i]; }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aDirt', new THREE.BufferAttribute(dirt, 1));
  g.setIndex(all);
  groups.forEach(([s, c], m) => { if (c) g.addGroup(s, c, m); });
  g.computeVertexNormals();
  return { geometry: g, mid, stations: st, info, glassBounds: { wsF, wsR, rgF, rgR, sideR, sideF, pillarB, pillarC } };
}

// ---------- pinnan arviointi osien sijoittelua varten ----------
// Palauttaa pisteen auton kehyksessä (x oikealle, y ylös, −z eteen) ja pinnan normaalin.
export function surface(S) {
  const D = { A: 2, Bk: 3, C: 11, D: 3, E: 7, F: 15 };
  const buf = new Float32Array(64 * 5), mid = (S.ra + S.fa) / 2;
  const conv = (X, y, z, v) => v.set(y, z, mid - X);
  const sec = u => ring(S, u, D, buf);
  const api = { mid };
  // katto/konepelti/keula/perä: u = profiilin parametri, yn = −1…1 reunasta reunaan
  api.top = (u, yn, v) => {
    const r = sec(u), a = Math.abs(yn), bw = S.bow(u), cw = S.crown(u);
    return conv(u - bw * S.fy(a), r.yR * yn, Math.max(r.zb, r.zRail + cw * (1 - Math.pow(a, 2.4))), v);
  };
  // kylki: X = pituuskohta, t = 0 (helma) … 1 (olkalinja), side = ±1
  api.side = (X, t, side, v) => {
    const u = S.uOfX(X), r = sec(u), rb = Math.min(S.rb, (r.zs - r.zb) * 0.42), rs = Math.min(S.rs, (r.zs - r.zb) * 0.36, r.yM * 0.3);
    const z0 = r.zb + rb, z1 = r.zs - rs;
    const z = z0 + (z1 - z0) * t;
    let y = sideY(S, r.yM, t);
    for (const ax of [S.ra, S.fa]) { const q = Math.hypot(X - ax, z - S.za) - S.Ra; if (q < 0.14) y += S.flare * Math.pow(1 - Math.max(0, q) / 0.14, 2); }
    return conv(X, side * y, z, v);
  };
  api.sideAtZ = (X, z, side, v) => {
    const u = S.uOfX(X), r = sec(u), rb = Math.min(S.rb, (r.zs - r.zb) * 0.42), rs = Math.min(S.rs, (r.zs - r.zb) * 0.36, r.yM * 0.3);
    return api.side(X, clamp((z - r.zb - rb) / Math.max(1e-3, r.zs - rs - r.zb - rb), 0, 1), side, v);
  };
  // ikkunapinta: t = 0 (ikkunalinja) … 1 (kattokaari)
  api.glassSide = (X, t, side, v) => { const r = sec(S.uOfX(X)); return conv(X, side * (r.yB + (r.yR - r.yB) * t), r.zs + r.gh * t, v); };
  api.sec = u => { const r = sec(u); return { X: r.X, yM: r.yM, zb: r.zb, zs: r.zs, zRail: r.zRail, gh: r.gh, yB: r.yB, yR: r.yR }; };
  // keulan tai perän pinnalta u, kun korkeus z ja sivusuunta y (metreinä) tunnetaan
  api.uAtZ = (front, z, y) => {
    let lo = front ? S.L - S.noseLen - 0.12 : 0, hi = front ? S.L : S.tf + 0.06;
    for (let i = 0; i < 26; i++) {
      const u = (lo + hi) / 2, r = sec(u), yn = clamp(Math.abs(y) / Math.max(0.05, r.yR), 0, 1);
      const zz = Math.max(r.zb, r.zRail + S.crown(u) * (1 - Math.pow(yn, 2.4)));
      if ((zz > z) === front) lo = u; else hi = u;
    }
    return (lo + hi) / 2;
  };
  // sama, kun sivusuunta annetaan osuutena −1…1 pinnan leveydestä
  api.uAtZn = (front, z, yn) => {
    let lo = front ? S.L - S.noseLen - 0.14 : 0, hi = front ? S.L : S.tf + 0.08;
    const a = Math.abs(yn), k = 1 - Math.pow(a, 2.4);
    for (let i = 0; i < 26; i++) { const u = (lo + hi) / 2, r = sec(u), zz = Math.max(r.zb, r.zRail + S.crown(u) * k); if ((zz > z) === front) lo = u; else hi = u; }
    return (lo + hi) / 2;
  };
  api.fasciaN = (front, yn, z, v) => api.top(api.uAtZn(front, z, yn), yn, v);
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
  // piste keulan/perän pinnalla kohdassa (y, z) ja normaali
  api.fascia = (front, y, z, v, nrm) => {
    const f = (yy, zz, out) => { const u = api.uAtZ(front, zz, yy), r = sec(u); return api.top(u, clamp(yy / Math.max(0.05, r.yR), -1, 1), out); };
    f(y, z, v);
    if (nrm) { f(y + 0.01, z, p1); f(y, z + 0.01, p2); p1.sub(v); p2.sub(v); nrm.crossVectors(p1, p2).normalize(); if ((nrm.z < 0) !== front) nrm.negate(); }
    return v;
  };
  api.normalTop = (u, yn, nrm) => { api.top(u, yn, p0); api.top(u + 0.01, yn, p1); api.top(u, yn + 0.01, p2); p1.sub(p0); p2.sub(p0); nrm.crossVectors(p2, p1).normalize(); if (nrm.y < 0) nrm.negate(); return nrm; };
  return api;
}
