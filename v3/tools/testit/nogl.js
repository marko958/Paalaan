// WebGL pois päältä: sivun pitää näyttää ilmoitus ja linkki 2.0:aan, eikä ajotilaan saa jäädä jumiin
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-3d-apis'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/v3/');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { RND = Math.random; S = newState(0); Q = []; Drive.start(); const n = document.getElementById('nogl'); return { shown: !n.hidden, text: n.textContent, link: n.querySelector('a').getAttribute('href'), active: Drive.active, fail: Drive.gfxFail !== '' }; });
  console.log(JSON.stringify(r), errs);
  await page.screenshot({ path: (process.env.KUVAT || require('os').tmpdir()) + '/nogl.png' });
  await browser.close();
})();
