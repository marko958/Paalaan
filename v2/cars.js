// PAALAAN! 2.0 – autot (alpha 34)
// g on gfx.js:n pinta (kuvapuskuri). Jokainen auto piirretään koodissa pikseli kerrallaan C64:n 16 värillä: takaa (oma auto ja edellä ajavat)
// ja edestä (vastaantulijat). Mallit erottuvat korityypistä, mittasuhteista ja valosignatuurista; logoja ei ole.
// Mitat ovat "autoyksiköitä": henkilöauton leveys on 72, ja k kertoo, montako pikseliä yksikkö on.
'use strict';

const Cars = (() => {
  const { ink, mix, em, veil, shade, dimInk, rect, C } = Gfx;

  // b = kori, w = leveyskerroin, c = väri, r = katon väri, tl = takavalot, hl = etuvalot, g = maski, x = lisäosat
  // takavalot: corner, wide, bar, pixel, vertical, round, tri, low, claw
  // etuvalot: slim, round, quad, split, bar, pixel, hammer, tri
  // maski: slot (säleikkö), thin, kid (kaksi munuaista), kidtall, sf (iso yksiosainen), rr (pystysäleikkö), panel (musta paneeli)
  const MODELS = [
    ['Ford Mondeo',       { b:'sedan', c:'#A8ADB4', tl:'corner', hl:'slim', g:'slot', x:['exh1'] }],
    ['Opel Astra',        { b:'hatch', c:'#7A1F24', tl:'wide', hl:'slim', g:'slot', x:['exh1', 'spoiler'] }],
    ['Toyota Avensis',    { b:'sedan', c:'#6E7378', tl:'wide', hl:'slim', g:'slot', x:['exh1'] }],
    ['Toyota Prius',      { b:'prius', c:'#C9CDD2', tl:'vertical', hl:'tri', g:'thin', x:['split', 'spoiler'] }],
    ['Volvo V70',         { b:'wagon', c:'#23314F', tl:'vertical', hl:'hammer', g:'slot', x:['exh2', 'rails', 'tall-lights'] }],
    ['VW Passat',         { b:'wagon', c:'#4D5258', tl:'wide', hl:'slim', g:'slot', x:['exh2', 'rails'] }],
    ['Audi A6',           { b:'sedan', w:1.04, c:'#1A1A1C', tl:'wide', hl:'split', g:'sf', x:['exh2', 'chrome'] }],
    ['BMW 530d',          { b:'sedan', w:1.04, c:'#1F2633', tl:'corner', hl:'quad', g:'kid', x:['exh2'] }],
    ['Mitsubishi Outlander', { b:'suv', c:'#E4E4E4', tl:'corner', hl:'slim', g:'slot', x:['rails'] }],
    ['Nissan Leaf',       { b:'hatch', c:'#EDEDED', tl:'vertical', hl:'round', g:'panel', x:['spoiler', 'tall-lights'] }],
    ['Renault Zoe',       { b:'mini', c:'#2F6DB5', tl:'wide', hl:'slim' }],
    ['VW e-Golf',         { b:'hatch', c:'#F0F0F0', tl:'wide', hl:'slim', g:'thin', x:['spoiler'] }],
    ['BMW i3',            { b:'tall', w:0.88, c:'#EDEDED', r:'#151515', tl:'corner', hl:'slim', g:'kid', x:['blackhatch'] }],
    ['Hyundai Ioniq 5',   { b:'hatch', w:1.02, c:'#9AA0A0', tl:'pixel', hl:'pixel', g:'panel', x:['spoiler'] }],
    ['Hyundai Ioniq',     { b:'prius', c:'#D6D9DD', tl:'wide', hl:'slim', g:'panel', x:['split'] }],
    ['Hyundai Kona',      { b:'suv', w:0.94, c:'#B9C23A', r:'#1A1A1A', tl:'low', hl:'split', x:['spoiler'] }],
    ['Kia e-Soul',        { b:'tall', c:'#A61E22', r:'#EDEDED', tl:'vertical', hl:'bar', x:['tall-lights'] }],
    ['Kia e-Niro',        { b:'suv', w:0.96, c:'#3A6EA5', tl:'vertical', hl:'slim', g:'thin', x:['spoiler'] }],
    ['Kia EV6',           { b:'suvc', c:'#3C4045', tl:'bar', hl:'slim', g:'thin', x:['duck'] }],
    ['Peugeot e-208',     { b:'hatch', w:0.94, c:'#D9B526', tl:'claw', hl:'tri', g:'slot', x:['spoiler'] }],
    ['Dacia Spring',      { b:'mini', w:0.84, c:'#E6E6E6', tl:'corner', hl:'split', g:'slot', x:['orange'] }],
    ['Fiat Topolino',     { b:'topo', w:0.72, c:'#7FB8A4', r:'#E8E8E0', tl:'round', hl:'round' }],
    ['Fiat 500e',         { b:'mini', w:0.82, c:'#9ED3C5', tl:'round', hl:'round', x:['chrome'] }],
    ['MG4',               { b:'hatch', c:'#D0412C', tl:'bar', hl:'slim', x:['spoiler'] }],
    ['VW ID.3',           { b:'hatch', c:'#B7BEC2', tl:'wide', hl:'bar', x:['blackhatch'] }],
    ['Tesla Model 3',     { b:'fastback', c:'#A3121A', tl:'wide', hl:'slim', x:['duck'] }],
    ['Tesla Model Y',     { b:'modely', c:'#ECECEC', tl:'wide', hl:'slim', x:['duck'] }],
    ['Tesla Model S 85',  { b:'fastback', w:1.04, c:'#8B8E92', tl:'wide', hl:'slim', g:'panel', x:['rust'] }],
    ['Tesla Model S',     { b:'fastback', w:1.04, c:'#111214', tl:'wide', hl:'slim', x:['duck'] }],
    ['Tesla Cybertruck',  { b:'truck', w:1.12, c:'#A9ADB1', tl:'bar', hl:'bar' }],
    ['Skoda Enyaq',       { b:'suv', c:'#2E5B4C', tl:'wide', hl:'slim', g:'sf', x:['rails'] }],
    ['VW ID.4',           { b:'suv', c:'#F1F1F1', r:'#151515', tl:'bar', hl:'bar', x:['spoiler'] }],
    ['Polestar 2',        { b:'fastback', c:'#E4E4E0', tl:'bar', hl:'hammer', g:'panel' }],
    ['Polestar 3',        { b:'suv', w:1.06, c:'#1F2328', tl:'bar', hl:'hammer', x:['spoiler'] }],
    ['Ford Mustang Mach-E', { b:'suvc', c:'#B1181E', r:'#151515', tl:'tri', hl:'tri', x:['duck'] }],
    ['BYD Atto 3',        { b:'suv', c:'#3E6FA9', tl:'bar', hl:'bar' }],
    ['Volvo XC40',        { b:'suv', c:'#7C8C7A', r:'#151515', tl:'vertical', hl:'hammer', x:['spoiler', 'tall-lights'] }],
    ['Audi Q4',           { b:'suv', c:'#9AA1A6', tl:'bar', hl:'split', g:'sf', x:['spoiler'] }],
    ['BMW i4',            { b:'fastback', c:'#1E4D9A', tl:'corner', hl:'quad', g:'kidtall', x:['duck', 'diff'] }],
    ['Porsche Taycan',    { b:'coupe', w:1.06, c:'#C8CBCE', tl:'bar', hl:'quad', x:['diff'] }],
    ['Audi RS e-tron GT', { b:'coupe', w:1.06, c:'#5B6B4E', tl:'bar', hl:'split', g:'sf', x:['diff', 'duck'] }],
    ['Audi e-tron GT',    { b:'coupe', w:1.06, c:'#3A3F44', tl:'bar', hl:'split', g:'sf', x:['diff'] }],
    ['BMW iX',            { b:'suv', w:1.06, c:'#1C2A3A', tl:'wide', hl:'slim', g:'kidtall', x:['spoiler'] }],
    ['Jaguar I-Pace',     { b:'suvc', c:'#7A1E28', tl:'wide', hl:'slim', g:'slot', x:['spoiler'] }],
    ['Mercedes EQS SUV',  { b:'suv', w:1.08, c:'#E6E6E6', tl:'bar', hl:'bar', g:'panel', x:['chrome'] }],
    ['Mercedes EQS',      { b:'fastback', w:1.06, c:'#2B2E33', tl:'bar', hl:'bar', g:'panel', x:['chrome'] }],
    ['Maybach EQS SUV',   { b:'suv', w:1.08, c:'#C0C3C7', r:'#16161A', tl:'bar', hl:'bar', g:'rr', x:['chrome', 'twotone'] }],
    ['BMW i7',            { b:'sedan', w:1.08, c:'#121417', tl:'wide', hl:'split', g:'kidtall', x:['chrome'] }],
    ['Porsche Macan',     { b:'suvc', c:'#2E3A2F', tl:'bar', hl:'quad', x:['spoiler'] }],
    ['Lucid Air',         { b:'fastback', w:1.06, c:'#B9B2A4', tl:'bar', hl:'bar' }],
    ['Lotus Eletre',      { b:'suv', w:1.06, c:'#E8C32A', r:'#151515', tl:'bar', hl:'split', x:['spoiler', 'diff'] }],
    ['Rolls-Royce Spectre', { b:'coupe', w:1.14, c:'#2B2F46', r:'#C0C3C7', tl:'vertical', hl:'split', g:'rr', x:['chrome'] }],
    ['Toyota Proace',     { b:'van', w:1.12, c:'#F2F2F2', tl:'vertical', hl:'slim', g:'slot' }],
    ['Audi e-tron 55',    { b:'suv', w:1.04, c:'#5C6670', tl:'bar', hl:'split', g:'sf', x:['spoiler'] }],
    ['Citroën ë-SpaceTourer', { b:'van', w:1.06, c:'#2B3A55', tl:'vertical', hl:'split', g:'slot', x:['windows'] }],
    ['Kia PV5 Passenger', { b:'van', w:1.04, c:'#8C979C', tl:'vertical', hl:'hammer', x:['windows', 'onepiece'] }],
    ['Kia PV5 Cargo',     { b:'van', w:1.04, c:'#EDEDED', tl:'vertical', hl:'hammer', x:['panelvan'] }],
    ['Renault Fluence',   { b:'sedan', c:'#D8D8D8', tl:'wide', hl:'slim', g:'slot', x:['chrome'] }],
    ['Ford Focus Electric', { b:'hatch', c:'#2F6DB5', tl:'vertical', hl:'slim', g:'sf', x:['spoiler'] }],
    ['Elcat',             { b:'van', w:0.84, c:'#F28C28', tl:'vertical', hl:'round', g:'slot', x:['panelvan', 'small'] }],
    ['Honda e',           { b:'mini', w:0.86, c:'#E3D23A', r:'#151515', tl:'circle', hl:'circle', g:'panelbig', x:['rearpanel'] }],
  ];
  const GENERIC = { e: { b:'hatch', c:'#959595', tl:'corner', hl:'slim' }, b: { b:'sedan', c:'#959595', tl:'corner', hl:'slim', g:'slot', x:['exh1'] } };
  function spec(name, type) {
    const m = MODELS.find(([n]) => name.startsWith(n));
    return m ? m[1] : GENERIC[type === 'e' ? 'e' : 'b'];
  }
  // liikenteeseen: arkiset mallit yleisiä, kalliit harvinaisia
  const COMMON = MODELS.filter(([n]) => !/Rolls|Maybach|Lotus|Lucid|Cybertruck|Topolino|Elcat|Spectre|RS e-tron/.test(n)).map(m => m[1]);
  const TRAFFIC_COL = ['#A8ADB4', '#1F2633', '#7A1F24', '#ECECEC', '#2F6DB5', '#3A3F44', '#2E5B4C', '#111214', '#D8D8D8', '#6E7378'];
  function random() {
    const r = Math.random(), base = r < 0.94 ? COMMON[Math.floor(Math.random() * COMMON.length)] : MODELS[Math.floor(Math.random() * MODELS.length)][1];
    return Math.random() < 0.6 ? Object.assign({}, base, { c: TRAFFIC_COL[Math.floor(Math.random() * TRAFFIC_COL.length)] }) : base;
  }

  // korin mitat: cl = maavara, bh = kyljen korkeus, dk = takakannen syvyys ylhäältä nähtynä, cab = ohjaamon korkeus,
  // bw = ohjaamon leveys alhaalla, rw = katon leveys, rt = kattopinnan paksuus, hd = konepellin syvyys edestä
  const BODY = {
    sedan:    { cl:6, bh:15, dk:4, cab:12, bw:0.90, rw:0.62, rt:3, hd:8 },
    fastback: { cl:6, bh:15, dk:2, cab:13, bw:0.92, rw:0.56, rt:3, hd:8 },
    prius:    { cl:6, bh:17, dk:1, cab:13, bw:0.90, rw:0.64, rt:3, hd:6 },
    hatch:    { cl:6, bh:17, dk:0, cab:15, bw:0.90, rw:0.76, rt:3, hd:6 },
    wagon:    { cl:6, bh:16, dk:0, cab:16, bw:0.92, rw:0.84, rt:3, hd:8 },
    suv:      { cl:9, bh:20, dk:0, cab:16, bw:0.92, rw:0.80, rt:3, hd:6, clad:1 },
    suvc:     { cl:8, bh:19, dk:1, cab:14, bw:0.92, rw:0.64, rt:3, hd:7, clad:1 },
    modely:   { cl:8, bh:20, dk:1, cab:14, bw:0.92, rw:0.60, rt:3, hd:7 },
    coupe:    { cl:5, bh:13, dk:3, cab:10, bw:0.94, rw:0.54, rt:2, hd:9 },
    mini:     { cl:6, bh:17, dk:0, cab:16, bw:0.90, rw:0.80, rt:3, hd:4 },
    tall:     { cl:7, bh:18, dk:0, cab:20, bw:0.92, rw:0.86, rt:3, hd:4 },
    topo:     { cl:6, bh:15, dk:0, cab:22, bw:0.96, rw:0.92, rt:3, hd:1 },
    van:      { cl:7, bh:24, dk:0, cab:24, bw:0.98, rw:0.92, rt:3, hd:3 },
    truck:    { cl:9, bh:18, dk:0, cab:18, bw:0.98, rw:0.24, rt:1, hd:9 },
  };
  const dims = sp => BODY[sp.b] || BODY.sedan;
  const height = sp => { const B = dims(sp); return B.cl + B.bh + B.dk + B.cab; };

  const K = {}; for (const n in C) K[n] = mix(C[n]);
  const paintC = new Map();
  function paint(hex, solid) {
    const key = hex + (solid ? '!' : '');
    let p = paintC.get(key);
    if (!p) paintC.set(key, p = { hi: shade(hex, 1.32, solid), base: ink(hex, solid), lo: shade(hex, 0.66, solid), dk: shade(hex, 0.4, solid) });
    return p;
  }

  // piirtokynä: origo auton alareunan keskellä, y kasvaa ylöspäin, kaikki pyöristetään pikseleihin
  function pen(g, k, o) {
    const dm = o.dim || 0, wd = !!o.world;
    const tone = q => (dm ? dimInk(q, dm) : q);
    const R = (x, y, w, h, q, fine) => {
      let x0 = Math.round(x * k), x1 = Math.round((x + w) * k), y0 = Math.round(y * k), y1 = Math.round((y + h) * k);
      if (x1 <= x0) { if (fine && w * k < 0.55) return; x1 = x0 + 1; }
      if (y1 <= y0) { if (fine && h * k < 0.55) return; y1 = y0 + 1; }
      rect(g, x0, -y1, x1 - x0, y1 - y0, tone(q));
    };
    // puolisuunnikas: alhaalla (y0) xl0..xr0, ylhäällä (y1) xl1..xr1
    const T = (y0, xl0, xr0, y1, xl1, xr1, q) => {
      q = tone(q);
      const a = Math.round(y0 * k), b = Math.max(a + 1, Math.round(y1 * k)), dy = (y1 - y0) * k || 1;
      for (let y = a; y < b; y++) {
        const t = Math.max(0, Math.min(1, (y + 0.5 - y0 * k) / dy)), l = Math.round((xl0 + (xl1 - xl0) * t) * k), r = Math.round((xr0 + (xr1 - xr0) * t) * k);
        if (r > l) rect(g, l, -y - 1, r - l, 1, q);
      }
    };
    const E = i => (wd ? em(i) : K_IDX[i]);       // itsevalaiseva maailmassa, tavallinen väri muualla
    const V = (i, n) => veil(i, n, wd);           // hehkun rasteri
    return { R, T, E, V, tone };
  }
  const K_IDX = []; for (let i = 0; i < 16; i++) K_IDX[i] = mix(i);

  function plate(R, y, k, w) {
    w = w || 18;
    R(-w / 2, y, w, 6, K.white);
    if (k >= 0.7) {
      R(-w / 2, y, 2, 6, K.blue, true);
      for (const x of [-5.5, -2.5, 2.5, 5.5]) R(x - 0.5, y + 1.5, 2, 3.5, K.black, true);
      R(0, y + 2.5, 1, 1, K.black, true);
    } else if (k >= 0.3) R(-w / 2 + 3, y + 2, w - 6, 2, K.grey, true);
  }
  function tyres(R, hw, h, tw, k, anim) {
    R(-hw + 1, 0, tw, h, K.black); R(hw - 1 - tw, 0, tw, h, K.black);
    if (k >= 0.8) for (let i = 0; i < 3; i++) { // kulutuspinta vilisee vauhdissa
      const yy = ((i * 3 + (anim || 0)) % 9) * h / 9;
      R(-hw + 2, yy, tw - 2, 1, K.dgrey, true); R(hw - tw, yy, tw - 2, 1, K.dgrey, true);
    }
  }
  // ympyrä riveittäin (halkaisija 4, 6, 8 tai 10 yksikköä)
  const CIRC = { 4:[2, 4, 4, 2], 6:[2, 4, 6, 6, 4, 2], 8:[4, 6, 8, 8, 8, 8, 6, 4], 10:[4, 8, 8, 10, 10, 10, 10, 8, 8, 4] };
  const circ = (R, cx, cy, d, q) => CIRC[d].forEach((w, i) => R(cx - w / 2, cy + d / 2 - i - 1, w, 1, q));
  const shadow = (R, hw, V) => R(-hw - 2, -2, hw * 2 + 4, 4, veil(C.black, 8));

  // ---------- takakuva ----------
  // o: brake, night (0–1), steer (−1…1), mb, snow, dim, anim, world, box, rust, minor
  function rear(g, sp, cx, by, k, o) {
    o = o || {};
    if (sp.b === 'bus' || sp.b === 'lorry') return heavyRear(g, sp, cx, by, k, o);
    const x = sp.x || [], has = f => x.includes(f);
    const solid = k < 0.42, fine = k >= 0.7, night = (o.night || 0) > 0.3;
    const P = paint(sp.c, solid), PR = sp.r && !has('twotone') ? paint(sp.r, solid) : P;
    const B = dims(sp), W0 = 72 * (sp.w || 1), hw = W0 / 2;
    const cl = B.cl, top = cl + B.bh, cabB = top + B.dk, roofY = cabB + B.cab, rt = B.rt;
    const st = o.steer || 0, d = Math.sign(st), sw = Math.round(Math.abs(st) * 11 * k);
    Gfx.push(g, Math.round(cx) - d * (sw >> 1), Math.round(by));
    const cs = d * Math.min(1.5, Math.abs(st) * 2);   // ohjaamo kallistuu hieman käännöksen suuntaan
    const { R, T, E, V, tone } = pen(g, k, o);
    const glass = night ? mix(C.black, C.blue, 3) : mix(C.black, C.blue, 6);
    const lens = o.brake ? E(C.lred) : night ? E(C.red) : K.red;
    const lamp = (lx, ly, w, h) => {
      if (fine) R(lx - 0.6, ly - 0.6, w + 1.2, h + 1.2, P.dk, true);
      if (o.brake || night) R(lx - 1.5, ly - 1.5, w + 3, h + 3, V(o.brake ? C.lred : C.red, o.brake ? 8 : 4), true);
      R(lx, ly, w, h, lens);
      if (o.brake && w * k >= 2.6 && h * k >= 2.6) R(lx + 1, ly + 1, w - 2, h - 2, E(C.white), true);
    };
    const pair = (lx, ly, w, h) => { lamp(-hw + lx, ly, w, h); lamp(hw - lx - w, ly, w, h); };
    shadow(R, hw);

    if (sp.b === 'van') {
      const small = has('small'), hgt = small ? 40 : 50, tp = cl - 2 + hgt;
      tyres(R, hw, cl + 3, 12, k, o.anim);
      R(-hw + 12, cl - 3, W0 - 24, 4, K.black);
      R(-hw, cl - 2, W0, hgt, P.base); R(-hw + 1, tp, W0 - 2, 1, P.base);
      R(-hw, cl - 2, W0, 5, K.dgrey); R(-hw + 1, tp - 2, W0 - 2, 3, P.hi);          // puskuri ja katon reuna
      if (!has('panelvan')) { // lasit: kaksi ovea tai yksi luukku
        if (has('onepiece')) R(-hw + 6, tp - 20, W0 - 12, 15, glass);
        else { R(-hw + 6, tp - 20, hw - 8, 15, glass); R(2, tp - 20, hw - 8, 15, glass); }
        if (!night) R(-hw + 6, tp - 9, W0 - 12, 4, veil(C.lblue, 5), true);
        if (!has('onepiece')) R(-2, tp - 21, 4, 17, P.base, true);
      } else if (fine) { R(-hw + 6, tp - 20, hw - 8, 15, P.lo); R(2, tp - 20, hw - 8, 15, P.lo); R(-hw + 7, tp - 19, hw - 10, 13, P.base); R(3, tp - 19, hw - 10, 13, P.base); }
      if (!has('onepiece')) R(-0.5, cl + 4, 1, hgt - 10, P.dk, true);
      R(-3, cl + 16, 2, 4, K.black, true);                                         // kahva
      pair(1, cl + 10, 5, small ? 16 : 26);
      if (fine) { R(-hw + 2, cl + 10, 3, 4, K.orange, true); R(hw - 5, cl + 10, 3, 4, K.orange, true); }
      R(-5, tp - 1, 10, 1, o.brake ? E(C.lred) : K.red, true);
      plate(R, cl + 5, k);
      finish(tp, tp, 0.98);
      Gfx.pop(g); return;
    }
    if (sp.b === 'truck') { // kulmikas teräskiila: lava, vino katto ja koko leveä valopalkki
      tyres(R, hw, cl + 4, 13, k, o.anim);
      R(-hw + 13, cl - 3, W0 - 26, 4, K.black);
      R(-hw, cl, W0, 6, K.dgrey);
      R(-hw, cl + 5, W0, 14, P.base);
      T(cl + 19, -hw, hw, cl + 22, -hw + 2, hw - 2, P.hi);                          // lavan kansi
      T(cl + 22, -hw + 2, hw - 2, cl + 40, -hw * 0.2, hw * 0.2, P.lo);              // vinot kyljet
      T(cl + 25, -hw * 0.62, hw * 0.62, cl + 37, -hw * 0.22, hw * 0.22, glass);
      if (o.brake || night) R(-hw + 1, cl + 15, W0 - 2, 5, V(C.lred, o.brake ? 8 : 4), true);
      R(-hw + 1, cl + 16.5, W0 - 2, 2, lens);
      if (o.brake) R(-hw + 3, cl + 17, W0 - 6, 1, E(C.white), true);
      plate(R, cl + 7, k);
      finish(cl + 22, cl + 40, 0.2);
      Gfx.pop(g); return;
    }

    // --- tavallinen kori ---
    const tw = 11;
    tyres(R, hw, cl + 4, tw, k, o.anim);
    R(-hw + tw, cl - 3, W0 - tw * 2, 4, K.black);                                   // pohja
    // kylki: puskuri, takapinta ja olkapään kiilto
    R(-hw + 1, cl, W0 - 2, 6, B.clad ? K.dgrey : P.lo);
    R(-hw, cl + 4, W0, B.bh - 5, P.base); R(-hw + 1, top - 1, W0 - 2, 1, P.hi);
    if (has('twotone')) R(-hw, cl + 4, W0, B.bh * 0.5, paint(sp.r, solid).base);
    if (B.clad && fine) R(-10, cl, 20, 2, K.lgrey, true);                           // pohjapanssari
    if (has('orange')) R(-hw + 1, cl + 5, W0 - 2, 1, K.orange, true);
    if (fine && !B.clad) R(-hw + 3, top - B.bh * 0.55, W0 - 6, 1, P.lo, true);      // takaluukun sauma
    // takakansi ylhäältä (sedan, fastback, coupé)
    if (B.dk) T(top, -hw + 1, hw - 1, cabB, -hw * B.bw - 1, hw * B.bw + 1, P.hi);
    // ohjaamo: pilarit, lasi ja katto; kallistuu hieman käännöksen suuntaan
    const pil = has('blackhatch') ? K.black : PR.base;
    T(cabB, -hw * B.bw, hw * B.bw, roofY - rt, -hw * B.rw + cs, hw * B.rw + cs, pil);
    const gi = B.rw > 0.7 ? 3 : 4, gy0 = cabB + (has('blackhatch') ? -5 : 1.5), gy1 = roofY - rt - 1;
    const gl = (yy) => -hw * (B.bw + (B.rw - B.bw) * (yy - cabB) / (B.cab - rt)) + gi + cs * (yy - cabB) / (B.cab - rt);
    T(gy0, gl(gy0), -gl(gy0) + 2 * cs * (gy0 - cabB) / (B.cab - rt), gy1, gl(gy1), -gl(gy1) + 2 * cs * (gy1 - cabB) / (B.cab - rt), glass);
    if (!night && k >= 0.5) { const m = gy0 + (gy1 - gy0) * 0.6; T(m, gl(m) + 1, -gl(m) - 1, gy1, gl(gy1) + 1, -gl(gy1) - 1, veil(C.lblue, 3)); } // taivas heijastuu
    if (fine && !night && gy1 - gy0 > 8) { R(-12, gy0, 7, 4, K.black, true); R(5, gy0, 7, 4, K.black, true); }                              // niskatuet
    if (has('split')) { const m = cabB + B.cab * 0.42; R(gl(m) - 1, m, -gl(m) * 2 + 2, 2, P.base); }
    // katto ylhäältä
    T(roofY - rt, -hw * B.rw + cs, hw * B.rw + cs, roofY, -hw * B.rw * 0.9 + cs, hw * B.rw * 0.9 + cs, PR.hi);
    if (sp.b === 'topo') R(-hw * B.rw, roofY - rt, W0 * B.rw, rt, paint(sp.r, solid).base);
    if (has('spoiler')) R(-hw * B.rw - 1 + cs, roofY - rt - 1, W0 * B.rw + 2, 2, PR.lo);
    if (has('rails')) { R(-hw * B.rw + cs, roofY, 2, 2, K.dgrey, true); R(hw * B.rw - 2 + cs, roofY, 2, 2, K.dgrey, true); }
    if (has('duck')) R(-hw * 0.8, top - 1, W0 * 0.8, 2, P.dk);
    if (has('chrome')) R(-hw * 0.6, top - 5, W0 * 0.6, 1, K.lgrey, true);
    if (fine) { R(-hw - 3, top + 1, 4, 3, P.lo, true); R(hw - 1, top + 1, 4, 3, P.lo, true); }   // peilit
    // takavalot
    const ly = top - 7;
    if (has('rearpanel')) R(-hw + 3, ly - 3, W0 - 6, 8, K.black);   // musta paneeli, jossa pyöreät valot
    switch (sp.tl) {
      case 'bar':      if (o.brake || night) R(-hw + 1, ly - 1.5, W0 - 2, 5, V(C.lred, o.brake ? 8 : 4), true);
                       R(-hw + 2, ly, W0 - 4, 2, lens); R(-hw + 1, ly - 1, 8, 4, lens); R(hw - 9, ly - 1, 8, 4, lens);
                       if (o.brake) R(-hw + 3, ly + 0.5, W0 - 6, 1, E(C.white), true); break;
      case 'wide':     pair(1, ly - 1, 18, 4); if (fine) { R(-hw + 15, ly, 3, 2, K.white, true); R(hw - 18, ly, 3, 2, K.white, true); } break;
      case 'pixel':    for (let i = 0; i < 6; i++) { const px = 2 + (i % 3) * 4, py = ly - 2 + (i > 2 ? 3.5 : 0); R(-hw + px, py, 3, 2.5, lens); R(hw - px - 3, py, 3, 2.5, lens); }
                       R(-hw + 14, ly - 0.5, W0 - 28, 2, K.black, true); break;
      case 'vertical': { const tall = has('tall-lights'); pair(1, ly - 4, 4, 13); if (tall) { lamp(-hw * B.bw + 0.5, top + 1, 3, B.cab - rt - 3); lamp(hw * B.bw - 3.5, top + 1, 3, B.cab - rt - 3); } break; }
      case 'circle':   for (const sx of [-1, 1]) { const lx = sx * (hw - 7.5), cy = ly + 1; // täysin pyöreät valot mustassa paneelissa
                         if (o.brake || night) R(lx - 4.5, cy - 4.5, 9, 9, V(o.brake ? C.lred : C.red, o.brake ? 8 : 4), true);
                         circ(R, lx, cy, 6, lens); if (k >= 0.6) R(lx - 1, cy - 1, 2, 2, o.brake ? E(C.white) : K.black, true); } break;
      case 'round':    pair(2, ly - 2, 5, 7); pair(3, ly - 3, 3, 9); if (fine) { R(-hw + 3.5, ly, 2, 3, E(o.brake ? C.white : C.lred), true); R(hw - 5.5, ly, 2, 3, E(o.brake ? C.white : C.lred), true); } break;
      case 'tri':      for (let i = 0; i < 3; i++) { lamp(-hw + 2 + i * 3.5, ly - 3, 2, 8); lamp(hw - 4 - i * 3.5, ly - 3, 2, 8); } break;
      case 'claw':     for (let i = 0; i < 3; i++) { R(-hw + 2 + i * 4, ly - 2 + i * 0.5, 2, 6, lens); R(hw - 4 - i * 4, ly - 2 + i * 0.5, 2, 6, lens); } R(-hw + 14, ly, W0 - 28, 2, K.black, true); break;
      case 'low':      pair(1, cl + 6, 9, 3); pair(2, ly + 1, 12, 1.5); break;
      default:         pair(1, ly - 1, 12, 5); if (fine) { R(-hw + 2, ly - 1, 4, 2, K.orange, true); R(hw - 6, ly - 1, 4, 2, K.orange, true); }
    }
    // lisäjarruvalo, pyyhkijä, rekkari, pakoputket
    R(-4 + cs, roofY - rt - 2, 8, 1, o.brake ? E(C.lred) : K.red, true);
    if (fine && B.dk === 0 && sp.b !== 'topo' && !has('blackhatch')) for (let i = 0; i < 5; i++) R(-1 + i * 1.4, gy0 + 1 + i, 1.4, 1, K.black, true);
    plate(R, has('rearpanel') ? cl + 1 : cl + 6, k);
    if (has('exh1')) R(-hw + 14, cl - 1, 5, 2, K.lgrey, true);
    if (has('exh2')) { R(-hw + 13, cl - 1, 5, 2, K.lgrey, true); R(hw - 18, cl - 1, 5, 2, K.lgrey, true); }
    if (has('diff')) { R(-16, cl, 32, 4, K.black, true); for (let i = -2; i <= 2; i++) R(i * 6 - 0.5, cl, 1, 4, K.dgrey, true); }
    finish(top, roofY, B.rw);
    Gfx.pop(g);

    // yhteiset viimeistelyt: ruoste, mikrobetoni, suola, kattoboksi ja käännöksessä näkyvä kylki
    function finish(belt, roof, rw) {
      if (has('rust') || o.rust) { const q = mix(C.orange, C.brown, 8); R(-hw + 3, cl + 4, 4, 3, q, true); R(hw - 9, cl + 5, 5, 2, q, true); R(-hw + 17, cl + 3, 3, 2, q, true); R(hw - 4, belt - 9, 3, 4, q, true); }
      if (o.mb) for (let i = 0; i < Math.min(4, o.mb); i++) { const mx = -hw + 7 + i * (W0 - 18) / 4 + (i % 2) * 3, my = belt - 8 - (i % 2) * 3; R(mx, my, 7, 5, K.grey, true); R(mx + 1, my + 1, 5, 3, K.lgrey, true); }
      if (o.snow && fine) for (let i = 0; i < 10; i++) { const sx = -hw + 2 + ((i * 37) % Math.max(1, W0 - 6)), sh = 2 + (i * 13) % 5; R(sx, cl + 1, 1.5, sh, i % 3 ? K.lgrey : K.white, true); }
      if (o.box) { R(-16, roof, 32, 6, K.black); R(-15, roof + 4, 30, 1, K.dgrey, true); R(-17, roof, 34, 1, K.dgrey, true); }
      if (o.taxi) { R(-7, roof, 14, 4, night ? E(C.yellow) : K.yellow); R(-5, roof + 1, 10, 2, K.black, true); }
      if (sw > 0) side(belt, roof, rw);
    }
    // käännöksessä näkyvä kylki: helma, sivulasi pilareineen ja pyörät; kapenee hieman keulaa kohti
    function side(belt, roof, rw) {
      const su = Math.abs(st) * 11, bw = sp.b === 'truck' ? 0.98 : B.bw;
      const M = (y0, a0, b0, y1, a1, b1, q) => (d > 0 ? T(y0, a0, b0, y1, a1, b1, q) : T(y0, -b0, -a0, y1, -b1, -a1, q));
      const MR = (x0, y, w, h, q) => R(d > 0 ? x0 : -x0 - w, y, w, h, q, true);
      const clad = B.clad || sp.b === 'van' || sp.b === 'truck';
      M(cl + 1, hw, hw + su, belt, hw, hw + su * 0.94, P.lo);                       // kylki
      M(cl + 1, hw, hw + su, cl + 6, hw, hw + su, clad ? K.dgrey : P.dk);           // helma
      MR(hw, belt - 1, su * 0.94, 1, P.base);                                       // olkalinja
      if (sp.b !== 'truck') {
        const gt = roof - rt, x0 = hw * bw, x1 = hw * rw + cs * d;
        M(belt, x0, x0 + su, gt, x1, x1 + su * 0.86, P.lo);                         // ohjaamon kylki
        if (!(sp.b === 'van' && has('panelvan'))) M(belt + 1.5, x0 + 1.5, x0 + su - 1, gt - 1, x1 + 1.5, x1 + su * 0.86 - 1, glass);
        if (su * k >= 6) M(belt, x0 + su * 0.5, x0 + su * 0.5 + 1.2, gt, x1 + su * 0.44, x1 + su * 0.44 + 1.2, P.lo);   // keskipilari
        M(gt, x1, x1 + su * 0.86, roof, x1 - hw * rw * 0.1, x1 + su * 0.8 - hw * rw * 0.1, PR.base);
      }
      MR(hw, 0, su * 0.42, cl + 4, K.black);                                        // takapyörä
      MR(hw + su * 0.7, 2, su * 0.3, cl + 2, K.black);                              // etupyörä kauempana
      MR(hw, cl + 1, 1, belt - cl - 1, P.hi);                                       // kulman kiilto
    }
  }

  // ---------- etukuva ----------
  function front(g, sp, cx, by, k, o) {
    o = o || {};
    if (sp.b === 'bus' || sp.b === 'lorry') return heavyFront(g, sp, cx, by, k, o);
    const x = sp.x || [], has = f => x.includes(f);
    const solid = k < 0.42, fine = k >= 0.7, night = (o.night || 0) > 0.3;
    const P = paint(sp.c, solid), PR = sp.r && !has('twotone') ? paint(sp.r, solid) : P;
    const B = dims(sp), W0 = 72 * (sp.w || 1), hw = W0 / 2, van = sp.b === 'van', truck = sp.b === 'truck';
    const cl = B.cl, nose = cl + Math.round(B.bh * (van ? 0.9 : 0.74)), hoodT = cl + B.bh + (van ? 2 : 3), roofY = hoodT + B.cab + (van ? 0 : B.dk > 2 ? 0 : 1), rt = B.rt;
    Gfx.push(g, Math.round(cx), Math.round(by));
    const { R, T, E, V } = pen(g, k, o);
    const glass = night ? mix(C.black, C.blue, 4) : mix(C.black, C.blue, 9);
    const lens = night ? E(C.white) : K.white;
    const lamp = (lx, ly, w, h) => {
      if (night) R(lx - 2, ly - 2, w + 4, h + 4, V(C.yellow, 7), true);
      if (k >= 0.45) R(lx - 0.8, ly - 0.8, w + 1.6, h + 1.6, K.black, true);
      R(lx, ly, w, h, lens);
      if (!night && fine && w >= 4 && h >= 3) R(lx + w - 2, ly, 2, h, K.lgrey, true);
    };
    const pair = (lx, ly, w, h) => { lamp(-hw + lx, ly, w, h); lamp(hw - lx - w, ly, w, h); };
    shadow(R, hw);
    tyres(R, hw, cl + 4, 11, k, o.anim);
    R(-hw + 11, cl - 3, W0 - 22, 4, K.black);
    // puskuri ja keulan pinta
    R(-hw + 1, cl, W0 - 2, 6, B.clad || van ? K.dgrey : P.lo);
    R(-hw, cl + 4, W0, nose - cl - 4, P.base); R(-hw + 1, nose - 1, W0 - 2, 1, P.base);
    if (has('twotone')) R(-hw, cl + 4, W0, (nose - cl) * 0.45, paint(sp.r, solid).base);
    R(-hw * 0.55, cl + 1, W0 * 0.55, 3, K.black);                                   // alailmanotto
    if (truck) {
      T(nose, -hw, hw, nose + 3, -hw + 1, hw - 1, P.hi);
      T(nose + 3, -hw + 1, hw - 1, roofY, -hw * 0.3, hw * 0.3, P.lo);
      T(nose + 5, -hw + 6, hw - 6, roofY - 2, -hw * 0.3, hw * 0.3, glass);
      if (!night) T(nose + 14, -hw * 0.6, hw * 0.6, roofY - 2, -hw * 0.3, hw * 0.3, veil(C.lblue, 6));
      if (night) R(-hw + 1, nose - 4, W0 - 2, 5, V(C.yellow, 7), true);
      R(-hw + 1, nose - 2.5, W0 - 2, 1.5, lens);
      pair(3, cl + 6, 6, 3);
      plate(R, cl + 1, k, 16);
      Gfx.pop(g); return;
    }
    // konepelti ylhäältä, tuulilasi ja katto
    T(nose, -hw + 1, hw - 1, hoodT, -hw * B.bw - 1, hw * B.bw + 1, P.hi);
    if (fine && B.hd > 4) { R(-hw * 0.45, nose + 1, 1, hoodT - nose - 2, P.base, true); R(hw * 0.45 - 1, nose + 1, 1, hoodT - nose - 2, P.base, true); }
    T(hoodT, -hw * B.bw, hw * B.bw, roofY - rt, -hw * B.rw, hw * B.rw, has('blackhatch') ? K.black : PR.base);
    const ch = roofY - rt - hoodT, gl = yy => -hw * (B.bw + (B.rw - B.bw) * (yy - hoodT) / ch) + 2.5;
    T(hoodT + 1, gl(hoodT + 1), -gl(hoodT + 1), roofY - rt - 1, gl(roofY - rt - 1), -gl(roofY - rt - 1), glass);
    if (!night && k >= 0.5) { const m = hoodT + ch * 0.55; T(m, gl(m) + 1, -gl(m) - 1, roofY - rt - 1, gl(roofY - rt - 1) + 1, -gl(roofY - rt - 1) - 1, veil(C.lblue, 4)); }
    if (fine && !night) { R(5, hoodT + 1, 7, Math.min(7, ch - 4), K.black, true); R(7, hoodT + 1 + Math.min(7, ch - 4), 3, 2, K.black, true); }   // kuljettaja
    if (fine) R(-1, roofY - rt - 3, 3, 2, K.black, true);                            // taustapeili
    T(roofY - rt, -hw * B.rw, hw * B.rw, roofY, -hw * B.rw * 0.9, hw * B.rw * 0.9, PR.hi);
    if (sp.b === 'topo') R(-hw * B.rw, roofY - rt, W0 * B.rw, rt, paint(sp.r, solid).base);
    if (has('rails')) { R(-hw * B.rw, roofY, 2, 2, K.dgrey, true); R(hw * B.rw - 2, roofY, 2, 2, K.dgrey, true); }
    if (fine) { R(-hw - 4, hoodT, 5, 3, P.lo, true); R(hw - 1, hoodT, 5, 3, P.lo, true); }
    // maski
    const hy = nose - 6;
    switch (sp.g) {
      case 'slot':    R(-hw + 19, hy - 1, W0 - 38, 5, K.black); if (fine) R(-hw + 20, hy + 1, W0 - 40, 1, K.lgrey, true); break;
      case 'thin':    R(-hw + 19, hy + 1, W0 - 38, 2, K.black); break;
      case 'kid':     R(-11, hy - 1, 10, 5, K.black); R(1, hy - 1, 10, 5, K.black); if (fine) { R(-11, hy + 4, 10, 1, K.lgrey, true); R(1, hy + 4, 10, 1, K.lgrey, true); } break;
      case 'kidtall': R(-10, cl + 3, 9, nose - cl - 5, K.black); R(1, cl + 3, 9, nose - cl - 5, K.black); if (fine) { R(-10, nose - 3, 9, 1, K.lgrey, true); R(1, nose - 3, 9, 1, K.lgrey, true); } break;
      case 'sf':      T(cl + 2, -9, 9, nose - 2, -13, 13, K.black); if (fine) { R(-13, nose - 3, 26, 1, K.lgrey, true); R(-10, cl + 6, 20, 1, K.dgrey, true); } break;
      case 'rr':      R(-10, cl + 3, 20, nose - cl - 3, K.lgrey); for (let i = -4; i <= 4; i++) R(i * 2.2 - 0.5, cl + 4, 1, nose - cl - 5, i % 2 ? K.white : K.grey, true); R(-10, nose - 1, 20, 1, K.white, true); break;
      case 'panel':   R(-hw + 4, hy - 1, W0 - 8, 5, K.black); break;
      case 'panelbig': R(-hw + 3, hy - 4, W0 - 6, 10, K.black); break;
    }
    // etuvalot
    switch (sp.hl) {
      case 'circle': for (const sx of [-1, 1]) { const lx = sx * (hw - 9), cy = hy + 1; // täysin pyöreät valot
                       if (night) R(lx - 6, cy - 6, 12, 12, V(C.yellow, 7), true);
                       circ(R, lx, cy, 8, lens); if (k >= 0.6) circ(R, lx, cy, 4, night ? E(C.yellow) : K.lgrey); } break;
      case 'round':  pair(3, hy - 2, 8, 6); pair(4, hy - 3, 6, 8); break;
      case 'quad':   pair(2, hy - 1, 6, 5); pair(10, hy - 1, 6, 5); break;
      case 'split':  pair(2, hy + 3, 15, 1.5); pair(4, hy - 4, 9, 4); break;
      case 'bar':    if (night) R(-hw + 1, hy, W0 - 2, 5, V(C.yellow, 5), true); R(-hw + 2, hy + 2, W0 - 4, 1.5, lens); pair(2, hy - 1, 12, 3); break;
      case 'pixel':  for (let i = 0; i < 4; i++) pair(2 + i * 4, hy, 3, 3); break;
      case 'hammer': pair(2, hy + 1, 15, 2); pair(8, hy - 2, 3, 6); break;
      case 'tri':    pair(2, hy - 2, 2, 7); pair(6, hy - 1, 2, 6); pair(10, hy, 2, 5); break;
      default:       pair(2, hy, 16, 3);
    }
    plate(R, cl + 1, k, 16);
    if (o.taxi) { R(-7, roofY, 14, 4, night ? E(C.yellow) : K.yellow); R(-5, roofY + 1, 10, 2, K.black, true); }
    if (o.snowRoof) R(-hw * B.rw * 0.9, roofY - 1, W0 * B.rw * 0.9, 2, K.white);
    Gfx.pop(g);
  }

  // ---------- bussit ja kuorma-autot (leveys 96) ----------
  const LIVERY = ['#ECECEC', '#2F6DB5', '#7A1F24', '#2E5B4C', '#D9B526', '#ECECEC'];
  function heavyRear(g, sp, cx, by, k, o) {
    const night = (o.night || 0) > 0.3, fine = k >= 0.6, bus = sp.b === 'bus', hw = 48, W0 = 96;
    Gfx.push(g, Math.round(cx), Math.round(by));
    const { R, E, V } = pen(g, k, o);
    const lens = o.brake ? E(C.lred) : night ? E(C.red) : K.red, glass = night ? mix(C.black, C.blue, 3) : mix(C.black, C.blue, 8);
    const P = paint(sp.c || '#ECECEC', k < 0.42);
    shadow(R, hw);
    R(-hw + 2, 0, 18, 12, K.black); R(hw - 20, 0, 18, 12, K.black);
    if (fine) { R(-hw + 10, 0, 1, 12, K.dgrey, true); R(hw - 11, 0, 1, 12, K.dgrey, true); }
    R(-hw + 20, 5, W0 - 40, 5, K.black);
    if (bus) {
      R(-hw, 8, W0, 100, P.base); R(-hw + 1, 108, W0 - 2, 1, P.base);
      R(-hw, 8, W0, 10, K.dgrey);                                        // puskuri
      R(-hw, 18, W0, 14, mix(C.blue)); R(-hw, 32, W0, 3, mix(C.lblue));    // raidat
      R(-hw + 6, 62, W0 - 12, 30, glass); if (!night) R(-hw + 6, 80, W0 - 12, 10, veil(C.lblue, 5), true);
      if (fine) for (let i = 0; i < 5; i++) R(-22, 38 + i * 4, 44, 1, K.lgrey, true);   // moottoriluukun säleet
      R(-hw + 2, 105, W0 - 4, 5, P.hi); R(-20, 110, 40, 4, K.lgrey);     // katto ja ilmastointi
      R(-14, 95, 28, 8, K.black); if (k >= 0.5) Gfx.text(g, sp.line || '23', 0, -Math.round(101.5 * k) , Math.max(1, Math.floor(k)), night ? E(C.yellow) : K.yellow, 0.5);
      for (const s of [-1, 1]) { const lx = s < 0 ? -hw + 2 : hw - 8;
        if (o.brake || night) R(lx - 1.5, 20.5, 9, 31, V(C.lred, o.brake ? 8 : 4), true);
        R(lx, 22, 6, 12, lens); R(lx, 36, 6, 6, K.orange); R(lx, 44, 6, 6, K.white); }
      plate(R, 10, k);
    } else {
      R(-hw + 4, 10, W0 - 8, 6, K.dgrey);                                // alleajosuoja
      R(-hw + 4, 4, 14, 9, K.black); R(hw - 18, 4, 14, 9, K.black);      // roiskeläpät
      R(-hw, 18, W0, 94, P.base); R(-hw, 18, W0, 3, K.dgrey); R(-hw + 1, 109, W0 - 2, 3, P.hi);
      R(-0.5, 21, 1.5, 88, P.lo);                                        // ovien sauma
      if (fine) { for (const lx of [-30, -12, 11, 29]) R(lx, 22, 1.5, 86, K.lgrey, true); for (let yy = 30; yy < 108; yy += 13) R(-hw + 2, yy, W0 - 4, 1, P.lo, true); }
      for (const s of [-1, 1]) { const lx = s < 0 ? -hw + 3 : hw - 15;   // heijastinkilvet ja valot
        R(lx, 22, 12, 9, K.yellow); if (fine) { R(lx + 1, 23, 4, 7, K.red, true); R(lx + 7, 23, 4, 7, K.red, true); }
        const vx = s < 0 ? -hw + 4 : hw - 14;
        if (o.brake || night) R(vx - 1.5, 9.5, 13, 8, V(C.lred, o.brake ? 8 : 4), true);
        R(vx, 11, 10, 5, lens); if (fine) R(vx + (s < 0 ? 7 : 0), 11, 3, 5, K.orange, true);
        R(s < 0 ? -hw : hw - 3, 107, 3, 3, night ? E(C.red) : K.red); }
      plate(R, 10.5, k, 16);
    }
    Gfx.pop(g);
  }
  function heavyFront(g, sp, cx, by, k, o) {
    const night = (o.night || 0) > 0.3, fine = k >= 0.6, bus = sp.b === 'bus', hw = 48, W0 = 96;
    Gfx.push(g, Math.round(cx), Math.round(by));
    const { R, E, V } = pen(g, k, o);
    const lens = night ? E(C.white) : K.white, glass = night ? mix(C.black, C.blue, 4) : mix(C.blue, C.black, 6);
    const P = paint(sp.c || '#ECECEC', k < 0.42);
    const lamp = (lx, ly, w, h, halo) => { if (night) R(lx - halo, ly - halo, w + halo * 2, h + halo * 2, V(C.yellow, 7), true); R(lx, ly, w, h, lens); };
    shadow(R, hw);
    R(-hw + 2, 0, 16, 12, K.black); R(hw - 18, 0, 16, 12, K.black);
    R(-hw + 18, 5, W0 - 36, 5, K.black);
    if (bus) {
      R(-hw, 8, W0, 100, P.base); R(-hw + 1, 108, W0 - 2, 1, P.base);
      R(-hw, 8, W0, 10, K.dgrey);
      R(-hw, 18, W0, 14, mix(C.blue)); R(-hw, 32, W0, 3, mix(C.lblue));
      R(-hw + 4, 44, W0 - 8, 48, glass); if (!night) R(-hw + 4, 72, W0 - 8, 18, veil(C.lblue, 6), true);
      R(-0.5, 44, 1.5, 48, K.dgrey, true);
      if (fine) { R(14, 46, 12, 14, K.black, true); R(16, 60, 8, 6, K.black, true); for (const s of [-1, 1]) for (let i = 0; i < 8; i++) R(s * (6 + i * 2.2), 46 + i * 1.2, 2, 1, K.black, true); }
      R(-hw + 6, 94, W0 - 12, 11, K.black);
      if (k >= 0.4) Gfx.fit(g, sp.dest || 'KUOPIO', 0, -Math.round(104 * k), Math.round((W0 - 16) * k), Math.round(9 * k), night ? E(C.yellow) : K.yellow);
      R(-hw + 2, 105, W0 - 4, 5, P.hi);
      R(-hw - 6, 78, 7, 12, K.black); R(hw - 1, 78, 7, 12, K.black);     // peilit korvina
      lamp(-hw + 5, 20, 9, 6, 2.5); lamp(hw - 14, 20, 9, 6, 2.5);
      R(-hw + 15, 21, 4, 4, K.orange, true); R(hw - 19, 21, 4, 4, K.orange, true);
      plate(R, 10, k);
    } else {
      R(-hw, 84, W0, 28, paint('#ECECEC', k < 0.42).base); R(-hw + 1, 109, W0 - 2, 3, K.white);   // kuormatila ohjaamon takana
      R(-hw + 3, 10, W0 - 6, 76, P.base); R(-hw + 4, 86, W0 - 8, 2, P.hi);
      R(-hw + 2, 8, W0 - 4, 12, K.dgrey);                                // puskuri
      R(-hw + 7, 50, W0 - 14, 26, glass); if (!night) R(-hw + 7, 64, W0 - 14, 10, veil(C.lblue, 6), true);
      R(-hw + 5, 76, W0 - 10, 6, K.black);                               // aurinkolippa
      if (fine) { R(14, 52, 11, 12, K.black, true); for (const s of [-1, 1]) for (let i = 0; i < 7; i++) R(s * (5 + i * 2.2) - 1, 52 + i * 1.2, 2, 1, K.black, true); }
      R(-22, 22, 44, 24, K.black); if (fine) for (let i = 0; i < 5; i++) R(-20, 25 + i * 4.5, 40, 1.5, K.grey, true);   // säleikkö
      R(-hw - 5, 54, 7, 20, K.black); R(hw - 2, 54, 7, 20, K.black);     // peilit
      lamp(-hw + 5, 11, 12, 6, 2.5); lamp(hw - 17, 11, 12, 6, 2.5);
      for (const lx of [-27, -13, 5, 19]) { R(lx, 86, 8, 7, K.black); lamp(lx + 1, 87, 6, 5, 2); }   // lisävalot katolla
      for (const lx of [-hw + 4, -hw / 2, 0, hw / 2 - 2, hw - 6]) R(lx, 82, 2, 1.5, night ? E(C.yellow) : K.orange, true);
      plate(R, 9, k, 16);
    }
    Gfx.pop(g);
  }

  // ---------- peräkärry oman auton perässä ----------
  // load: '' | 'romu' | 'muutto'
  function trailer(g, cx, by, k, o) {
    o = o || {};
    const night = (o.night || 0) > 0.3;
    Gfx.push(g, Math.round(cx), Math.round(by));
    const { R, E, V } = pen(g, k, o);
    const lens = o.brake ? E(C.lred) : night ? E(C.red) : K.red;
    R(-31, -2, 62, 4, veil(C.black, 8));
    R(-3, 13, 6, 7, K.black);                                           // aisa
    R(-30, 0, 9, 8, K.black); R(21, 0, 9, 8, K.black);
    R(-29, 3, 58, 14, K.dgrey);
    R(-28, 5, 56, 10, mix(C.orange, C.brown, 6));                       // vanerilaita
    for (let x = -19; x < 27; x += 9) R(x, 5, 1, 10, K.brown, true);
    R(-29, 15, 58, 2, K.black);
    if (o.load === 'romu') {
      const q = mix(C.orange, C.brown, 8);
      R(-26, 17, 52, 9, q); R(-18, 26, 34, 8, mix(C.orange)); R(-14, 27, 12, 5, K.black); R(2, 27, 12, 5, K.black); R(-27, 17, 54, 1, K.yellow, true);
    } else if (o.load === 'muutto') {
      R(-25, 17, 13, 11, mix(C.orange, C.yellow, 5)); R(-23, 28, 10, 7, mix(C.orange, C.yellow, 8)); R(-25, 22, 13, 1, K.brown, true);
      R(-9, 17, 24, 8, K.red); R(-9, 25, 4, 6, K.red); R(11, 25, 4, 6, K.red);
      R(18, 17, 2, 13, K.dgrey, true); R(16, 29, 7, 2, K.dgrey, true); R(17, 17, 8, 2, K.dgrey, true);
      R(-27, 16, 54, 1, K.yellow, true);
    }
    if (o.brake || night) { R(-29.5, 3.5, 9, 6, V(C.lred, o.brake ? 8 : 4), true); R(20.5, 3.5, 9, 6, V(C.lred, o.brake ? 8 : 4), true); }
    R(-28, 5, 6, 3, lens); R(22, 5, 6, 3, lens);
    R(-7, 6, 14, 5, K.white); R(-5, 7.5, 10, 2, K.black, true);
    Gfx.pop(g);
  }

  return { MODELS, BODY, spec, random, dims, height, rear, front, trailer, LIVERY };
})();
