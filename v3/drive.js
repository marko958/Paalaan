// PAALAAN! 3.0 – ajotilan simulaatio
// Sama segmenttitie ja sama logiikka kuin 2.0:ssa (alpha 31): tie, ohjaus, esteet, asemat, keikat, liikkeet, pikavalinnat ja sää.
// Vain piirto on vaihdettu: 2.0:n canvas-piirron tilalla on three.js-näkymä (gfx/main.js), joka lukee tämän tilan
// (Drive.sim) ja muuntaa tiekoordinaatit (segmentti ja x) 3D-maailmaan. Törmäysrajat, nopeudet ja tasapaino ovat ennallaan.
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

  // ---------- 3.0: näkymä ja grafiikka-asetus ----------
  // Näkymä on ES-moduuli, joka latautuu tämän skriptin jälkeen ja ilmoittautuu attachView()lla.
  // gfxFail = WebGL ei toimi: ajotilaan ei mennä, vaan sivulla näkyy ilmoitus ja linkki 2.0:aan.
  let View = null, gfxFail = '';
  const GFX_KEY = 'paalaan3.gfx', GFX = ['auto', 'low', 'med', 'high'], GFX_FI = { auto:'Auto', low:'Matala', med:'Keski', high:'Korkea' };
  let gfx = 'auto';
  try { const v = localStorage.getItem(GFX_KEY); if (GFX.includes(v)) gfx = v; } catch (e) {}
  function gfxCycle() {
    gfx = GFX[(GFX.indexOf(gfx) + 1) % GFX.length];
    try { localStorage.setItem(GFX_KEY, gfx); } catch (e) {}
    if (View) View.setQuality(gfx);
    return gfx;
  }
  const gfxName = () => GFX_FI[gfx] + (gfx === 'auto' && View && View.autoLevel ? ` (nyt ${GFX_FI[View.autoLevel()]})` : '');
  function showFail(msg) {
    gfxFail = msg || ' ';
    const el = document.getElementById('nogl');
    if (el) { el.hidden = false; const m = document.getElementById('nogl-msg'); if (m) m.textContent = gfxFail; }
  }

  let cv;
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
      zone = { kind, left: 80 + Math.floor(rr(n, 2) * 160), lim: kind === 'kylä' ? (rr(n, 25) < 0.5 ? 50 : 60) : kind === 'pelto' ? 80 : 'H', cam: rr(n, 26) < 0.5, len:0 };
      start = true;
    }
    zone.len++;
    const sp = scenery(n, zone.kind);
    const clearView = side => { // merkin eteen ei puita, jotta se näkyy
      for (let k = 0; k <= 10 && n - k >= 0; k++) { const arr = k ? segs[n - k].sprites : sp; for (let j = arr.length - 1; j >= 0; j--) if (Math.sign(arr[j].x) === side && ['kuusi', 'koivu', 'mökki', 'lato'].includes(arr[j].k)) arr.splice(j, 1); }
    };
    if (start) { sp.push({ k:'raja', x:1.3, lim:zone.lim }); clearView(1); if (zone.cam) { sp.push({ k:'valvonta', x:-1.3 }); clearView(-1); } }
    else if (zone.cam && zone.len % 120 === 60 && zone.left > 10) { sp.push({ k:'kamera', x:1.3 }); clearView(1); }
    segs.push({ i:n, p1:pt(lastY(), n * SEG), p2:pt(y, (n + 1) * SEG), curve, sprites:sp, clip:H, lim:zone.lim });
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
    if (TR && TR.rental) { const r = TR.rental; return { bus:false, rental:r, name:r.name, vmax:r.vmax, acc:15, spec: /paku/i.test(r.name) ? { b:'van', w:1.08, c:'#ECECEC', tl:'vertical' } : { b:'suv', c:'#3A3F44', tl:'corner', x:['rails'] }, mb:0, minor:0, box:false }; }
    const tripCar = TR && TR.car && S.cars.includes(TR.car) ? TR.car : null;
    const T = tripCar ? null : S.tsa, car = tripCar || (T ? null : drivenCar());
    if (!T && !car) return { bus:true, name:'Bussi', vmax:80, acc:8, mb:0, minor:0 };
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
    return { bus:false, tsa:!!T, car, name:k.name, vmax, acc, spec:modelSpec(k), mb: T ? T.mb : car.mb, minor, box: !!(TR && TR.box) };
  }
  function refreshVehicle() {
    const prev = st.veh, v = vehicle();
    if (prev && !prev.bus && v.bus) toast('!Auto jäi tien varteen. Matka jatkuu bussilla.');
    else if (prev && prev.name !== v.name && !v.bus) toast(`+Alla on nyt ${v.name}.`);
    st.veh = v;
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
  const TRAFFIC_COL = ['#A8ADB4', '#1F2633', '#7A1F24', '#ECECEC', '#2F6DB5', '#3A3F44', '#2E5B4C', '#9B6739'];
  function spawnTraffic(oncoming) {
    const z1 = st.pos + PZ, seg = segAt(z1), lim = limitOf(seg.lim);
    const z = z1 + DRAW * SEG * (oncoming ? 0.95 : 0.6 + Math.random() * 0.3);
    if (st.ramp && z / SEG > st.ramp.start - 10 && z / SEG < st.ramp.end + 10) return;
    if (st.dyn.some(o => (o.k === 'auto' || o.k === 'vasta') && Math.abs(o.z - z) < 20 * SEG && (o.k === 'vasta') === oncoming)) return;
    const kmh = oncoming ? lim - 5 + Math.random() * 15 : Math.max(45, lim - 15 + Math.random() * 15);
    st.dyn.push({ k: oncoming ? 'vasta' : 'auto', z, x: oncoming ? -0.5 : 0.5, v: (oncoming ? -1 : 1) * kmh * KMH, col: TRAFFIC_COL[Math.floor(Math.random() * TRAFFIC_COL.length)], prel: z - z1 });
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
  const HIT = { kuusi:0.1, koivu:0.05, tolppa:0.03, mökki:0.6, lato:0.8, raja:0.03, valvonta:0.03, kamera:0.09 };
  const WHERE = { kuusi:'kuuseen', koivu:'koivuun', tolppa:'reunapaaluun', mökki:'mökin seinään', lato:'latoon', kyltti:'liikennemerkkiin', raja:'liikennemerkkiin', valvonta:'liikennemerkkiin', kamera:'kameratolppaan' };
  const CAR_HW = 0.11; // auto on 72 px leveä, tien puolikas pelaajan kohdalla 320 px
  function hits(o) {
    if (o.k === 'kyltti') return [0, 0.52].some(dx => Math.abs(o.x + dx - st.x) < 0.03 + CAR_HW);
    return HIT[o.k] !== undefined && Math.abs(o.x - st.x) < HIT[o.k] + CAR_HW;
  }
  const rampHides = (seg, o) => st.ramp && seg.i >= st.ramp.start - 2 && seg.i <= st.ramp.end + 2 && o.x > 0.9 && o.x < 2.6;
  function crashStop() {
    if (st.trip && st.trip.cargo) st.trip.broken = true; // kolarissa kuorma menee rikki
    st.speed = 0; st.shake = 0.6; st.flash = 0.5;
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
  function update(dt) {
    const v = st.veh, keys = st.keys;
    const maxU = v.vmax * KMH;
    const z0 = st.pos + PZ;
    const pseg = segAt(z0);
    const onRamp = st.ramp && pseg.i >= st.ramp.start && pseg.i <= st.ramp.end;
    const rightEdge = onRamp ? 1 + RAMP_W : 1;
    const off = st.x < -1 || st.x > rightEdge;

    // huono pito: kesärenkaat talvikelillä tai rengashotellin sekoittamat kiekot
    const slick = !v.bus && ((S.summer > 0 && (season().snow || season().bare)) || !!(v.car && v.car.mixed));
    const icy = !v.bus && st.ice > 0; if (st.ice > 0) st.ice -= dt;
    if (v.bus) st.speed += (Math.min(maxU, 80 * KMH) - st.speed) * Math.min(1, dt * 0.8);
    else if (keys.brake) st.speed -= (slick ? 46 : 70) * (icy ? 0.3 : 1) * KMH * dt;
    else st.speed += v.acc * KMH * dt * (1 - 0.6 * st.speed / maxU);
    if (off && st.speed > 45 * KMH) { st.speed -= 90 * KMH * dt; st.shake = Math.max(st.shake, 0.08); }
    st.speed = Math.max(0, Math.min(maxU, st.speed));

    const sp = st.speed / (160 * KMH);
    const steer = dt * 2.4 * Math.min(1.2, Math.max(sp, st.speed > 0 ? 0.35 : 0)) * (slick ? 0.65 : 1) * (icy ? 0.3 : 1);
    if (icy) st.x += dt * 0.35 * sp * Math.sin(performance.now() / 300); // takapää elää
    // 3.0: ohjaus pehmenee (rattiliike kasvaa ja palautuu vähitellen) ja sivuttaisnopeus on 3D-mittakaavaan sovitettu
    { const tgt = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); st.steerIn = (st.steerIn || 0) + (tgt - (st.steerIn || 0)) * Math.min(1, dt * (tgt ? 7 : 10)); }
    st.x += steer * 0.62 * st.steerIn;
    if (v.minor) st.x += dt * 0.05 * sp; // korjaamaton vika vetää sivulle
    if (v.car && v.car.mixed) st.x += dt * 0.1 * sp * Math.sin(performance.now() / 650); // kolme leveää ja yksi kapea: auto vaeltaa
    st.x -= steer * sp * pseg.curve * (slick ? 0.46 : 0.32) * 0.3; // 3.0: kaarteet ovat näkymässä loivempia, joten sivuttaisveto on pienempi
    st.x = Math.max(-2.6, Math.min(2.8, st.x));
    st.skyOff += pseg.curve * sp * dt * 6;

    st.pos += st.speed * dt;
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

  // ---------- automallit takaa ----------
  // b = korityyppi, w = leveyskerroin, c = väri, r = katon väri, tl = takavalot, x = lisäosat
  // takavalot: corner, wide, bar (koko leveä valopalkki), pixel, vertical (pilarien vieressä), round, tri (kolme pystyviivaa), low
  // lisäosat: exh1/exh2 = pakoputket, spoiler = kattospoileri, duck = takaluukun spoileri, rails = kattokaiteet,
  //           split = jaettu takalasi, chrome = kromilista, blackhatch = musta lasiluukku, rust = ruostetta, diff = diffuusori
  const MODELS = [
    ['Ford Mondeo',       { b:'sedan', c:'#A8ADB4', tl:'corner', x:['exh1'] }],
    ['Opel Astra',        { b:'hatch', c:'#7A1F24', tl:'wide', x:['exh1', 'spoiler'] }],
    ['Toyota Avensis',    { b:'sedan', c:'#6E7378', tl:'wide', x:['exh1'] }],
    ['Toyota Prius',      { b:'prius', c:'#C9CDD2', tl:'wide', x:['split', 'spoiler'] }],
    ['Volvo V70',         { b:'wagon', c:'#23314F', tl:'vertical', x:['exh2', 'rails'] }],
    ['VW Passat',         { b:'wagon', c:'#4D5258', tl:'wide', x:['exh2', 'rails'] }],
    ['Audi A6',           { b:'sedan', w:1.04, c:'#1A1A1C', tl:'wide', x:['exh2', 'chrome'] }],
    ['BMW 530d',          { b:'sedan', w:1.04, c:'#1F2633', tl:'corner', x:['exh2'] }],
    ['Mitsubishi Outlander', { b:'suv', c:'#E4E4E4', tl:'corner', x:['rails'] }],
    ['Nissan Leaf',       { b:'hatch', c:'#EDEDED', tl:'vertical', x:['spoiler'] }],
    ['Renault Zoe',       { b:'mini', c:'#2F6DB5', tl:'wide' }],
    ['VW e-Golf',         { b:'hatch', c:'#F0F0F0', tl:'wide', x:['spoiler'] }],
    ['BMW i3',            { b:'tall', w:0.88, c:'#EDEDED', r:'#151515', tl:'corner', x:['blackhatch'] }],
    ['Hyundai Ioniq 5',   { b:'hatch', w:1.02, c:'#9AA0A0', tl:'pixel', x:['spoiler'] }],
    ['Hyundai Ioniq',     { b:'prius', c:'#D6D9DD', tl:'wide', x:['split'] }],
    ['Hyundai Kona',      { b:'suv', w:0.94, c:'#B9C23A', r:'#1A1A1A', tl:'low', x:['spoiler'] }],
    ['Kia e-Soul',        { b:'tall', c:'#A61E22', r:'#EDEDED', tl:'vertical' }],
    ['Kia e-Niro',        { b:'suv', w:0.96, c:'#3A6EA5', tl:'vertical', x:['spoiler'] }],
    ['Kia EV6',           { b:'suvc', c:'#3C4045', tl:'bar', x:['duck'] }],
    ['Peugeot e-208',     { b:'hatch', w:0.94, c:'#D9B526', tl:'bar', x:['spoiler'] }],
    ['Dacia Spring',      { b:'mini', w:0.84, c:'#E6E6E6', tl:'corner', x:['orange'] }],
    ['Fiat Topolino',     { b:'mini', w:0.72, c:'#7FB8A4', r:'#E8E8E0', tl:'round' }],
    ['Fiat 500e',         { b:'mini', w:0.82, c:'#9ED3C5', tl:'round', x:['chrome'] }],
    ['MG4',               { b:'hatch', c:'#D0412C', tl:'bar', x:['spoiler'] }],
    ['VW ID.3',           { b:'hatch', c:'#B7BEC2', tl:'wide', x:['blackhatch'] }],
    ['Tesla Model 3',     { b:'fastback', c:'#A3121A', tl:'wide', x:['duck'] }],
    ['Tesla Model Y',     { b:'suvc', c:'#ECECEC', tl:'wide', x:['duck'] }],
    ['Tesla Model S 85',  { b:'fastback', w:1.04, c:'#8B8E92', tl:'wide', x:['rust'] }],
    ['Tesla Model S',     { b:'fastback', w:1.04, c:'#111214', tl:'wide', x:['duck'] }],
    ['Tesla Cybertruck',  { b:'truck', w:1.12, c:'#A9ADB1', tl:'bar' }],
    ['Skoda Enyaq',       { b:'suv', c:'#2E5B4C', tl:'wide', x:['rails'] }],
    ['VW ID.4',           { b:'suv', c:'#F1F1F1', r:'#151515', tl:'bar', x:['spoiler'] }],
    ['Polestar 2',        { b:'fastback', c:'#E4E4E0', tl:'bar' }],
    ['Polestar 3',        { b:'suv', w:1.06, c:'#1F2328', tl:'bar', x:['spoiler'] }],
    ['Ford Mustang Mach-E', { b:'suvc', c:'#B1181E', r:'#151515', tl:'tri', x:['duck'] }],
    ['BYD Atto 3',        { b:'suv', c:'#3E6FA9', tl:'bar' }],
    ['Volvo XC40',        { b:'suv', c:'#7C8C7A', r:'#151515', tl:'vertical', x:['spoiler'] }],
    ['Audi Q4',           { b:'suv', c:'#9AA1A6', tl:'bar', x:['spoiler'] }],
    ['BMW i4',            { b:'fastback', c:'#1E4D9A', tl:'corner', x:['duck', 'diff'] }],
    ['Porsche Taycan',    { b:'coupe', w:1.06, c:'#C8CBCE', tl:'bar', x:['diff'] }],
    ['Audi RS e-tron GT', { b:'coupe', w:1.06, c:'#5B6B4E', tl:'bar', x:['diff', 'duck'] }],
    ['Audi e-tron GT',    { b:'coupe', w:1.06, c:'#3A3F44', tl:'bar', x:['diff'] }],
    ['BMW iX',            { b:'suv', w:1.06, c:'#1C2A3A', tl:'wide', x:['spoiler'] }],
    ['Jaguar I-Pace',     { b:'suvc', c:'#7A1E28', tl:'wide', x:['spoiler'] }],
    ['Mercedes EQS SUV',  { b:'suv', w:1.08, c:'#E6E6E6', tl:'bar', x:['chrome'] }],
    ['Mercedes EQS',      { b:'fastback', w:1.06, c:'#2B2E33', tl:'bar', x:['chrome'] }],
    ['Maybach EQS SUV',   { b:'suv', w:1.08, c:'#C0C3C7', r:'#16161A', tl:'bar', x:['chrome', 'twotone'] }],
    ['BMW i7',            { b:'sedan', w:1.08, c:'#121417', tl:'wide', x:['chrome'] }],
    ['Porsche Macan',     { b:'suvc', c:'#2E3A2F', tl:'bar', x:['spoiler'] }],
    ['Lucid Air',         { b:'fastback', w:1.06, c:'#B9B2A4', tl:'bar' }],
    ['Lotus Eletre',      { b:'suv', w:1.06, c:'#E8C32A', r:'#151515', tl:'bar', x:['spoiler', 'diff'] }],
    ['Rolls-Royce Spectre', { b:'coupe', w:1.14, c:'#2B2F46', r:'#C0C3C7', tl:'vertical', x:['chrome'] }],
    ['Toyota Proace',     { b:'van', w:1.12, c:'#F2F2F2', tl:'vertical' }],
    ['Audi e-tron 55',    { b:'suv', w:1.04, c:'#5C6670', tl:'bar', x:['spoiler'] }],
    ['Citroën ë-SpaceTourer', { b:'van', w:1.06, c:'#2B3A55', tl:'vertical' }],
    ['Kia PV5 Passenger', { b:'van', w:1.04, c:'#8C979C', tl:'vertical' }],
    ['Kia PV5 Cargo',     { b:'van', w:1.04, c:'#EDEDED', tl:'vertical' }],
    ['Renault Fluence',   { b:'sedan', c:'#D8D8D8', tl:'wide', x:['chrome'] }],
    ['Ford Focus Electric', { b:'hatch', c:'#2F6DB5', tl:'vertical', x:['spoiler'] }],
    ['Elcat',             { b:'van', w:0.84, c:'#F28C28', tl:'vertical' }],
  ];
  function modelSpec(k) {
    const m = MODELS.find(([n]) => k.name.startsWith(n));
    if (m) return m[1];
    return { b: k.type === 'e' ? 'hatch' : 'sedan', c: '#959595', tl:'corner', x: k.type === 'b' ? ['exh1'] : [] };
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
  function drawHud() {
    hudSet('month', `KK ${S.m}/${LAST} · ${KK[(S.m - 1) % 12].toUpperCase()}KUU ${2027 + Math.floor((S.m - 1) / 12)} · ${keliTxt()}`);
    hudSet('cash', `KASSA ${eur(S.cash)}`);
    hudSet('cashCls', S.cash < 0 ? 'neg' : '', 'className');
    hudSet('bar', Math.min(100, st.monthT / MONTH_S * 100).toFixed(1) + '%', 'width');
    const kmh = Math.round(st.speed / KMH), lim = limitOf(segAt(st.pos + PZ).lim);
    hudSet('speed', `${kmh} km/h`);
    hudSet('speedCls', kmh > lim ? 'over' : '', 'className');
    hudSet('lim', st.veh.bus ? '' : limTxt(lim));
    hudSet('limD', st.veh.bus ? 'none' : 'inline-flex', 'display');
    hudSet('car', st.veh.name + (st.veh.tsa ? ' (työsuhdeauto)' : ''));
    hudSet('en', energyHud());
    const gh = st.trip ? tripHud() : gigHud();
    let lh = '';
    { const lot = st.dyn.find(d => d.lot && !d.used);
      if (lot) { const d = lot.at - Math.floor((st.pos + PZ) / SEG); if (d < 150 && d >= -STOP_WIN) lh = d > STOP_WIN ? `AUTOLIIKE ${gpsDown() ? 'TULOSSA' : d * 5 + ' M'} · PYSÄHDY PIHAAN OIKEAAN REUNAAN` : 'AUTOLIIKE · PYSÄHDY TÄHÄN'; } }
    const msgs = (gh ? `<p class="gig">${escH(gh)}</p>` : '') + (lh ? `<p class="gig">${escH(lh)}</p>` : '') + st.toasts.map(t => {
      const c = t.t[0] === '!' ? 'r' : t.t[0] === '+' ? 'g' : '';
      return `<p class="${c}">${escH(c ? t.t.slice(1) : t.t)}</p>`;
    }).join('');
    hudSet('msgs', msgs, 'innerHTML');
    let ramp = '';
    if (st.ramp) {
      const d = st.ramp.start - Math.floor((st.pos + PZ) / SEG);
      if (d > -RAMP_LEN) ramp = gpsDown() ? (d < 25 ? 'LIITTYMÄ → oikealle = valikko' : '') : d > 0 ? `LIITTYMÄ ${d * 5} m → oikealle = valikko` : 'LIITTYMÄ → oikealle = valikko';
    }
    hudSet('ramp', ramp);
    hudSet('hint', st.hint ? '← → ohjaa · ↓ jarru · P tauko' : '');
    hudSet('pause', st.userPause ? 'flex' : 'none', 'display');
    hudSet('quick', quickHtml(), 'innerHTML'); // sama sisältö koko pikavalinnan ajan, joten napit eivät vaihdu kesken painalluksen
    hudSet('quickD', st.quick && !st.paused ? 'block' : 'none', 'display');
    if (st.quick) { const b = document.getElementById('q-bar'); if (b) b.style.width = Math.max(0, st.quick.t / st.quick.T * 100).toFixed(1) + '%'; }
    hudSet('flash', st.flash > 0 ? Math.min(1, st.flash).toFixed(2) : '0', 'opacity'); // salama ja törmäys: valkoinen välähdys HTML-kerroksena
  }
  // 3.0: piirto on three.js-näkymässä (gfx/). Simulaatio ei tiedä siitä muuta kuin tämän kutsun.
  function render() {
    drawHud();
    if (View) View.render(st.paused || st.userPause ? 0 : st.dt || 0);
  }

  // ---------- silmukka ----------
  function frame(now) {
    if (!st.active) return;
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now; st.dt = dt;
    // 3.0: simulaatio odottaa, kunnes näkymä ja resurssit on ladattu
    const wait = !View || !View.ready();
    hudSet('load', wait ? 'flex' : 'none', 'display');
    if (wait) return;
    if (!st.paused && !st.userPause) {
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
    cv = document.getElementById('road');
    const $ = id => document.getElementById(id);
    Object.assign(hud, { quick:$('quick'), quickD:$('quick').style, en:$('h-en'), month:$('h-month'), cash:$('h-cash'), cashCls:$('h-cash'), bar:$('h-bar').style, speed:$('h-speed'), speedCls:$('h-speed'), lim:$('h-lim'), limD:$('h-lim').style, car:$('h-car'), msgs:$('h-msgs'), ramp:$('h-ramp'), hint:$('h-hint'), pause:$('h-pause').style, flash:$('h-flash').style, load:$('h-load').style });
    document.addEventListener('keydown', e => {
      if (!st.active || st.paused) return;
      if (st.quick && /^[1-9]$/.test(e.key)) { quickPick(+e.key - 1); e.preventDefault(); return; }
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
    $('quick').addEventListener('pointerdown', e => { const b = e.target.closest('button[data-i]'); if (!b) return; e.preventDefault(); if (!st.paused && !st.userPause) quickPick(+b.dataset.i); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && st.active && !st.paused) st.userPause = true; });
  }

  // ---------- julkinen rajapinta ----------
  function start() {
    if (gfxFail) { showFail(gfxFail); const el = document.getElementById('nogl'); if (el && el.scrollIntoView) el.scrollIntoView(); return; }
    if (!cv) init();
    if (st.S !== S) { st.S = S; st.pos = 0; st.x = 0.5; st.hint = true; }
    st.active = true; st.paused = false; st.userPause = false;
    st.steerIn = 0;
    st.speed = 0; st.monthT = 0; st.ramp = null; st.dyn = []; st.toasts = []; st.keys = {}; st.gig = null; st.gigT = 3;
    st.quick = null; st.boardKm = 15; st.lotDone = false; st.ice = 0; st.iceWarn = false; st.wx = null; st.fx = [];
    st.x = 0.5;
    S.cars.forEach(c => { c.energy = 1; }); if (S.tsa) S.tsa.energy = 1; // kotona ladattu ja tankattu
    st.chg = null; st.kmTot = 0; st.eWarn = 0; scheduleStation();
    st.veh = null; refreshVehicle();
    if (S.trip) tripBegin();
    else { const sea = season();
      if (S.summer > 0 && (sea.snow || sea.temp <= 0)) toast('!Kesärenkaat ja ' + (sea.snow ? 'lunta tiellä' : 'pakkasta') + ': jarrutusmatka pitenee, ja auto liukuu mutkissa.', 6);
      else if (weather().ice) toast(`Keli ${keliTxt().replace(' · LIUKASTA', '')}: tie on liukas. Varo mustaa jäätä.`, 5); }
    document.body.classList.add('driving'); document.body.classList.remove('paused');
    if (View) View.enter();
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
    if (View) View.leave();
    document.body.classList.remove('driving', 'paused');
  }
  return {
    start, resume, stop, rangeOf, hold, quick,
    get active() { return st.active; },
    blockKeys: () => st.active && !st.paused,
    _st: st, _vehicle: vehicle, _seg: i => { ensure(i); return segs[i]; }, // testejä varten
    // 3.0: grafiikka-asetus (aloitusruudun valinta) ja näkymän kytkentä
    gfxName, gfxCycle, get gfx() { return gfx; }, get gfxFail() { return gfxFail; }, fail: showFail,
    attachView(v) { View = v; v.setQuality(gfx); if (st.active) v.enter(); },
    // näkymä lukee simulaation tilan tästä; se ei muuta mitään
    sim: { st, segs, SEG, ROAD, PZ, KMH, DRAW, RAMP_W, RAMP_LEN, MONTH_S, STOP_WIN, CAR_HW, HIT,
      seg: i => { ensure(i); return segs[i]; }, season, weather, limitOf, limTxt, autobahn, towing, eSpec, energy, rampHides,
      game: () => S, carOf: id => C(id), modelSpec, MODELS },
  };
})();
