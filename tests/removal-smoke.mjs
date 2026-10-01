import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const b=await chromium.launch({channel:'msedge',headless:true});
try {
  const p=await b.newPage({viewport:{width:1440,height:1000}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  p.on('requestfailed',r=>console.log('Request failed:',r.url(),r.failure()?.errorText));
  await p.goto('http://localhost:3001/removal-test');
  await p.locator('input[type=file]').setInputFiles(process.env.TEST_FACE||'test-results/brow-head-only-test.png');
  try { await p.getByText('사진 준비 완료',{exact:true}).waitFor({timeout:90000}); }
  catch(e) { console.log(await p.locator('body').innerText()); await p.screenshot({path:'test-results/removal-error.png'}); throw e; }
  const canvases=p.locator('canvas');
  const original=await canvases.nth(0).evaluate(c=>c.toDataURL());
  await p.getByRole('slider').first().fill('0.5');
  await p.waitForTimeout(300);
  assert.notEqual(await canvases.nth(1).evaluate(c=>c.toDataURL()),original);
  await p.getByRole('button',{name:'전체 연하게',exact:true}).click();
  const half=await canvases.nth(1).evaluate(c=>c.toDataURL());
  await p.getByRole('slider').first().fill('1');
  await p.waitForTimeout(300);
  assert.notEqual(await canvases.nth(1).evaluate(c=>c.toDataURL()),half);
  await p.screenshot({path:'test-results/removal-desktop.png',fullPage:true});
  await p.getByLabel('적용 영역 표시').check();
  const dl=p.waitForEvent('download');await p.getByRole('button',{name:'테스트 이미지 저장'}).click();
  await (await dl).saveAs('test-results/removal-export.png');
  await p.getByRole('button',{name:'원본 복원'}).click();
  await p.waitForTimeout(250);
  assert.equal(await canvases.nth(1).evaluate(c=>c.toDataURL()),original);
  assert.equal(await p.getByRole('slider').first().inputValue(),'0');
  await p.setViewportSize({width:390,height:844});
  await p.screenshot({path:'test-results/removal-mobile.png',fullPage:true});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.getByRole('slider').first().fill('0.8');
  await p.getByRole('button',{name:'눈썹 연하게 하고 새 디자인'}).click();
  await p.waitForURL('**/editor?source=lightened&handoff=*');
  await p.getByText('눈썹 명암 조정 결과를 불러왔습니다.',{exact:true}).waitFor();
  assert.equal(await p.getByRole('button',{name:'가상 눈썹 만들기',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok((await p.getByRole('link',{name:'보정 전 원본 저장'}).getAttribute('href')).startsWith('data:image/png'));
  await p.waitForTimeout(500);
  await p.screenshot({path:'test-results/lightening-handoff.png',fullPage:false});
  await p.getByRole('button',{name:'조정 패널 열기'}).click();
  await p.getByRole('button',{name:'내 눈썹 연하게 하고 다시 그리기',exact:true}).click();
  await p.waitForURL('**/removal-test?handoff=*');
  await p.getByText('현재 사진을 불러왔습니다.',{exact:true}).waitFor();
  assert.equal(await p.locator('canvas').first().evaluate(c=>c.toDataURL()),original);
  assert.deepEqual(errors,[]);console.log('PASS removal apply, restore, mask, export, mobile');
} finally {await b.close();}
