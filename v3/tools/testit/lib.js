// yhteiset apurit Playwright-testeille
const { chromium, devices } = require('playwright');
const URL = (process.env.BASE || 'http://localhost:8765') + '/v3/';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
async function open(opt = {}) {
  const browser = await chromium.launch({ args: ARGS });
  const ctx = await browser.newContext(opt.device ? { ...devices[opt.device] } : { viewport: opt.viewport || { width: 1280, height: 900 }, deviceScaleFactor: opt.dsf || 1 });
  const page = await ctx.newPage();
  const log = { errors: [], external: [], requests: 0, bytes: 0 };
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => log.errors.push('pageerror: ' + e.message));
  page.on('request', r => { log.requests++; if (!/^(http:\/\/localhost:876[56]|data:|blob:)/.test(r.url())) log.external.push(r.url()); });
  page.on('response', async r => { try { const b = await r.body(); log.bytes += b.length; } catch (e) {} });
  if (opt.gfx) await page.addInitScript(g => { try { localStorage.setItem('paalaan3.gfx', g); localStorage.setItem('paalaan3.snd', '0'); } catch (e) {} }, opt.gfx);
  await page.goto(URL + (opt.query || ''));
  return { browser, ctx, page, log };
}
// uusi peli suoraan tielle: kuukausi m (1 = tammikuu 2027), valinnainen muokkaus fn(S)
async function drive(page, m = 6, setup = '') {
  await page.evaluate(([m, setup]) => {
    RND = Math.random; S = newState(0); Q = []; S.m = m;
    if (setup) (new Function('S', setup))(S);
    Drive.start();
  }, [m, setup]);
  await page.waitForFunction(() => document.getElementById('h-load').style.display === 'none' && Drive.active, null, { timeout: 120000 });
}
const frames = (page, n) => page.evaluate(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
module.exports = { open, drive, frames, URL };
