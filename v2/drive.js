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
    pos:0, x:0.5, speed:0, gig:null, gigT:3, monthT:0, ramp:null, dyn:[], toasts:[], keys:{}, veh:null,
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
    return {
      m,
      snow: [11, 0, 1, 2].includes(m),
      autumn: [8, 9].includes(m),
      bare: m === 10, // marraskuu: ruskea maa, lehdettömät koivut
      dark: [10, 11, 0].includes(m) ? 0.72 : [1, 9].includes(m) ? 0.35 : 0,
      deerPerMonth: m >= 8 && m <= 11 ? 4 : 2,
      holesPerMonth: [2, 3, 4].includes(m) ? 7 : 3, // kelirikko keväällä
    };
  }

  const winterLimits = () => [9, 10, 11, 0, 1, 2].includes((S.m - 1) % 12); // talvinopeusrajoitukset loka–maalis
  // peräkärry perässä, kun muuttokeikat ovat päällä eikä pakua ole
  const towing = () => !!(S.gigs && !vanOK() && trailerOK());
  const limitOf = lim => { const l = lim === 'H' ? (winterLimits() ? 80 : 100) : lim; return towing() ? Math.min(80, l) : l; };

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
    st.flash = 0.8;
    (S.post = S.post || []).push([`Nopeuskamera: ${kmh} km/h, rajoitus ${lim} (${kind})`, f]);
    toast(`!SALAMA! ${kmh} km/h alueella ${lim}. Sakko ${eur(f)} tulee postissa.`, 5);
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
    if (k.fl.includes('B')) vmax = 130;
    vmax = Math.min(230, Math.max(125, vmax));
    let acc = k.type === 'e' ? Math.min(36, 20 + k.price / 4000) : Math.min(24, 12 + k.price / 6000);
    const minor = car ? (car.minor || 0) : 0;
    if (minor) { vmax *= 0.92; acc *= 0.85; }
    if (!T && towing()) { vmax = Math.min(vmax, 120); acc *= 0.75; }
    return { bus:false, tsa:!!T, name:k.name, vmax, acc, spec:modelSpec(k), mb: T ? T.mb : car.mb, minor };
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
      if (st.gig && st.gig.phase === 'deliver') Q.unshift(() => say('KEIKKA JÄI KESKEN', ['!Ajoit liittymästä kotiin kesken keikan. Siitä ei makseta.']));
      st.gig = null;
      stop();
      return scr(`${monthName()}: TILIOTE`, tilioteLines(R), [['Jatka', next]]);
    }
    let plus = 0, minus = 0;
    R.forEach(r => { if (r[0] === '+') plus += r[2]; else if (r[0] === '-') minus += r[2]; });
    toast(`${KK[(S.m - 1) % 12].toUpperCase()}KUU: +${eur(plus)} / −${eur(minus)} · KASSA ${eur(S.cash)}`, 6);
    R.filter(r => r[0] === '+' && /keikat|toimitukset|kyydit/i.test(r[1])).forEach(r => toast(`+${r[1]}: ${eur(r[2])}`, 6));
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
    crashStop(); gigCrash();
    Q.unshift(() => damageEvent(kmh >= 50 ? 'peura' : 'kolhu', { title: on ? 'NOKKAKOLARI!' : 'PERÄÄNAJO!', txt: txt + (on ? ' Syy on sinun.' : ' Peräänajaja on aina syyllinen.'), total: kmh >= 100 }));
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
    st.speed *= 0.4; st.paused = true;
    gigCrash();
    Q.unshift(() => dentEvent(d.k === 'kuoppa' ? 'isoon kuoppaan' : 'kiveen', kmh));
    setTimeout(() => { if (st.active) openEvents(); }, 350);
  }
  function hitDeer(d) {
    st.dyn.splice(st.dyn.indexOf(d), 1);
    const kmh = st.speed / KMH;
    if (kmh < 35) { st.speed *= 0.4; st.shake = 0.3; return toast('Peura säikähti ja loikkasi metsään. Huh.'); }
    crashStop(); gigCrash();
    Q.unshift(() => damageEvent('peura', kmh >= 100 ? { total:true, txt:`Peura osui keulaan ${Math.round(kmh)} km/h:n vauhdissa.` } : {}));
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
    crashStop(); gigCrash();
    Q.unshift(() => damageEvent(kmh >= 50 ? 'peura' : 'kolhu', opt));
    setTimeout(() => { if (st.active) openEvents(); }, 450);
  }

  // ---------- keikat: Wolt ja taksi ----------
  const FOOD = ['KEBAB', 'PIZZA', 'SUSHI', 'BURGER', 'THAI', 'PHO', 'GRILLI'];
  const DEST = ['Lentokentälle', 'Rautatieasemalle', 'Keskustaan', 'Sairaalalle', 'Kauppakeskukseen', 'Satamaan', 'Hotellille'];
  const STOP_WIN = 8; // pysähdysikkuna segmentteinä kohteen molemmin puolin
  const LOAD_S = 3; // muuttokuorman kantaminen ja purku (s)
  // muuttokeikka vaatii, että ajossa on paku tai vetokoukullinen auto ja peräkärry
  const muuttoOK = d => !!d && (C(d.c).fl.includes('V') || (!!S.trailer && towOK(d)));
  function gigKinds() {
    const d = drivenCar();
    if (S.tsa || !d) return [];
    const k = [];
    if (S.wolt) k.push('wolt');
    if (S.taxi && taxiOK(d)) k.push('taxi');
    if (S.gigs && muuttoOK(d)) k.push('muutto');
    return k;
  }
  const gigMarkers = () => st.dyn.filter(o => o.gig);
  function gigClear() { st.dyn = st.dyn.filter(o => !o.gig); st.gig = null; st.gigT = 3 + Math.random() * 4; }
  function gigSpawn(kind) {
    const at = Math.floor((st.pos + PZ) / SEG) + 90 + Math.floor(Math.random() * 60);
    if (st.ramp && at > st.ramp.start - 20 && at < st.ramp.end + 10) return;
    const food = FOOD[Math.floor(Math.random() * FOOD.length)];
    st.gig = { kind, phase:'pickup', at, food, t:0, off:0, crash:0 };
    st.dyn.push(kind === 'wolt' ? { k:'ravintola', z:at * SEG, x:1.75, t:food, gig:true } : kind === 'muutto' ? { k:'muutto', z:at * SEG, x:2.0, gig:true } : { k:'asiakas', z:at * SEG, x:1.3, gig:true });
  }
  function gigBook(kind, pay) {
    S.gig = S.gig || {};
    S.gig[kind] = (S.gig[kind] || 0) + pay; S.gig[kind + 'N'] = (S.gig[kind + 'N'] || 0) + 1;
    if (kind === 'muutto') { S.black += pay; if (S.trailer && !C(drivenCar().c).fl.includes('V')) S.trailer.wear++; }
    const car = drivenCar();
    if (car) { // kuluminen per keikka
      car.base *= kind === 'wolt' ? 0.999 : kind === 'muutto' ? 0.997 : 0.996;
      car.tire -= kind === 'wolt' ? 0.25 : kind === 'muutto' ? 0.5 : 0.6;
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
      if (G.kind === 'muutto') return toast('!Kuorma jäi kesken matkan. Asiakas ei maksa.');
      if (G.kind === 'taxi') { S.taxiStars = (S.taxiStars === undefined ? 5 : S.taxiStars) * 0.7 + 0.3; return toast('!Asiakas jäi tien varteen. Kyydistä ei makseta, ja tähtiä tuli yksi.'); }
      return toast('!Ruoka ei päässyt perille. Toimituksesta ei makseta.');
    }
    const cur = Math.floor(z1 / SEG);
    G.t += dt;
    if (G.phase === 'deliver' && (st.x < -1 || st.x > 1)) G.off += dt;
    const near = Math.abs(cur - G.at) <= STOP_WIN, stopped = st.speed < 15 * KMH && st.x > 0.25;
    if (G.kind === 'muutto') { // kuorma kannetaan ja puretaan: pitää seistä kohdalla hetki
      if (near && stopped) { G.load = (G.load || 0) + dt; if (G.load < LOAD_S) return; G.load = 0; }
      else { G.load = 0; }
      if (near && stopped) return G.phase === 'pickup' ? gigPickup(G, cur) : gigFinish(G, false);
    } else if (near && stopped) return G.phase === 'pickup' ? gigPickup(G, cur) : gigFinish(G, false);
    if (cur > G.at + STOP_WIN) {
      if (G.phase === 'pickup') { gigClear(); return toast(G.kind === 'wolt' ? 'Ohitit ravintolan. Tilaus meni toiselle kuskille.' : G.kind === 'muutto' ? 'Ohitit muuttoasiakkaan. Hän soitti toiselle Marketplace-kuskille.' : 'Ohitit asiakkaan. Hän tilasi kilpailijan.'); }
      if (G.kind === 'wolt') { gigClear(); return toast('!Ohitit asiakkaan oven. Tilaus peruttiin, ei palkkiota.'); }
      return gigFinish(G, true);
    }
  }
  function gigPickup(G, cur) {
    st.dyn = st.dyn.filter(o => !o.gig);
    const dist = G.kind === 'wolt' ? 220 + Math.floor(Math.random() * 220) : G.kind === 'muutto' ? 350 + Math.floor(Math.random() * 350) : 450 + Math.floor(Math.random() * 450);
    G.phase = 'deliver'; G.at = cur + dist; G.t = 0;
    G.limit = dist * SEG / (85 * KMH) + 6;
    const van = C(drivenCar().c).fl.includes('V');
    G.pay = G.kind === 'wolt' ? ri(12, 24) * 5 : G.kind === 'muutto' ? (van ? ri(30, 80) : ri(20, 60)) * 5 : ri(30, 80) * 5;
    if (G.kind === 'muutto') G.limit = Infinity;
    G.dest = DEST[Math.floor(Math.random() * DEST.length)];
    if (G.kind === 'taxi' && C(drivenCar().c).fl.includes('B')) { G.pay = Math.round(G.pay * 1.6 / 5) * 5; G.big = true; } // tila-auto: isot porukat
    st.dyn.push({ k:'kohde', z:G.at * SEG, x:1.45, t: G.kind === 'wolt' ? 'TOIMITUS' : G.kind === 'muutto' ? 'PURKU' : 'KOHDE', gig:true });
    if (G.kind === 'muutto') return toast(van ? '+Paku täynnä: sohva, 40 laatikkoa ja kuntopyörä. Vie ne perille.' : '+Kärry täynnä: sohva, 40 laatikkoa ja kuntopyörä. Vie ne perille, max 80 km/h.', 4);
    toast(G.kind === 'wolt' ? `+${G.food} kyytiin. Vie se perille ennen kuin se jäähtyy.` : G.big ? `+8 hengen porukka kyytiin: "${G.dest}, ja äkkiä!" (tila-autolla isompi taksa)` : `+Asiakas kyytiin: "${G.dest}, ja äkkiä!"`, 4);
  }
  function gigFinish(G, missed) {
    const late = G.t > G.limit;
    let pay, msg;
    if (G.kind === 'muutto') {
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
    if (G.kind === 'muutto') { gigClear(); Q.push(() => say('KUORMA LEVISI', ['!Kolarissa kuorma levisi pitkin tietä. Asiakas ei maksa, ja hänen kuntopyöränsä on nyt ojassa.'])); return; }
    if (G.kind === 'wolt') { gigClear(); Q.push(() => say('KEITTO KAATUI', ['!Tilaus levisi pitkin takapenkkiä. Toimitus peruttiin, eikä siitä makseta.'])); }
    else G.crash++;
  }
  function gigHud() {
    const G = st.gig;
    if (!G) return null;
    const d = Math.max(0, G.at - Math.floor((st.pos + PZ) / SEG)) * 5;
    const dist = d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} KM` : `${d} M`;
    if (G.kind === 'muutto') {
      if (G.load > 0) return `MUUTTO: ${G.phase === 'pickup' ? 'KANNETAAN KUORMAA' : 'PURETAAN'}… ${Math.ceil(LOAD_S - G.load)} S`;
      return G.phase === 'pickup' ? `MUUTTO: ASIAKAS ${dist} · PYSÄHDY KOHDALLE` : `MUUTTO: PURKUPAIKKA ${dist} · PYSÄHDY KOHDALLE`;
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
    if (!v.bus && Math.random() < dt * sea.holesPerMonth / MONTH_S) spawnHazard();
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
      if (d.k === 'peura') {
        if ((d.z - z1) / SEG < d.wake) d.x += d.vx * dt;
        if (Math.abs(d.x) > 3) { st.dyn.splice(st.dyn.indexOf(d), 1); continue; }
        if (!v.bus && d.z >= z0 && d.z < z1 + 1 && Math.abs(d.x - st.x) < 0.15 + CAR_HW) { hitDeer(d); return; }
      }
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
      case 'ravintola': {
        P(-60, 0, 120, 1000, COL.grey1);
        P(-1000, 900, 2000, 900, COL.white); P(-950, 950, 1900, 800, '#B03A2E');
        if (s * 2000 > 24) { g.fillStyle = COL.white; g.textAlign = 'center'; g.font = `${Math.max(6, Math.round(s * 560))}px VT323`; g.fillText(o.t, cx, by - 1150 * s); g.textAlign = 'left'; }
        break; }
      case 'asiakas': {
        const wave = Math.floor(performance.now() / 250) % 2;
        P(-120, 0, 90, 500, '#2A2A3A'); P(30, 0, 90, 500, '#2A2A3A');   // jalat
        P(-170, 480, 340, 500, '#2F6DB5');                              // takki
        P(-110, 980, 220, 220, '#E8B890');                              // pää
        P(-120, 1150, 240, 80, '#3A2A1A');                              // pipo
        P(170, 900 + wave * 150, 80, 400, '#2F6DB5');                   // heiluva käsi
        if (s * 1000 > 14) { g.fillStyle = COL.yellow; g.textAlign = 'center'; g.font = `${Math.max(6, Math.round(s * 380))}px VT323`; g.fillText('TAKSI!', cx, by - 1500 * s); g.textAlign = 'left'; }
        break; }
      case 'muutto': { // muuttava talo: laatikoita ja sohva pihalla
        P(-1300, 0, 2600, 1500, '#C8B27A'); P(-1300, 0, 120, 1500, COL.white); P(1180, 0, 120, 1500, COL.white);
        tri(-1500, 1500, 1500, 1500, 0, 2400, sea.snow ? '#FFFFFF' : COL.grey1);
        P(-700, 600, 400, 400, '#A5C8FF'); P(300, 600, 400, 400, '#A5C8FF');
        P(-1700, 0, 300, 300, '#B08850'); P(-1650, 300, 250, 250, '#C09860'); P(-1300, 0, 280, 280, '#B08850'); // laatikot
        P(1400, 0, 700, 250, '#7A2E2E'); P(1400, 250, 120, 200, '#7A2E2E'); P(1980, 250, 120, 200, '#7A2E2E'); // sohva
        if (s * 2600 > 24) { g.fillStyle = COL.yellow; g.textAlign = 'center'; g.font = `${Math.max(6, Math.round(s * 460))}px VT323`; g.fillText('MUUTTO', cx, by - 2600 * s); g.textAlign = 'left'; }
        break; }
      case 'kohde': {
        const blink = Math.floor(performance.now() / 300) % 2;
        P(-40, 0, 80, 1700, COL.yellow);
        P(40, 1300, 600, 380, blink ? '#FF8A80' : COL.yellow);
        if (s * 1000 > 14) { g.fillStyle = COL.white; g.textAlign = 'center'; g.font = `${Math.max(6, Math.round(s * 380))}px VT323`; g.fillText(o.t, cx, by - 1900 * s); g.textAlign = 'left'; }
        break; }
      case 'raja': { // nopeusrajoitusmerkki
        P(-35, 0, 70, 1000, COL.grey3);
        P(-330, 1000, 660, 660, '#D02020'); P(-380, 1060, 760, 540, '#D02020'); P(-270, 1080, 540, 500, '#FFFFFF'); P(-210, 1040, 420, 580, '#FFFFFF');
        if (s * 660 > 9) { g.fillStyle = COL.black; g.textAlign = 'center'; g.font = `${Math.max(5, Math.round(s * 420))}px VT323`; g.fillText(String(limitOf(o.lim)), cx, by - 1180 * s); g.textAlign = 'left'; }
        break; }
      case 'valvonta': { // automaattinen liikennevalvonta -merkki
        P(-35, 0, 70, 1000, COL.grey3);
        P(-380, 1000, 760, 700, '#FFFFFF'); P(-340, 1040, 680, 620, '#1F4FB5');
        P(-180, 1200, 300, 200, '#FFFFFF'); P(120, 1260, 80, 80, '#FFFFFF'); P(-60, 1250, 80, 100, '#1F4FB5'); // kameran kuva
        break; }
      case 'kamera': { // kameratolppa
        P(-90, 0, 180, 1900, '#6E6E72');
        P(-260, 1900, 520, 900, '#8E8E92'); P(-260, 2800, 520, 60, '#EEEE77'); P(-260, 1900, 520, 60, '#EEEE77');
        P(-180, 2150, 360, 360, '#101012'); P(-90, 2240, 180, 180, st.flash > 0.3 ? '#FFFFFF' : '#3A3A8A');
        break; }
      case 'auto': { // samaan suuntaan: takaa
        const lit = sea.dark > 0.3 ? '#FF3030' : '#A01818';
        if (!(sea.dark > 0.6 && n > 50)) {
          P(-210, 0, 80, 60, COL.black); P(130, 0, 80, 60, COL.black);
          P(-225, 40, 450, 150, o.col); P(-170, 190, 340, 110, o.col); P(-150, 200, 300, 80, '#1E2A3A');
          P(-60, 70, 120, 40, COL.white);
        }
        P(-220, 120, 70, 35, lit); P(150, 120, 70, 35, lit);
        break; }
      case 'vasta': { // vastaantuleva: edestä
        const head = sea.dark > 0.3 ? '#FFFFEE' : '#E8E8D0';
        if (!(sea.dark > 0.6 && n > 50)) {
          P(-210, 0, 80, 60, COL.black); P(130, 0, 80, 60, COL.black);
          P(-225, 40, 450, 150, o.col); P(-180, 190, 360, 120, o.col); P(-160, 195, 320, 95, '#2A3A4E');
          P(-70, 60, 140, 40, '#222');
        }
        P(-215, 110, 80, 40, head); P(135, 110, 80, 40, head);
        if (sea.dark > 0.3) { g.fillStyle = 'rgba(255,255,220,0.25)'; g.fillRect(cx - 320 * s, by - 220 * s, 640 * s, 200 * s); }
        break; }
      case 'kuoppa': {
        const rim = sea.snow ? '#C8C8D0' : '#8A8A8A', c = sea.snow ? '#505058' : '#101012';
        P(-420, -20, 840, 110, rim); P(-340, 90, 680, 30, rim);
        P(-360, 0, 720, 80, c); P(-280, 80, 560, 25, c);
        if (!sea.snow) P(-180, 20, 260, 30, '#4A5A78'); // vesilätäkkö
        break; }
      case 'kivi': {
        P(-260, 0, 520, 160, '#5E5E62'); P(-200, 160, 400, 90, '#6E6E72'); P(-120, 250, 220, 50, '#7E7E82');
        P(-160, 180, 80, 40, '#9A9A9E'); if (sea.snow) P(-180, 250, 300, 40, '#FFFFFF');
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
      let list = st.ramp ? seg.sprites.filter(o => !rampHides(seg, o)) : seg.sprites;
      if (byIdx[seg.i]) list = list.concat(byIdx[seg.i]);
      if (!list.length) continue;
      const sc = seg.p1.screen, s = sc.scale * W / 2;
      if (s * 3000 < 0.6) continue;
      g.save(); g.beginPath(); g.rect(0, 0, W, seg.clip); g.clip();
      for (const o of list) sprite(o, sc.x + s * o.x * ROAD, sc.y, s, sea, n);
      g.restore();
    }
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
  ];
  function modelSpec(k) {
    const m = MODELS.find(([n]) => k.name.startsWith(n));
    if (m) return m[1];
    return { b: k.type === 'e' ? 'hatch' : 'sedan', c: COL.grey3, tl:'corner', x: k.type === 'b' ? ['exh1'] : [] };
  }
  // korityyppien mitat (pikseleinä, leveys 72 = 1.0)
  const BODY = {
    sedan:    { bh:15, cl:6, rw:0.66, cab:12, bw:0.92 },
    fastback: { bh:15, cl:6, rw:0.58, cab:12, bw:0.94 },
    prius:    { bh:16, cl:6, rw:0.66, cab:14, bw:0.92 },
    hatch:    { bh:17, cl:6, rw:0.78, cab:14, bw:0.9 },
    wagon:    { bh:16, cl:6, rw:0.84, cab:15, bw:0.9 },
    suv:      { bh:20, cl:9, rw:0.8, cab:15, bw:0.9 },
    suvc:     { bh:19, cl:8, rw:0.68, cab:13, bw:0.92 },
    coupe:    { bh:12, cl:5, rw:0.56, cab:10, bw:0.96 },
    mini:     { bh:17, cl:6, rw:0.82, cab:15, bw:0.88 },
    tall:     { bh:18, cl:7, rw:0.86, cab:19, bw:0.88 },
  };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = sh => Math.max(0, Math.min(255, Math.round(((n >> sh) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  function drawModel(v, cx, by, tilt, sea) {
    const sp = v.spec, x = sp.x || [];
    const has = f => x.includes(f);
    const R = (xx, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(cx + xx), Math.round(by - y - h), Math.round(w), Math.round(h)); };
    const trap = (y0, w0, y1, w1, off, c) => quad(cx - w0 / 2, by - y0, cx + w0 / 2, by - y0, cx + w1 / 2 + off, by - y1, cx - w1 / 2 + off, by - y1, c);
    const brake = st.keys.brake, lit = brake ? '#FF3030' : sea.dark > 0.3 ? '#E02828' : '#A01818';
    const W0 = 72 * (sp.w || 1);
    const glassC = sea.dark > 0.3 ? '#0E1420' : '#1E2A3A';
    R(-W0 / 2 + 2, -2, W0 - 4, 3, 'rgba(0,0,0,0.45)'); // varjo

    if (sp.b === 'van') {
      const h = 50;
      R(-W0 / 2 + 3, 0, 12, 8, COL.black); R(W0 / 2 - 15, 0, 12, 8, COL.black);
      R(-W0 / 2, 5, W0, h, sp.c); R(-W0 / 2, 5, W0, 5, '#2A2A2A');
      R(-W0 / 2 + 6, 34, W0 / 2 - 8, 14, glassC); R(2, 34, W0 / 2 - 8, 14, glassC);
      R(-0.5, 10, 1, h - 6, '#9A9A9A');
      R(-W0 / 2 + 1, 18, 5, 26, lit); R(W0 / 2 - 6, 18, 5, 26, lit);
      R(-9, 12, 18, 6, COL.white); R(-8, 13, 16, 4, COL.black);
      return;
    }
    if (sp.b === 'truck') {
      R(-W0 / 2 + 3, 0, 13, 9, COL.black); R(W0 / 2 - 16, 0, 13, 9, COL.black);
      trap(6, W0, 24, W0, 0, sp.c);                       // laatikko
      trap(24, W0 * 0.98, 42, W0 * 0.22, tilt, shade(sp.c, 0.85)); // viisto katto
      trap(31, W0 * 0.6, 38, W0 * 0.32, tilt, glassC);
      R(-W0 / 2 + 2, 21, W0 - 4, 2, lit);                // valopalkki
      R(-W0 / 2, 6, W0, 3, '#3A3A3A');
      R(-9, 10, 18, 6, COL.white); R(-8, 11, 16, 4, COL.black);
      return;
    }
    const B = BODY[sp.b] || BODY.sedan;
    const top = B.cl + B.bh, bodyC = sp.c, lower = has('twotone') ? sp.r : shade(sp.c, 0.7);
    // renkaat
    R(-W0 / 2 + 2, 0, 11, B.cl + 3, COL.black); R(W0 / 2 - 13, 0, 11, B.cl + 3, COL.black);
    // kori: alaosa tummempi, nurkat pyöristetty
    R(-W0 / 2 + 1, B.cl, W0 - 2, B.bh, bodyC);
    R(-W0 / 2, B.cl + 1, W0, B.bh - 2, bodyC);
    R(-W0 / 2 + 1, B.cl, W0 - 2, 5, ['suv', 'suvc'].includes(sp.b) ? '#2A2A2A' : lower);
    if (has('twotone')) R(-W0 / 2 + 1, B.cl, W0 - 2, B.bh * 0.55, lower);
    if (has('orange')) { R(-W0 / 2 + 1, B.cl + 5, W0 - 2, 1, '#E07A1F'); }
    // ohjaamo ja lasi
    const roofC = sp.r && !has('twotone') ? sp.r : bodyC;
    trap(top, W0 * B.bw, top + B.cab, W0 * B.rw, tilt, roofC);
    if (has('blackhatch')) trap(top - 6, W0 * B.bw * 0.8, top + B.cab - 2, W0 * B.rw - 4, tilt, glassC);
    else trap(top + 2, W0 * B.bw - 8, top + B.cab - 2, W0 * B.rw - 4, tilt, glassC);
    if (has('split')) trap(top + B.cab * 0.45, W0 * (B.bw + B.rw) / 2 - 5, top + B.cab * 0.45 + 2, W0 * (B.bw + B.rw) / 2 - 6, tilt, bodyC);
    if (has('spoiler')) trap(top + B.cab - 1, W0 * B.rw + 2, top + B.cab + 1, W0 * B.rw + 2, tilt, roofC);
    if (has('rails')) { R(-W0 * B.rw / 2 + tilt, top + B.cab, 2, 2, '#2A2A2A'); R(W0 * B.rw / 2 - 2 + tilt, top + B.cab, 2, 2, '#2A2A2A'); }
    if (has('duck')) R(-W0 * 0.38, top - 1, W0 * 0.76, 2, shade(sp.c, 0.6));
    if (has('chrome')) R(-W0 * 0.3, top - 6, W0 * 0.6, 1, '#E8E8E8');
    // takavalot
    const ly = top - 7, side = W0 / 2;
    switch (sp.tl) {
      case 'bar':      R(-side + 2, ly, W0 - 4, 2, lit); R(-side + 1, ly - 1, 8, 4, lit); R(side - 9, ly - 1, 8, 4, lit); break;
      case 'wide':     R(-side + 1, ly - 1, 18, 4, lit); R(side - 19, ly - 1, 18, 4, lit); break;
      case 'pixel':    for (let i = 0; i < 4; i++) { R(-side + 2 + (i % 2) * 4, ly - 2 + (i >> 1) * 3, 3, 2, lit); R(side - 9 + (i % 2) * 4, ly - 2 + (i >> 1) * 3, 3, 2, lit); } R(-side + 10, ly, W0 - 20, 1, shade(lit === '#A01818' ? '#A01818' : '#E02828', 0.6)); break;
      case 'vertical': R(-side + 1, ly - 4, 4, 13, lit); R(side - 5, ly - 4, 4, 13, lit); break;
      case 'round':    R(-side + 2, ly - 2, 5, 7, lit); R(side - 7, ly - 2, 5, 7, lit); R(-side + 3, ly - 3, 3, 9, lit); R(side - 6, ly - 3, 3, 9, lit); break;
      case 'tri':      for (let i = 0; i < 3; i++) { R(-side + 2 + i * 3, ly - 3, 2, 8, lit); R(side - 4 - i * 3, ly - 3, 2, 8, lit); } break;
      case 'low':      R(-side + 1, B.cl + 3, 9, 3, lit); R(side - 10, B.cl + 3, 9, 3, lit); R(-side + 2, ly + 1, 10, 1, lit); R(side - 12, ly + 1, 10, 1, lit); break;
      default:         R(-side + 1, ly - 1, 12, 5, lit); R(side - 13, ly - 1, 12, 5, lit);
    }
    // rekkari, pakoputket, diffuusori
    R(-9, B.cl + 6, 18, 6, COL.white); R(-8, B.cl + 7, 16, 4, COL.black); R(-7, B.cl + 8, 2, 2, COL.white);
    if (has('exh1')) R(-side + 14, B.cl - 1, 4, 2, '#222');
    if (has('exh2')) { R(-side + 12, B.cl - 1, 4, 2, '#222'); R(side - 16, B.cl - 1, 4, 2, '#222'); }
    if (has('diff')) for (let i = -2; i <= 2; i++) R(i * 6 - 1, B.cl - 1, 2, 3, '#151515');
    if (has('rust')) { R(-side + 4, B.cl + 2, 3, 2, '#7A4A1E'); R(side - 9, B.cl + 3, 4, 2, '#7A4A1E'); R(-side + 18, B.cl + 1, 2, 2, '#7A4A1E'); }
    if (v.mb) for (let k = 0; k < Math.min(4, v.mb); k++) R(-side + 6 + k * (W0 - 16) / 4, B.cl + B.bh - 6, 6, 4, '#9A9A9A'); // mikrobetonipaikat
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
    const tow = !v.tsa && towing();
    drawModel(v, cx, tow ? by - 14 : by, tilt, sea);
    if (tow) { // peräkärry auton perässä: kapeampi ja matalampi kuin auto, aisa näkyy välissä
      const lit = st.keys.brake ? '#FF3030' : sea.dark > 0.3 ? '#E02828' : '#A01818';
      R(-3, 13, 6, 6, '#222');                                   // aisa
      R(-29, 0, 8, 7, COL.black); R(21, 0, 8, 7, COL.black);     // renkaat
      R(-28, 3, 56, 13, '#3E3A32');                              // runko
      R(-27, 5, 54, 9, '#8A7A5A');                               // vanerilaita
      for (let k = -18; k < 27; k += 9) R(k, 5, 1, 9, '#5E523C');
      R(-28, 14, 56, 2, '#2A2A2A');                              // yläreuna
      R(-27, 4, 6, 3, lit); R(21, 4, 6, 3, lit);                 // valot
      R(-7, 6, 14, 5, COL.white); R(-6, 7, 12, 3, COL.black);    // rekkari
    }
    if (v.minor && Math.random() < 0.4) R(28 + Math.random() * 6, 0, 4, 3, '#BBBBBB'); // savua
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
  // HUD on HTML-tekstiä canvasin päällä, jotta se pysyy terävänä kaikilla näytöillä
  const hud = {};
  const hudSet = (k, v, prop) => { if (hud[k + '_'] !== v) { hud[k + '_'] = v; hud[k][prop || 'textContent'] = v; } };
  const escH = t => String(t).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
  function drawHud() {
    hudSet('month', `KK ${S.m}/${LAST} · ${KK[(S.m - 1) % 12].toUpperCase()}KUU ${2027 + Math.floor((S.m - 1) / 12)}`);
    hudSet('cash', `KASSA ${eur(S.cash)}`);
    hudSet('cashCls', S.cash < 0 ? 'neg' : '', 'className');
    hudSet('bar', Math.min(100, st.monthT / MONTH_S * 100).toFixed(1) + '%', 'width');
    const kmh = Math.round(st.speed / KMH), lim = limitOf(segAt(st.pos + PZ).lim);
    hudSet('speed', `${kmh} km/h`);
    hudSet('speedCls', kmh > lim ? 'over' : '', 'className');
    hudSet('lim', st.veh.bus ? '' : String(lim));
    hudSet('limD', st.veh.bus ? 'none' : 'inline-flex', 'display');
    hudSet('car', st.veh.name + (st.veh.tsa ? ' (työsuhdeauto)' : ''));
    const gh = gigHud();
    const msgs = (gh ? `<p class="gig">${escH(gh)}</p>` : '') + st.toasts.map(t => {
      const c = t.t[0] === '!' ? 'r' : t.t[0] === '+' ? 'g' : '';
      return `<p class="${c}">${escH(c ? t.t.slice(1) : t.t)}</p>`;
    }).join('');
    hudSet('msgs', msgs, 'innerHTML');
    let ramp = '';
    if (st.ramp) {
      const d = st.ramp.start - Math.floor((st.pos + PZ) / SEG);
      if (d > -RAMP_LEN) ramp = d > 0 ? `LIITTYMÄ ${d * 5} m → oikealle = valikko` : 'LIITTYMÄ → oikealle = valikko';
    }
    hudSet('ramp', ramp);
    hudSet('hint', st.hint ? '← → ohjaa · ↓ jarru · P tauko' : '');
    hudSet('pause', st.userPause ? 'flex' : 'none', 'display');
    if (st.flash > 0) { g.fillStyle = `rgba(255,255,255,${st.flash})`; g.fillRect(0, 0, W, H); }
  }
  function render() {
    g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
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
    const $ = id => document.getElementById(id);
    Object.assign(hud, { month:$('h-month'), cash:$('h-cash'), cashCls:$('h-cash'), bar:$('h-bar').style, speed:$('h-speed'), speedCls:$('h-speed'), lim:$('h-lim'), limD:$('h-lim').style, car:$('h-car'), msgs:$('h-msgs'), ramp:$('h-ramp'), hint:$('h-hint'), pause:$('h-pause').style });
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
    st.speed = 0; st.monthT = 0; st.ramp = null; st.dyn = []; st.toasts = []; st.keys = {}; st.gig = null; st.gigT = 3;
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
    if (st.tow) { st.tow = false; st.x = Math.max(-0.85, Math.min(0.85, st.x)); }
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
    _st: st, _vehicle: vehicle, _seg: i => { ensure(i); return segs[i]; }, // testejä varten
  };
})();
