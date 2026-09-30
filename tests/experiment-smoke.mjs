import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const requirePackage = createRequire(import.meta.url);
const { chromium } = requirePackage(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') console.log('Browser console:', message.text()); });
  await page.goto('http://localhost:3001/experiment');
  await page.locator('input[type=file]').setInputFiles(process.env.TEST_FACE || 'test-results/portrait.jpg');
  await page.waitForFunction(() => {
    const c = document.querySelectorAll('canvas');
    return c.length === 3 && c[0].width > 300 && c[1].width > 300 && c[2].width > 300;
  }, undefined, { timeout: 90000 });
  const originals = await page.locator('canvas').evaluateAll(cs => cs.map(c => c.toDataURL()));
  assert.equal(originals[0], originals[2], 'B neutral must exactly equal original');
  assert.notEqual(originals[0], originals[1], 'A must show existing layer');
  const previewFrames = await page.getByLabel('빈 곳 보충량', { exact: true }).evaluate(async input => {
    const widths = [];
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (let i = 0; i < 12; i++) {
      setter.call(input, String((i + 1) * 0.05));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
      widths.push(document.querySelectorAll('canvas')[2].width);
    }
    return widths;
  });
  assert.ok(previewFrames.includes(640), 'drag should render lightweight preview');
  await page.waitForFunction(() => {
    const cs = document.querySelectorAll('canvas');
    return cs[0].width === cs[2].width;
  });
  await page.getByLabel('빈 곳 보충량', { exact: true }).fill('0');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() === previous, originals[2]);
  console.log('PASS: live 640px preview and full resolution restoration');
  await page.locator('input[type=range]').first().fill('0.7');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() !== previous, originals[2]);
  await page.getByLabel('눈썹 확대').check();
  const bareWarp = await page.locator('canvas').nth(2).evaluate(c => c.toDataURL());
  await page.getByLabel('빈 곳 보충량', { exact: true }).fill('0.7');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() !== previous, bareWarp);
  const filled = await page.locator('canvas').nth(2).evaluate(c => c.toDataURL());
  await page.getByRole('combobox').selectOption('5');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() !== previous, filled);
  await page.getByLabel('빈 곳 보충량', { exact: true }).fill('0');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() === previous, bareWarp);
  await page.getByLabel('빈 곳 보충량', { exact: true }).fill('0.5');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() !== previous, bareWarp);
  await page.getByRole('combobox').selectOption('8');
  await page.waitForTimeout(300);
  const alphaStats = await page.getByAltText('선택한 눈썹 털결').evaluate(image => {
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let empty = 0, visible = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) empty++; if (pixels[i] > 30) visible++; }
    return { empty, visible, total: pixels.length / 4 };
  });
  assert.ok(alphaStats.empty > alphaStats.total * 0.7);
  assert.ok(alphaStats.visible > 1000);
  console.log('Transparent asset:', alphaStats);
  const thin = await page.locator('canvas').evaluateAll(cs => cs.map(c => c.toDataURL()));
  await page.getByLabel('털 한 올 굵기', { exact: true }).fill('1');
  await page.waitForFunction(previous => {
    const cs = document.querySelectorAll('canvas');
    return cs[1].toDataURL() !== previous[1] && cs[2].toDataURL() !== previous[2];
  }, thin);
  assert.equal(await page.locator('canvas').first().evaluate(c => c.toDataURL()), thin[0]);
  await page.getByLabel('빈 곳 보충량', { exact: true }).fill('0');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() === previous, bareWarp);
  await page.getByLabel('빈 곳 보충량', { exact: true }).fill('1');
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() !== previous, bareWarp);
  await page.screenshot({ path: 'test-results/experiment-desktop.png', fullPage: true });
  const female = await page.locator('canvas').nth(1).evaluate(c => c.toDataURL());
  await page.getByRole('combobox').selectOption({ label: '남성 헤어스트로크 · 자연 일자' });
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[1].toDataURL() !== previous, female);
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('B 결과 저장')).disabled);
  await page.screenshot({ path: 'test-results/experiment-male.png', fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'B 결과 저장' }).click();
  await (await downloadEvent).saveAs('test-results/experiment-export.png');
  await page.getByRole('button', { name: '변형 초기화' }).click();
  await page.waitForFunction(previous => document.querySelectorAll('canvas')[2].toDataURL() === previous, originals[2]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/experiment-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: A/B upload, neutral identity, warp, reset, export, mobile overflow, page errors');
} catch (error) {
  if (page) { console.log(await page.locator('body').innerText()); await page.screenshot({ path: 'test-results/experiment-error.png' }); }
  throw error;
} finally { await browser.close(); }
