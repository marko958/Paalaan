// PAALAAN! 2.0 – ajotila
// Pseudo-3D-tie: segmenttitie, joka kaartuu ja mäkeilee. Kuva piirretään 320×200-kokoon ja skaalataan pikseleinä.
// Pelilogiikka (S, monthTick, damageEvent, Q, next …) tulee engine.js:stä.
'use strict';

const Drive = (() => {
  const W = 320, H = 200;
  const SEG = 200;            // segmentin pituus
  const ROAD = 2000;          // puolikas tien leveys
  const CAMH = 1000;          // kameran korkeus
  const CAMD = 1 / Math.tan(50 * Math.PI / 180); // FOV 100°
  const DRAW = 150;           // piirtoetäisyys segmentteinä
  const PZ = CAMH * CAMD;     // pelaajan etäisyys kamerasta
  const KMH = 12000 / 220;    // nopeusyksikköä per km/h
  const MONTH_S = 30;         // kuukausi = 30 s ajoa
  const RAMP_LEAD_S = 6;      // liittymäkyltit näkyvät näin monta sekuntia ennen kuun vaihdetta
  const RAMP_LEN = 45;        // liittymäkaistan pituus segmentteinä
  const RAMP_W = 0.9;         // liittymäkaistan leveys tien puolikkaina

  const COL = {
    black:'#000000', white:'#FFFFFF', grey1:'#444444', grey2:'#6C6C6C', grey3:'#959595',
    red:'#883932', lred:'#B86962', yellow:'#EEEE77', blue:'#352879', lblue:'#7869C4', sky:'#A59FF8',
    green:'#588D43', lgreen:'#6AA151', dgreen:'#2E5A2A', brown:'#6F4F25', dbrown:'#433900', orange:'#9B6739',
  };

  let cv, g;
  const segs = [];
  const st = {
    active:false, paused:false, userPause:false, S:null,
    pos:0, x:0.5, speed:0, monthT:0, ramp:null, dyn:[], toasts:[], keys:{}, veh:null,
    skyOff:0, shake:0, flash:0, last:0, raf:0, hint:true,
  };

  // ---------- satunnaisuus tielle (toistettava segmentin mukaan) ----------
  const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };
  const rr = (n, k) => hash(n * 7919 + k * 104729);

  // ---------- tien rakentaminen ----------
  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeInOut = (a, b, p) => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);
  const lastY = () => segs.length ? segs[segs.length - 1].p2.world.y : 0;
  const pt = (y, z) => ({ world:{ y, z }, camera:{}, screen:{} });
  let zone = { kind:'metsä', left:0 };
  function addSeg(curve, y) {
    const n = segs.length;
    if (zone.left-- <= 0) { const r = rr(n, 1); zone = { kind: r < 0.55 ? 'metsä' : r < 0.8 ? 'pelto' : 'kylä', left: 60 + Math.floor(rr(n, 2) * 140) }; }
    segs.push({ i:n, p1:pt(lastY(), n * SEG), p2:pt(y, (n + 1) * SEG), curve, sprites:scenery(n, zone.kind), clip:H });
  }
  function addRoad(enter, hold, leave, curve, hill) {
    const y0 = lastY(), y1 = y0 + hill * SEG, tot = enter + hold + leave;
    for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / tot));
    for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(y0, y1, (enter + n) / tot));
    for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / tot));
  }
  function ensure(idx) {
    while (segs.length < idx + DRAW + 60) {
      const n = segs.length, r = rr(n, 3);
      const len = [20, 30, 45, 60][Math.floor(rr(n, 4) * 4)];
      const curve = r < 0.35 ? 0 : (rr(n, 5) < 0.5 ? -1 : 1) * [1.5, 3, 4.5][Math.floor(rr(n, 6) * 3)];
      const hill = rr(n, 7) < 0.4 ? 0 : (rr(n, 8) - 0.5) * 70;
      addRoad(len, len, len, curve, hill);
    }
  }
  function scenery(n, kind) {
    const out = [];
    const side = () => (rr(n, 13) < 0.5 ? -1 : 1);
    if (kind === 'metsä') {
      if (rr(n, 10) < 0.7) out.push({ k: rr(n, 11) < 0.8 ? 'kuusi' : 'koivu', x: side() * (1.25 + rr(n, 12) * 2.5) });
      if (rr(n, 14) < 0.5) out.push({ k:'kuusi', x: -side() * (1.4 + rr(n, 15) * 3) });
    } else if (kind === 'pelto') {
      if (rr(n, 16) < 0.06) out.push({ k:'lato', x: side() * (3 + rr(n, 17) * 3) });
      if (rr(n, 18) < 0.12) out.push({ k:'koivu', x: side() * (1.3 + rr(n, 19) * 1.5) });
    } else {
      if (rr(n, 20) < 0.08) out.push({ k:'mökki', x: side() * (2 + rr(n, 21) * 2) });
      if (rr(n, 22) < 0.25) out.push({ k: rr(n, 23) < 0.5 ? 'koivu' : 'kuusi', x: side() * (1.3 + rr(n, 24) * 3) });
    }
    if (n % 20 === 0) out.push({ k:'tolppa', x: 1.12 }, { k:'tolppa', x: -1.12 });
    return out;
  }
  const segAt = z => { const i = Math.floor(z / SEG); ensure(i); return segs[i]; };

  // ---------- vuodenaika ----------
  function season() {
    const m = (S.m - 1) % 12; // 0 = tammikuu
    return {
      m,
      snow: [11, 0, 1, 2].includes(m),
      autumn: [8, 9].includes(m),
      bare: m === 10, // marraskuu: ruskea maa, lehdettömät koivut
      dark: [10, 11, 0].includes(m) ? 0.72 : [1, 9].includes(m) ? 0.35 : 0,
      deerPerMonth: m >= 8 && m <= 11 ? 4 : 2,
    };
  }

  // ---------- ajoneuvo ----------
  function vehicle() {
    const T = S.tsa, car = T ? null : drivenCar();
    if (!T && !car) return { bus:true, name:'Bussi', vmax:80, acc:8, color:COL.yellow, mb:0, minor:0 };
    const id = T ? T.c : car.c, k = C(id);
    let vmax = 120 + 25 * Math.log2(Math.max(1, k.price / 4000));
    if (k.fl.includes('T')) vmax += 20;
    if (k.fl.includes('S')) vmax = 125;
    if (k.fl.includes('V')) vmax = 140;
    vmax = Math.min(230, Math.max(125, vmax));
    let acc = k.type === 'e' ? Math.min(36, 20 + k.price / 4000) : Math.min(24, 12 + k.price / 6000);
    const minor = car ? (car.minor || 0) : 0;
    if (minor) { vmax *= 0.92; acc *= 0.85; }
    const pal = [COL.red, COL.lblue, COL.white, COL.grey3, COL.dgreen, COL.black, COL.orange, COL.blue, COL.lred];
    let h = 0; for (const ch of k.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { bus:false, tsa:!!T, name:k.name, vmax, acc, color:pal[h % pal.length], mb: T ? T.mb : car.mb, minor };
  }
  function refreshVehicle() {
    const prev = st.veh, v = vehicle();
    if (prev && !prev.bus && v.bus) toast('!Auto jäi tien varteen. Matka jatkuu bussilla.');
    else if (prev && prev.name !== v.name && !v.bus) toast(`+Alla on nyt ${v.name}.`);
    st.veh = v;
  }

  // ---------- ilmoitukset ----------
  function toast(t, sec) { st.toasts.push({ t, life: sec || 4.5 }); if (st.toasts.length > 4) st.toasts.shift(); }
  function tilioteLines(R) {
    return R.map(r => (r[0] === '+' ? '+' : r[0] === '!' ? '!' : '') + `${r[1]}: ${r[0] === '+' ? '+' : '−'}${eur(r[2])}`);
  }

  // ---------- kuukauden vaihde ----------
  function spawnRamp() {
    const cur = Math.floor((st.pos + PZ) / SEG);
    const start = cur + Math.max(70, Math.round(st.speed * RAMP_LEAD_S / SEG));
    st.ramp = { start, end: start + RAMP_LEN };
    st.dyn.push({ k:'kyltti', z:(start - 60) * SEG, x:2.1, t:'LIITTYMÄ', s:'KOTI · ASIOILLE' });
    st.dyn.push({ k:'kyltti', z:(start - 4) * SEG, x:2.2, t:'→ VALIKKO', s:'' });
  }
  function monthEnd(exiting) {
    st.ramp = null; st.monthT = 0;
    if (S.m >= LAST) { stop(); return endGame(); }
    S.m++;
    Q = [];
    const R = monthTick();
    if (S.vippi > 3000) { stop(); return repossess(); }
    if (exiting) {
      stop();
      return scr(`${monthName()}: TILIOTE`, tilioteLines(R), [['Jatka', next]]);
    }
    let plus = 0, minus = 0;
    R.forEach(r => { if (r[0] === '+') plus += r[2]; else if (r[0] === '-') minus += r[2]; });
    toast(`${KK[(S.m - 1) % 12].toUpperCase()}KUU: +${eur(plus)} / −${eur(minus)} · KASSA ${eur(S.cash)}`, 6);
    R.filter(r => r[0] === '!').forEach(r => toast('!' + r[1], 6));
    if (Q.length) openEvents();
  }
  function openEvents() {
    st.paused = true;
    document.body.classList.add('paused');
    st.keys = {};
    next(); // engine näyttää jonon ruudut paneelissa; tyhjä jono kutsuu resume()
  }

  // ---------- peurat ----------
  function spawnDeer() {
    const ahead = (DRAW * (0.55 + Math.random() * 0.35)) * SEG;
    const z = st.pos + PZ + ahead;
    if (st.ramp && z / SEG > st.ramp.start - 5 && z / SEG < st.ramp.end + 5) return;
    const r = Math.random();
    if (r < 0.65) { const s = Math.random() < 0.5 ? -1 : 1; st.dyn.push({ k:'peura', z, x: s * (1.6 + Math.random() * 0.6), vx: -s * (0.55 + Math.random() * 0.5), wake: 70 + Math.random() * 40 }); }
    else st.dyn.push({ k:'peura', z, x: (Math.random() - 0.5) * 1.6, vx: 0, wake: 999 });
  }
  function hitDeer(d) {
    st.dyn.splice(st.dyn.indexOf(d), 1);
    const kmh = st.speed / KMH;
    if (kmh < 35) { st.speed *= 0.4; st.shake = 0.3; return toast('Peura säikähti ja loikkasi metsään. Huh.'); }
    st.speed = 0; st.shake = 0.6; st.flash = 0.5;
    Q.unshift(() => damageEvent('peura'));
    st.paused = true; // pysäytä fysiikka heti, paneeli aukeaa hetken päästä
    setTimeout(() => { if (st.active) openEvents(); }, 450);
  }

  // ---------- päivitys ----------
  function update(dt) {
    const v = st.veh, keys = st.keys;
    const maxU = v.vmax * KMH;
    const z0 = st.pos + PZ;
    const pseg = segAt(z0);
    const onRamp = st.ramp && pseg.i >= st.ramp.start && pseg.i <= st.ramp.end;
    const rightEdge = onRamp ? 1 + RAMP_W : 1;
    const off = st.x < -1 || st.x > rightEdge;

    if (v.bus) st.speed += (Math.min(maxU, 80 * KMH) - st.speed) * Math.min(1, dt * 0.8);
    else if (keys.brake) st.speed -= 70 * KMH * dt;
    else st.speed += v.acc * KMH * dt * (1 - 0.6 * st.speed / maxU);
    if (off && st.speed > 45 * KMH) { st.speed -= 90 * KMH * dt; st.shake = Math.max(st.shake, 0.08); }
    st.speed = Math.max(0, Math.min(maxU, st.speed));

    const sp = st.speed / (160 * KMH);
    const steer = dt * 2.4 * Math.min(1.2, Math.max(sp, st.speed > 0 ? 0.35 : 0));
    if (keys.left) st.x -= steer;
    if (keys.right) st.x += steer;
    if (v.minor) st.x += dt * 0.05 * sp; // korjaamaton vika vetää sivulle
    st.x -= steer * sp * pseg.curve * 0.32;
    st.x = Math.max(-2.6, Math.min(2.8, st.x));
    st.skyOff += pseg.curve * sp * dt * 6;

    st.pos += st.speed * dt;
    const z1 = st.pos + PZ;
    ensure(Math.floor(z1 / SEG));

    // peurat
    const sea = season();
    if (!v.bus && Math.random() < dt * sea.deerPerMonth / MONTH_S) spawnDeer();
    for (const d of st.dyn.slice()) {
      if (d.k === 'peura') {
        if ((d.z - z1) / SEG < d.wake) d.x += d.vx * dt;
        if (Math.abs(d.x) > 3) { st.dyn.splice(st.dyn.indexOf(d), 1); continue; }
        if (!v.bus && d.z >= z0 && d.z < z1 + 1 && Math.abs(d.x - st.x) < 0.42) { hitDeer(d); return; }
      }
      if (d.z < st.pos - SEG) st.dyn.splice(st.dyn.indexOf(d), 1);
    }

    // kuukausi ja liittymä
    st.monthT += dt;
    if (!st.ramp && st.monthT >= MONTH_S - RAMP_LEAD_S) spawnRamp();
    if (st.ramp && Math.floor(z1 / SEG) > st.ramp.end) return monthEnd(st.x > 1.02);
  }

  // ---------- piirto ----------
  function project(p, cx, cy, cz) {
    p.camera.x = -cx; p.camera.y = p.world.y - cy; p.camera.z = p.world.z - cz;
    const s = p.screen.scale = CAMD / p.camera.z;
    p.screen.x = W / 2 + s * p.camera.x * W / 2;
    p.screen.y = H / 2 - s * p.camera.y * H / 2;
    p.screen.w = s * ROAD * W / 2;
  }
  function quad(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    g.fillStyle = c; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4); g.closePath(); g.fill();
  }
  function strip(a, b, from1, to1, from2, to2, c) {
    quad(a.x + a.w * from1, a.y, a.x + a.w * to1, a.y, b.x + b.w * to2, b.y, b.x + b.w * from2, b.y, c);
  }
  function drawSeg(seg, sea) {
    const a = seg.p1.screen, b = seg.p2.screen, alt = Math.floor(seg.i / 3) % 2;
    g.fillStyle = sea.snow ? (alt ? '#FFFFFF' : '#E4E4EC') : sea.bare ? (alt ? '#6B5E45' : '#5E523C') : sea.autumn ? (alt ? COL.orange : '#8A5D30') : (alt ? COL.lgreen : COL.green);
    g.fillRect(0, b.y, W, a.y - b.y + 1);
    const ramp = st.ramp;
    if (ramp && seg.i >= ramp.start && seg.i <= ramp.end) {
      const k1 = Math.min(1, (seg.i - ramp.start) / 10), k2 = Math.min(1, (seg.i + 1 - ramp.start) / 10);
      strip(a, b, 0.9, 1 + RAMP_W * k1, 0.9, 1 + RAMP_W * k2, sea.snow ? '#A8A8A8' : COL.grey2);
      strip(a, b, 0.97 + RAMP_W * k1, 1 + RAMP_W * k1, 0.97 + RAMP_W * k2, 1 + RAMP_W * k2, COL.white);
      if (alt) strip(a, b, 0.96, 1.0, 0.96, 1.0, COL.white);
    }
    strip(a, b, -1, 1, -1, 1, sea.snow ? (alt ? '#A8A8A8' : '#B4B4B4') : (alt ? COL.grey2 : '#666666'));
    if (!sea.snow || alt) {
      strip(a, b, -0.97, -0.93, -0.97, -0.93, COL.white);
      if (!(ramp && seg.i >= ramp.start && seg.i <= ramp.end)) strip(a, b, 0.93, 0.97, 0.93, 0.97, COL.white);
    }
    if (Math.floor(seg.i / 4) % 2) strip(a, b, -0.025, 0.025, -0.025, 0.025, COL.yellow); // keltainen keskiviiva
  }
  function drawSky(sea) {
    const d = sea.dark;
    g.fillStyle = d > 0.6 ? '#0B0820' : d > 0 ? '#352879' : COL.lblue; g.fillRect(0, 0, W, H);
    g.fillStyle = d > 0.6 ? '#1A1440' : d > 0 ? '#6C5EB5' : COL.sky; g.fillRect(0, H * 0.32, W, H * 0.3);
    if (d > 0.6) { g.fillStyle = '#FFFFFF'; for (let i = 0; i < 40; i++) g.fillRect((((hash(i) * W + st.skyOff * 2) % W) + W) % W | 0, (hash(i + 99) * H * 0.4) | 0, 1, 1); }
    // kaukainen metsänreuna
    g.fillStyle = d > 0.6 ? '#05140A' : sea.snow ? '#3B5A45' : COL.dgreen;
    const base = H * 0.55;
    const o = st.skyOff * 8, k0 = Math.floor(o / 4);
    for (let j = -2; j < W / 4 + 3; j++) {
      const k = k0 + j, xx = k * 4 - o;
      const h = 6 + hash(((k % 4096) + 4096) % 4096) * 12;
      g.beginPath(); g.moveTo(xx - 3, base); g.lineTo(xx, base - h); g.lineTo(xx + 3, base); g.fill();
    }
    g.fillRect(0, base, W, H - base);
  }

  // spritet: cx = keskikohta, by = alareuna, s = pikseliä per maailman yksikkö
  function sprite(o, cx, by, s, sea, n) {
    const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(cx + x * s, by - (y + h) * s, Math.max(1, w * s), Math.max(1, h * s)); };
    const tri = (x1, y1, x2, y2, x3, y3, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(cx + x1 * s, by - y1 * s); g.lineTo(cx + x2 * s, by - y2 * s); g.lineTo(cx + x3 * s, by - y3 * s); g.fill(); };
    switch (o.k) {
      case 'kuusi': {
        P(-90, 0, 180, 500, COL.dbrown);
        const c = COL.dgreen;
        tri(-750, 400, 750, 400, 0, 1700, c); tri(-600, 1100, 600, 1100, 0, 2400, c); tri(-420, 1800, 420, 1800, 0, 3000, c);
        if (sea.snow) { tri(-300, 2300, 300, 2300, 0, 3000, '#FFFFFF'); P(-500, 1100, 1000, 90, '#FFFFFF'); }
        break; }
      case 'koivu': {
        P(-70, 0, 140, 2200, '#E8E8E8');
        for (let k = 1; k < 6; k++) P(-70, k * 380, 80, 50, COL.black);
        if (!sea.snow && !sea.bare) { const c = sea.autumn ? COL.yellow : COL.lgreen; P(-600, 1300, 1200, 1100, c); P(-420, 2300, 840, 400, c); }
        else { P(-450, 1500, 900, 40, COL.dbrown); P(-300, 1900, 600, 40, COL.dbrown); }
        break; }
      case 'mökki': {
        P(-1200, 0, 2400, 1300, COL.red); P(-1200, 0, 120, 1300, COL.white); P(1080, 0, 120, 1300, COL.white);
        tri(-1400, 1300, 1400, 1300, 0, 2200, sea.snow ? '#FFFFFF' : COL.grey1);
        const win = sea.dark > 0.3 ? COL.yellow : '#A5C8FF';
        P(-700, 500, 400, 400, win); P(300, 500, 400, 400, win); P(-100, 0, 300, 800, COL.dbrown);
        break; }
      case 'lato': {
        P(-1600, 0, 3200, 1500, '#5A4632'); tri(-1800, 1500, 1800, 1500, 0, 2300, sea.snow ? '#FFFFFF' : COL.grey1);
        for (let k = -1500; k < 1600; k += 300) P(k, 0, 40, 1500, '#3E2F22');
        break; }
      case 'tolppa': P(-40, 0, 80, 900, COL.black); P(-40, 700, 80, 120, COL.white); break;
      case 'kyltti': {
        P(-60, 0, 120, 1200, COL.grey1); P(1040, 0, 120, 1200, COL.grey1);
        P(-1300, 1100, 2600, 1300, COL.white); P(-1240, 1160, 2480, 1180, '#1F4FB5');
        if (s * 2600 > 30) {
          g.fillStyle = COL.white; g.textAlign = 'center';
          g.font = `${Math.max(6, Math.round(s * 520))}px VT323`; g.fillText(o.t, cx, by - 1820 * s);
          if (o.s) { g.font = `${Math.max(5, Math.round(s * 380))}px VT323`; g.fillText(o.s, cx, by - 1380 * s); }
          g.textAlign = 'left';
        }
        break; }
      case 'peura': {
        const nightFar = sea.dark > 0.6 && n > 45;
        const f = o.vx < 0 ? -1 : 1;
        if (!nightFar) {
          const c = '#7A5530';
          P(-300, 380, 600, 260, c);                         // runko
          P(-260, 0, 60, 400, c); P(200, 0, 60, 400, c);     // jalat
          P(-200, 0, 50, 400, c); P(140, 0, 50, 400, c);
          P(f * 260 - 60, 560, 120, 240, c);                 // kaula
          P(f * 300 - 90, 760, 180, 120, c);                 // pää
          P(-f * 330 - 30, 520, 60, 80, '#FFFFFF');          // valkohäntä
          P(f * 260 - 60, 880, 30, 140, COL.dbrown); P(f * 340 - 30, 880, 30, 140, COL.dbrown); // sarvet
        }
        if (sea.dark > 0.3 && n < 90) { P(f * 300 - 70, 820, 50, 40, '#FFFF99'); P(f * 300 + 30, 820, 50, 40, '#FFFF99'); } // silmät heijastavat
        break; }
    }
  }
  function drawSprites(sea) {
    const base = Math.floor(st.pos / SEG);
    const byIdx = {};
    for (const d of st.dyn) { const i = Math.floor(d.z / SEG); (byIdx[i] = byIdx[i] || []).push(d); }
    for (let n = DRAW - 1; n >= 0; n--) {
      const seg = segs[base + n];
      if (!seg || seg.p1.camera.z <= CAMD) continue;
      const onRamp = st.ramp && seg.i >= st.ramp.start - 2 && seg.i <= st.ramp.end + 2;
      let list = onRamp ? seg.sprites.filter(o => o.x < 0.9 || o.x > 2.6) : seg.sprites;
      if (byIdx[seg.i]) list = list.concat(byIdx[seg.i]);
      if (!list.length) continue;
      const sc = seg.p1.screen, s = sc.scale * W / 2;
      if (s * 3000 < 0.6) continue;
      g.save(); g.beginPath(); g.rect(0, 0, W, seg.clip); g.clip();
      for (const o of list) sprite(o, sc.x + s * o.x * ROAD, sc.y, s, sea, n);
      g.restore();
    }
  }
  function drawCar(sea) {
    const v = st.veh;
    const bounce = st.speed > 0 ? (Math.random() < 0.5 ? 0 : 1) * (st.speed / (v.vmax * KMH)) : 0;
    const sh = st.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    const tilt = (st.keys.left ? -2 : 0) + (st.keys.right ? 2 : 0);
    const cx = Math.round(W / 2 + sh), by = Math.round(H - 6 - bounce);
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(cx + x, by - y - h, w, h); };
    if (v.bus) {
      R(-44, 0, 88, 56, '#C8C24A'); R(-40, 30, 80, 22, '#22303A'); R(-44, 0, 88, 4, COL.grey1);
      R(-40, 8, 8, 5, COL.red); R(32, 8, 8, 5, COL.red); R(-12, 12, 24, 8, COL.black);
      g.fillStyle = COL.yellow; g.font = '8px VT323'; g.textAlign = 'center'; g.fillText('BUSSI', cx, by - 14); g.textAlign = 'left';
      return;
    }
    R(-34, 0, 12, 7, COL.black); R(22, 0, 12, 7, COL.black);         // renkaat
    R(-36, 5, 72, 16, v.color);                                    // kori
    R(-29 + tilt, 21, 58, 13, v.color);                            // katto
    R(-25 + tilt, 23, 50, 9, '#1E2A3A');                           // takalasi
    R(-34, 12, 12, 5, st.keys.brake ? '#FF3030' : COL.red); R(22, 12, 12, 5, st.keys.brake ? '#FF3030' : COL.red);
    R(-9, 7, 18, 6, COL.white); R(-8, 8, 16, 4, COL.black); R(-7, 9, 2, 2, COL.white); // rekkari
    if (v.mb) for (let k = 0; k < Math.min(4, v.mb); k++) R(-30 + k * 16, 15, 6, 4, '#9A9A9A'); // mikrobetonipaikat
    if (v.minor && Math.random() < 0.4) R(28 + Math.random() * 6, 0, 4, 3, '#BBBBBB');           // savua
    if (sea.dark > 0.3) { // ajovalojen keila
      const gr = g.createRadialGradient(cx, by - 60, 4, cx, by - 60, 90);
      gr.addColorStop(0, 'rgba(255,255,200,0.10)'); gr.addColorStop(1, 'rgba(255,255,200,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  }
  function drawDark(sea) {
    if (!sea.dark) return;
    const gr = g.createRadialGradient(W / 2, H * 0.9, 20, W / 2, H * 0.75, 190);
    gr.addColorStop(0, 'rgba(0,0,16,0)'); gr.addColorStop(0.45, `rgba(0,0,16,${sea.dark * 0.45})`); gr.addColorStop(1, `rgba(0,0,16,${sea.dark})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  function text(t, x, y, c, size, align) {
    g.font = `${size || 10}px VT323`; g.textAlign = align || 'left';
    g.fillStyle = COL.black; g.fillText(t, x + 1, y + 1);
    g.fillStyle = c; g.fillText(t, x, y);
    g.textAlign = 'left';
  }
  function drawHud() {
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, 12);
    text(`KK ${S.m}/${LAST} ${KK[(S.m - 1) % 12].toUpperCase()}KUU ${2027 + Math.floor((S.m - 1) / 12)}`, 3, 9, COL.white);
    text(`KASSA ${eur(S.cash)}`, W - 3, 9, S.cash < 0 ? '#FF8A80' : COL.white, 10, 'right');
    g.fillStyle = '#222'; g.fillRect(0, 12, W, 2);
    g.fillStyle = COL.yellow; g.fillRect(0, 12, Math.min(1, st.monthT / MONTH_S) * W, 2);
    const kmh = Math.round(st.speed / KMH);
    text(`${String(kmh).padStart(3, '0')} KM/H`, 4, H - 6, COL.white, 14);
    text(st.veh.name + (st.veh.tsa ? ' (TSA)' : ''), W - 4, H - 6, COL.white, 9, 'right');
    let y = 26;
    for (const t of st.toasts) {
      const c = t.t[0] === '!' ? '#FF8A80' : t.t[0] === '+' ? '#A9FF9F' : COL.white;
      text(t.t[0] === '!' || t.t[0] === '+' ? t.t.slice(1) : t.t, W / 2, y, c, 10, 'center'); y += 11;
    }
    if (st.ramp) {
      const d = st.ramp.start - Math.floor((st.pos + PZ) / SEG);
      if (d > -RAMP_LEN && Math.floor(performance.now() / 400) % 2) text(d > 0 ? `LIITTYMÄ ${d * 5} M → AJA OIKEALLE = VALIKKO` : 'LIITTYMÄ: AJA OIKEALLE = VALIKKO', W / 2, H - 22, COL.yellow, 10, 'center');
    }
    if (st.hint) text('← → OHJAA · ↓ JARRU · P TAUKO', W / 2, H - 70, COL.white, 10, 'center');
    if (st.userPause) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); text('TAUKO · P JATKAA', W / 2, H / 2, COL.white, 16, 'center'); }
    if (st.flash > 0) { g.fillStyle = `rgba(255,255,255,${st.flash})`; g.fillRect(0, 0, W, H); }
  }
  function render() {
    const sea = season();
    const baseIdx = Math.floor(st.pos / SEG); ensure(baseIdx);
    const base = segs[baseIdx], basePct = (st.pos % SEG) / SEG;
    const pz = st.pos + PZ, ps = segAt(pz), pp = (pz % SEG) / SEG;
    const camY = CAMH + ps.p1.world.y + (ps.p2.world.y - ps.p1.world.y) * pp;
    drawSky(sea);
    let maxy = H, x = 0, dx = -(base.curve * basePct);
    for (let n = 0; n < DRAW; n++) {
      const seg = segs[baseIdx + n];
      seg.clip = maxy;
      project(seg.p1, st.x * ROAD - x, camY, st.pos);
      project(seg.p2, st.x * ROAD - x - dx, camY, st.pos);
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= CAMD || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      drawSeg(seg, sea);
      maxy = seg.p2.screen.y;
    }
    drawSprites(sea);
    drawDark(sea);
    drawCar(sea);
    drawHud();
  }

  // ---------- silmukka ----------
  function frame(now) {
    if (!st.active) return;
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    if (!st.paused && !st.userPause) {
      update(dt);
      if (!st.active) return;
      st.toasts.forEach(t => t.life -= dt); st.toasts = st.toasts.filter(t => t.life > 0);
    }
    st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt * 2);
    if (st.hint && st.monthT > 8) st.hint = false;
    render();
  }

  // ---------- ohjaus ----------
  const KEYMAP = { ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right', ArrowDown:'brake', s:'brake', S:'brake', ' ':'brake' };
  function init() {
    cv = document.getElementById('road'); g = cv.getContext('2d');
    if (document.fonts && document.fonts.load) document.fonts.load('10px VT323');
    document.addEventListener('keydown', e => {
      if (!st.active || st.paused) return;
      if (KEYMAP[e.key]) { st.keys[KEYMAP[e.key]] = true; e.preventDefault(); }
      else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { st.userPause = !st.userPause; e.preventDefault(); }
      else if (e.key === 'ArrowUp') e.preventDefault();
    });
    document.addEventListener('keyup', e => { if (KEYMAP[e.key]) st.keys[KEYMAP[e.key]] = false; });
    document.querySelectorAll('.pad button').forEach(b => {
      const k = b.dataset.k;
      const on = e => { e.preventDefault(); st.keys[k] = true; b.classList.add('on'); if (st.userPause) st.userPause = false; };
      const off = () => { st.keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    cv.addEventListener('pointerdown', () => { if (st.userPause) st.userPause = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && st.active && !st.paused) st.userPause = true; });
  }

  // ---------- julkinen rajapinta ----------
  function start() {
    if (!cv) init();
    if (st.S !== S) { st.S = S; st.pos = 0; st.x = 0.5; st.hint = true; }
    st.active = true; st.paused = false; st.userPause = false;
    st.speed = 0; st.monthT = 0; st.ramp = null; st.dyn = []; st.toasts = []; st.keys = {};
    st.x = 0.5;
    st.veh = null; refreshVehicle();
    document.body.classList.add('driving'); document.body.classList.remove('paused');
    window.scrollTo(0, 0);
    st.last = performance.now();
    cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(frame);
  }
  function resume() {
    if (!st.active || S.over) return;
    if (S.cash < 0) { if (invTotal() > 0) return deficitPrompt(); fixNeg(); }
    if (S.vippi > 3000) { stop(); return repossess(); }
    st.paused = false; st.keys = {};
    document.body.classList.remove('paused');
    refreshVehicle();
    window.scrollTo(0, 0);
    st.last = performance.now();
  }
  function stop() {
    st.active = false; st.paused = false; st.keys = {};
    cancelAnimationFrame(st.raf);
    document.body.classList.remove('driving', 'paused');
  }
  return {
    start, resume, stop,
    get active() { return st.active; },
    blockKeys: () => st.active && !st.paused,
    _st: st, // testejä varten
  };
})();
