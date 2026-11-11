// Toiminnallinen testi: ajetaan oikeassa ajassa vähintään kolme kuukautta, liittymä, autoliike, pikavalinnat, tallennus, päivän haaste.
const { open, frames } = require('./lib.js');
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FAIL ') + t); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, log } = await open({ gfx: 'low', viewport: { width: 330, height: 640 } });
  const t0 = Date.now();
  // valikosta tielle oikeita nappeja painamalla
  const click = async re => { const b = page.locator('#choices button', { hasText: re }).first(); await b.click(); };
  ok(await page.locator('#choices button', { hasText: /Grafiikka: Matala/ }).count() === 1, 'aloitusruudussa Grafiikka-valinta (tallennettu Matala)');
  await click(/Grafiikka/); ok(await page.locator('#choices button', { hasText: /Grafiikka: Keski/ }).count() === 1, 'Grafiikka vaihtuu napista (Keski)');
  ok(await page.evaluate(() => localStorage.getItem('paalaan3.gfx')) === 'med', 'grafiikka-asetus tallentuu (paalaan3.gfx)');
  await page.evaluate(() => { localStorage.setItem('paalaan3.gfx', 'low'); }); await page.reload();
  await click(/Uusi peli/); await page.locator('#choices button').first().click();
  await click(/Jatka/);
  for (let i = 0; i < 6 && !(await page.evaluate(() => Drive.active)); i++) { const p = page.locator('#choices button.paa'); if (await p.count()) await p.first().click(); else await page.locator('#choices button:not([disabled])').first().click(); }
  ok(await page.evaluate(() => Drive.active), 'PAALAAN!-napista ajotilaan');
  await page.waitForFunction(() => document.getElementById('h-load').style.display === 'none', null, { timeout: 120000 });
  // autopilotti: pitää kaistan ja 70 km/h, mode vaihtaa tavoitetta
  await page.evaluate(() => {
    window.AP = { mode: 'lane', log: [], months: [S.m] };
    setInterval(() => {
      const st = Drive._st, s = Drive.sim; if (!Drive.active || st.paused) return;
      const cur = Math.floor((st.pos + s.PZ) / s.SEG), kmh = st.speed / s.KMH;
      let tx = 0.5, vmax = 70;
      const lot = st.dyn.find(d => d.lot && !d.used);
      if (AP.mode === 'lot' && lot) { const d = lot.at - cur; tx = 0.8; if (d < 60) vmax = Math.max(8, d * 1.2); if (d <= 2) vmax = 0; }
      if (AP.mode === 'exit' && st.ramp && cur > st.ramp.start + 6) tx = 1.5;
      // väistä edessä olevat esteet omalla kaistalla
      for (const d of st.dyn) { const rel = (d.z - st.pos - s.PZ) / s.SEG; if (rel > 0 && rel < 40 && ['peura', 'poro', 'kuoppa', 'kivi', 'auto'].includes(d.k) && Math.abs(d.x - tx) < 0.4) { if (d.k === 'auto') vmax = Math.min(vmax, Math.abs(d.v) / s.KMH - 5); else tx = d.x > 0.45 ? 0.1 : 0.85; } }
      st.keys.left = st.x > tx + 0.04; st.keys.right = st.x < tx - 0.04; st.keys.brake = kmh > vmax;
      if (AP.months[AP.months.length - 1] !== S.m) AP.months.push(S.m);
    }, 40);
  });
  // paneelit (kolarit, tapahtumat) kuitataan ensimmäisellä valinnalla, jotta ajo jatkuu
  const pump = async (cond, maxMs, label) => {
    const t = Date.now();
    while (Date.now() - t < maxMs) {
      if (await page.evaluate(cond)) return true;
      const st = await page.evaluate(() => ({ paused: Drive.active && Drive._st.paused, over: S.over, active: Drive.active, title: document.getElementById('title').textContent }));
      if (st.over) { console.log('peli päättyi kesken testin: ' + st.title); return false; }
      if (st.paused) { const b = page.locator('#choices button:not([disabled])').first(); if (await b.count()) await b.click().catch(() => {}); }
      await page.waitForTimeout(700);
    }
    console.log('aikakatkaisu: ' + label); return false;
  };
  // 1) pikavalinta näppäimellä ja napautuksella
  await page.evaluate(() => { window.QP = []; scr('HUHU', ['Testihuhu: bensan hinta nousee.'], [['Usko', () => { QP.push('a'); next(); }], ['Älä usko', () => { QP.push('b'); next(); }]]); });
  await page.waitForFunction(() => document.getElementById('quick').style.display === 'block', null, { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => document.getElementById('quick').style.display === 'block' && !Drive._st.paused), 'pikavalinta näkyy tien päällä, peli ei pysähdy');
  await page.screenshot({ path: (process.env.KUVAT || require('os').tmpdir()) + '/f_quick.png' });
  await page.keyboard.press('1'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => QP.join('') === 'a' && !Drive._st.quick), 'pikavalinta näppäimellä 1');
  await page.evaluate(() => { scr('HUHU', ['Toinen testihuhu.'], [['Usko', () => { QP.push('a'); next(); }], ['Älä usko', () => { QP.push('b'); next(); }]]); });
  await page.waitForTimeout(400);
  await page.locator('#quick button[data-i="1"]').dispatchEvent('pointerdown'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => QP.join('') === 'ab' && !Drive._st.quick), 'pikavalinta napautuksella');
  // 2) autoliikkeen pihaan
  await page.evaluate(() => { AP.mode = 'lot'; });
  const m0 = await page.evaluate(() => S.m);
  const gotLot = await pump(() => /AUTOLIIKE|LIIKKEEN PIHA|PIHASSA/i.test(document.getElementById('title').textContent) && Drive._st.paused, 1200000, 'autoliike');
  const lotTitle = await page.evaluate(() => document.getElementById('title').textContent);
  ok(gotLot, 'autoliikkeen pihaan pysähtyminen avaa liikkeen (' + lotTitle + ')');
  await page.screenshot({ path: (process.env.KUVAT || require('os').tmpdir()) + '/f_lot.png' });
  if (gotLot) { await page.locator('#choices button', { hasText: /Takaisin|tielle|Jatka/i }).last().click(); }
  // 3) ajetaan liittymien ohi, kunnes kolme kuukautta on vaihtunut tiellä
  await page.evaluate(() => { AP.mode = 'lane'; });
  const three = await pump(() => S.m >= AP.months[0] + 3, 3000000, 'kolme kuukautta');
  const info = await page.evaluate(() => ({ months: AP.months, km: Math.round(S.stat.km), cash: S.cash }));
  ok(three, `kolme kuukautta ajettu putkeen: ${info.months.join(' → ')} (${info.km} km, ${Math.round((Date.now() - t0) / 1000)} s seinäkelloa)`);
  // 4) seuraavasta liittymästä valikkoon
  await page.evaluate(() => { AP.mode = 'exit'; });
  const exited = await pump(() => !Drive.active && /TILIOTE/.test(document.getElementById('title').textContent), 900000, 'liittymä');
  ok(exited, 'liittymästä tiliotteeseen ja valikkoon');
  if (exited) { await click(/Jatka/); for (let i = 0; i < 8; i++) { if (await page.locator('#choices button.paa').count()) break; await page.locator('#choices button:not([disabled])').first().click(); } }
  ok(await page.locator('#choices button.paa').count() === 1, 'valikossa PAALAAN!-nappi');
  // 5) tallennus ja lataus
  const saved = await page.evaluate(() => { saveGame(); return { m: S.m, cash: S.cash, cars: S.cars.length, raw: !!localStorage.getItem('paalaan3.save'), v2: localStorage.getItem('paalaan2.save') }; });
  ok(saved.raw && saved.v2 === null, 'tallennus avaimella paalaan3.save, ei koske 2.0:n tallennukseen');
  await page.reload();
  ok(await page.locator('#choices button', { hasText: /Jatka peliä/ }).count() === 1, 'aloitusruutu tarjoaa tallennetun pelin');
  await click(/Jatka peliä/);
  const loaded = await page.evaluate(() => ({ m: S.m, cash: S.cash, cars: S.cars.length }));
  ok(loaded.m === saved.m && loaded.cash === saved.cash && loaded.cars === saved.cars, `lataus palauttaa tilan (KK ${loaded.m}, kassa ${loaded.cash})`);
  // 6) päivän haaste: sama siemen antaa samat kuukaudet
  const daily = await page.evaluate(() => {
    const run = () => { const d = dailyInfo(); S = newState(d.target); S.seed = d.seed; S.daily = d.txt; RND = seededRnd; const out = []; for (let i = 0; i < 8; i++) { Q = []; out.push(JSON.stringify(monthTick()) + '|' + Q.length + '|' + Math.round(S.cash)); S.m++; } return out.join('\n'); };
    const a = run(), b = run(); return { same: a === b, len: a.length };
  });
  ok(daily.same && daily.len > 200, 'päivän haaste: sama siemen antaa samat kahdeksan kuukautta');
  ok(log.external.length === 0, 'ei pyyntöjä localhostin ulkopuolelle (' + log.requests + ' pyyntöä)');
  ok(log.errors.length === 0, 'ei virheitä tai varoituksia konsolissa' + (log.errors.length ? ': ' + log.errors.slice(0, 4).join(' | ').slice(0, 600) : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
