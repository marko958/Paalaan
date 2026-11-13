// PAALAAN! 2.0 – grafiikkaydin (alpha 34)
// Kuva on aidosti 320×200 pikseliä ja siinä on vain C64:n 16 väriä. Välisävyt tehdään rasteroimalla
// (4×4-Bayer-kuvio), kuten C64:llä. Piirto ei käytä canvasin piirtokomentoja vaan omaa kuvapuskuria, jossa
// jokainen pikseli on paletin indeksi (kuin C64:n näyttömuisti); canvasille siirretään vain valmis kuva.
// Pimeys ei ole läpinäkyvä kerros vaan paletin porrastus: jokainen väri vaihtuu pimeässä tummempaan
// C64-väriin, ja ajovalojen keila sekä muut valot keventävät porrastusta.
'use strict';

const Gfx = (() => {
  const W = 320, H = 200;
  // Colodore-paletti
  const HEX = ['#000000', '#FFFFFF', '#813338', '#75CEC8', '#8E3C97', '#56AC4D', '#2E2C9B', '#EDF171',
               '#8E5029', '#553800', '#C46C71', '#4A4A4A', '#7B7B7B', '#A9FF9F', '#706DEB', '#B2B2B2'];
  const C = { black:0, white:1, red:2, cyan:3, purple:4, green:5, blue:6, yellow:7, orange:8, brown:9, lred:10, dgrey:11, grey:12, lgreen:13, lblue:14, lgrey:15 };
  const RGB = HEX.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const LUM = RGB.map(c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
  const PAL32 = new Uint32Array(RGB.map(c => (0xFF000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0));
  const dist = (r, g, b, c) => { const dr = r - c[0], dg = g - c[1], db = b - c[2]; return 3 * dr * dr + 4 * dg * dg + 2 * db * db; };
  const nearest = (r, g, b) => { let bi = 0, bd = Infinity; for (let i = 0; i < 16; i++) { const d = dist(r, g, b, RGB[i]); if (d < bd) { bd = d; bi = i; } } return bi; };

  // pimeän portaat: RAMP[taso * 16 + väri]; taso 0 = päivänvalo, 4 = lähes musta. Sävy taittuu siniseen kuin kuutamossa.
  // Usein yhteen rasteroidut värit (valkoinen ja vaaleanharmaa lumessa) päätyvät pimeässä samaan väriin, jotta lumi ei rakeistu.
  const RAMP_SRC = {
    0: [0, 0, 0, 0, 0],    1: [1, 15, 12, 11, 0],  2: [2, 9, 9, 0, 0],    3: [3, 14, 6, 6, 0],
    4: [4, 11, 6, 0, 0],   5: [5, 11, 6, 0, 0],    6: [6, 6, 0, 0, 0],    7: [7, 8, 9, 9, 0],
    8: [8, 9, 9, 0, 0],    9: [9, 9, 0, 0, 0],     10: [10, 2, 9, 0, 0],  11: [11, 6, 0, 0, 0],
    12: [12, 11, 6, 0, 0], 13: [13, 5, 11, 6, 0],  14: [14, 6, 6, 0, 0],  15: [15, 12, 11, 11, 0],
  };
  const RAMP = new Uint8Array(5 * 16);
  for (let l = 0; l < 5; l++) for (let i = 0; i < 16; i++) RAMP[l * 16 + i] = RAMP_SRC[i][l];
  const dimIdx = (i, l) => RAMP[Math.max(0, Math.min(4, l)) * 16 + i];

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const BAYF = new Float32Array(BAYER.map(b => (b + 0.5) / 16));

  // ---------- pinnat ----------
  // pinta = kuvapuskuri: pikselin arvo on paletin indeksi 0–15, +16 = itsevalaiseva (ei himmene pimeässä), 255 = tyhjä.
  // ox, oy = siirto (ja rasterikuvion ankkuri), clipY = rivit tästä alaspäin jäävät piirtämättä (mäen harja).
  const EMIT = 16, NONE = 255;
  const surface = (w, h) => ({ w, h, buf: new Uint8Array(w * h).fill(NONE), ox: 0, oy: 0, clipY: h, stack: [], img: null });
  const clear = sf => { sf.buf.fill(NONE); };
  const push = (sf, dx, dy) => { sf.stack.push(sf.ox, sf.oy); sf.ox += dx; sf.oy += dy; };
  const pop = sf => { sf.oy = sf.stack.pop(); sf.ox = sf.stack.pop(); };

  // ---------- musteet ----------
  // muste: b = pohjaväri (−1 = ei pohjaa), s = rasterin väri, n = rasterin tiheys 0–16, e = itsevalaiseva (0 tai 16)
  const inkC = new Map();
  function mix(i, j, n) {
    if (j === undefined || !n) { j = i; n = 0; }
    n = Math.max(0, Math.min(16, Math.round(n)));
    if (n >= 16) { i = j; n = 0; }
    const key = i | (j << 4) | (n << 8);
    let k = inkC.get(key);
    if (!k) inkC.set(key, k = { b: i, s: j, n, e: 0 });
    return k;
  }
  // pelkkä rasteri ilman pohjaväriä (varjot, hehkut, usva); e = itsevalaiseva
  const veilC = new Map();
  function veil(i, n, e) {
    n = Math.max(0, Math.min(16, Math.round(n)));
    const key = i | (n << 4) | (e ? 1024 : 0);
    let k = veilC.get(key);
    if (!k) veilC.set(key, k = n >= 16 ? { b: i, s: i, n: 0, e: e ? EMIT : 0 } : { b: -1, s: i, n, e: e ? EMIT : 0 });
    return k;
  }
  // itsevalaiseva väri: jälkikäsittely ei himmennä sitä (takavalot, ikkunat, heijastimet)
  const EM = HEX.map((h, i) => ({ b: i, s: i, n: 0, e: EMIT }));
  const em = i => EM[typeof i === 'number' ? i : C[i]];
  // mielivaltainen väri → lähin yksivärinen tai rasteroitu C64-sävy. Suurikontrastisia pareja vältetään.
  const hexC = new Map();
  const CHR = RGB.map(c => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]));
  function match(r, g, b, solid) {
    // harmaaseen sävyyn ei sekoiteta värejä: paletin värin kylläisyys ei saa ylittää tavoitetta reilusti
    const tc = Math.max(r, g, b) - Math.min(r, g, b), sat = i => { const e = Math.max(0, CHR[i] - tc * 1.6 - 25); return e * e * 1.5; };
    let best = null, bd = Infinity;
    for (let i = 0; i < 16; i++) { const d = dist(r, g, b, RGB[i]) + sat(i); if (d < bd) { bd = d; best = [i, i, 0]; } }
    if (!solid) for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      if (i === j) continue;
      const dl = Math.abs(LUM[i] - LUM[j]);
      if (dl > 95) continue;
      for (const n of [4, 8]) {
        if (n === 8 && j < i) continue;
        const f = n / 16, c = [RGB[i][0] * (1 - f) + RGB[j][0] * f, RGB[i][1] * (1 - f) + RGB[j][1] * f, RGB[i][2] * (1 - f) + RGB[j][2] * f];
        const d = dist(r, g, b, c) + dl * dl * 0.9 + (n === 8 ? 1500 : 900) + sat(i) + sat(j);
        if (d < bd) { bd = d; best = [i, j, n]; }
      }
    }
    return mix(best[0], best[1], best[2]);
  }
  function ink(v, solid) {
    if (typeof v === 'object') return v;
    if (typeof v === 'number') return mix(v);
    const key = v + (solid ? '!' : '');
    let k = hexC.get(key);
    if (!k) {
      if (C[v] !== undefined) k = mix(C[v]);
      else { const n = parseInt(v.slice(1), 16); k = match((n >> 16) & 255, (n >> 8) & 255, n & 255, solid); }
      hexC.set(key, k);
    }
    return k;
  }
  // sama muste pimeän tason l mukaan himmennettynä (pelaajan auto piirretään jälkikäsittelyn jälkeen)
  const dimInk = (k, l) => (!l || k.e ? k : k.b < 0 ? veil(dimIdx(k.s, l), k.n) : mix(dimIdx(k.b, l), dimIdx(k.s, l), k.n));
  // sävytys: kerroin f RGB-avaruudessa ja uusi sovitus palettiin
  const shadeC = new Map();
  function shade(hex, f, solid) {
    const key = hex + f + (solid ? '!' : '');
    let k = shadeC.get(key);
    if (!k) {
      const n = parseInt(hex.slice(1), 16), ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f + (f > 1 ? (f - 1) * 90 : 0))));
      shadeC.set(key, k = match(ch(16), ch(8), ch(0), solid));
    }
    return k;
  }

  // ---------- piirtoalkeet ----------
  function rect(sf, x, y, w, h, k) {
    let x0 = Math.round(x) + sf.ox, y0 = Math.round(y) + sf.oy, x1 = x0 + Math.round(w), y1 = y0 + Math.round(h);
    const W = sf.w, cy = sf.clipY < sf.h ? sf.clipY : sf.h;
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W) x1 = W; if (y1 > cy) y1 = cy;
    if (x1 <= x0 || y1 <= y0) return;
    const buf = sf.buf, n = k.n;
    if (!n) { if (k.b < 0) return; const v = k.b | k.e; for (let yy = y0; yy < y1; yy++) buf.fill(v, yy * W + x0, yy * W + x1); return; }
    const ax = sf.ox, ay = sf.oy, sv = k.s | k.e, bv = k.b < 0 ? -1 : k.b | k.e;
    for (let yy = y0; yy < y1; yy++) {
      const row = ((yy - ay) & 3) << 2; let i = yy * W + x0;
      if (bv < 0) { for (let xx = x0; xx < x1; xx++, i++) if (BAYER[row | ((xx - ax) & 3)] < n) buf[i] = sv; }
      else for (let xx = x0; xx < x1; xx++, i++) buf[i] = BAYER[row | ((xx - ax) & 3)] < n ? sv : bv;
    }
  }
  // puolisuunnikas riveittäin: ylhäällä (y0) reunat xl0..xr0, alhaalla (y1) xl1..xr1; y0 < y1 ruudun koordinaateissa
  function trap(sf, y0, xl0, xr0, y1, xl1, xr1, k, ymax) {
    const lim = sf.clipY - sf.oy, a = Math.max(Math.round(y0), -sf.oy), b = Math.min(Math.round(y1), ymax === undefined ? lim : Math.min(ymax, lim)), dy = (y1 - y0) || 1;
    for (let y = a; y < b; y++) {
      const t = (y + 0.5 - y0) / dy, l = Math.round(xl0 + (xl1 - xl0) * t), r = Math.round(xr0 + (xr1 - xr0) * t);
      if (r > l) rect(sf, l, y, r - l, 1, k);
    }
  }
  function disc(sf, cx, cy, rx, ry, k, ymax) {
    const lim = sf.clipY - sf.oy, top = ymax === undefined ? lim : Math.min(ymax, lim);
    const y0 = Math.round(cy - ry), y1 = Math.min(Math.round(cy + ry), top);
    if (Math.round(cy + ry) <= y0) { if (y0 < top) rect(sf, Math.round(cx - rx), y0, Math.max(1, Math.round(rx * 2)), 1, k); return; }
    for (let y = Math.max(y0, -sf.oy); y < y1; y++) {
      const t = (y + 0.5 - cy) / ry, hw = rx * Math.sqrt(Math.max(0, 1 - t * t)), l = Math.round(cx - hw), r = Math.round(cx + hw);
      rect(sf, l, y, Math.max(1, r - l), 1, k);
    }
  }
  function line(sf, x0, y0, x1, y1, k) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    while (n++ < 900) {
      rect(sf, x0, y0, 1, 1, k);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // pystyliuku: stops = paletin indeksejä ylhäältä alas, välit rasteroidaan
  function vgrad(sf, x, y0, w, y1, stops) {
    const n = stops.length - 1, h = y1 - y0;
    for (let y = 0; y < h; y++) {
      const p = n * y / Math.max(1, h - 1), b = Math.min(n - 1, Math.floor(p));
      rect(sf, x, y0 + y, w, 1, mix(stops[b], stops[b + 1], Math.round((p - b) * 16)));
    }
  }

  // ---------- pikselifontti 3×5 (ääkkösten pisteet kahdella lisärivillä) ----------
  const F = {
    A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110', E:'111100110100111', F:'111100110100100',
    G:'011100101101011', H:'101101111101101', I:'11111', J:'001001001101010', K:'101101110101101', L:'100100100100111',
    M:'1000111011101011000110001', N:'10011101101110011001', O:'010101101101010', P:'110101110100100', Q:'010101101110011',
    R:'110101110101101', S:'011100010001110', T:'111010010010010', U:'101101101101111', V:'101101101101010',
    W:'1000110001101011101110001', X:'101101010101101', Y:'101101010010010', Z:'111001010100111',
    0:'111101101101111', 1:'010110010010111', 2:'110001010100111', 3:'110001010001110', 4:'101101111001001',
    5:'111100110001110', 6:'011100111101111', 7:'111001010010010', 8:'111101111101111', 9:'111101111001110',
    '.':'00001', ',':'00011', '!':'11101', '?':'110001010000010', '-':'000000111000000', '+':'000010111010000', ':':'01010',
    '/':'001001010100100', '%':'101001010100101', '€':'01111100111011000111', '·':'00100', "'":'11000', '(':'0110101001', ')':'1001010110',
    '=':'000111000111000', '>':'01000010111100100100', '<':'00100100111101000010', '°':'111101111000000', '*':'000101010101000',
  };
  const ALIAS = { 'Ä':['A', '101'], 'Ö':['O', '101'], 'Å':['A', '010'], 'Ë':['E', '101'], 'É':['E', '010'], 'Ü':['U', '101'], '–':['-'], '−':['-'], '—':['-'], '→':['>'], '←':['<'], '×':['X'], '"':["'"], '’':["'"] };
  const glyph = ch => { const a = ALIAS[ch]; const b = F[a ? a[0] : ch]; return b ? { b, w: b.length / 5, dots: a && a[1] } : null; };
  function textW(str, s) {
    let w = 0;
    for (const ch of String(str).toUpperCase()) { const G = glyph(ch); w += (G ? G.w : 2) + 1; }
    return Math.max(0, w - 1) * (s || 1);
  }
  // y = kirjainten yläreuna (ääkkösten pisteet menevät sen yli), align: 0 vasen, 0.5 keskitys, 1 oikea
  function text(sf, str, x, y, s, k, align) {
    s = s || 1; str = String(str).toUpperCase();
    x = Math.round(x - textW(str, s) * (align || 0)); y = Math.round(y);
    for (const ch of str) {
      const G = glyph(ch);
      if (!G) { x += 3 * s; continue; }
      for (let r = 0; r < 5; r++) for (let c = 0; c < G.w; c++) if (G.b[r * G.w + c] === '1') rect(sf, x + c * s, y + r * s, s, s, k);
      if (G.dots) for (let c = 0; c < 3; c++) if (G.dots[c] === '1') rect(sf, x + c * s, y - 2 * s, s, s, k);
      x += (G.w + 1) * s;
    }
  }
  // teksti suurimmalla kokonaislukukoolla, joka mahtuu; liian pienenä piirretään pelkkä viiva
  function fit(sf, str, cx, y, maxW, maxH, k) {
    const w1 = textW(str, 1), s = Math.min(Math.floor(maxW / Math.max(1, w1)), Math.floor(maxH / 5));
    if (s >= 1) { text(sf, str, cx, y + Math.floor((maxH - 5 * s) / 2), s, k, 0.5); return s; }
    if (maxW >= 4 && maxH >= 2) { const w = Math.max(2, Math.round(maxW * 0.7)); rect(sf, Math.round(cx - w / 2), Math.round(y + maxH / 2 - 0.5), w, 1, k); }
    return 0;
  }

  // ---------- 8×8-merkistö paneeleihin ----------
  // Oma piirros C64-henkeen: 6 pikseliä leveät merkit kahden pikselin rungolla, 40 merkkiä riville. Vain isot kirjaimet.
  const F8SRC = {
    A:'.XXXX. XX..XX XX..XX XXXXXX XX..XX XX..XX XX..XX', B:'XXXXX. XX..XX XX..XX XXXXX. XX..XX XX..XX XXXXX.', C:'.XXXX. XX..XX XX.... XX.... XX.... XX..XX .XXXX.',
    D:'XXXX.. XX.XX. XX..XX XX..XX XX..XX XX.XX. XXXX..', E:'XXXXXX XX.... XX.... XXXXX. XX.... XX.... XXXXXX', F:'XXXXXX XX.... XX.... XXXXX. XX.... XX.... XX....',
    G:'.XXXX. XX..XX XX.... XX.XXX XX..XX XX..XX .XXXXX', H:'XX..XX XX..XX XX..XX XXXXXX XX..XX XX..XX XX..XX', I:'.XXXX. ..XX.. ..XX.. ..XX.. ..XX.. ..XX.. .XXXX.',
    J:'..XXXX ...XX. ...XX. ...XX. ...XX. XX.XX. .XXX..', K:'XX..XX XX.XX. XXXX.. XXX... XXXX.. XX.XX. XX..XX', L:'XX.... XX.... XX.... XX.... XX.... XX.... XXXXXX',
    M:'XX..XX XXXXXX XXXXXX XX..XX XX..XX XX..XX XX..XX', N:'XX..XX XXX.XX XXXXXX XXXXXX XX.XXX XX..XX XX..XX', O:'.XXXX. XX..XX XX..XX XX..XX XX..XX XX..XX .XXXX.',
    P:'XXXXX. XX..XX XX..XX XXXXX. XX.... XX.... XX....', Q:'.XXXX. XX..XX XX..XX XX..XX XX.XXX .XXXX. ....XX', R:'XXXXX. XX..XX XX..XX XXXXX. XXXX.. XX.XX. XX..XX',
    S:'.XXXX. XX..XX XX.... .XXXX. ....XX XX..XX .XXXX.', T:'XXXXXX ..XX.. ..XX.. ..XX.. ..XX.. ..XX.. ..XX..', U:'XX..XX XX..XX XX..XX XX..XX XX..XX XX..XX .XXXX.',
    V:'XX..XX XX..XX XX..XX XX..XX XX..XX .XXXX. ..XX..', W:'XX..XX XX..XX XX..XX XX..XX XXXXXX XXXXXX XX..XX', X:'XX..XX XX..XX .XXXX. ..XX.. .XXXX. XX..XX XX..XX',
    Y:'XX..XX XX..XX .XXXX. ..XX.. ..XX.. ..XX.. ..XX..', Z:'XXXXXX ....XX ...XX. ..XX.. .XX... XX.... XXXXXX',
    'Ä':'XX..XX ...... .XXXX. XX..XX XXXXXX XX..XX XX..XX', 'Ö':'XX..XX ...... .XXXX. XX..XX XX..XX XX..XX .XXXX.', 'Å':'..XX.. ...... .XXXX. XX..XX XXXXXX XX..XX XX..XX',
    0:'.XXXX. XX..XX XX.XXX XXX.XX XX..XX XX..XX .XXXX.', 1:'..XX.. .XXX.. ..XX.. ..XX.. ..XX.. ..XX.. .XXXX.', 2:'.XXXX. XX..XX ....XX ...XX. ..XX.. .XX... XXXXXX',
    3:'.XXXX. XX..XX ....XX ..XXX. ....XX XX..XX .XXXX.', 4:'...XX. ..XXX. .XXXX. XX.XX. XXXXXX ...XX. ...XX.', 5:'XXXXXX XX.... XXXXX. ....XX ....XX XX..XX .XXXX.',
    6:'.XXXX. XX.... XX.... XXXXX. XX..XX XX..XX .XXXX.', 7:'XXXXXX ....XX ...XX. ..XX.. ..XX.. ..XX.. ..XX..', 8:'.XXXX. XX..XX XX..XX .XXXX. XX..XX XX..XX .XXXX.',
    9:'.XXXX. XX..XX XX..XX .XXXXX ....XX ....XX .XXXX.',
    '.':'...... ...... ...... ...... ...... ..XX.. ..XX..', ',':'...... ...... ...... ...... ..XX.. ..XX.. .XX...', '!':'..XX.. ..XX.. ..XX.. ..XX.. ...... ..XX.. ..XX..',
    '?':'.XXXX. XX..XX ....XX ...XX. ..XX.. ...... ..XX..', '-':'...... ...... ...... XXXXXX ...... ...... ......', '+':'...... ..XX.. ..XX.. XXXXXX ..XX.. ..XX.. ......',
    ':':'...... ..XX.. ..XX.. ...... ..XX.. ..XX.. ......', '/':'....XX ...XX. ...XX. ..XX.. .XX... .XX... XX....', '%':'XX..XX XX.XX. ...XX. ..XX.. .XX... .XX.XX XX..XX',
    '€':'..XXXX .XX... XXXXX. .XX... XXXXX. .XX... ..XXXX', '·':'...... ...... ..XX.. ..XX.. ...... ...... ......', "'":'..XX.. ..XX.. .XX... ...... ...... ...... ......',
    '(':'...XX. ..XX.. .XX... .XX... .XX... ..XX.. ...XX.', ')':'.XX... ..XX.. ...XX. ...XX. ...XX. ..XX.. .XX...', '=':'...... ...... XXXXXX ...... XXXXXX ...... ......',
    '>':'...... ..XX.. ...XX. XXXXXX ...XX. ..XX.. ......', '<':'...... ..XX.. .XX... XXXXXX .XX... ..XX.. ......', '°':'.XXX.. XX.XX. .XXX.. ...... ...... ...... ......',
    '~':'...... ...... .XX..X XXXXXX X..XX. ...... ......', '*':'...... XX..XX .XXXX. XXXXXX .XXXX. XX..XX ......', 'v':'..XX.. ..XX.. ..XX.. XXXXXX .XXXX. ..XX.. ......',
    '#':'.X..X. XXXXXX .X..X. .X..X. XXXXXX .X..X. ......',
    '^':'..XX.. .XXXX. XXXXXX ..XX.. ..XX.. ..XX.. ......', '|':'..XX.. ..XX.. ..XX.. ..XX.. ..XX.. ..XX.. ..XX..', '[':'.XXXX. .XX... .XX... .XX... .XX... .XX... .XXXX.', ']':'.XXXX. ...XX. ...XX. ...XX. ...XX. ...XX. .XXXX.',
    ';':'...... ..XX.. ..XX.. ...... ..XX.. ..XX.. .XX...', '…':'...... ...... ...... ...... ...... X.XX.X X.XX.X', '_':'...... ...... ...... ...... ...... ...... XXXXXX',
    '"':'XX.XX. XX.XX. .X..X. ...... ...... ...... ......', '$':'..XX.. .XXXXX XX.... .XXXX. ....XX XXXXX. ..XX..', '×':'...... XX..XX .XXXX. ..XX.. .XXXX. XX..XX ......',
    'Ë':'XX..XX ...... XXXXXX XX.... XXXXX. XX.... XXXXXX', 'Ü':'XX..XX ...... XX..XX XX..XX XX..XX XX..XX .XXXX.', '█':'XXXXXX XXXXXX XXXXXX XXXXXX XXXXXX XXXXXX XXXXXX', '&':'.XXX.. XX.XX. .XXX.. XXX.XX XX.XX. XX.XX. .XX.XX',
  };
  const A8 = { 'É':'E', '–':'-', '−':'-', '—':'-', '→':'>', '←':'<', '↓':'v', '↑':'^', '’':"'", '★':'*' };
  const F8 = {};
  for (const ch in F8SRC) F8[ch] = F8SRC[ch].split(' ').map(r => { let b = 0; for (let i = 0; i < 6; i++) if (r[i] === 'X') b |= 1 << i; return b; });
  // teksti 8×8-ruudukkoon: x, y pikseleinä, fg = väri-indeksi, bg = taustan indeksi tai −1 (ei taustaa), scale = 1 tai 2
  function text8(sf, str, x, y, fg, bg, scale) {
    const sc = scale || 1; str = String(str).toUpperCase();
    const fk = mix(fg), bk = bg >= 0 ? mix(bg) : null;
    for (const c0 of str) {
      const ch = A8[c0] || c0, G = F8[ch];
      if (bk) rect(sf, x, y, 8 * sc, 8 * sc, bk);
      if (G) for (let r = 0; r < 7; r++) { const b = G[r]; if (b) for (let i = 0; i < 6; i++) if (b & (1 << i)) rect(sf, x + (1 + i) * sc, y + r * sc, sc, sc, fk); }
      x += 8 * sc;
    }
  }
  // rivitys sanarajoista enintään cols merkin riveiksi
  function wrap8(str, cols) {
    const out = []; let line = '';
    for (const w of String(str).split(' ')) {
      if (line && (line + ' ' + w).length > cols) { out.push(line); line = w; }
      else line = line ? line + ' ' + w : w;
      while (line.length > cols) { out.push(line.slice(0, cols)); line = line.slice(cols); }
    }
    if (line) out.push(line);
    return out;
  }

  // ---------- valokartta ----------
  // light[i] = 0..255: kuinka paljon pikseli on valossa. Ajovalojen keila lasketaan kerran, muut valot leimataan päälle.
  const light = new Uint8Array(W * H), cone = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / 190, dy = (y - 168) / 78, d = Math.sqrt(dx * dx + dy * dy);
    let v = Math.max(0, 1 - d); v = Math.pow(v, 0.7) * 1.7;
    if (y < 98) v *= Math.max(0, 1 - (98 - y) / 30); // kaukovalot yltävät vähän horisontin yli
    cone[y * W + x] = Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  const lightReset = on => { if (on) light.set(cone); else light.fill(0); };
  function glow(cx, cy, rx, ry, pow) {
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx)), y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
    if (rx < 0.5 || ry < 0.5) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d < 1) { const i = y * W + x, v = light[i] + (1 - d) * pow * 255; light[i] = v > 255 ? 255 : v; }
    }
  }

  // ---------- jälkikäsittely ----------
  // tausta (taivas) sellaisenaan, maailma pimeän portaisiin valokartan mukaan, itsevalaisevat pikselit täydellä kirkkaudella
  function post(world, back, out, amb) {
    const wb = world.buf, bb = back.buf, ob = out.buf, dark = amb > 0, k = amb / 255;
    for (let y = 0, i = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i++) {
        const v = wb[i];
        if (v === NONE) ob[i] = bb[i] & 15;
        else if (v & EMIT || !dark) ob[i] = v & 15;
        else { // rasteri vain portaiden rajoilla: valon vyöhykkeet ovat tasaisia, eikä koko keila rakeistu
          let l = (k * (255 - light[i]) + 0.5 + (BAYF[by | (x & 3)] - 0.5) * 0.4) | 0; if (l > 4) l = 4; ob[i] = RAMP[l * 16 + v]; }
      }
    }
  }
  // valmis pinta canvasille
  function blit(sf, ctx) {
    if (!sf.img) { sf.img = ctx.createImageData(sf.w, sf.h); sf.u32 = new Uint32Array(sf.img.data.buffer); }
    const b = sf.buf, u = sf.u32;
    for (let i = 0, n = b.length; i < n; i++) u[i] = PAL32[b[i] & 15];
    ctx.putImageData(sf.img, 0, 0);
  }

  return { W, H, HEX, C, surface, clear, push, pop, ink, mix, veil, em, shade, dimInk, dimIdx, rect, trap, disc, line, vgrad, text, textW, fit, text8, wrap8, light, lightReset, glow, post, blit };
})();
