import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:900});
    await page.goto('http://localhost:3001/');
    const hero=page.locator('img').first();
    await hero.evaluate(img=>img.decode());
    assert.ok(await hero.evaluate(img=>img.naturalWidth>100));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`test-results/home-${width}.png`,fullPage:true});
    await page.getByRole('link',{name:'사진으로 시작하기'}).click();
    await page.getByRole('button',{name:'사진 선택',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`test-results/upload-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: home image, launch links, upload and responsive widths 320-1440');
} finally { await browser.close(); }
