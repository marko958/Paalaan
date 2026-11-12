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
  // alpha 17: energia ja matkat. Aika on tiivistetty: F pelisekuntia per oikea sekunti.
  // Matka ja aika ovat keskenään johdonmukaiset, joten 100 km/h:ssa 100 km vie tunnin pelikelloa.
  const F_NORMAL = 200, F_TRIP = 300;

  const COL = {
    black:'#000000', white:'#FFFFFF', grey1:'#444444', grey2:'#6C6C6C', grey3:'#959595',
    red:'#883932', lred:'#B86962', yellow:'#EEEE77', blue:'#352879', lblue:'#7869C4', sky:'#A59FF8',
    green:'#588D43', lgreen:'#6AA151', dgreen:'#2E5A2A', brown:'#6F4F25', dbrown:'#433900', orange:'#9B6739',
  };

  let cv, g;
  const segs = [];
  const st = {
    active:false, paused:false, userPause:false, S:null,
    pos:0, x:0.5, speed:0, gig:null, gigT:3, monthT:0, ramp:null, dyn:[], toasts:[], keys:{}, veh:null,
    skyOff:0, shake:0, flash:0, last:0, raf:0, hint:true, trip:null, kmTot:0, nextSt:40, chg:null, eWarn:0, lateM:0,
    quick:null, boardN:0, lotDone:false, ice:0, iceWarn:false, wx:null, fx:[],
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
    let start = false;
    if (zone.left-- <= 0) {
      const r = rr(n, 1), kind = r < 0.55 ? 'metsä' : r < 0.8 ? 'pelto' : 'kylä';
      // nopeusrajoitus: H = 100 kesällä, 80 talvella
      zone = { kind, left: 80 + Math.floor(rr(n, 2) * 160), lim: kind === 'kylä' ? (rr(n, 25) < 0.5 ? 50 : 60) : kind === 'pelto' ? 80 : 'H', cam: rr(n, 26) < 0.5, len:0, lake: kind === 'metsä' && rr(n, 40) < 0.45 ? (rr(n, 41) < 0.5 ? -1 : 1) : 0 };
      start = true;
    }
    zone.len++;
    const sp = scenery(n, zone.kind);
    const clearView = side => { // merkin eteen ei puita, jotta se näkyy
      for (let k = 0; k <= 10 && n - k >= 0; k++) { const arr = k ? segs[n - k].sprites : sp; for (let j = arr.length - 1; j >= 0; j--) if (Math.sign(arr[j].x) === side && ['kuusi', 'koivu', 'mökki', 'lato'].includes(arr[j].k)) arr.splice(j, 1); }
    };
    if (start) { sp.push({ k:'raja', x:1.3, lim:zone.lim }); clearView(1); if (zone.cam) { sp.push({ k:'valvonta', x:-1.3 }); clearView(-1); } }
    else if (zone.cam && zone.len % 120 === 60 && zone.left > 10) { sp.push({ k:'kamera', x:1.3 }); clearView(1); }
    segs.push({ i:n, p1:pt(lastY(), n * SEG), p2:pt(y, (n + 1) * SEG), curve, sprites:sp, clip:H, lim:zone.lim, kind:zone.kind, lake: zone.lake && zone.len > 14 && zone.left > 14 ? zone.lake : 0 });
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
    const lap = !!(st.trip && st.trip.road === 'lappi'), north = lap || !!(st.trip && st.trip.road === 'kuusamo');
    return {
      m, lap,
      snow: lap || (!autobahn() && [11, 0, 1, 2].includes(m)),
      autumn: [8, 9].includes(m),
      bare: m === 10, // marraskuu: ruskea maa, lehdettömät koivut
      dark: [10, 11, 0].includes(m) ? 0.72 : [1, 9].includes(m) ? 0.35 : 0,
      deerPerMonth: north ? 0 : m >= 8 && m <= 11 ? 4 : 2,
      poroPerMonth: lap ? 7 : north ? 5 : S.job === 'kuusamo' && !st.trip ? 2 : 0,
      holesPerMonth: [2, 3, 4].includes(m) ? 7 : 3, // kelirikko keväällä
      temp: temperature(m, lap, north),
    };
  }
  // alpha 30: lämpötila ja sää. Sama kuukausi näyttää samalta koko ajon ajan (siemen kuukaudesta).
  const TEMP = [-8, -9, -4, 3, 10, 15, 18, 16, 10, 4, -1, -6];
  function temperature(m, lap, north) {
    if (autobahn()) return Math.round(TEMP[m] / 2 + 6 + rr(S.m, 31) * 4);
    return Math.round(TEMP[m] + (lap ? -20 : north ? -6 : 0) + (rr(S.m, 30) - 0.5) * 8);
  }
  function weather() {
    const key = S.m + (st.trip ? ':' + st.trip.road : '');
    if (st.wx && st.wx.key === key) return st.wx;
    const sea = season(), r = rr(S.m, 32 + (st.trip ? 7 : 0));
    const kind = sea.snow ? (r < 0.6 ? 'lumi' : '') : (sea.temp > 0 && [3, 4, 7, 8, 9].includes(sea.m) && r < 0.5) ? 'sade' : (sea.temp <= 0 && r < 0.3 ? 'lumi' : '');
    st.wx = { key, kind, ice: sea.temp <= 1 && !autobahn() ? (sea.temp <= -15 ? 2 : 4) : 0 };
    return st.wx;
  }
  const keliTxt = () => { const sea = season(), w = weather(); return `${sea.temp > 0 ? '+' : sea.temp < 0 ? '−' : ''}${Math.abs(sea.temp)} °C${w.kind === 'lumi' ? ' · LUMISADE' : w.kind === 'sade' ? ' · SADE' : ''}${w.ice ? ' · LIUKASTA' : ''}`; };

  const winterLimits = () => [9, 10, 11, 0, 1, 2].includes((S.m - 1) % 12); // talvinopeusrajoitukset loka–maalis
  // peräkärry perässä, kun muuttokeikat ovat päällä eikä pakua ole
  const towing = () => st.trip ? !!st.trip.trailer : !!(S.gigs && !vanOK() && trailerOK());
  const autobahn = () => !!(st.trip && st.trip.road === 'autobahn');
  const limitOf = lim => {
    const l = autobahn() ? (lim === 'H' ? Infinity : lim === 80 ? 120 : 80) : lim === 'H' ? (winterLimits() ? 80 : 100) : lim;
    return towing() ? Math.min(80, l) : l; };
  const limTxt = l => l === Infinity ? '—' : String(l);

  // ---------- nopeuskamerat ----------
  function camFine(over) {
    if (over <= 10) return [140, 'rikesakko'];
    if (over <= 20) return [200, 'rikesakko'];
    if (over <= 30) return [420, 'päiväsakot 14 × 30 €'];
    if (over <= 40) return [600, 'päiväsakot 20 × 30 €'];
    return [900, 'päiväsakot 30 × 30 €, ja ajokieltoa harkitaan'];
  }
  function camera(seg) {
    const kmh = Math.round(st.speed / KMH), lim = limitOf(seg.lim);
    if (kmh <= lim + 7) return; // kamera sallii pienen toleranssin
    const [f, kind] = camFine(kmh - lim);
    st.flash = 0.8; Snd.play('flash'); ST().cam++; S.stat.camEur += f;
    (S.post = S.post || []).push([`Nopeuskamera: ${kmh} km/h, rajoitus ${lim} (${kind})`, f]);
    toast(`!SALAMA! ${kmh} km/h alueella ${lim}. Sakko ${eur(f)} tulee postissa.`, 5);
  }

  // ---------- ajoneuvo ----------
  function vehicle() {
    const TR = st.trip;
    if (TR && TR.rental) { const r = TR.rental; return { bus:false, rental:r, name:r.name, vmax:r.vmax, acc:15, spec: /paku/i.test(r.name) ? { b:'van', w:1.08, c:'#ECECEC', tl:'vertical', hl:'slim', g:'slot', x:['panelvan'] } : { b:'suv', c:'#3A3F44', tl:'corner', hl:'slim', g:'slot', x:['rails'] }, mb:0, minor:0, box:false }; }
    const tripCar = TR && TR.car && S.cars.includes(TR.car) ? TR.car : null;
    const T = tripCar ? null : S.tsa, car = tripCar || (T ? null : drivenCar());
    if (!T && !car) return { bus:true, name:'Bussi', vmax:80, acc:8, color:COL.yellow, mb:0, minor:0 };
    const id = T ? T.c : car.c, k = C(id);
    let vmax = 120 + 25 * Math.log2(Math.max(1, k.price / 4000));
    if (k.fl.includes('T')) vmax += 20;
    if (k.fl.includes('S')) vmax = 125;
    if (k.fl.includes('V')) vmax = 140;
    if (k.fl.includes('B')) vmax = 130;
    vmax = Math.min(230, Math.max(125, vmax));
    { const es = evSpec(k); if (es && es[3]) vmax = es[3]; } // hitaat: Elcat ja Topolino
    let acc = k.type === 'e' ? Math.min(36, 20 + k.price / 4000) : Math.min(24, 12 + k.price / 6000);
    if (/^Elcat/.test(k.name)) acc = 7;
    if (/^Fiat Topolino/.test(k.name)) acc = 6;
    const minor = car ? (car.minor || 0) : 0;
    if (minor) { vmax *= 0.92; acc *= 0.85; }
    if (!T && towing()) { vmax = Math.min(vmax, 120); acc *= 0.75; }
    if (car && car.dpf) { vmax = Math.min(vmax, 60); acc *= 0.5; } // DPF tukossa: vikatila
    return { bus:false, tsa:!!T, car, name:k.name, vmax, acc, spec:Cars.spec(k.name, k.type), mb: T ? T.mb : car.mb, minor, box: !!(TR && TR.box) };
  }
  function refreshVehicle() {
    const prev = st.veh, v = vehicle();
    if (prev && !prev.bus && v.bus) toast('!Auto jäi tien varteen. Matka jatkuu bussilla.');
    else if (prev && prev.name !== v.name && !v.bus) toast(`+Alla on nyt ${v.name}.`);
    st.veh = v;
    { const b = document.getElementById('pad-auto'); if (b) b.hidden = !apOK(); }
    if (!apOK()) st.auto = false;
    else if (!st.apHint || (prev && prev.name !== v.name)) { st.apHint = true; toast('Tesla Avustettu Ajo (entinen FSD): T tai ↑ kytkee.', 6); }
  }

  // ---------- energia (alpha 17) ----------
  const fNow = () => st.trip ? F_TRIP : F_NORMAL;
  const kmPerU = () => fNow() / 3600 / KMH;
  const coldNow = () => !!(st.trip && st.trip.road === 'lappi') || coldSeason();
  function eSpecFor(k, car, T) {
    const obj = T || car;
    if (k.type !== 'e') { const range = k.type === 'h' ? 900 : 750; return { ev:false, range, obj, tank: range * (k.fl.includes('D') ? 0.06 : 0.07), free: !!(T && T.kind === 'vapaa') }; }
    const es = evSpec(k);
    let range = es ? es[1] : k.fl.includes('S') ? 160 : k.fl.includes('V') ? 300 : k.fl.includes('B') ? 320 : Math.min(560, 280 + k.price / 350);
    if (car && car.soh !== undefined) range *= Math.max(0.5, car.soh / 100);
    const kw = es ? es[2] : k.fl.includes('S') ? 46 : k.price < 15000 ? 50 : /Ioniq 5|EV6|Taycan|e-tron GT|Macan|Lucid|Lotus|PV5/.test(k.name) ? 240 : k.price >= 50000 ? 200 : 125;
    return { ev:true, range, obj, kw, cap: range * 0.17, hp: hasHeatPump(k), free: k.fl.includes('F') || !!(T && T.kind === 'vapaa') || S.job === 'lataus' };
  }
  function eSpec() {
    const v = st.veh;
    if (!v || v.bus) return null;
    if (v.rental) return { ev:false, range:v.rental.range, obj:v.rental, tank:v.rental.range * 0.08 };
    const T = v.tsa ? S.tsa : null;
    return eSpecFor(C(T ? T.c : v.car.c), v.car, T);
  }
  // kulutuskerroin: ilmanvastus kasvaa vauhdin neliönä; kattoboksi, kärry, pakkanen ja Lapin pakkanen päälle
  function consF(E, kmh, cold, tow, box, lap) {
    const r = Math.max(30, kmh) / 90;
    let f = 0.45 + 0.55 * r * r;
    if (box) f *= 1 + 0.15 * r * r;
    if (tow) f *= E.ev ? 1.5 : 1.3;
    if (E.ev && cold) f /= E.hp ? 0.8 : 0.67;
    if (E.ev && lap) f /= 0.85;
    return f;
  }
  const consNow = (E, kmh) => consF(E, kmh, coldNow(), towing(), st.veh.box, season().lap) / E.range * (st.trip ? 1 : commuteF()); // osuus akusta tai tankista per km
  function rangeOf(car, cold, kmh) { const E = eSpecFor(C(car.c), car, null); return Math.round(E.range / consF(E, kmh || 100, cold === 'cold', false, false, false) / 10) * 10; }
  const energy = E => (E.obj.energy === undefined ? 1 : E.obj.energy);
  function scheduleStation() {
    const r = st.trip && st.trip.road, [a, b] = r === 'lappi' || r === 'kuusamo' ? [110, 190] : r ? [50, 90] : [35, 70];
    st.nextSt = st.kmTot + a + Math.random() * (b - a);
  }
  function spawnStation() {
    const at = Math.floor((st.pos + PZ) / SEG) + 110, r = st.trip && st.trip.road;
    if ((st.ramp && at > st.ramp.start - 25 && at < st.ramp.end + 15) || lotNear(at, 30)) { st.nextSt = st.kmTot + 3; return; }
    const kw = r === 'autobahn' ? (Math.random() < 0.8 ? 300 : 150) : r === 'lappi' || r === 'kuusamo' ? (Math.random() < 0.5 ? 50 : 150) : (Math.random() < 0.6 ? 150 : 50);
    st.dyn.push({ k:'asema', station:true, z:at * SEG, x:1.9, at, kw, broken: Math.random() < (r === 'lappi' ? 0.3 : r === 'kuusamo' ? 0.2 : 0.08), queue: Math.random() < (r === 'autobahn' ? 0.35 : 0.2) ? 2 + Math.random() * 4 : 0 });
    st.nextSt = Infinity;
  }
  function stationUpdate(dt, z1) {
    const cur = Math.floor(z1 / SEG);
    if (st.kmTot >= st.nextSt) spawnStation();
    const o = st.dyn.find(d => d.station);
    if (!o) { if (st.nextSt === Infinity) { if (st.chg) chargeEnd(); scheduleStation(); } return; }
    if (cur > o.at + STOP_WIN) { if (st.chg) chargeEnd(); st.dyn.splice(st.dyn.indexOf(o), 1); scheduleStation(); return; }
    const E = eSpec();
    const near = Math.abs(cur - o.at) <= STOP_WIN, stopped = st.speed < 15 * KMH && st.x > 0.25;
    if (!E || !(near && stopped)) { if (st.chg) chargeEnd(); return; }
    if (E.ev && o.broken) { if (!st.chg) { st.chg = { o, E, broken:true }; toast('!LATURI RIKKI: "Out of order". Seuraava asema on kauempana.', 4); } return; }
    if (!st.chg) st.chg = { o, E, start: energy(E), kwh:0, l:0, cost:0, t:0, q: o.queue };
    const c = st.chg;
    c.t += dt;
    if (c.q > 0) { c.q -= dt; return; }
    let e = energy(E);
    if (e >= 0.999) return;
    if (E.ev) { const kw = Math.min(E.kw, o.kw) * (e > 0.8 ? 0.35 : 1), kwh = kw * dt * fNow() / 3600;
      e = Math.min(1, e + kwh / E.cap); c.kwh += kwh; c.cost += E.free ? 0 : kwh * (o.kw >= 150 ? 0.52 : 0.39); }
    else { const add = Math.min(1 - e, dt * 0.3); e += add; c.l += add * E.tank; c.cost += E.free ? 0 : add * E.tank * 1.95; }
    E.obj.energy = e;
  }
  function chargeEnd() {
    const c = st.chg; st.chg = null;
    if (!c || c.broken || (!c.kwh && !c.l)) return;
    if (c.cost > 0) payOrVippi(c.cost, false);
    toast(c.E.ev ? `+Ladattu ${Math.round(c.start * 100)} → ${Math.round(energy(c.E) * 100)} % · ${Math.round(c.kwh)} kWh · ${c.cost ? eur(c.cost) : 'ilmainen'}` : `+Tankattu ${Math.round(c.l)} l · ${c.cost ? eur(c.cost) : 'firma maksaa'}`, 4);
    // työmatkalla pitkä latausstoppi myöhästyttää (työsuhdeautolla ja matkoilla ei)
    if (!st.trip && !st.veh.tsa && job().km > 0 && c.E.ev && c.t > 3 && st.lateM !== S.m) { st.lateM = S.m; S.late = (S.late || 0) + 1; toast('!OLET MYÖHÄSSÄ PALAVERISTA! Pomo merkitsi sen muistiin.', 5); }
  }
  function towTo(title, lines, cost, extraH) {
    st.speed = 0; st.paused = true; st.keys = {};
    if (st.trip) { st.trip.towed = true; st.trip.t += extraH || 1.5; }
    else if (!st.veh.tsa) S.late = (S.late || 0) + 1;
    gigCrash();
    Q.unshift(() => { payOrVippi(cost); say(title, lines.concat([`Hinaus ${eur(cost)}.`, st.trip ? '!Matka-aikaa kului hinauksessa.' : '!Myöhästyit töistä, ja pomo huomasi.'])); });
    setTimeout(() => { if (st.active) openEvents(); }, 450);
  }
  function outOfEnergy(E) {
    const lap = !!(st.trip && (st.trip.road === 'lappi' || st.trip.road === 'kuusamo')), city = st.trip && st.trip.road === 'kuusamo' ? 'Kuusamoon' : 'Rovaniemelle';
    E.obj.energy = E.ev ? 0.35 : 0.4;
    towTo(E.ev ? 'AKKU LOPPUI' : 'TANKKI LOPPUI', [E.ev ? `!${st.veh.name} pysähtyi tien varteen: akku 0 %.${coldNow() ? ' Pakkanen söi viimeiset kilometrit.' : ''}` : `!${st.veh.name} yski ja sammui: tankki tyhjä.`,
      E.ev ? `Hinausauto vei auton ${lap ? city : 'lähimmälle laturille'} ja latasi sen 35 %:iin.` : 'Hinausauto toi kanisterin ja vei lähimmälle asemalle.'], lap ? 600 : 250);
  }

  // ---------- matkat (alpha 17) ----------
  function tripBegin() {
    const T = S.trip; st.trip = T;
    T.done = T.done || 0; T.t = T.t || 0;
    if (st.gig) toast('!Keikka jäi kesken, kun lähdit matkalle.');
    st.dyn = st.dyn.filter(d => !d.gig && !d.station); st.gig = null; st.ramp = null; st.chg = null;
    refreshVehicle();
    const E = eSpec();
    if (E) E.obj.energy = T.car ? 0.8 : 1; // kotona ladattu täyteen; Saksan auton myyjä latasi 80 %:iin
    const car = st.veh.car;
    if (T.trailer && isDiesel(car) && Math.random() < 0.6) T.dpfAt = 40 + Math.random() * 200;
    st.kmTot = 0; scheduleStation(); st.nextSt = Math.min(st.nextSt, 30);
    toast(`+MATKA ALKAA: ${T.name}, ${T.km} km, aikaa ${T.hours} h. ${E && E.ev ? 'Akku' : 'Tankki'} ${Math.round(energy(E || {obj:{}}) * 100)} %.`, 6);
  }
  function tripUpdate(dt, km) {
    const T = st.trip;
    T.t += dt * F_TRIP / 3600; T.done += km;
    if (T.dpfAt && T.done >= T.dpfAt && st.veh.car) { T.dpfAt = 0; st.veh.car.dpf = 1; refreshVehicle(); toast('!DPF-VALO! Dieselin hiukkassuodatin tukkeutui kärryn vedossa. Auto on vikatilassa: enintään 60 km/h.', 6); }
    if (T.gel && T.done >= T.gel) { T.gel = 0; return towTo('DIESEL HYYTYI', ['!−30 °C ja tankissa oli kesälaatua. Polttoainesuodatin täyttyi parafiinista, ja moottori sammui.', 'Hinausauto vei auton lämpimään halliin sulamaan.'], 400, 2); }
    if (st.veh.bus || (T.car && !S.cars.includes(T.car))) return tripEnd({ ok:false, towed:true, late:true, broken:!!T.cargo });
    if (T.done >= T.km) tripEnd({ ok:true, late: T.t > T.hours, towed: !!T.towed, broken: !!T.broken });
  }
  function tripEnd(res) {
    const T = st.trip; st.trip = null;
    if (S.trip === T) S.trip = null;
    st.dyn = st.dyn.filter(d => !d.station); st.chg = null; st.kmTot = 0; scheduleStation();
    st.speed = Math.min(st.speed, 50 * KMH);
    toast(res.late ? `!Perillä: ${T.name}, mutta myöhässä (${hhmm(T.t)} h)` : `+Perillä: ${T.name} (${hhmm(T.t)} h)`, 5);
    Q.unshift(() => tripDone(T, res));
    st.paused = true;
    setTimeout(() => { if (st.active) openEvents(); }, 300);
  }
  const hhmm = h => `${Math.floor(h)}.${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  // vahinkotapahtuma oikealle autolle: vuokra-autosta laskuttaa vuokraamo, Saksan autolla vahinko osuu siihen
  function dmg(k, opt) {
    opt = opt || {};
    if (st.veh.rental) return () => { const c = opt.total ? 1500 : k === 'peura' ? 800 : 300; payOrVippi(c);
      say(opt.title || (k === 'peura' ? 'PEURA!' : 'KOLHU'), [opt.txt || 'Vuokra-autoon tuli vaurio.', `!Vuokraamo laskuttaa omavastuun ${eur(c)}. Oma auto säästyi.`]); };
    if (st.trip && st.trip.car) opt.car = st.trip.car;
    return () => damageEvent(k, opt);
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
    st.ramp = null; st.monthT = 0; st.boardN = 0; st.lotDone = false;
    if (S.m >= LAST) { stop(); return endGame(); }
    S.m++;
    Q = [];
    const R = monthTick();
    if (S.vippi > 3000) { stop(); return repossess(); }
    Snd.play('cash');
    if (exiting) {
      if (st.gig && st.gig.phase === 'deliver') Q.unshift(() => say('KEIKKA JÄI KESKEN', ['!Ajoit liittymästä kotiin kesken keikan. Siitä ei makseta.']));
      st.gig = null;
      stop();
      return scr(`${monthName()}: TILIOTE`, tilioteLines(R), [['Jatka', next]]);
    }
    let plus = 0, minus = 0;
    R.forEach(r => { if (r[0] === '+') plus += r[2]; else if (r[0] === '-') minus += r[2]; });
    toast(`${KK[(S.m - 1) % 12].toUpperCase()}KUU: +${eur(plus)} / −${eur(minus)} · KASSA ${eur(S.cash)}`, 6);
    R.filter(r => r[0] === '+' && /keikat|toimitukset|kyydit/i.test(r[1])).forEach(r => toast(`+${r[1]}: ${eur(r[2])}`, 6));
    R.filter(r => r[0] === '!' && !(st.gig && /ei ajettu/.test(r[1]))).forEach(r => toast('!' + r[1], 6)); // kesken olevaa keikkaa ei moitita
    if (Q.length) openEvents();
  }
  // alpha 30: jono käydään läpi ilman pakkopysähdystä. Pikavalinnat näkyvät tien päällä (quick), muut ruudut
  // pysäyttävät pelin ja aukeavat paneeliin (hold). Tyhjä jono kutsuu resume().
  function openEvents() {
    st.keys = {};
    next();
  }
  function hold() {
    if (!st.active) return;
    if (st.quick) { const s = st.quick.s; st.quick = null; Q.unshift(() => show(s)); } // kesken jäänyt pikavalinta odottaa vuoroaan
    st.paused = true; st.keys = {};
    document.body.classList.add('paused');
  }
  const QUICK_S = 5;
  function quick(s) {
    if (!st.active) return false;
    if (st.paused) { // paneelista takaisin tielle
      st.paused = false; st.keys = {};
      if (st.tow) { st.tow = false; st.x = Math.max(-0.85, Math.min(0.85, st.x)); }
    st.vx = 0; st.sa = 0; st.auto = false; st.apErr = null;
      document.body.classList.remove('paused');
      refreshVehicle(); st.last = performance.now();
    }
    const def = s.choices.length - 1 - [...s.choices].reverse().findIndex(c => !c.dis);
    // pelkkä ilmoitus: pitkä teksti saa enemmän lukuaikaa (enintään 9 s)
    const len = s.lines.join(' ').length, T = s.choices.length === 1 ? Math.min(9, Math.max(QUICK_S, 3 + len / 35)) : QUICK_S;
    st.quick = { s, t: T, T, def: def > s.choices.length - 1 ? 0 : def };
    Snd.play('quick');
    return true;
  }
  function quickPick(i) {
    const q = st.quick; if (!q) return;
    const c = q.s.choices[i]; if (!c || c.dis) return;
    st.quick = null;
    Snd.play('click');
    c.f();
  }
  function quickUpdate(dt) {
    const q = st.quick; if (!q) return;
    q.t -= dt;
    if (q.t <= 0) quickPick(q.def);
  }
  function quickHtml() {
    const q = st.quick; if (!q || st.paused) return '';
    const lines = q.s.lines.filter(l => l !== '').map(l => { const c = l[0] === '!' ? 'r' : l[0] === '+' ? 'g' : ''; return `<p class="${c}">${escH(c ? l.slice(1) : l)}</p>`; }).join('');
    const one = q.s.choices.length === 1;
    const ch = q.s.choices.map((c, i) => `<button data-i="${i}"${c.dis ? ' disabled' : ''}${i === q.def ? ' class="def"' : ''}><span class="k">${i + 1}</span>${escH(one && c.t === 'Jatka' ? 'OK' : c.t)}</button>`).join('');
    return `<div class="q-t">${escH(q.s.title)}</div>${lines}<div class="q-ch">${ch}</div><div class="q-bar"><i id="q-bar"></i></div>`;
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
  function spawnPoro() {
    const z = st.pos + PZ + DRAW * (0.6 + Math.random() * 0.3) * SEG;
    st.dyn.push({ k:'poro', z, x:(Math.random() - 0.5) * 1.5, vx:(Math.random() - 0.5) * 0.12, wake:999 });
  }
  // ---------- kuopat ja kivet ----------
  // ---------- muu liikenne ----------
  const DESTS = ['KUOPIO', 'TAMPERE', 'OULU', 'LAHTI', 'PORI', 'VARIKKO', 'TILAUSAJO', 'KOUVOLA'];
  const TRAFFIC_COL = ['#A8ADB4', '#1F2633', '#7A1F24', '#ECECEC', '#2F6DB5', '#3A3F44', '#2E5B4C', '#9B6739'];
  function spawnTraffic(oncoming) {
    const z1 = st.pos + PZ, seg = segAt(z1), lim = limitOf(seg.lim);
    const z = z1 + DRAW * SEG * (oncoming ? 0.95 : 0.6 + Math.random() * 0.3);
    if (st.ramp && z / SEG > st.ramp.start - 10 && z / SEG < st.ramp.end + 10) return;
    if (st.dyn.some(o => (o.k === 'auto' || o.k === 'vasta') && Math.abs(o.z - z) < 20 * SEG && (o.k === 'vasta') === oncoming)) return;
    const kmh = oncoming ? lim - 5 + Math.random() * 15 : Math.max(45, lim - 15 + Math.random() * 15);
    st.dyn.push({ spec: Cars.random(), dest: DESTS[Math.floor(Math.random() * DESTS.length)], heavy: Math.random() < 0.12 ? (Math.random() < 0.5 ? 'bus' : 'truck') : '', k: oncoming ? 'vasta' : 'auto', z, x: oncoming ? -0.5 : 0.5, v: (oncoming ? -1 : 1) * kmh * KMH, col: TRAFFIC_COL[Math.floor(Math.random() * TRAFFIC_COL.length)], prel: z - z1 });
  }
  function hitTraffic(d, kmh) {
    st.dyn.splice(st.dyn.indexOf(d), 1);
    const on = d.k === 'vasta';
    if (kmh < 12) { st.speed = Math.max(0, d.v); st.shake = 0.3; return toast('Kolautit puskuria. Pahoittelut vilkulla, ja matka jatkuu.'); }
    const name = st.veh.name;
    const txt = on ? `${name} ajoi vastaantulevien kaistalle, ja nokat kohtasivat ${kmh} km/h:n yhteisnopeudella.` : `${name} ajoi edellä menevän auton perään ${kmh} km/h:n nopeuserolla.`;
    crashStop(); gigCrash(); Snd.play('crash'); ST().crash++;
    Q.unshift(dmg(kmh >= 50 ? 'peura' : 'kolhu', { title: on ? 'NOKKAKOLARI!' : 'PERÄÄNAJO!', txt: txt + (on ? ' Syy on sinun.' : ' Peräänajaja on aina syyllinen.'), total: kmh >= 100 }));
    setTimeout(() => { if (st.active) openEvents(); }, 450);
  }

  function spawnHazard() {
    const z = st.pos + PZ + DRAW * (0.6 + Math.random() * 0.3) * SEG;
    if (st.ramp && z / SEG > st.ramp.start - 5 && z / SEG < st.ramp.end + 5) return;
    st.dyn.push({ k: Math.random() < 0.6 ? 'kuoppa' : 'kivi', z, x: (Math.random() - 0.5) * 1.7 });
  }
  function hitHazard(d) {
    st.dyn.splice(st.dyn.indexOf(d), 1);
    const kmh = Math.round(st.speed / KMH);
    st.shake = 0.4;
    if (kmh < 30) { st.speed *= 0.6; return toast(d.k === 'kuoppa' ? 'Kolahti kuoppaan, mutta pohja kesti.' : 'Raapaisit kiveä hiljaa. Ei vahinkoa.'); }
    st.speed *= 0.4; st.paused = true; Snd.play('thump');
    gigCrash();
    if (st.veh.rental) Q.unshift(dmg('kolhu', { title:'KOLAHDUS!', txt:`Vuokra-auto osui ${d.k === 'kuoppa' ? 'isoon kuoppaan' : 'kiveen'} ${kmh} km/h:n vauhdissa.` }));
    else Q.unshift(() => dentEvent(d.k === 'kuoppa' ? 'isoon kuoppaan' : 'kiveen', kmh, st.trip && st.trip.car));
    setTimeout(() => { if (st.active) openEvents(); }, 350);
  }
  // ---------- mainostaulut ja autoliikkeet (alpha 30) ----------
  // puut ja rakennukset pois taulun tai liikkeen edestä, jotta se näkyy
  function clearSide(at, side) { ensure(at + 2); for (let i = Math.max(0, at - 14); i <= at + 2; i++) { const a = segs[i].sprites; for (let j = a.length - 1; j >= 0; j--) if (Math.sign(a[j].x) === side && Math.abs(a[j].x) > 1.15 && ['kuusi', 'koivu', 'mökki', 'lato'].includes(a[j].k)) a.splice(j, 1); } }
  const lotNear = (at, w) => st.dyn.some(d => d.lot && !d.used && Math.abs(d.at - at) < w);
  function boardUpdate(km) {
    st.boardKm -= km;
    if (st.boardKm > 0 || autobahn() || st.veh.bus) return;
    st.boardKm = 45 + Math.random() * 50;
    const at = Math.floor((st.pos + PZ) / SEG) + 120;
    if (st.dyn.some(d => d.k === 'mainos' && Math.abs(d.z / SEG - at) < 40)) return;
    const b = billboard(); if (!b) return;
    clearSide(at, -1);
    st.dyn.push({ k:'mainos', z:at * SEG, x:-2.6, t:b[0], s:b[1], hot: !!(S.camp && b[0] === shortName(S.camp.id)) || /0 %|★/.test(b[0]) });
  }
  function lotSpawn() {
    const at = Math.floor((st.pos + PZ) / SEG) + 130;
    if (st.ramp && at > st.ramp.start - 30 && at < st.ramp.end + 15) return;
    if (st.dyn.some(d => d.station && Math.abs(d.at - at) < 30) || (st.gig && Math.abs(st.gig.at - at) < 30)) return;
    clearSide(at, 1); clearSide(at - 70, -1);
    st.dyn.push({ k:'liike', lot:true, z:at * SEG, x:2.3, at });
    st.dyn.push({ k:'mainos', z:(at - 70) * SEG, x:-2.6, t:'AUTOLIIKE 350 M', s:'KÄÄNNY PIHAAN · KAHVIT VALMIINA', hot:true });
    st.lotDone = true;
  }
  function lotUpdate(z1) {
    if (!st.lotDone && !st.trip && st.monthT > 7 && st.monthT < MONTH_S - RAMP_LEAD_S - 7) lotSpawn();
    const o = st.dyn.find(d => d.lot && !d.used); if (!o) return;
    const cur = Math.floor(z1 / SEG);
    if (cur > o.at + STOP_WIN) { o.used = true; return; }
    if (Math.abs(cur - o.at) <= STOP_WIN && st.speed < 15 * KMH && st.x > 0.25) {
      o.used = true; st.speed = 0; st.paused = true; st.keys = {};
      Q.unshift(lotVisit);
      openEvents();
    }
  }
  // ---------- liukkaus (alpha 30): musta jää pakkasella ----------
  function spawnIce() {
    const z = st.pos + PZ + DRAW * (0.6 + Math.random() * 0.3) * SEG;
    if (st.ramp && z / SEG > st.ramp.start - 5 && z / SEG < st.ramp.end + 5) return;
    st.dyn.push({ k:'jää', z, x:(Math.random() - 0.5) * 1.4, w:0.25 + Math.random() * 0.2 });
  }
  function hitIce(d) {
    d.hit = true;
    st.ice = S.summer > 0 ? 2.4 : 1.3;
    Snd.play('ice');
    if (!st.iceWarn || S.summer > 0) { st.iceWarn = true; toast(S.summer > 0 ? '!MUSTA JÄÄ – ja kesärenkaat! Auto ei ohjaa eikä jarruta.' : '!Musta jää! Ohjaus ja jarrut eivät pure hetkeen.', 3.5); }
  }

  function hitDeer(d) {
    st.dyn.splice(st.dyn.indexOf(d), 1);
    const kmh = st.speed / KMH;
    const poro = d.k === 'poro';
    if (kmh < 35) { st.speed *= 0.4; st.shake = 0.3; return toast(poro ? 'Poro katsoi sinua, ja sinä poroa. Se siirtyi lopulta metrin.' : 'Peura säikähti ja loikkasi metsään. Huh.'); }
    crashStop(); gigCrash(); Snd.play('crash'); ST()[poro ? 'poro' : 'deer']++;
    if (poro) (S.post = S.post || []).push(['Paliskunta: poron korvaus', 450]);
    const ptxt = poro ? { title:'PORO!', txt:`Poro seisoi keskellä tietä eikä väistänyt. Osuma ${Math.round(kmh)} km/h:n vauhdissa. Paliskunta laskuttaa poron (450 €).` } : {};
    Q.unshift(dmg('peura', kmh >= 100 ? Object.assign(ptxt, { total:true, txt: ptxt.txt || `Peura osui keulaan ${Math.round(kmh)} km/h:n vauhdissa.` }) : ptxt));
    setTimeout(() => { if (st.active) openEvents(); }, 450);
  }

  // ---------- törmäykset tienvarteen ----------
  // puolikas leveys tien puolikkaina; kyltillä kaksi tolppaa
  // runkojen ja seinien puolikkaat leveydet piirretyn kuvan mukaan (1 = tien puolikas = 2000 yksikköä)
  const HIT = { kuusi:0.1, koivu:0.05, tolppa:0.03, mökki:0.6, lato:0.8, raja:0.03, valvonta:0.03, kamera:0.09, pylväs:0.03, lamppu:0.03, lohkare:0.2 };
  const WHERE = { kuusi:'kuuseen', koivu:'koivuun', tolppa:'reunapaaluun', mökki:'mökin seinään', lato:'latoon', kyltti:'liikennemerkkiin', raja:'liikennemerkkiin', valvonta:'liikennemerkkiin', kamera:'kameratolppaan', pylväs:'sähköpylvääseen', lamppu:'katuvalopylvääseen', lohkare:'kivenlohkareeseen' };
  const CAR_HW = 0.11; // auto on 72 px leveä, tien puolikas pelaajan kohdalla 320 px
  function hits(o) {
    if (o.k === 'kyltti') return [0, 0.52].some(dx => Math.abs(o.x + dx - st.x) < 0.03 + CAR_HW);
    return HIT[o.k] !== undefined && Math.abs(o.x - st.x) < HIT[o.k] + CAR_HW;
  }
  const rampHides = (seg, o) => st.ramp && seg.i >= st.ramp.start - 2 && seg.i <= st.ramp.end + 2 && o.x > 0.9 && o.x < 2.6;
  // pensas ei pysäytä, mutta maalipinta kärsii: korjaus maksaa tai arvo laskee
  function scratch() {
    const kmh = Math.round(st.speed / KMH);
    if (kmh < 25 || st.scrCd > 0) return;
    st.scrCd = 2; st.speed *= 0.88; st.shake = Math.max(st.shake, 0.2); Snd.play('thump');
    const v = st.veh;
    if (v.rental) { payOrVippi(150); return toast('!Pensas naarmutti vuokra-auton kyljen. Vuokraamo laskuttaa 150 €.', 5); }
    if (v.tsa) return quick({ title:'NAARMUT', lines:[`Pensas raapi työsuhdeauton (${v.name}) kyljen ${kmh} km/h:n vauhdissa.`, '!Leasingyhtiö tarkastaa maalipinnan palautuksessa.'], choices:[
      { t:'Kiillotuta omalla rahalla (180 €)', f: () => { payOrVippi(180); toast('Naarmut kiillotettiin pois. Pomo ei kuullut mitään.'); } },
      { t:'Anna olla: pomo huomaa', f: () => { S.boss++; toast('!Pomo kiersi auton parkkihallissa ja nosti kulmakarvojaan.'); } }] });
    const car = st.trip && st.trip.car && S.cars.includes(st.trip.car) ? st.trip.car : drivenCar();
    if (!car) return;
    const k = C(car.c), cost = k.price > 50000 ? 480 : 260;
    const leave = () => { car.base *= 0.97; car.scr = (car.scr || 0) + 1; toast(`!Naarmut jäivät kylkeen. Arvo −3 %${car.scr > 1 ? ` (jo ${car.scr}. kerta)` : ''}.`); };
    if (st.quick) return leave(); // toinen valinta on jo ruudulla: naarmut jäävät
    quick({ title:'NAARMUT', lines:[`${k.name} raapaisi pensasta ${kmh} km/h:n vauhdissa. Oksat vetivät kylkeen pitkät naarmut.`], choices:[
      { t:`Maalaus ja kiillotus (${eur(cost)})`, f: () => { payOrVippi(cost); toast('Kylki maalattiin ja kiillotettiin. Arvo säilyi.'); } },
      { t:'Jätä naarmut (arvo −3 %)', f: leave }] });
  }
  function crashStop() {
    if (st.trip && st.trip.cargo) st.trip.broken = true; // kolarissa kuorma menee rikki
    st.speed = 0; st.shake = 0.6; st.flash = 0.5; st.auto = false; st.apErr = null;
    st.paused = true; // fysiikka seis heti, paneeli aukeaa hetken päästä
    st.tow = true; // hinataan takaisin tielle, kun tapahtumaikkuna suljetaan
  }
  function crash(o) {
    const kmh = Math.round(st.speed / KMH);
    if (kmh < 15) { st.speed = 0; st.shake = 0.25; st.x += st.x > 0 ? -0.08 : 0.08; return toast('Tömps. Pelkkä hipaisu.'); }
    const name = st.veh.name;
    const txt = `${name} törmäsi ${WHERE[o.k]} ${kmh} km/h:n vauhdissa.`;
    const opt = kmh >= 100 ? { title:'ULOSAJO!', txt, total:true }
      : { title:'ULOSAJO!', txt: txt + (kmh >= 50 ? ' Keula on mytyssä.' : ' Puskuri ja pelti saivat osansa.') };
    crashStop(); gigCrash(); Snd.play('crash'); ST().crash++;
    Q.unshift(dmg(kmh >= 50 ? 'peura' : 'kolhu', opt));
    setTimeout(() => { if (st.active) openEvents(); }, 450);
  }

  // ---------- keikat: Wolt ja taksi ----------
  const FOOD = ['KEBAB', 'PIZZA', 'SUSHI', 'BURGER', 'THAI', 'PHO', 'GRILLI'];
  const DEST = ['Lentokentälle', 'Rautatieasemalle', 'Keskustaan', 'Sairaalalle', 'Kauppakeskukseen', 'Satamaan', 'Hotellille'];
  const STOP_WIN = 8; // pysähdysikkuna segmentteinä kohteen molemmin puolin
  const LOAD_S = 3; // muuttokuorman kantaminen ja purku (s)
  // muuttokeikka vaatii, että ajossa on paku tai vetokoukullinen auto ja peräkärry
  const muuttoOK = d => !!d && (C(d.c).fl.includes('V') || (!!S.trailer && towOK(d) && licOK(d)));
  function gigKinds() {
    const d = drivenCar();
    if (S.tsa || !d || st.trip) return [];
    const k = [];
    if (S.wolt) k.push('wolt');
    if (S.taxi && taxiOK(d)) k.push('taxi');
    if (S.gigs && muuttoOK(d)) k.push(!C(d.c).fl.includes('V') && TT() === TRAILERS.auto ? 'romu' : 'muutto');
    return k;
  }
  const gigMarkers = () => st.dyn.filter(o => o.gig);
  function gigClear() { st.dyn = st.dyn.filter(o => !o.gig); st.gig = null; st.gigT = 3 + Math.random() * 4; }
  function gigSpawn(kind) {
    const at = Math.floor((st.pos + PZ) / SEG) + 90 + Math.floor(Math.random() * 60);
    if (st.ramp && at > st.ramp.start - 20 && at < st.ramp.end + 10) return;
    if (lotNear(at, 30)) return;
    const food = FOOD[Math.floor(Math.random() * FOOD.length)];
    st.gig = { kind, phase:'pickup', at, food, t:0, off:0, crash:0 };
    const d = drivenCar();
    if ((kind === 'muutto' || kind === 'romu') && !C(d.c).fl.includes('V')) { // kärryn kuorma: paino näkyy ennen noutoa
      const T = TT(); let kg = T.cargo[0] + Math.random() * (T.cargo[1] - T.cargo[0]);
      if (Math.random() < 0.2) kg *= 1.35; // "pari laatikkoa vaan"
      st.gig.kg = Math.round(kg / 10) * 10; st.gig.total = T.own + st.gig.kg;
      st.gig.over = st.gig.total > Math.min(towSpec(d).kg, T.max);
    }
    st.dyn.push(kind === 'wolt' ? { k:'ravintola', z:at * SEG, x:1.75, t:food, gig:true } : kind === 'muutto' ? { k:'muutto', z:at * SEG, x:2.0, gig:true } : kind === 'romu' ? { k:'romu', z:at * SEG, x:2.0, gig:true } : { k:'asiakas', z:at * SEG, x:1.3, gig:true });
  }
  function gigBook(kind, pay) {
    S.gig = S.gig || {};
    S.gig[kind] = (S.gig[kind] || 0) + pay; S.gig[kind + 'N'] = (S.gig[kind + 'N'] || 0) + 1; ST().gig += pay; if (pay) Snd.play('coin');
    if (kind === 'muutto') { S.black += pay; if (S.trailer && !C(drivenCar().c).fl.includes('V')) S.trailer.wear++; }
    if (kind === 'romu' && S.trailer) S.trailer.wear++;
    const car = drivenCar();
    if (car) { // kuluminen per keikka
      car.base *= kind === 'wolt' ? 0.999 : kind === 'muutto' || kind === 'romu' ? 0.997 : 0.996;
      car.tire -= kind === 'wolt' ? 0.25 : kind === 'muutto' || kind === 'romu' ? 0.5 : 0.6;
      if (car.soh !== undefined) car.soh -= kind === 'wolt' ? 0.04 : 0.12;
    }
  }
  function gigUpdate(dt, z1) {
    const kinds = gigKinds(), G = st.gig;
    if (!G) {
      if (!kinds.length) return;
      st.gigT -= dt;
      if (st.gigT <= 0) { st.gigT = 3 + Math.random() * 4; gigSpawn(kinds[Math.floor(Math.random() * kinds.length)]); }
      return;
    }
    if (!kinds.includes(G.kind)) {
      gigClear();
      if (G.phase === 'pickup') return toast('Keikka peruttiin: tällä autolla sitä ei voi ajaa.');
      if (G.kind === 'muutto' || G.kind === 'romu') return toast('!Kuorma jäi kesken matkan. Asiakas ei maksa.');
      if (G.kind === 'taxi') { S.taxiStars = (S.taxiStars === undefined ? 5 : S.taxiStars) * 0.7 + 0.3; return toast('!Asiakas jäi tien varteen. Kyydistä ei makseta, ja tähtiä tuli yksi.'); }
      return toast('!Ruoka ei päässyt perille. Toimituksesta ei makseta.');
    }
    const cur = Math.floor(z1 / SEG);
    G.t += dt;
    if (G.phase === 'deliver' && (st.x < -1 || st.x > 1)) G.off += dt;
    const near = Math.abs(cur - G.at) <= STOP_WIN, stopped = st.speed < 15 * KMH && st.x > 0.25;
    if (G.kind === 'muutto' || G.kind === 'romu') { // kuorma kannetaan ja puretaan: pitää seistä kohdalla hetki
      if (near && stopped) { G.load = (G.load || 0) + dt; if (G.load < LOAD_S) return; G.load = 0; }
      else { G.load = 0; }
      if (near && stopped) return G.phase === 'pickup' ? gigPickup(G, cur) : gigFinish(G, false);
    } else if (near && stopped) return G.phase === 'pickup' ? gigPickup(G, cur) : gigFinish(G, false);
    if (cur > G.at + STOP_WIN) {
      if (G.phase === 'pickup') { gigClear(); return toast(G.kind === 'wolt' ? 'Ohitit ravintolan. Tilaus meni toiselle kuskille.' : G.kind === 'romu' ? 'Ohitit romun. Joku muu haki sen.' : G.kind === 'muutto' ? 'Ohitit muuttoasiakkaan. Hän soitti toiselle Marketplace-kuskille.' : 'Ohitit asiakkaan. Hän tilasi kilpailijan.'); }
      if (G.kind === 'wolt') { gigClear(); return toast('!Ohitit asiakkaan oven. Tilaus peruttiin, ei palkkiota.'); }
      return gigFinish(G, true);
    }
  }
  function gigPickup(G, cur) {
    st.dyn = st.dyn.filter(o => !o.gig);
    const dist = G.kind === 'wolt' ? 220 + Math.floor(Math.random() * 220) : G.kind === 'muutto' || G.kind === 'romu' ? 350 + Math.floor(Math.random() * 350) : 450 + Math.floor(Math.random() * 450);
    G.phase = 'deliver'; G.at = cur + dist; G.t = 0;
    G.limit = dist * SEG / (85 * KMH) + 6;
    const van = C(drivenCar().c).fl.includes('V');
    G.pay = G.kind === 'wolt' ? ri(12, 24) * 5 : G.kind === 'muutto' ? (van ? ri(30, 80) * 5 : Math.round((60 + G.kg * 0.25) / 5) * 5) : G.kind === 'romu' ? Math.round((100 + G.kg * 0.12) / 5) * 5 : ri(30, 80) * 5;
    if (G.kind === 'muutto' || G.kind === 'romu') G.limit = Infinity;
    // diesel ja kärry: hiukkassuodatin tukkeutuu 60 %:n todennäköisyydellä per keikka
    const dc = drivenCar();
    if (G.kg && isDiesel(dc) && !dc.dpf && !dc.dpfDel && Math.random() < 0.6) { dc.dpf = 1; refreshVehicle(); toast('!DPF-VALO! Dieselin hiukkassuodatin tukkeutui raskaan kärryn vedossa. Auto on vikatilassa: enintään 60 km/h.', 6); }
    G.dest = DEST[Math.floor(Math.random() * DEST.length)];
    if (G.kind === 'taxi' && C(drivenCar().c).fl.includes('B')) { G.pay = Math.round(G.pay * 1.6 / 5) * 5; G.big = true; } // tila-auto: isot porukat
    st.dyn.push({ k:'kohde', z:G.at * SEG, x:1.45, t: G.kind === 'wolt' ? 'TOIMITUS' : G.kind === 'muutto' ? 'PURKU' : 'KOHDE', gig:true });
    if (G.kind === 'romu') return toast(`+Romu vinssattu traileriin (${G.kg.toLocaleString('fi-FI')} kg). Vie se purkamolle, max 80 km/h.${G.over ? ' YLIPAINO: koukku ei ole tähän tehty.' : ''}`, 4);
    if (G.kind === 'muutto' && G.kg) return toast(`+Kärry täynnä: ${G.kg.toLocaleString('fi-FI')} kg sohvaa ja laatikoita. Vie ne perille, max 80 km/h.${G.over ? ' YLIPAINO!' : ''}`, 4);
    if (G.kind === 'muutto') return toast(van ? '+Paku täynnä: sohva, 40 laatikkoa ja kuntopyörä. Vie ne perille.' : '+Kärry täynnä: sohva, 40 laatikkoa ja kuntopyörä. Vie ne perille, max 80 km/h.', 4);
    toast(G.kind === 'wolt' ? `+${G.food} kyytiin. Vie se perille ennen kuin se jäähtyy.` : G.big ? `+8 hengen porukka kyytiin: "${G.dest}, ja äkkiä!" (tila-autolla isompi taksa)` : `+Asiakas kyytiin: "${G.dest}, ja äkkiä!"`, 4);
  }
  function gigFinish(G, missed) {
    const late = G.t > G.limit;
    let pay, msg;
    if ((G.kind === 'muutto' || G.kind === 'romu') && G.over && Math.random() < 0.35) {
      pay = 0; (S.post = S.post || []).push(['Poliisin punnitus: perävaunun ylikuorma (rikesakko)', 250]);
      msg = `!Poliisin punnitus! Yhdistelmä painoi ${G.total.toLocaleString('fi-FI')} kg, ja ${C(drivenCar().c).name} saa vetää vähemmän. Sakko 250 € tulee postissa, ja kuorma jäi tienvarteen.`;
    } else if (G.kind === 'romu') {
      pay = missed ? Math.round(G.pay / 2) : G.pay;
      msg = missed ? `!Ajoit purkamon ohi. Toinen purkamo maksoi vain ${eur(pay)}.` : `+Romu purkamolla: ${eur(pay)} tilille.`;
    } else if (G.kind === 'muutto') {
      pay = missed ? Math.round(G.pay / 2) : G.pay;
      msg = missed ? `!Ajoit purkupaikan ohi. Asiakas kantoi itse loppumatkan ja maksoi puolet (${eur(pay)}).` : `+Muutto valmis: ${eur(pay)} käteistä, ei kuittia.`;
    } else if (G.kind === 'wolt') {
      pay = late ? Math.round(G.pay / 2) : G.pay;
      msg = `+Toimitettu: ${eur(pay)}${late ? ' (myöhässä, puolet)' : ''}`;
    } else {
      const stars = missed ? 1 : Math.max(1, 5 - 2 * G.crash - Math.floor(G.off / 1.5) - (late ? 1 : 0));
      pay = Math.round(G.pay * (missed ? 0.5 : stars / 5));
      S.taxiStars = (S.taxiStars === undefined ? 5 : S.taxiStars) * 0.7 + stars * 0.3;
      msg = missed ? `!Ajoit kohteen ohi. Asiakas maksoi puolet (${eur(pay)}) ja antoi yhden tähden.` : `+Kyyti perillä: ${eur(pay)} · ${stars}/5 tähteä`;
    }
    gigBook(G.kind, pay);
    gigClear();
    if (G.kind === 'taxi') st.gigT *= 1 + (5 - S.taxiStars) * 0.5; // huonot tähdet = harvemmin kyytejä
    toast(msg, 4);
  }
  function gigCrash() {
    const G = st.gig;
    if (!G || G.phase !== 'deliver') return;
    if (G.kind === 'romu') { gigClear(); Q.push(() => say('ROMU LEVISI', ['!Kolarissa romu irtosi trailerista ja jäi ojaan. Purkamo ei maksa ojasta.'])); return; }
    if (G.kind === 'muutto') { gigClear(); Q.push(() => say('KUORMA LEVISI', ['!Kolarissa kuorma levisi pitkin tietä. Asiakas ei maksa, ja hänen kuntopyöränsä on nyt ojassa.'])); return; }
    if (G.kind === 'wolt') { gigClear(); Q.push(() => say('KEITTO KAATUI', ['!Tilaus levisi pitkin takapenkkiä. Toimitus peruttiin, eikä siitä makseta.'])); }
    else G.crash++;
  }
  // GPS rikki (antennit hapettuneet, korjaamatta): ei etäisyyksiä, kuski etsii kyltit itse
  const gpsDown = () => { const c = !st.veh.tsa && drivenCar(); if (c && c.gps && !(c.minor > 0)) c.gps = false; return !!(c && c.gps); };
  function gigHud() {
    const G = st.gig;
    if (!G) return null;
    const d = Math.max(0, G.at - Math.floor((st.pos + PZ) / SEG)) * 5;
    const dist = gpsDown() ? 'GPS: EI SIGNAALIA' : d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} KM` : `${d} M`;
    if (G.kind === 'muutto' || G.kind === 'romu') {
      const nm = G.kind === 'romu' ? 'ROMU' : 'MUUTTO', kg = G.kg ? ` ${G.kg.toLocaleString('fi-FI')} KG${G.over ? ' (YLIPAINO!)' : ''}` : '';
      if (G.load > 0) return `${nm}: ${G.phase === 'pickup' ? (G.kind === 'romu' ? 'VINSSATAAN' : 'KANNETAAN KUORMAA') : 'PURETAAN'}… ${Math.ceil(LOAD_S - G.load)} S`;
      return G.phase === 'pickup' ? `${nm}${kg}: ${G.kind === 'romu' ? 'NOUTO' : 'ASIAKAS'} ${dist} · PYSÄHDY KOHDALLE` : `${nm}: ${G.kind === 'romu' ? 'PURKAMO' : 'PURKUPAIKKA'} ${dist} · PYSÄHDY KOHDALLE`;
    }
    if (G.phase === 'pickup') return G.kind === 'wolt' ? `WOLT: NOUDA ${G.food} ${dist} · PYSÄHDY KOHDALLE` : `TAKSI: ASIAKAS VIITTOO ${dist} · PYSÄHDY KOHDALLE`;
    if (G.kind === 'wolt') { const left = Math.ceil(G.limit - G.t); return `WOLT: ${G.food} PERILLE ${dist} · ${left > 0 ? left + ' S' : 'MYÖHÄSSÄ'}`; }
    return `TAKSI: ${G.dest.toUpperCase()} ${dist} · ${Math.max(1, 5 - 2 * G.crash - Math.floor(G.off / 1.5))}/5 TÄHTEÄ`;
  }

  // ---------- päivitys ----------
  // ---------- ajofysiikka (alpha 35) ----------
  // Pito g: 1 = kuiva asfaltti. Se rajaa jarrutusta, liikkeellelähtöä ja ohjauksen tehoa, ja määrää, kuinka nopeasti
  // auto tottelee rattia: liukkaalla sivuttaisliike jatkuu vielä, kun ratti on jo suorassa.
  function grip() {
    const v = st.veh;
    if (v.bus) return 1;
    const sea = season();
    let g = sea.snow ? 0.75 : weather().kind === 'sade' ? 0.9 : 1;
    if (S.summer > 0 && (sea.snow || sea.bare)) g = Math.min(g, sea.snow ? 0.55 : 0.6); // kesärenkaat talvikelillä
    if (v.car && v.car.mixed) g = Math.min(g, 0.6);                                      // rengashotellin sekoittamat kiekot
    return g;
  }
  // ---------- Tesla Avustettu Ajo (alpha 40) ----------
  // Pitää kaistan, rajoituksen ja välin edellä ajavaan, mutta tekee satunnaisesti virheitä: ajautuu vastaantulijoiden kaistalle
  // tai pientareelle, haamujarruttaa tai lukee rajoituksen väärin. Peuroja, kuoppia ja liittymää se ei huomaa lainkaan.
  // Kuljettaja ottaa ohjat ohjaamalla tai jarruttamalla.
  const AP_CARS = /^Tesla (Model 3|Model S Plaid|Cybertruck)/;
  const apOK = () => !!st.veh && !st.veh.bus && AP_CARS.test(st.veh.name);
  function apOff(msg) { if (!st.auto) return; st.auto = false; st.apErr = null; Snd.play('minus'); if (msg) toast(msg, 4); }
  function apToggle() {
    if (!st.active || st.paused || !apOK()) return;
    if (st.auto) return apOff('Avustettu ajo pois.');
    if (st.speed < 20 * KMH) return toast('Avustettu ajo kytkeytyy vasta vauhdissa.', 3);
    st.auto = true; st.apErr = null; st.apT = 10 + Math.random() * 20; Snd.play('plus');
    toast('+Avustettu Ajo päällä. Seuraa tietä: auto tekee virheitä. Ohjaus tai jarru ottaa ohjat.', 6);
  }
  function autopilot(dt, pseg, fa, sp) {
    const sea = season(), hard = sea.snow || sea.dark > 0.3 || weather().kind ? 1.6 : 1; // lumella, pimeässä ja sateessa virheitä tulee useammin
    if (st.apErr) { st.apErr.t -= dt; if (st.apErr.t <= 0) st.apErr = null; }
    else if ((st.apT -= dt * hard) <= 0) {
      st.apT = 15 + Math.random() * 25;
      const r = Math.random();
      st.apErr = r < 0.3 ? { k:'left', t:3.2 } : r < 0.55 ? { k:'right', t:3.2 } : r < 0.8 ? { k:'phantom', t:0.6 } : { k:'fast', t:7 };
      ST().apErr = (ST().apErr || 0) + 1;
    }
    const e = st.apErr ? st.apErr.k : '', drift = e === 'left' || e === 'right';
    const tx = e === 'left' ? -0.6 : e === 'right' ? 1.6 : 0.5;
    const A = 2.4 * Math.min(1.2, Math.max(sp, 0.35));
    const lim = drift ? 0.28 : 1;                                             // virheessä auto ajautuu rauhallisesti, ei riuhtaise
    const want = Math.max(-1, Math.min(1, Math.max(-lim, Math.min(lim, 3.5 * (tx - st.x) - 0.6 * ((st.vx || 0) - A * sp * pseg.curve * 0.32))) + sp * pseg.curve * 0.32 / fa));
    let l = limitOf(pseg.lim); if (l === Infinity) l = 130; if (e === 'fast') l += 35;
    let tgt = Math.min(l, st.veh.vmax) * KMH;
    for (const d of st.dyn) if (d.k === 'auto' && Math.abs(d.x - st.x) < 0.3) { // väli edellä ajavaan
      const gap = d.z - (st.pos + PZ);
      if (gap > 0 && gap < 6 * SEG + st.speed * 1.4) tgt = Math.min(tgt, Math.max(0, d.v - (gap < 6 * SEG ? 10 * KMH : 0)));
    }
    return { want, brake: e === 'phantom' || st.speed > tgt + 8 * KMH ? 2 : st.speed > tgt + KMH ? 1 : 0, hold: st.speed > tgt - KMH };
  }
  const toward = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));
  function physics(dt) {
    const v = st.veh, keys = st.keys;
    const maxU = v.vmax * KMH;
    const z0 = st.pos + PZ;
    const pseg = st.testSeg || segAt(z0); // testSeg: testit ajavat keinotekoisella tiellä
    const onRamp = st.ramp && pseg.i >= st.ramp.start && pseg.i <= st.ramp.end;
    const rightEdge = onRamp ? 1 + RAMP_W : 1;
    const off = st.x < -1 || st.x > rightEdge;
    const icy = !v.bus && st.ice > 0; if (st.ice > 0) st.ice -= dt;
    if (st.scrCd > 0) st.scrCd -= dt;
    const g0 = grip(), g = g0 * (icy ? 0.3 : 1) * (off ? 0.8 : 1);
    st.grip = g;

    // avustettu ajo: kuljettajan ohjaus tai jarru ottaa ohjat
    const fa = (0.3 + 0.7 * g0) * (icy ? 0.35 : 1);
    let ap = null;
    if (st.auto) {
      if (keys.left || keys.right || keys.brake) apOff('!Otit ohjat. Avustettu ajo pois (T tai ↑ kytkee takaisin).');
      else if (!apOK()) st.auto = false;
      else ap = autopilot(dt, pseg, fa, st.speed / (160 * KMH));
    }
    const braking = !!keys.brake || !!(ap && ap.brake === 2);
    st.braking = braking || !!(ap && ap.brake === 1);

    // pituussuunta: automaattikaasu, jarru, mäki ja piennar
    const slope = v.bus ? 0 : Math.max(-0.4, Math.min(0.4, (pseg.p2.world.y - pseg.p1.world.y) / SEG));
    const towK = !v.bus && !v.tsa && towing() ? 0.85 : 1;
    if (v.bus) st.speed += (Math.min(maxU, 80 * KMH) - st.speed) * Math.min(1, dt * 0.8);
    else if (braking) st.speed -= 70 * (0.2 + 0.8 * g0) * (icy ? 0.3 : 1) * (off ? 0.8 : 1) * towK * KMH * dt;
    else if (ap && ap.brake === 1) st.speed -= 22 * KMH * dt;
    else if (!(ap && ap.hold)) st.speed += Math.min(v.acc, 30 * g) * KMH * dt * (1 - 0.6 * st.speed / maxU);
    if (!v.bus && st.speed > 0) st.speed -= slope * 12 * KMH * dt;                        // ylämäki syö vauhtia, alamäki antaa
    if (off && st.speed > (season().snow ? 30 : 45) * KMH) { st.speed -= (season().snow ? 120 : 90) * KMH * dt; st.shake = Math.max(st.shake, 0.08); }
    st.speed = Math.max(0, Math.min(maxU * (1 + 0.15 * Math.max(0, -slope)), st.speed));

    // sivusuunta: ratti kääntyy portaattomasti, auto seuraa pidon sallimalla viiveellä, kaarre työntää ulos
    const sp = st.speed / (160 * KMH);
    const want = ap ? ap.want : st.speed > 0 ? (keys.right ? 1 : 0) - (keys.left ? 1 : 0) : 0;
    st.sa = toward(st.sa || 0, want, dt * (want ? 8 : 14));
    const A = 2.4 * Math.min(1.2, Math.max(sp, st.speed > 0 ? 0.35 : 0));                // ohjauksen teho: tien puolikasta sekunnissa
    const target = st.sa * A * fa;
    st.vx = target + ((st.vx || 0) - target) * Math.exp(-(1 + 23 * g * g) * dt);
    st.slip = A > 0 ? Math.abs(target - st.vx) / A : 0;                                  // 0 = pitää, lähellä 1 = luistaa
    let dx = st.vx - A * sp * pseg.curve * 0.32;
    if (icy) dx += 0.35 * sp * Math.sin(T * 3.3);                                        // takapää elää
    if (v.minor) dx += 0.05 * sp;                                                        // korjaamaton vika vetää sivulle
    if (v.car && v.car.mixed) dx += 0.1 * sp * Math.sin(T * 1.5);                        // kolme leveää ja yksi kapea: auto vaeltaa
    st.x += dx * dt;
    if (st.testHold !== undefined) st.x = st.testHold; // testit: pidä auto sivusuunnassa paikallaan
    if (st.x < -2.6) { st.x = -2.6; st.vx = 0; } else if (st.x > 2.8) { st.x = 2.8; st.vx = 0; }
    st.skyOff += pseg.curve * sp * dt * 6;
    st.pos += st.speed * dt;
  }

  function update(dt) {
    const v = st.veh, z0 = st.pos + PZ, pseg = segAt(z0);
    physics(dt);
    const z1 = st.pos + PZ;
    ensure(Math.floor(z1 / SEG));

    // energia: akku tai tankki kuluu ajetuista kilometreistä
    const km = st.speed * dt * kmPerU();
    st.kmTot += km; ST().km += km;
    const E = eSpec();
    if (E) {
      const e = energy(E) - km * consNow(E, st.speed / KMH);
      E.obj.energy = Math.max(0, e);
      if (e <= 0.2 && !st.eWarn) { st.eWarn = 1; toast(E.ev ? '!Akku 20 %. Etsi latausasema.' : '!Tankki varalla. Etsi asema.', 4); }
      if (e > 0.3) st.eWarn = 0;
      if (e <= 0) return outOfEnergy(E);
    }
    if (st.trip) { tripUpdate(dt, km); if (!st.active || st.paused) return; }

    // peurat
    const sea = season();
    if (!v.bus && Math.random() < dt * sea.deerPerMonth / MONTH_S) spawnDeer();
    if (!v.bus && Math.random() < dt * sea.poroPerMonth / MONTH_S) spawnPoro();
    if (!v.bus && Math.random() < dt * sea.holesPerMonth / MONTH_S) spawnHazard();
    if (!v.bus && Math.random() < dt * weather().ice / MONTH_S) spawnIce();
    boardUpdate(km);
    const busy = pseg.lim === 50 || pseg.lim === 60 ? 1.6 : 1; // taajamassa enemmän liikennettä
    if (Math.random() < dt * 0.12 * busy) spawnTraffic(false);
    if (Math.random() < dt * 0.22 * busy) spawnTraffic(true);
    for (const d of st.dyn.slice()) {
      if (d.k === 'auto' || d.k === 'vasta') {
        d.z += d.v * dt;
        const rel = d.z - z1;
        if (!v.bus && d.prel > 0 && rel <= 0 && Math.abs(d.x - st.x) < 0.22) { hitTraffic(d, Math.round(Math.abs(st.speed - d.v) / KMH)); return; }
        d.prel = rel;
        if (rel < -150 || rel > DRAW * SEG * 1.2) st.dyn.splice(st.dyn.indexOf(d), 1);
        continue;
      }
      if (d.k === 'peura' || d.k === 'poro') {
        if (!d.warned && !v.bus && (d.z - z1) / SEG < 45 && Math.abs(d.x) < 1.4) { d.warned = true; Snd.play('deer'); }
        if ((d.z - z1) / SEG < d.wake || d.k === 'poro') d.x += d.vx * dt;
        if (Math.abs(d.x) > 3) { st.dyn.splice(st.dyn.indexOf(d), 1); continue; }
        if (!v.bus && d.z >= z0 && d.z < z1 + 1 && Math.abs(d.x - st.x) < 0.15 + CAR_HW) { hitDeer(d); return; }
      }
      if (d.k === 'jää' && !d.hit && !v.bus && d.z >= z0 && d.z < z1 + SEG && Math.abs(d.x - st.x) < d.w + CAR_HW) hitIce(d);
      if ((d.k === 'kuoppa' || d.k === 'kivi') && !v.bus && d.z >= z0 && d.z < z1 + 1 && Math.abs(d.x - st.x) < (d.k === 'kuoppa' ? 0.18 : 0.13) + CAR_HW) { hitHazard(d); return; }
      if (d.z < st.pos - SEG) st.dyn.splice(st.dyn.indexOf(d), 1);
    }

    if (!v.bus) {
      for (let i = Math.floor(z0 / SEG); i < Math.floor(z1 / SEG); i++) if (segs[i].sprites.some(o => o.k === 'kamera')) camera(segs[i]);
      for (let i = Math.floor(z0 / SEG); i <= Math.floor(z1 / SEG); i++) {
        const seg = segs[i];
        for (const o of seg.sprites) if (!rampHides(seg, o) && hits(o)) { crash(o); return; }
        for (const o of decorVisible(seg)) {
          if (o.k === 'pensas') { if (Math.abs(o.x - st.x) < 0.14 + CAR_HW) scratch(); }
          else if (hits(o)) { crash(o); return; }
        }
      }
      for (const d of st.dyn) if (d.k === 'kyltti' && d.z >= z0 - SEG && d.z < z1 && hits(d)) { crash(d); return; }
    }

    if (!v.bus) gigUpdate(dt, z1);
    stationUpdate(dt, z1);
    if (!v.bus) { lotUpdate(z1); if (!st.active || st.paused) return; }
    if (st.trip) return; // matkalla kuukausi ei vaihdu eikä liittymää tule

    // kuukausi ja liittymä
    st.monthT += dt;
    if (!st.ramp && st.monthT >= MONTH_S - RAMP_LEAD_S) spawnRamp();
    if (st.ramp && Math.floor(z1 / SEG) > st.ramp.end) return monthEnd(st.x > 1.02);
  }

  // ---------- piirto (alpha 34) ----------
  // Kuva on aidosti 320×200 ja C64:n 16 väriä (gfx.js). Maailma piirretään tyhjälle pinnalle (g), taivas omalleen (bg),
  // ja jälkikäsittely yhdistää ne valmiiksi kuvaksi (og): pimeässä maailman värit porrastetaan tummemmiksi valokartan mukaan.
  const { mix, veil, em, rect, trap, disc, vgrad } = Gfx, PC = Gfx.C;
  const K = {}; for (const n in PC) K[n] = mix(PC[n]);
  const KI = Gfx.HEX.map((h, i) => mix(i));
  let scr;          // koko ruutu: pelikuva ja tekstipaneelit
  let og, bg, vg, octx;   // og = valmis 320×200-kuva (pinta), octx = sama canvasina, vg = näkyvä canvas
  let T = 0;        // animaatiokello sekunteina
  let AMB = 0;      // pimeän taso 0–4
  let GP = null;    // maan ja tien värit tälle kuvalle
  const wrap = (x, span) => ((x % span) + span) % span;

  function project(p, cx, cy, cz) {
    p.camera.x = -cx; p.camera.y = p.world.y - cy; p.camera.z = p.world.z - cz;
    const s = p.screen.scale = CAMD / p.camera.z;
    p.screen.x = W / 2 + s * p.camera.x * W / 2;
    p.screen.y = H / 2 - s * p.camera.y * H / 2;
    p.screen.w = s * ROAD * W / 2;
  }
  function palette(sea) {
    const wet = weather().kind === 'sade', m = sea.m, P = {};
    if (sea.snow) { P.gA = K.white; P.gB = mix(PC.white, PC.lgrey, 3); P.verge = mix(PC.white, PC.cyan, 4); }
    else if (sea.bare) { P.gA = mix(PC.orange, PC.brown, 8); P.gB = mix(PC.brown, PC.orange, 5); P.verge = mix(PC.brown, PC.black, 4); }
    else if (sea.autumn) { P.gA = mix(PC.green, PC.orange, 6); P.gB = mix(PC.green, PC.yellow, 4); P.verge = mix(PC.green, PC.brown, 8); }
    else if (m === 3) { P.gA = mix(PC.green, PC.orange, 5); P.gB = mix(PC.green, PC.brown, 4); P.verge = mix(PC.green, PC.brown, 8); }
    else { P.gA = K.green; P.gB = mix(PC.green, PC.lgreen, 4); P.verge = mix(PC.green, PC.black, 5); }
    // pelto: oras, vilja, sänki, kynnös
    if (sea.snow) { P.fA = K.white; P.fB = mix(PC.white, PC.lgrey, 7); }
    else if (m >= 4 && m <= 6) { P.fA = mix(PC.lgreen, PC.green, 6); P.fB = K.green; }
    else if (m === 7) { P.fA = mix(PC.yellow, PC.lgreen, 5); P.fB = mix(PC.yellow, PC.orange, 6); }
    else if (m === 8) { P.fA = mix(PC.yellow, PC.orange, 6); P.fB = K.orange; }
    else { P.fA = mix(PC.orange, PC.brown, 6); P.fB = K.brown; }
    // tie: lumipolanne, märkä tai kuiva asfaltti; rut = renkaiden urat
    if (sea.snow) { P.rA = mix(PC.white, PC.lgrey, 8); P.rB = mix(PC.lgrey, PC.white, 6); P.rut = mix(PC.lgrey, PC.grey, 7); P.sh = K.white; }
    else if (wet) { P.rA = mix(PC.dgrey, PC.grey, 5); P.rB = mix(PC.dgrey, PC.grey, 2); P.rut = mix(PC.dgrey, PC.lblue, 5); P.sh = mix(PC.grey, PC.dgrey, 8); }
    else { P.rA = K.grey; P.rB = mix(PC.grey, PC.dgrey, 4); P.rut = mix(PC.grey, PC.dgrey, 9); P.sh = mix(PC.grey, PC.lgrey, 8); }
    P.haze = sea.dark > 0.6 ? -1 : sea.snow ? PC.white : sea.dark > 0 ? PC.lred : weather().kind ? PC.lgrey : PC.cyan;
    return P;
  }
  // kaistale tien poikki riveittäin: f = osuus tien puolikkaasta, erikseen lähi- (a) ja kaukoreunalle (b)
  function strip(a, b, y0, y1, fa0, fa1, fb0, fb1, q, minw) {
    const dy = a.y - b.y;
    for (let y = y0; y < y1; y++) {
      const t = (y + 0.5 - b.y) / dy, cx = b.x + (a.x - b.x) * t, w = b.w + (a.w - b.w) * t;
      let l = Math.round(cx + w * (fb0 + (fa0 - fb0) * t)), r = Math.round(cx + w * (fb1 + (fa1 - fb1) * t));
      if (l < 0) l = 0; if (r > W) r = W;
      if (r <= l) { if (!minw || l >= W || r <= 0) continue; r = l + 1; }
      rect(g, l, y, r - l, 1, q);
    }
  }
  const S2 = (a, b, y0, y1, f0, f1, q, minw) => strip(a, b, y0, y1, f0, f1, f0, f1, q, minw);
  // pellon vaot: maailman x-suuntaiset raidat, jotka suppenevat horisonttiin
  function furrows(a, b, y0, y1, q) {
    const PER = 520, dy = a.y - b.y;
    for (let y = y0; y < y1; y++) {
      const t = (y + 0.5 - b.y) / dy, cx = b.x + (a.x - b.x) * t, pw = (b.w + (a.w - b.w) * t) / ROAD * PER;
      if (pw < 2.2) continue;
      const k0 = Math.floor(-cx / pw) - 1, k1 = Math.ceil((W - cx) / pw);
      for (let k = k0; k <= k1; k++) {
        if (!(k & 1) || (k > -7 && k < 6)) continue;
        const l = Math.round(cx + k * pw), r = Math.round(cx + (k + 0.45) * pw);
        rect(g, l, y, Math.max(1, r - l), 1, q);
      }
    }
  }
  const LAKE_X = 4.7;
  function drawSeg(seg, sea, n, y0, y1) {
    const a = seg.p1.screen, b = seg.p2.screen, alt = Math.floor(seg.i / 3) % 2, P = GP, field = seg.kind === 'pelto';
    rect(g, 0, y0, W, y1 - y0, field ? P.fA : alt ? P.gB : P.gA);
    if (field) { furrows(a, b, y0, y1, P.fB); S2(a, b, y0, y1, -1.55, 1.55, alt ? P.gB : P.gA); }
    if (seg.lake) { // järvi metsän takana: kesällä sininen, talvella jäässä
      const sd = seg.lake, q = sea.snow ? (alt ? mix(PC.white, PC.cyan, 5) : mix(PC.white, PC.cyan, 8)) : alt ? mix(PC.blue, PC.lblue, 7) : mix(PC.blue, PC.lblue, 3);
      if (sd > 0) { S2(a, b, y0, y1, LAKE_X, 80, q); S2(a, b, y0, y1, LAKE_X - 0.18, LAKE_X, sea.snow ? K.lgrey : mix(PC.green, PC.black, 9)); }
      else { S2(a, b, y0, y1, -80, -LAKE_X, q); S2(a, b, y0, y1, -LAKE_X, -LAKE_X + 0.18, sea.snow ? K.lgrey : mix(PC.green, PC.black, 9)); }
    }
    const road = alt ? P.rB : P.rA, wide = a.w > 16;
    S2(a, b, y0, y1, -1.2, 1.2, P.verge);
    S2(a, b, y0, y1, -1.07, 1.07, P.sh);
    const ramp = st.ramp, onR = ramp && seg.i >= ramp.start && seg.i <= ramp.end;
    if (onR) {
      const k1 = Math.min(1, (seg.i - ramp.start) / 10), k2 = Math.min(1, (seg.i + 1 - ramp.start) / 10);
      strip(a, b, y0, y1, 0.9, 1.07 + RAMP_W * k1, 0.9, 1.07 + RAMP_W * k2, P.sh);
      strip(a, b, y0, y1, 0.9, 1 + RAMP_W * k1, 0.9, 1 + RAMP_W * k2, road);
      if (!sea.snow || alt) strip(a, b, y0, y1, 0.96 + RAMP_W * k1, 1 + RAMP_W * k1, 0.96 + RAMP_W * k2, 1 + RAMP_W * k2, K.white);
    }
    S2(a, b, y0, y1, -1, 1, road, true);
    if (wide) for (const f of [-0.73, -0.27, 0.27, 0.73]) S2(a, b, y0, y1, f - 0.075, f + 0.075, P.rut);
    if (onR && alt) S2(a, b, y0, y1, 0.96, 1.0, K.white);
    if (!sea.snow) {
      S2(a, b, y0, y1, -0.97, -0.93, K.white, wide);
      if (!onR) S2(a, b, y0, y1, 0.93, 0.97, K.white, wide);
      if (Math.abs(seg.curve) >= 3) { S2(a, b, y0, y1, -0.045, -0.012, K.white, wide); S2(a, b, y0, y1, 0.012, 0.045, K.white); } // sulkuviiva mutkassa
      else if (Math.floor(seg.i / 4) % 2) S2(a, b, y0, y1, -0.022, 0.022, K.white, wide);
    } else if (wide && alt) { S2(a, b, y0, y1, -0.03, 0.03, K.white); S2(a, b, y0, y1, -1.0, -0.9, K.white); if (!onR) S2(a, b, y0, y1, 0.9, 1.0, K.white); }
    if (P.haze >= 0 && n > 60) rect(g, 0, y0, W, y1 - y0, veil(P.haze, Math.min(9, (n - 60) / 9))); // kaukana maisema haalistuu
  }

  // taivas: liukuväri rasteroituna, aurinko tai kuu, pilvet, revontulet, vaarat ja metsänreuna
  function drawSky(sea) {
    const b = bg, d = sea.dark, night = d > 0.6, dusk = d > 0 && !night, over = !!weather().kind, base = 110, off = st.skyOff;
    const stops = night ? [0, 0, 0, 6] : dusk ? [6, 4, 10, 7] : over ? [12, 15, 15, 1] : sea.snow ? [14, 3, 1, 1] : sea.autumn || sea.bare ? [14, 3, 3, 15] : [14, 14, 3, 1];
    vgrad(b, 0, 0, W, base, stops);
    if (night) {
      for (let i = 0; i < 80; i++) {
        if (hash(i * 31 + Math.floor(T * 2.5 + i)) < 0.07) continue; // tuike
        rect(b, wrap(hash(i) * W - off * 2, W) | 0, (24 + hash(i + 99) * 70) | 0, 1, 1, KI[i % 9 === 0 ? PC.yellow : i % 5 === 0 ? PC.lblue : i % 3 === 0 ? PC.lgrey : PC.white]);
      }
      const mx = wrap(70 - off * 2, W + 40) - 20, ph = S.m % 4;
      disc(b, mx, 40, 7, 7, K.white); rect(b, mx - 3, 38, 2, 2, K.lgrey); rect(b, mx + 1, 42, 3, 2, K.lgrey); rect(b, mx + 2, 36, 1, 1, K.lgrey);
      if (ph) disc(b, mx + (ph === 1 ? 5 : ph === 2 ? -5 : 3), 40, 7, 7, K.black);
      if (sea.lap || (sea.temp <= -3 && rr(S.m, 70) < 0.7)) { // revontulet
        for (let x = 0; x < W; x += 2) for (let i = 0; i < 2; i++) {
          const u = x + off * 3, yb = 44 + i * 22 + Math.sin(u * 0.031 + T * 0.25 + i * 2) * 9 + Math.sin(u * 0.083 - T * 0.4) * 4;
          const h = 16 + 11 * Math.sin(u * 0.12 + T * 0.7 + i * 1.7) + 5 * Math.sin(u * 0.41 + T * 1.3), a = 0.5 + 0.5 * Math.sin(u * 0.02 + T * 0.2 + i);
          if (h < 6 || a < 0.25) continue;
          rect(b, x, (yb - h) | 0, 2, (h * 0.55) | 0, veil(i ? PC.cyan : PC.green, 3 + a * 3));
          rect(b, x, (yb - h * 0.45) | 0, 2, (h * 0.45) | 0, veil(PC.green, 6 + a * 6));
          rect(b, x, (yb - 3) | 0, 2, 3, veil(PC.lgreen, 5 + a * 9));
        }
      }
    } else if (!over) {
      const sx = wrap(236 - off * 3, W + 60) - 30;
      if (dusk) { disc(b, sx, base - 13, 13, 13, K.yellow); disc(b, sx, base - 13, 9, 9, K.white); rect(b, sx - 14, base - 9, 28, 1, K.lred); rect(b, sx - 14, base - 5, 28, 2, K.lred); }
      else { const sy = sea.snow ? 70 : sea.autumn || sea.bare ? 58 : 44; disc(b, sx, sy, 10, 10, veil(PC.yellow, 6)); disc(b, sx, sy, 7, 7, K.yellow); disc(b, sx - 1, sy - 1, 4, 4, K.white); }
    }
    // pilvet: litteäpohjaiset kumpupilvet, pilvisellä säällä harmaita lauttoja
    if (!night || over) {
      const cn = over ? 11 : 6, top = dusk ? K.lred : over ? K.lgrey : K.white, bot = night ? K.dgrey : dusk ? K.purple : over ? K.grey : mix(PC.lgrey, PC.white, 6);
      for (let i = 0; i < cn; i++) {
        const cw = (over ? 34 : 20) + hash(i + 300) * 26, cx = wrap(hash(i + 310) * (W + 120) - off * 4 + T * (1 + hash(i + 320)), W + 120) - 60, cy = 34 + hash(i + 330) * (over ? 52 : 34);
        const ch = cw * 0.26;
        disc(b, cx, cy + 2, cw, ch, bot, cy + 3); disc(b, cx + cw * 0.45, cy + 2, cw * 0.6, ch * 0.8, bot, cy + 3); disc(b, cx - cw * 0.5, cy + 2, cw * 0.55, ch * 0.7, bot, cy + 3);
        if (!night) { disc(b, cx, cy, cw * 0.9, ch, top, cy + 1); disc(b, cx + cw * 0.45, cy, cw * 0.5, ch * 0.75, top, cy + 1); disc(b, cx - cw * 0.5, cy, cw * 0.45, ch * 0.62, top, cy + 1); }
      }
    }
    // kaukaiset vaarat ja metsänreuna: kaksi parallaksikerrosta
    const hillC = night ? mix(PC.black, PC.blue, 8) : dusk ? mix(PC.blue, PC.purple, 7) : sea.snow ? mix(PC.lblue, PC.white, 7) : mix(PC.lblue, PC.cyan, 5);
    const treeC = night ? K.black : dusk ? mix(PC.black, PC.blue, 4) : sea.snow ? mix(PC.dgrey, PC.white, 6) : mix(PC.black, PC.green, 7);
    const o1 = off * 4, o2 = off * 8;
    for (let x = 0; x < W; x++) { const u = x + o1, h = 9 + 7 * Math.sin(u * 0.017) + 4 * Math.sin(u * 0.043 + 1) + 2 * Math.sin(u * 0.11 + 2); rect(b, x, (base - 6 - h) | 0, 1, 30, hillC); }
    for (let x = 0; x < W; x++) {
      const u = x + o2, k = Math.floor(u / 5), dx = Math.abs(u - k * 5 - 2.5), hk = 5 + hash(((k % 4096) + 4096) % 4096) * 11;
      const h = 4 + 2 * Math.sin(u * 0.03) + Math.max(0, hk * (1 - dx / 3));
      rect(b, x, (base - h) | 0, 1, 40, treeC);
    }
    rect(b, 0, base + 2, W, H - base - 2, GP.gA);
    if (GP.haze >= 0) rect(b, 0, base + 2, W, H - base - 2, veil(GP.haze, 8));
  }

  // tien varren koristeet: pensaat, kivet, lupiinit, heinäpaalit, sähkölinja, katuvalot ja aurausviitat. Sähköpylvääseen, katuvaloon ja kivenlohkareeseen voi törmätä, pensas naarmuttaa; paalien, kukkien ja aurausviittojen läpi pääsee vahingoitta.
  function decorOf(seg) {
    if (seg.decor) return seg.decor;
    const n = seg.i, d = seg.decor = [], kind = seg.kind, sd = rr(n, 50) < 0.5 ? -1 : 1;
    if (kind === 'pelto') {
      if (n % 14 === 0) d.push({ k:'pylväs', x:-2.35 });
      if (rr(n, 57) < 0.07) d.push({ k:'paali', x: sd * (2.9 + rr(n, 58) * 3) });
      if (rr(n, 59) < 0.2) d.push({ k:'lupiini', x: sd * (1.24 + rr(n, 56) * 0.25) });
    } else if (kind === 'kylä') {
      if (n % 16 === 0) d.push({ k:'lamppu', x:-1.38 });
      if (rr(n, 60) < 0.18) d.push({ k:'pensas', x: sd * (1.7 + rr(n, 61) * 1.5) });
    } else {
      if (rr(n, 51) < 0.2) d.push({ k:'pensas', x: sd * (1.4 + rr(n, 52) * 1.2) });
      if (rr(n, 53) < 0.06) d.push({ k:'lohkare', x: -sd * (1.6 + rr(n, 54) * 1.5) });
      if (rr(n, 55) < 0.3) d.push({ k:'lupiini', x: sd * (1.24 + rr(n, 56) * 0.25) });
    }
    if (n % 6 === 3) d.push({ k:'viitta', x:1.14 }, { k:'viitta', x:-1.14 });
    return d;
  }

  // koristeet, jotka ovat oikeasti paikalla: liittymän, asemien, liikkeiden ja kylttien kohdalta ne on raivattu
  function decorVisible(seg) {
    const d = decorOf(seg);
    if (!d.length) return d;
    return d.filter(o => !rampHides(seg, o) && !st.dyn.some(c => CLEARS.includes(c.k) && Math.sign(c.x) === Math.sign(o.x) && seg.i >= Math.floor(c.z / SEG) - 14 && seg.i <= Math.floor(c.z / SEG) + 3));
  }
  // spritet: cx = keskikohta, by = alareuna, s = pikseliä per maailman yksikkö, clipY = mäen harjan rivi
  function sprite(o, cx, by, s, sea, n, clipY) {
    const X = v => Math.round(cx + v * s), Y = v => Math.round(by - v * s);
    const P = (x, y, w, h, q) => { let x0 = X(x), x1 = X(x + w), y1 = Y(y), y0 = Y(y + h); if (x1 <= x0) x1 = x0 + 1; if (y1 <= y0) y0 = y1 - 1; if (y0 < clipY && y1 > 0) rect(g, x0, y0, x1 - x0, y1 - y0, q); };
    const F = (x, y, w, h, q) => { if (w * s >= 0.6 && h * s >= 0.6) P(x, y, w, h, q); }; // yksityiskohta, joka jää pois pienenä
    const tri = (xl, xr, yb, xt, yt, q) => trap(g, Y(yt), X(xt) - 0.5, X(xt) + 0.5, Y(yb), X(xl), X(xr), q, clipY);
    const tz = (yb, xl0, xr0, yt, xl1, xr1, q) => trap(g, Y(yt), X(xl1), X(xr1), Y(yb), X(xl0), X(xr0), q, clipY);
    const D = (x, y, rx, ry, q) => disc(g, X(x), Y(y), rx * s, ry * s, q, clipY);
    const L = (x0, y0, x1, y1, q) => Gfx.line(g, X(x0), Y(y0), X(x1), Y(y1), q);
    const night = sea.dark > 0.3, E = i => (night ? em(i) : KI[i]);
    const big = s * 1000, hv = (Math.abs(o.x) * 977.3) % 1;
    const label = (txt, x0, x1, yTop, yBot, q) => Gfx.fit(g, txt, (X(x0) + X(x1)) / 2, Y(yTop), X(x1) - X(x0), Y(yBot) - Y(yTop), q);
    const dkG = mix(PC.black, PC.green, 7), mdG = mix(PC.green, PC.black, 5);
    switch (o.k) {
      case 'kuusi': {
        const z = 0.8 + ((hv * 7) % 1) * 0.45;
        if (hv < 0.22 && !sea.lap) { // mänty: pitkä punaruskea runko ja latvus ylhäällä
          const h = 3200 * z;
          P(-60 * z, 0, 120 * z, h * 0.45, mix(PC.brown, PC.dgrey, 8)); P(-50 * z, h * 0.45, 100 * z, h * 0.36, mix(PC.orange, PC.brown, 5));
          F(60 * z, h * 0.58, 240 * z, 45 * z, K.brown); F(-260 * z, h * 0.66, 220 * z, 45 * z, K.brown);
          D(0, h * 0.86, 620 * z, 400 * z, dkG); D(-380 * z, h * 0.78, 420 * z, 280 * z, dkG); D(400 * z, h * 0.8, 440 * z, 290 * z, dkG);
          if (big >= 5) { const c = sea.snow ? K.white : mdG; D(-150 * z, h * 0.9, 420 * z, 230 * z, c); D(-430 * z, h * 0.81, 250 * z, 150 * z, c); D(330 * z, h * 0.84, 250 * z, 140 * z, c); }
          break;
        }
        P(-80 * z, 0, 160 * z, 500 * z, K.brown);
        if (big < 5) { tri(-700 * z, 700 * z, 300 * z, 0, 3300 * z, sea.snow ? mix(PC.dgrey, PC.white, 7) : dkG); break; }
        for (let i = 0; i < 5; i++) {
          const yb = (330 + i * 540) * z, yt = yb + (i === 4 ? 820 : 980) * z, wb = (780 - i * 135) * z;
          tri(-wb, wb, yb, 0, yt, dkG);
          tri(-wb * 0.92, 0, yb + 40 * z, -wb * 0.04, yt - 60 * z, sea.snow ? K.white : mdG);          // valon puoli
          if (sea.snow) tri(wb * 0.1, wb * 0.8, yb + 160 * z, wb * 0.12, yt - 260 * z, veil(PC.white, 6));
          else if (big >= 14) tri(-wb * 0.8, -wb * 0.3, yb + 60 * z, -wb * 0.3, yb + 420 * z, veil(PC.lgreen, 4));
        }
        break; }
      case 'koivu': {
        const z = 0.85 + ((hv * 5) % 1) * 0.35, leaf = !sea.snow && !sea.bare;
        P(-55 * z, 0, 110 * z, 2500 * z, K.white); F(15 * z, 0, 40 * z, 2500 * z, K.lgrey);
        for (let i = 0; i < 6; i++) F(-55 * z, (260 + i * 370) * z, (50 + (i % 2) * 40) * z, 60 * z, K.black);
        if (leaf) {
          const c0 = sea.autumn ? K.orange : mdG, c1 = sea.autumn ? mix(PC.yellow, PC.orange, 5) : mix(PC.green, PC.lgreen, 7), c2 = sea.autumn ? K.yellow : K.lgreen;
          D(0, 2350 * z, 650 * z, 620 * z, c0); D(-330 * z, 2000 * z, 430 * z, 380 * z, c0); D(350 * z, 2050 * z, 430 * z, 400 * z, c0);
          if (big >= 4) { D(-80 * z, 2470 * z, 520 * z, 450 * z, c1); D(-380 * z, 2100 * z, 300 * z, 250 * z, c1); D(300 * z, 2200 * z, 290 * z, 250 * z, c1); }
          if (big >= 9) { D(-200 * z, 2640 * z, 280 * z, 200 * z, c2); D(-420 * z, 2180 * z, 150 * z, 110 * z, c2); D(250 * z, 2300 * z, 150 * z, 110 * z, c2); }
        } else {
          const br = sea.snow ? K.lgrey : mix(PC.brown, PC.dgrey, 8);
          for (let i = 0; i < 6; i++) { const y0 = (1250 + i * 230) * z, dx = (520 - i * 60) * z * (i % 2 ? 1 : -1); L(0, y0, dx, y0 + 420 * z, br); if (big >= 8) L(dx * 0.6, y0 + 250 * z, dx * 1.1, y0 + 300 * z, br); }
          L(0, 2400 * z, 0, 2900 * z, br);
          if (sea.snow && big >= 6) D(0, 2300 * z, 520 * z, 600 * z, veil(PC.white, 3));
        }
        break; }
      case 'mökki': {
        const roof = sea.snow ? K.white : mix(PC.dgrey, PC.black, 6), win = night ? E(PC.yellow) : K.cyan;
        P(-1250, 0, 2500, 130, K.grey);
        P(-1200, 110, 2400, 1200, K.red);
        if (big >= 9) for (let x = -1050; x < 1100; x += 220) F(x, 110, 30, 1200, mix(PC.red, PC.brown, 9));
        P(-1200, 110, 110, 1200, K.white); P(1090, 110, 110, 1200, K.white);
        F(-1420, 1270, 2840, 70, K.black);
        tz(1310, -1420, 1420, 1980, -1180, 1180, roof); if (!sea.snow) F(-1180, 1940, 2360, 50, K.dgrey);
        P(460, 1800, 240, 430, mix(PC.red, PC.brown, 8)); F(430, 2200, 300, 60, sea.snow ? K.white : K.dgrey);
        if (sea.snow || sea.temp < 4) for (let i = 0; i < 3; i++) { const ph = (T * 0.5 + i / 3) % 1; D(580 + ph * 260 + Math.sin(T + i) * 40, 2330 + ph * 900, 110 + ph * 160, 80 + ph * 110, veil(PC.lgrey, 9 - ph * 7)); } // savu
        for (const wx of [-760, 300]) { P(wx, 520, 460, 470, K.white); P(wx + 40, 560, 380, 390, win); F(wx + 215, 560, 30, 390, K.white); F(wx + 40, 740, 380, 30, K.white); }
        P(-170, 110, 340, 800, K.white); P(-130, 110, 260, 760, K.dgrey); F(60, 430, 40, 60, K.yellow);
        if (night) Gfx.glow(cx, by + 2, 1500 * s, 420 * s, 0.5);
        const side = Math.sign(o.x), hh = Math.abs(Math.round(o.x * 1000)) % 7;
        if (hh < 4) Cars.rear(g, Cars.MODELS[(hh * 11 + Math.abs(Math.round(o.x * 100))) % 26][1], X(side * 1800), by, s * 6.25, { world:true, night: sea.dark, snow: sea.snow }); // auto pihassa
        if (hh >= 3 && !sea.snow && !night && big >= 4) { const fx = -side * 1650; P(fx - 25, 0, 50, 2900, K.white); P(fx + 25, 2330, 640, 430, K.white); F(fx + 25, 2500, 640, 90, K.blue); F(fx + 200, 2330, 100, 430, K.blue); } // lippu salossa
        break; }
      case 'lato': {
        const red = hv < 0.5, wall = red ? mix(PC.red, PC.brown, 5) : mix(PC.grey, PC.dgrey, 8);
        P(-1600, 0, 3200, 1500, wall);
        if (big >= 6) for (let x = -1500; x < 1600; x += 260) F(x, 0, 40, 1500, red ? K.brown : K.dgrey);
        P(-380, 0, 760, 1000, K.black); F(-380, 1000, 760, 60, red ? K.white : K.dgrey);
        F(-1800, 1460, 3600, 60, K.black);
        tz(1500, -1800, 1800, 2250, -1350, 1350, sea.snow ? K.white : mix(PC.dgrey, PC.brown, 6));
        break; }
      case 'tolppa':
        P(-35, 0, 70, 900, K.white); P(-35, 560, 70, 170, K.black);
        if (o.x > 0) F(-25, 600, 50, 90, E(PC.white)); else { F(-25, 570, 50, 60, E(PC.white)); F(-25, 660, 50, 60, E(PC.white)); }
        break;
      case 'kyltti': {
        P(-60, 0, 120, 1200, K.grey); P(1040, 0, 120, 1200, K.grey);
        P(-1300, 1100, 2600, 1300, night ? E(PC.lgrey) : K.white); P(-1240, 1160, 2480, 1180, K.blue);
        const tc = night ? E(PC.white) : K.white;
        if (o.s) { label(o.t, -1180, 1180, 2290, 1780, tc); label(o.s, -1180, 1180, 1700, 1260, tc); } else label(o.t, -1180, 1180, 2200, 1300, tc);
        break; }
      case 'ravintola': {
        P(-60, 0, 120, 1000, K.grey);
        P(-1000, 900, 2000, 900, K.white); P(-940, 960, 1880, 780, K.red);
        label(o.t, -900, 900, 1680, 1020, night ? E(PC.white) : K.white);
        F(-1000, 1800, 2000, 50, night ? E(PC.yellow) : K.lgrey);
        if (night) Gfx.glow(cx, Y(1300), 1300 * s, 700 * s, 0.9);
        break; }
      case 'asiakas': {
        const wave = Math.floor(T * 4) % 2;
        P(-120, 0, 95, 520, K.dgrey); P(30, 0, 95, 520, K.dgrey); F(-150, 0, 130, 70, K.black); F(30, 0, 130, 70, K.black);
        P(-175, 480, 350, 520, K.lblue); F(-175, 480, 350, 60, K.blue); F(-20, 480, 40, 520, K.blue);
        P(-110, 1000, 220, 210, K.lred); F(-110, 1000, 220, 50, K.red);                       // kaulaliina ja kasvot
        P(-125, 1160, 250, 90, K.brown); F(-40, 1250, 80, 50, K.brown);                        // pipo
        P(170, 880 + wave * 160, 85, 420, K.lblue); F(165, 1280 + wave * 160, 95, 80, K.lred); // heiluva käsi
        P(-260, 0, 150, 330, K.orange); F(-230, 330, 90, 50, K.brown);                         // laukku
        if (big >= 9) { const sz = Math.min(2, Math.max(1, Math.floor(s * 110))); Gfx.text(g, 'TAKSI!', cx, Y(1500) - 5 * sz, sz, E(PC.yellow), 0.5); }
        break; }
      case 'muutto': {
        P(-1300, 0, 2600, 1500, mix(PC.yellow, PC.orange, 5)); P(-1300, 0, 120, 1500, K.white); P(1180, 0, 120, 1500, K.white);
        F(-1500, 1460, 3000, 60, K.black);
        tz(1500, -1500, 1500, 2250, -1200, 1200, sea.snow ? K.white : mix(PC.dgrey, PC.black, 6));
        for (const wx of [-760, 300]) { P(wx, 560, 460, 470, K.white); P(wx + 40, 600, 380, 390, night ? E(PC.yellow) : K.cyan); }
        P(-130, 0, 260, 860, K.brown);
        P(-1750, 0, 320, 310, K.orange); F(-1750, 150, 320, 30, K.brown); P(-1690, 310, 260, 260, mix(PC.orange, PC.yellow, 6)); P(-1380, 0, 290, 290, K.orange); // laatikot
        P(1400, 0, 720, 260, K.red); P(1400, 260, 130, 210, K.red); P(1990, 260, 130, 210, K.red);                                                                // sohva
        if (big >= 6) { const sz = Math.min(3, Math.max(1, Math.floor(s * 130))); Gfx.text(g, 'MUUTTO', cx, Y(2400) - 5 * sz, sz, E(PC.yellow), 0.5); }
        break; }
      case 'kohde': {
        const blink = Math.floor(T * 3.3) % 2;
        P(-40, 0, 80, 1700, K.yellow);
        P(40, 1300, 620, 400, blink ? E(PC.lred) : E(PC.yellow)); F(40, 1300, 620, 60, K.black); F(40, 1640, 620, 60, K.black);
        if (big >= 6) { const sz = Math.min(2, Math.max(1, Math.floor(s * 110))); Gfx.text(g, o.t, cx, Y(1800) - 5 * sz, sz, E(PC.white), 0.5); }
        break; }
      case 'raja': {
        P(-35, 0, 70, 1000, K.lgrey);
        D(0, 1340, 390, 390, night ? E(PC.lred) : K.red); D(0, 1340, 280, 280, night ? E(PC.white) : K.white);
        const txt = limTxt(limitOf(o.lim)), sz = Math.min(Math.floor(s * 440 / Gfx.textW(txt, 1)), Math.floor(s * 330 / 5));
        if (sz >= 1) Gfx.text(g, txt, cx, Y(1340) - Math.floor(sz * 2.5), sz, K.black, 0.5);
        break; }
      case 'valvonta': {
        P(-35, 0, 70, 1000, K.lgrey);
        P(-390, 1000, 780, 720, night ? E(PC.lgrey) : K.white); P(-340, 1050, 680, 620, K.blue);
        F(-200, 1220, 320, 220, K.white); F(120, 1280, 90, 100, K.white); F(-90, 1280, 110, 110, K.blue); F(-60, 1440, 100, 60, K.white);
        break; }
      case 'kamera': {
        P(-90, 0, 180, 1900, K.grey); F(30, 0, 60, 1900, K.dgrey);
        P(-270, 1900, 540, 920, K.lgrey); P(-270, 2760, 540, 60, K.yellow); P(-270, 1900, 540, 60, K.yellow);
        P(-190, 2140, 380, 380, K.black); F(-100, 2230, 200, 200, st.flash > 0.3 ? E(PC.white) : K.blue); F(-190, 2580, 120, 80, K.dgrey);
        break; }
      case 'auto': case 'vasta': {
        const sp = o.heavy ? { b: o.heavy === 'bus' ? 'bus' : 'lorry', c: o.heavy === 'bus' ? '#ECECEC' : o.col, dest: o.dest } : o.spec || Cars.MODELS[0][1];
        const opt = { world:true, night: sea.dark, snow: sea.snow, anim: Math.floor(T * 18) };
        if (o.k === 'auto') Cars.rear(g, sp, cx, by, s * 6.25, opt);
        else {
          Cars.front(g, sp, cx, by, s * 6.25, opt);
          if (night) { Gfx.glow(cx, by + 260 * s + 1, 620 * s + 3, 230 * s + 2, 0.95); Gfx.glow(cx, by - 120 * s, 420 * s + 4, 200 * s + 3, 0.6); } // ajovalot valaisevat tien
        }
        break; }
      case 'kuoppa': {
        const rim = sea.snow ? K.lgrey : mix(PC.grey, PC.lgrey, 8), c = K.black;
        P(-420, -20, 840, 110, rim); P(-340, 90, 680, 30, rim);
        P(-360, 0, 720, 80, c); P(-280, 80, 560, 25, c);
        if (!sea.snow) F(-180, 15, 300, 35, mix(PC.blue, PC.lblue, 6));
        break; }
      case 'kivi': {
        tz(0, -270, 270, 170, -200, 200, K.dgrey); tz(170, -200, 200, 290, -90, 110, K.grey);
        F(-170, 150, 120, 60, K.lgrey); F(-60, 60, 60, 40, K.black); if (sea.snow) F(-150, 260, 260, 50, K.white);
        break; }
      case 'asema': { // lataus- ja huoltoasema (bränditön): katos, laturit ja bensamittari
        const ev = st.veh && eSpec() && eSpec().ev;
        P(-1400, 0, 140, 1800, K.lgrey); P(1260, 0, 140, 1800, K.lgrey); F(-1300, 0, 40, 1800, K.grey); F(1360, 0, 40, 1800, K.grey);
        P(-1650, 1800, 3300, 400, K.white); P(-1650, 1800, 3300, 110, K.green); F(-1650, 2170, 3300, 40, K.lgrey);
        F(-1500, 1750, 3000, 50, night ? E(PC.white) : K.grey);
        if (night) Gfx.glow(cx, Y(500), 1900 * s, 1300 * s, 0.95);
        for (const x0 of [-450, 50]) { P(x0, 0, 330, 950, K.white); F(x0, 0, 330, 80, K.dgrey); F(x0 + 50, 540, 230, 280, o.broken ? K.black : E(PC.cyan)); F(x0 + 290, 250, 70, 420, K.black); F(x0 + 30, 880, 270, 70, o.broken ? K.dgrey : K.green); }
        P(760, 0, 320, 720, K.red); F(820, 430, 200, 170, K.white); F(790, 720, 260, 60, K.dgrey); F(1080, 200, 50, 360, K.black);
        label(`ASEMA · LATAUS ${o.kw} KW`, -1560, 1560, 2160, 1930, K.black);
        if (o.broken && ev && big >= 3) label('LATURI RIKKI', -700, 700, 1560, 1100, E(PC.lred));
        break; }
      case 'romu': {
        const r1 = mix(PC.orange, PC.brown, 8), r2 = K.orange;
        P(-1300, 0, 2600, 520, r1); tz(520, -900, 800, 940, -700, 600, r2); F(-700, 580, 600, 300, K.black); F(100, 580, 500, 300, K.black);
        P(-1100, 0, 420, 260, K.black); P(700, 0, 420, 260, K.black); F(-500, 200, 300, 120, K.brown); F(-1300, 380, 300, 100, K.lgrey); F(300, 300, 500, 60, K.brown);
        if (big >= 6) { const sz = Math.min(3, Math.max(1, Math.floor(s * 130))); Gfx.text(g, 'ROMU', cx, Y(1100) - 5 * sz, sz, E(PC.yellow), 0.5); }
        break; }
      case 'mainos': { // mainostaulu: valaistu pimeällä
        P(-1700, 0, 160, 1400, K.dgrey); P(1540, 0, 160, 1400, K.dgrey); F(-1700, 700, 3400, 60, K.dgrey);
        P(-2350, 1300, 4700, 1600, K.white); P(-2250, 1380, 4500, 1440, o.hot ? K.red : K.blue);
        F(-2350, 1240, 4700, 60, K.grey);
        if (night) { for (const lx of [-1700, -570, 570, 1700]) F(lx - 90, 2900, 180, 70, E(PC.yellow)); Gfx.glow(cx, Y(2100), 2600 * s, 1100 * s, 1); }
        label(o.t, -2150, 2150, 2740, 2060, K.yellow);
        label(o.s, -2150, 2150, 1960, 1480, K.white);
        break; }
      case 'liike': { // autoliike: lasinen näyttelytila, liput ja autot pihassa
        P(-2300, 0, 50, 2700, K.lgrey); P(-2250, 2250, 540, 340, K.yellow); F(-2250, 2250, 540, 60, K.orange);
        P(2250, 0, 50, 2700, K.lgrey); P(2300, 2250, 540, 340, K.lblue); F(2300, 2250, 540, 60, K.blue);
        P(-1800, 0, 3600, 1700, K.lgrey); P(-1650, 120, 3300, 1250, night ? E(PC.yellow) : mix(PC.lblue, PC.cyan, 6));
        if (!night) F(-1650, 1000, 3300, 370, veil(PC.white, 5));
        for (const x0 of [-1100, -400, 300, 1000]) P(x0, 120, 60, 1250, K.dgrey);
        P(-1900, 1700, 3800, 400, K.red); F(-1900, 2060, 3800, 40, K.lred);
        label(o.used ? 'KÄYTY' : 'AUTOLIIKE', -1750, 1750, 2020, 1760, night ? E(PC.white) : K.white);
        if (night) Gfx.glow(cx, by, 2600 * s, 700 * s, 0.9);
        const lot = Math.abs(Math.round(o.z / SEG));
        Cars.front(g, Cars.MODELS[23 + lot % 20][1], X(-880), by, s * 5.6, { world:true, night: 0 });
        Cars.front(g, Cars.MODELS[9 + lot % 13][1], X(960), by, s * 5.6, { world:true, night: 0 });
        break; }
      case 'jää':
        P(-o.w * 2000, -10, o.w * 4000, 50, veil(sea.snow ? PC.cyan : PC.lblue, 9));
        F(-o.w * 1200, 18, o.w * 1400, 18, veil(PC.white, 11));
        break;
      case 'penkka':
        tz(0, -560, 560, 300, -330, 330, K.white); F(-560, 0, 1120, 50, mix(PC.white, PC.cyan, 7)); F(120, 60, 300, 160, veil(PC.lgrey, 5));
        break;
      case 'poro': case 'peura': {
        const poro = o.k === 'poro', f = o.vx < 0 ? -1 : 1, run = o.vx && !o.dead ? Math.floor(T * 9) % 2 : 0;
        const c = poro ? mix(PC.grey, PC.brown, 6) : K.orange, c2 = poro ? K.lgrey : mix(PC.orange, PC.brown, 8), horn = poro ? K.lgrey : K.brown;
        const zz = 0.85, R2 = (x, y, w, h, q) => P((f > 0 ? x : -x - w) * zz, y * zz, w * zz, h * zz, q), R2f = (x, y, w, h, q) => F((f > 0 ? x : -x - w) * zz, y * zz, w * zz, h * zz, q);
        const l1 = run ? 60 : 0, l2 = run ? -60 : 0;
        R2(-270 + l1, 0, 60, 420, c2); R2(210 + l2, 0, 60, 420, c2); R2(-190 + l2, 0, 55, 420, c); R2(140 + l1, 0, 55, 420, c);   // jalat
        R2(-310, 380, 620, 270, c); R2f(-310, 380, 620, 70, poro ? K.white : c2); R2f(-250, 600, 480, 50, c2);                  // runko
        R2(210, 560, 130, 270, poro ? K.white : c); R2(230, 780, 210, 130, c); R2f(400, 790, 60, 60, K.black);                  // kaula, pää ja kuono
        R2f(215, 900, 50, 80, c2); R2f(-360, 520, 70, 110, K.white);                                                           // korva ja häntä
        R2f(240, 900, 30, 250, horn); R2f(330, 900, 30, 210, horn); R2f(180, 1120, 150, 30, horn); R2f(330, 1090, 130, 30, horn); if (poro) { R2f(150, 1000, 100, 30, horn); R2f(360, 1000, 110, 30, horn); }
        if (night && n < 90) { R2f(300, 850, 45, 40, em(PC.yellow)); R2f(390, 850, 45, 40, em(PC.yellow)); } // silmät heijastavat
        break; }
      // --- koristeet ---
      case 'pensas': {
        if (sea.bare || sea.snow) { const br = sea.snow ? K.lgrey : K.brown; for (let i = -2; i <= 2; i++) L(i * 60, 0, i * 170, 420 - Math.abs(i) * 60, br); if (sea.snow) D(0, 120, 330, 130, K.white); break; }
        const c0 = sea.autumn ? mix(PC.orange, PC.brown, 6) : dkG, c1 = sea.autumn ? mix(PC.orange, PC.yellow, 5) : mdG;
        D(0, 230, 400, 250, c0); D(-110, 300, 250, 160, c1); if (big >= 12) D(-150, 350, 110, 70, sea.autumn ? K.yellow : K.lgreen);
        break; }
      case 'lohkare':
        tz(0, -480, 480, 260, -360, 330, K.dgrey); tz(260, -360, 330, 430, -160, 150, K.grey); F(-300, 240, 200, 110, K.lgrey);
        if (sea.snow) tz(330, -280, 260, 450, -150, 140, K.white); else F(60, 60, 260, 90, veil(PC.green, 7));
        break;
      case 'lupiini': {
        if (sea.m !== 5 && sea.m !== 6) break;
        for (let i = 0; i < 5; i++) { const x0 = (i - 2) * 95 + ((i * 53) % 40), h = 260 + (i * 71) % 130; F(x0, 0, 26, h, K.green); F(x0 - 28, h, 82, 300, i % 3 === 0 ? K.lred : i % 3 === 1 ? K.purple : K.lblue); F(x0 - 6, h + 300, 38, 80, i % 3 === 0 ? K.white : K.lblue); }
        break; }
      case 'paali': {
        if (sea.snow || sea.m < 6 || sea.m > 9) break;
        if (hv < 0.55) { D(0, 320, 430, 330, K.white); F(-300, 60, 600, 90, veil(PC.lgrey, 9)); F(110, 200, 180, 300, veil(PC.lgrey, 6)); } // muoviin kääritty "traktorinmuna"
        else { D(0, 320, 420, 330, mix(PC.yellow, PC.orange, 6)); D(0, 320, 250, 200, K.yellow); D(0, 320, 90, 70, K.orange); }
        break; }
      case 'pylväs': {
        const wood = mix(PC.brown, PC.black, 5);
        P(-45, 0, 90, 2750, wood); P(-430, 2480, 860, 70, wood); F(-400, 2550, 60, 90, K.lgrey); F(340, 2550, 60, 90, K.lgrey);
        if (o.far) { const fs = o.far.s, fx = o.far.x, fy = o.far.y; for (const dx of [-370, 370]) { // johdot seuraavaan pylvääseen, hieman notkolla
          const x0 = X(dx), y0 = Y(2640), x1 = Math.round(fx + dx * fs), y1 = Math.round(fy - 2640 * fs), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.max(1, (y1 - y0) * 0.08 + 2);
          Gfx.line(g, x0, y0, mx, my, K.black); Gfx.line(g, mx, my, x1, y1, K.black); } }
        break; }
      case 'lamppu': {
        const sg = -Math.sign(o.x);
        P(-40, 0, 80, 2650, K.grey); P(sg > 0 ? 0 : -720, 2600, 720, 60, K.grey);
        P(sg > 0 ? 480 : -780, 2530, 300, 80, night ? E(PC.yellow) : K.lgrey);
        if (night) { D(sg * 630, 2520, 330, 220, veil(PC.yellow, 5, true)); Gfx.glow(X(sg * 1000), by + 1, 1700 * s, 430 * s + 1, 0.9); }
        break; }
      case 'viitta':
        if (!sea.snow) break;
        P(-18, 0, 36, 1150, K.lred); F(-18, 980, 36, 170, E(PC.white));
        break;
    }
  }
  const PENK = [{ k:'penkka', x:-1.22 }, { k:'penkka', x:1.22 }];
  const CLEARS = ['asema', 'liike', 'mainos', 'muutto', 'romu', 'ravintola', 'kyltti'];
  function drawSprites(sea) {
    const base = Math.floor(st.pos / SEG);
    const byIdx = {};
    for (const d of st.dyn) { const i = Math.floor(d.z / SEG); (byIdx[i] = byIdx[i] || []).push(d); }
    for (let n = DRAW - 1; n >= 0; n--) {
      const seg = segs[base + n];
      if (!seg || seg.p1.camera.z <= CAMD || seg.clip <= 0) continue;
      const sc = seg.p1.screen, s = sc.scale * W / 2;
      if (s * 3000 < 0.6) continue;
      let list = st.ramp ? seg.sprites.filter(o => !rampHides(seg, o)) : seg.sprites;
      const dec = decorVisible(seg);
      if (dec.length) list = list.concat(dec);
      if (sea.snow && seg.i % 3 === 0) list = list.concat(st.ramp ? PENK.filter(o => !rampHides(seg, o)) : PENK);
      if (byIdx[seg.i]) list = list.concat(byIdx[seg.i]);
      if (!list.length) continue;
      g.clipY = seg.clip;
      for (const o of list) {
        if (o.k === 'pylväs') { const f = segs[seg.i + 14]; o.far = f && n + 14 < DRAW && f.kind === 'pelto' && f.p1.camera.z > CAMD ? { x: f.p1.screen.x + f.p1.screen.scale * W / 2 * o.x * ROAD, y: f.p1.screen.y, s: f.p1.screen.scale * W / 2 } : null; }
        sprite(o, sc.x + s * o.x * ROAD, sc.y, s, sea, n, seg.clip);
      }
    }
    g.clipY = H;
  }

  // oma auto: piirretään jälkikäsittelyn jälkeen suoraan näkyvälle canvasille, pimeällä porrasta tummempana
  function drawCar(sea, dt) {
    const v = st.veh, night = sea.dark > 0.3;
    const bounce = st.speed > 0 ? (Math.random() < 0.5 ? 0 : 1) * (st.speed / (v.vmax * KMH)) : 0;
    const sh = st.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    const sv = Math.max(-1, Math.min(1, (st.sa || 0) + ((st.slip || 0) > 0.35 ? Math.sign(st.vx) * 0.5 : 0))); // luistossa perä kiertää
    const steer = Math.abs(sv) < 0.08 ? 0 : sv;
    const dive = st.braking && st.speed > 20 * KMH ? 1 : 0;
    const cx = Math.round(W / 2 + sh), by = Math.round(H - 6 - bounce) + dive;
    const opt = { brake: !!st.braking, night: sea.dark, steer, mb: v.mb, snow: sea.snow, dim: 0, anim: Math.floor(st.pos / 45), box: v.box, taxi: !v.bus && !st.trip && !v.tsa && S.taxi && gigKinds().includes('taxi') };
    if (v.bus) { Cars.rear(og, { b:'bus', c:'#ECECEC', line:'84' }, cx, by, 0.9, opt); return; }
    const tow = !v.tsa && towing();
    Cars.rear(og, v.spec, cx, tow ? by - 14 : by, 1, opt);
    if (tow) Cars.trailer(og, cx, by, 1, { brake: opt.brake, night: sea.dark, dim: opt.dim,
      load: st.gig && st.gig.kind === 'romu' && st.gig.phase === 'deliver' ? 'romu' : (st.gig && st.gig.kind === 'muutto' && st.gig.phase === 'deliver') || (st.trip && st.trip.trailer) ? 'muutto' : '' });
    // savu: korjaamaton vika savuttaa aina, polttomoottori höyryää pakkasella
    const E = eSpec(), cold = E && !E.ev && sea.temp <= 0 && st.speed < 70 * KMH;
    if (v.minor || cold) for (let i = 0; i < 3; i++) {
      const ph = (T * (v.minor ? 1.6 : 1) + i / 3) % 1;
      disc(og, cx - 22 + ph * 5 + Math.sin(T * 3 + i) * 2, by - 3 - ph * 12, 2 + ph * 5, 1.5 + ph * 4, veil(v.minor ? PC.dgrey : PC.white, 9 - ph * 7));
    }
  }
  // sade ja lumisade: hiukkaset ruudun koordinaateissa, vauhti venyttää niitä kohti reunoja
  function drawWeather(dt) {
    const w = weather();
    if (!w.kind) { st.fx.length = 0; return; }
    const N = w.kind === 'lumi' ? 80 : 100, sp = st.speed / (120 * KMH);
    while (st.fx.length < N) st.fx.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.6 });
    for (const p of st.fx) {
      const dx = (p.x - W / 2) / (W / 2);
      if (w.kind === 'lumi') { p.y += dt * (25 + 40 * sp) * p.z; p.x += dt * (dx * 60 * sp + Math.sin(p.y / 9) * 8); }
      else { p.y += dt * (160 + 80 * sp) * p.z; p.x += dt * dx * 40 * sp; }
      if (p.y > H || p.x < 0 || p.x > W) { p.x = Math.random() * W; p.y = -2; }
      if (w.kind === 'lumi') rect(og, p.x | 0, p.y | 0, p.z > 0.8 ? 2 : 1, p.z > 0.8 ? 2 : 1, p.z > 0.55 ? K.white : K.lgrey);
      else rect(og, p.x | 0, p.y | 0, 1, 3 + (p.z * 3 | 0), p.z > 0.7 ? K.cyan : K.lblue);
    }
  }
  // HUD on HTML-tekstiä canvasin päällä, jotta se pysyy terävänä kaikilla näytöillä
  const hud = {};
  const hudSet = (k, v, prop) => { if (hud[k + '_'] !== v) { hud[k + '_'] = v; hud[k][prop || 'textContent'] = v; } };
  const escH = t => String(t).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
  function energyHud() {
    const E = eSpec();
    if (!E) return '';
    const e = energy(E);
    if (st.chg && !st.chg.broken) return `${E.ev ? 'LADATAAN' : 'TANKATAAN'} ${Math.round(e * 100)} %${st.chg.q > 0 ? ' · JONOSSA' : E.ev ? ` · ${Math.round(Math.min(E.kw, st.chg.o.kw) * (e > 0.8 ? 0.35 : 1))} kW` : ''}`;
    const left = Math.round(e / consNow(E, Math.max(60, st.speed / KMH)));
    const o = st.dyn.find(d => d.station);
    const ds = gpsDown() ? '?' : o ? Math.max(0, Math.round((o.z - (st.pos + PZ)) * kmPerU())) : Math.max(0, Math.round(st.nextSt - st.kmTot));
    return `${E.ev ? 'AKKU' : 'TANKKI'} ${Math.round(e * 100)} % ~${left} KM · ASEMA ${ds} KM`;
  }
  function tripHud() {
    const T = st.trip, kmh = Math.max(40, st.speed / KMH), eta = T.t + (T.km - T.done) / kmh;
    return `${T.name}: ${Math.round(T.done)}/${T.km} KM · KELLO ${hhmm(T.t)}/${T.hours}.00 · ARVIO ${hhmm(eta)}${eta > T.hours ? ' MYÖHÄSSÄ' : ''}`;
  }
  // Paneelit ja viestit piirretään samaan 320×200-kuvaan 8×8-merkistöllä (40 merkkiä riville) yksiväriselle taustalle,
  // kuten C64-peleissä: ylärivi ja kaksi alariviä ovat tekstiä, niiden välissä 176 riviä pelikuvaa.
  const PAN_TOP = 8, PAN_BOT = 16, CROP = PAN_TOP + PAN_BOT;
  const t8 = (str, col, row, fg, bg) => Gfx.text8(scr, str, col * 8, row * 8, fg, bg);
  // viestilaatikko: rivit keskitettynä mustalle pohjalle, palauttaa seuraavan vapaan rivin (pikseleinä)
  function msgBox(lines, y, fg) {
    const w = Math.max(...lines.map(l => l.length)) + 2, x0 = Math.floor((40 - w) / 2) * 8;
    rect(scr, x0, y, w * 8, lines.length * 8 + 1, K.black);
    lines.forEach((l, i) => Gfx.text8(scr, l, x0 + 8 + Math.floor((w - 2 - l.length) / 2) * 8, y + 1 + i * 8, fg, -1));
    return y + lines.length * 8 + 2;
  }
  function drawHud() {
    // pelikuva paneelien väliin: taivaan ylimmät rivit jäävät pois
    scr.buf.set(og.buf.subarray(CROP * W, H * W), PAN_TOP * W);
    // ylärivi: kuukausi ja kassa, alareunassa kuukauden eteneminen
    rect(scr, 0, 0, W, 8, K.blue);
    t8(`KK ${S.m}/${LAST} ${KK[(S.m - 1) % 12]}KUU ${2027 + Math.floor((S.m - 1) / 12)}`, 0, 0, PC.white, -1);
    { const c = `KASSA ${eur(S.cash)}`; t8(c, 40 - c.length, 0, S.cash < 0 ? PC.lred : PC.yellow, -1); }
    rect(scr, 0, 7, W, 1, K.dgrey); rect(scr, 0, 7, Math.round(Math.min(1, st.monthT / MONTH_S) * W), 1, K.yellow);
    // alarivit: rajoitus, nopeus ja auto; energia ja keli
    rect(scr, 0, H - 16, W, 16, K.black);
    const kmh = Math.round(st.speed / KMH), lim = limitOf(segAt(st.pos + PZ).lim);
    let col = 0;
    if (!st.veh.bus) { const l = limTxt(lim); t8(' ', 0, 23, PC.white, PC.red); t8(l, 1, 23, PC.black, PC.white); t8(' ', 1 + l.length, 23, PC.white, PC.red); col = l.length + 3; } // rajoitusmerkki: punaiset reunat
    const sp = `${kmh} KM/H`; t8(sp, col, 23, kmh > lim ? PC.lred : PC.white, -1); col += sp.length + 1;
    if (st.auto) t8('AVUSTETTU AJO', 27, 23, Math.floor(T * 2) % 2 ? PC.lgreen : PC.green, -1);
    else { let nm = st.veh.name + (st.veh.tsa ? ' (TSA)' : ''); if (nm.length > 40 - col) nm = nm.slice(0, 40 - col); t8(nm, 40 - nm.length, 23, PC.lgrey, -1); }
    const en = energyHud().replace(/ %/g, '%').replace(/ · /g, ' '), keli = keliTxt().replace(' °C', '°C').replace(/ · /g, ' '), temp = keli.split(' ')[0];
    t8(en, 0, 24, PC.cyan, -1);
    { const k = en.length + 1 + keli.length <= 40 ? keli : en.length + 1 + temp.length <= 40 ? temp : ''; if (k) t8(k, 40 - k.length, 24, PC.lgreen, -1); }
    // viestit pelikuvan yläreunaan: keikka tai matka, autoliike, kaksi uusinta ilmoitusta
    let y = PAN_TOP + 2;
    const gh = st.trip ? tripHud() : gigHud();
    if (gh) y = msgBox(Gfx.wrap8(gh, 38), y, PC.cyan);
    { const lot = st.dyn.find(d => d.lot && !d.used);
      if (lot) { const d = lot.at - Math.floor((st.pos + PZ) / SEG); if (d < 150 && d >= -STOP_WIN) y = msgBox(Gfx.wrap8(d > STOP_WIN ? `AUTOLIIKE ${gpsDown() ? 'TULOSSA' : d * 5 + ' M'} · PYSÄHDY PIHAAN OIKEAAN REUNAAN` : 'AUTOLIIKE · PYSÄHDY TÄHÄN', 38), y, PC.cyan); } }
    for (const t of st.toasts.slice(-2)) {
      const c = t.t[0] === '!' ? PC.lred : t.t[0] === '+' ? PC.lgreen : PC.white;
      y = msgBox(Gfx.wrap8(c === PC.white ? t.t : t.t.slice(1), 38).slice(0, 4), y, c);
    }
    if (st.ramp && Math.floor(T * 2.5) % 2) {
      const d = st.ramp.start - Math.floor((st.pos + PZ) / SEG);
      const r = d <= -RAMP_LEN ? '' : gpsDown() ? (d < 25 ? 'LIITTYMÄ → OIKEALLE = VALIKKO' : '') : d > 0 ? `LIITTYMÄ ${d * 5} M → OIKEALLE = VALIKKO` : 'LIITTYMÄ → OIKEALLE = VALIKKO';
      if (r) msgBox([r], 118, PC.yellow);
    }
    if (st.hint) msgBox(['← → OHJAA · ↓ JARRU · P TAUKO'], 96, PC.white);
    if (st.userPause) { rect(scr, 0, PAN_TOP, W, H - CROP, veil(PC.black, 8)); msgBox(['TAUKO · P JATKAA'], 84, PC.yellow); }
    hudSet('quick', quickHtml(), 'innerHTML'); // sama sisältö koko pikavalinnan ajan, joten napit eivät vaihdu kesken painalluksen
    hudSet('quickD', st.quick && !st.paused ? 'block' : 'none', 'display');
    if (st.quick) { const b = document.getElementById('q-bar'); if (b) b.style.width = Math.max(0, st.quick.t / st.quick.T * 100).toFixed(1) + '%'; }
  }
  function render() {
    const sea = season(), dt = st.paused || st.userPause ? 0 : st.dt || 0;
    T = performance.now() / 1000;
    GP = palette(sea);
    // pimeän taso: kaamos tai hämärä; ajovalot leikkaavat siihen keilan
    AMB = sea.dark > 0.6 ? 3 : sea.dark > 0 ? 1 : 0; // kokonaisluku: keilan ulkopuoli on tasainen, rasteri näkyy vain valon reunassa
    Gfx.lightReset(AMB > 0);
    const baseIdx = Math.floor(st.pos / SEG); ensure(baseIdx);
    const base = segs[baseIdx], basePct = (st.pos % SEG) / SEG;
    const pz = st.pos + PZ, ps = segAt(pz), pp = (pz % SEG) / SEG;
    const camY = CAMH + ps.p1.world.y + (ps.p2.world.y - ps.p1.world.y) * pp;
    drawSky(sea);
    Gfx.clear(g);
    let maxRow = H, x = 0, dx = -(base.curve * basePct);
    for (let n = 0; n < DRAW; n++) {
      const seg = segs[baseIdx + n];
      seg.clip = maxRow;
      project(seg.p1, st.x * ROAD - x, camY, st.pos);
      project(seg.p2, st.x * ROAD - x - dx, camY, st.pos);
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= CAMD) continue;
      const yb = Math.min(maxRow, Math.ceil(seg.p1.screen.y - 0.5)), yt = Math.max(0, Math.ceil(seg.p2.screen.y - 0.5));
      if (yt >= yb) continue;
      drawSeg(seg, sea, n, yt, yb);
      maxRow = yt;
    }
    drawSprites(sea);
    Gfx.post(g, bg, og, AMB);
    drawCar(sea, dt);
    drawWeather(dt);
    if (st.flash > 0) rect(og, 0, 0, W, H, veil(PC.white, st.flash * 20));
    drawHud();
    Gfx.blit(scr, octx); vg.imageSmoothingEnabled = false; vg.drawImage(octx.canvas, 0, 0, cv.width, cv.height);
  }

  // ---------- silmukka ----------
  function frame(now) {
    if (!st.active) return;
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; st.dt = dt;
    if (!st.paused && !st.userPause && !st.freeze) { // freeze: testit pysäyttävät maailman kuvaa varten
      T = now / 1000;
      update(st.quick ? dt * 0.4 : dt); // pikavalinnan ajan peli hidastuu
      if (!st.active) return;
      if (!st.paused) quickUpdate(dt);
      if (!st.active) return;
      st.toasts.forEach(t => t.life -= dt); st.toasts = st.toasts.filter(t => t.life > 0);
    }
    { const E = st.veh && !st.veh.bus ? eSpec() : null; Snd.engine(st.speed / KMH, !!(E && E.ev), !st.paused && !st.userPause && !!E); }
    st.shake = Math.max(0, st.shake - dt); st.flash = Math.max(0, st.flash - dt * 2);
    if (st.hint && st.monthT > 8) st.hint = false;
    render();
  }

  // ---------- ohjaus ----------
  const KEYMAP = { ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right', ArrowDown:'brake', s:'brake', S:'brake', ' ':'brake' };
  function init() {
    cv = document.getElementById('road'); vg = cv.getContext('2d');
    { const c = document.createElement('canvas'); c.width = W; c.height = H; octx = c.getContext('2d'); }
    og = Gfx.surface(W, H); g = Gfx.surface(W, H); bg = Gfx.surface(W, H); scr = Gfx.surface(W, H);
    // näkyvä canvas on 320×200 kokonaislukukertoimella suurennettuna, jotta rasteri ei moiroi epätasaisessa skaalauksessa
    const fitCanvas = () => { const n = Math.max(1, Math.min(6, Math.ceil((cv.clientWidth || 640) * (window.devicePixelRatio || 1) / W - 0.05))); if (cv.width !== W * n) { cv.width = W * n; cv.height = H * n; } };
    fitCanvas(); window.addEventListener('resize', fitCanvas); st.fitCanvas = fitCanvas;
    const $ = id => document.getElementById(id);
    Object.assign(hud, { quick:$('quick'), quickD:$('quick').style });
    document.addEventListener('keydown', e => {
      if (!st.active || st.paused) return;
      if (st.quick && /^[1-9]$/.test(e.key)) { quickPick(+e.key - 1); e.preventDefault(); return; }
      if (KEYMAP[e.key]) { st.keys[KEYMAP[e.key]] = true; e.preventDefault(); }
      else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { st.userPause = !st.userPause; e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 't' || e.key === 'T' || e.key === 'w' || e.key === 'W') { if (!e.repeat) apToggle(); e.preventDefault(); }
    });
    document.addEventListener('keyup', e => { if (KEYMAP[e.key]) st.keys[KEYMAP[e.key]] = false; });
    document.querySelectorAll('.pad button').forEach(b => {
      const k = b.dataset.k;
      if (k === 'auto') { b.addEventListener('pointerdown', e => { e.preventDefault(); apToggle(); }); return; }
      const on = e => { e.preventDefault(); st.keys[k] = true; b.classList.add('on'); if (st.userPause) st.userPause = false; };
      const off = () => { st.keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      b.addEventListener('contextmenu', e => e.preventDefault());
    });
    cv.addEventListener('pointerdown', () => { if (st.userPause) st.userPause = false; });
    $('quick').addEventListener('pointerdown', e => { const b = e.target.closest('button[data-i]'); if (!b) return; e.preventDefault(); if (!st.paused && !st.userPause) quickPick(+b.dataset.i); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && st.active && !st.paused) st.userPause = true; });
  }

  // ---------- julkinen rajapinta ----------
  function start() {
    if (!cv) init();
    if (st.S !== S) { st.S = S; st.pos = 0; st.x = 0.5; st.hint = true; }
    st.active = true; st.paused = false; st.userPause = false;
    st.speed = 0; st.monthT = 0; st.ramp = null; st.dyn = []; st.toasts = []; st.keys = {}; st.gig = null; st.gigT = 3;
    st.quick = null; st.boardKm = 15; st.lotDone = false; st.ice = 0; st.iceWarn = false; st.wx = null; st.fx = [];
    st.x = 0.5; st.vx = 0; st.sa = 0; st.scrCd = 0; st.freeze = false; st.auto = false; st.apErr = null;
    S.cars.forEach(c => { c.energy = 1; }); if (S.tsa) S.tsa.energy = 1; // kotona ladattu ja tankattu
    st.chg = null; st.kmTot = 0; st.eWarn = 0; scheduleStation();
    st.veh = null; refreshVehicle();
    if (S.trip) tripBegin();
    else { const sea = season();
      if (S.summer > 0 && (sea.snow || sea.temp <= 0)) toast('!Kesärenkaat ja ' + (sea.snow ? 'lunta tiellä' : 'pakkasta') + ': jarrutusmatka pitenee, ja auto liukuu mutkissa.', 6);
      else if (weather().ice) toast(`Keli ${keliTxt().replace(' · LIUKASTA', '')}: tie on liukas. Varo mustaa jäätä.`, 5); }
    document.body.classList.add('driving'); document.body.classList.remove('paused');
    st.fitCanvas();
    window.scrollTo(0, 0);
    st.last = performance.now();
    cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(frame);
  }
  function resume() {
    if (!st.active || S.over) return;
    if (S.cash < 0) { if (invTotal() > 0) return deficitPrompt(); fixNeg(); }
    if (S.vippi > 3000) { stop(); return repossess(); }
    st.paused = false; st.keys = {};
    if (st.tow) { st.tow = false; st.x = Math.max(-0.85, Math.min(0.85, st.x)); }
    st.vx = 0; st.sa = 0; st.auto = false; st.apErr = null;
    document.body.classList.remove('paused');
    refreshVehicle();
    if (S.trip && !st.trip) tripBegin();
    window.scrollTo(0, 0);
    st.last = performance.now();
  }
  function stop() {
    st.active = false; st.paused = false; st.keys = {}; st.quick = null;
    Snd.engine(0, false, false);
    cancelAnimationFrame(st.raf);
    document.body.classList.remove('driving', 'paused');
  }
  return {
    start, resume, stop, rangeOf, hold, quick,
    get active() { return st.active; },
    blockKeys: () => st.active && !st.paused,
    _st: st, _vehicle: vehicle, _render: render, _ap: apToggle, _decor: decorOf, _physics: physics, _refresh: refreshVehicle, _KMH: KMH, _seg: i => { ensure(i); return segs[i]; }, // testejä varten
  };
})();
