// node fps.js <laatu> [kuukausi] [leveys] : mittaa ruudunpäivityksen (SwiftShader = ohjelmistorenderöinti, ei vastaa oikeaa näytönohjainta)
const { open, drive } = require('./lib.js');
(async () => {
  const q = process.argv[2] || 'med', m = +(process.argv[3] || 6), w = +(process.argv[4] || 1280);
  const { browser, page, log } = await open({ gfx: q, viewport: { width: w, height: Math.round(w * 0.7) } });
  const t0 = Date.now();
  await drive(page, m);
  const tl = Date.now() - t0;
  await page.evaluate(() => { Drive._st.speed = 90 * Drive.sim.KMH; });
  const r = await page.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; const e = performance.now() - t; if (e > 6000) res({ fps: n / e * 1000, n }); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  const info = await page.evaluate(() => ({ calls: __gfx.renderer.info.render.calls, tris: __gfx.renderer.info.render.triangles, js: __gfx.stats.ms, level: __gfx.level(), size: [__gfx.renderer.domElement.width, __gfx.renderer.domElement.height], gl: (() => { const g = __gfx.renderer.getContext(); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; })() }));
  console.log(q, 'load ms', tl, 'kB', Math.round(log.bytes / 1024), 'requests', log.requests, 'fps', r.fps.toFixed(1), JSON.stringify(info), log.errors.length ? log.errors.slice(0, 3) : '');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
