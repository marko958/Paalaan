// PAALAAN! 2.0 – ajofysiikan mittaukset. Ajo: node v2/tools/fysiikka.js (vaatii Playwrightin ja Chromiumin).
// Ajaa pelin fysiikkaa keinotekoisella tiellä (Drive._st.testSeg) ilman piirtoa ja tulostaa kiihtyvyydet, jarrutusmatkat,
// kaarteiden pidon eri keleillä, kaistanvaihdon, kuvataajuusriippuvuuden, liukkauden ja mäkien vaikutuksen.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html') + ''); await p.waitForTimeout(200);
  const res = await p.evaluate(() => {
    const KMH = Drive._KMH, out = [];
    const setup = (car, m, opt) => {
      Drive.stop(); RND = Math.random; S = newState(0); S.m = m || 7;
      const id = CARS.findIndex(c => c[0].startsWith(car)); S.cars[0].c = id;
      Object.assign(S, opt || {});
      Drive.start(); Drive.stop();   // alustaa tilan, pysäyttää silmukan
      const st = Drive._st; st.pos = 0; st.x = 0.5; st.speed = 0; st.keys = {}; st.ice = 0; st.vx = 0; st.sa = 0; return st;
    };
    const run = (st, sec, dt, fn) => { for (let t = 0; t < sec; t += dt) { if (fn && fn(t) === false) return t; Drive._physics(dt); } return sec; };
    const road = (st, curve, slope) => { st.testSeg = { i: 5, curve: curve || 0, slope: slope || 0, p1: { world: { y: 0 } }, p2: { world: { y: (slope || 0) * 200 } } }; };
    const M = st => (st.pos / 200 * 5);
    // 1) kiihtyvyys ja huippunopeus tasaisella
    for (const car of ['Ford Mondeo', 'Tesla Model 3', 'Porsche Taycan', 'Fiat Topolino', 'Dacia Spring']) {
      const st = setup(car); road(st); let t100 = null, t80 = null;
      run(st, 60, 1 / 60, t => { if (t100 === null && st.speed >= 100 * KMH) t100 = t; if (t80 === null && st.speed >= 80 * KMH) t80 = t; });
      out.push(`${car}: vmax ${Math.round(st.veh.vmax)}, 0-80 ${t80 === null ? '-' : t80.toFixed(1)} s, 0-100 ${t100 === null ? '-' : t100.toFixed(1)} s, 60 s jälkeen ${Math.round(st.speed / KMH)} km/h`);
    }
    { const st = setup('Tesla Model 3', 1); road(st); let t100 = null; run(st, 20, 1 / 60, t => { if (t100 === null && st.speed >= 100 * KMH) t100 = t; }); out.push(`Tesla Model 3 lumella 0-100: ${t100.toFixed(1)} s`); }
    // 2) jarrutus 100 -> 0 eri keleillä
    for (const [name, m, opt, ice] of [['kuiva kesä', 7], ['lumi, talvirenkaat', 1], ['lumi, kesärenkaat', 1, { summer: 1 }], ['musta jää', 1, null, 9]]) {
      const st = setup('Ford Mondeo', m, opt); road(st); st.speed = 100 * KMH; st.keys.brake = true; st.ice = ice || 0;
      const t = run(st, 30, 1 / 60, () => st.speed > 0);
      out.push(`jarrutus 100→0, ${name}: ${t.toFixed(2)} s, ${M(st).toFixed(0)} m`);
    }
    // 3) kaarteet: paras pito täydellä vastaohjauksella vakionopeudessa, 4 s kaarretta; suurin ajautuma ulos (1 = kaistan verran)
    for (const [name, m, opt] of [['kuiva', 7], ['lumi+talvi', 1], ['lumi+kesä', 1, { summer: 1 }]]) for (const c of [1.5, 3, 4.5]) {
      const row = [];
      for (const kmh of [60, 80, 100, 120, 160]) {
        const st = setup('Porsche Taycan', m, opt); road(st, c); st.x = 0; let worst = 0;
        run(st, 4, 1 / 60, () => { st.speed = kmh * KMH; st.keys.right = st.x < 0; st.keys.left = false; worst = Math.max(worst, -st.x); });
        row.push(`${kmh}:${worst.toFixed(2)}`);
      }
      out.push(`kaarre ${c} ${name}: ${row.join('  ')}`);
    }
    // 4) kaistanvaihto (x 0.5 → −0.5) ja ylitys
    for (const [nm, m] of [['kuiva', 7], ['lumi', 1]]) for (const kmh of [50, 100, 160]) {
      const st = setup('Porsche Taycan', m); road(st); st.x = 0.5; let over = 0, tt = null;
      run(st, 6, 1 / 60, t => { st.speed = kmh * KMH; st.keys.left = st.x > -0.5 && tt === null; if (tt === null && st.x <= -0.5) tt = t; if (tt !== null) over = Math.max(over, -0.5 - st.x); });
      out.push(`kaistanvaihto ${nm} ${kmh} km/h: ${tt === null ? '-' : tt.toFixed(2)} s, ylitys ${over.toFixed(3)}`);
    }
    // 5) kuvataajuus: sama ajo 30, 60 ja 144 fps
    { const r = [];
      for (const fps of [30, 60, 144]) { const st = setup('Tesla Model 3'); road(st, 3); st.x = 0.5; st.speed = 60 * KMH;
        run(st, 5, 1 / fps, t => { st.keys.right = t > 0.5 && t < 1.6; st.keys.brake = t > 3.5 && t < 4; });
        r.push(`${fps} fps: x ${st.x.toFixed(3)}, ${(st.speed / KMH).toFixed(1)} km/h, ${M(st).toFixed(0)} m`); }
      out.push('kuvataajuus: ' + r.join(' | ')); }
    // 6) liukkaus: ohjaus täysillä 1 s @100, sitten vapautus 1 s
    for (const [nm, m, ice] of [['kuiva', 7, 0], ['lumi', 1, 0], ['musta jää', 1, 5]]) { const st = setup('Ford Mondeo', m); road(st); st.x = 0; st.ice = ice; run(st, 1, 1 / 60, () => { st.speed = 100 * KMH; st.keys.right = true; }); const x1 = st.x; st.keys.right = false; run(st, 1, 1 / 60, () => { st.speed = 100 * KMH; }); out.push(`ohjaus 1 s @100 ${nm}: x ${x1.toFixed(2)}, vapautuksen jälkeen 1 s: ${st.x.toFixed(2)} (liuku ${(st.x - x1).toFixed(2)})`); }
    // 7) mäet: tasaantuva nopeus 30 %:n ylä- ja alamäessä
    for (const car of ['Ford Mondeo', 'Fiat Topolino', 'Tesla Model 3']) { const r = []; for (const sl of [0.3, 0, -0.3]) { const st = setup(car); road(st, 0, sl); run(st, 60, 1 / 60); r.push(`${sl > 0 ? 'ylämäki' : sl < 0 ? 'alamäki' : 'tasainen'} ${Math.round(st.speed / KMH)}`); } out.push(`${car} (vmax ${Math.round(Drive._st.veh.vmax)}): ${r.join(', ')} km/h`); }
    // 8) vakaus: suoralla ilman ohjausta x ei muutu; pientare hidastaa
    { const st = setup('Ford Mondeo'); road(st); st.x = 0.5; run(st, 10, 1 / 60); out.push(`suora 10 s ilman ohjausta: x ${st.x.toFixed(3)}`);
      const s2 = setup('Tesla Model 3'); road(s2); s2.x = 1.6; s2.speed = 120 * KMH; run(s2, 4, 1 / 60); out.push(`pientareella 4 s (lähtö 120): ${Math.round(s2.speed / KMH)} km/h`); }
    { let n = 0, sum = 0, big = 0; for (let i = 100; i < 20000; i++) { const q = Drive._seg(i), sl = Math.abs(q.p2.world.y - q.p1.world.y) / 200; n++; sum += Math.min(0.4, sl); if (sl > 0.2) big++; } out.push(`mäet: keskijyrkkyys ${(sum / n * 100).toFixed(0)} %, yli 20 %: ${(big / n * 100).toFixed(0)} % matkasta`); }
    Drive._st.testSeg = null;
    return out;
  });
  console.log(res.join('\n')); console.log('errors', errs);
  await b.close();
})();
