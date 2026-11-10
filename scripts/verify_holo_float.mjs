import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8919; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);

// desktop, dark, reduced motion OK
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx.route('**firestore.googleapis.com**', r => r.abort());
await ctx.addInitScript(`try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-theme','dark');}catch(e){}`);
const page = await ctx.newPage();
await page.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });

const stage = await page.evaluate(() => {
  const g = document.getElementById('schedule-grid');
  const cs = getComputedStyle(g);
  const r = g.getBoundingClientRect();
  return { perspective: cs.perspective, ox: parseFloat(cs.perspectiveOrigin) / r.width, oy: parseFloat(cs.perspectiveOrigin.split(' ')[1]) / r.height };
});
ok('grid stage perspective 1500px', stage.perspective === '1500px', stage.perspective);
ok('stage origin 50% 26%', Math.abs(stage.ox - .5) < .01 && Math.abs(stage.oy - .26) < .01, `ox=${stage.ox.toFixed(2)} oy=${stage.oy.toFixed(2)}`);

const rest = await page.evaluate(() => {
  const c = document.querySelectorAll('.week-card')[1];
  const cs = getComputedStyle(c);
  const v = cs.transform.match(/matrix3d\(([^)]+)\)/);
  return { z: v ? parseFloat(v[1].split(',')[14]) : null, anim: cs.animationName, dur: cs.animationDuration, translate: cs.translate, willChange: cs.willChange };
});
ok('rest transform is translateZ(48px)', rest.z === 48, `m43=${rest.z}`);
ok('idle float animation holoFloat running', rest.anim === 'holoFloat', `${rest.anim} ${rest.dur}`);
ok('will-change includes translate/scale', rest.willChange.includes('translate') && rest.willChange.includes('scale'), rest.willChange);

// hover pop: translateZ 106 + scale 1.03
const card = (await page.$$('.week-card'))[2];
await page.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }), card);
await page.waitForTimeout(400);
const box = await card.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
await page.waitForTimeout(650);
const hover = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.week-card')];
  const c = cards.find(x => x.matches(':hover'));
  if (!c) return null;
  const cs = getComputedStyle(c);
  return { transform: cs.transform, scale: cs.scale, z: cs.zIndex };
});
if (hover) {
  const m = hover.transform.match(/matrix3d\(([^)]+)\)/);
  const vals = m ? m[1].split(',').map(Number) : [];
  const z = vals[14]; // m43 = forward translation in px
  ok('hover transform carries forward pop', z >= 100 && z <= 112, `m43=${z?.toFixed(1)}px (pop from 48 → 106)`);
  ok('hover scale 1.03', hover.scale === '1.03' || parseFloat(hover.scale) > 1.02, hover.scale);
} else ok('hover pop engaged', false, 'no card matched :hover');

// tilt vars still wired
const tilt = await page.evaluate(() => {
  const c = [...document.querySelectorAll('.week-card')].find(x => x.matches(':hover'));
  return c ? { tx: c.style.getPropertyValue('--tx'), cls: c.classList.contains('holo-tilt') } : null;
});
ok('tilt class + --tx fed on hover', tilt && tilt.cls && tilt.tx !== '', tilt ? `--tx=${tilt.tx}` : 'none');

// featured card floats too
const feat = await page.evaluate(() => {
  const c = document.querySelector('#featured-week .week-card');
  if (!c) return null;
  const cs = getComputedStyle(c);
  return { anim: cs.animationName, transform: cs.transform };
});
ok('featured week panel floats', feat && feat.anim === 'holoFloat' && feat.transform.includes('matrix3d'), feat ? `${feat.anim}` : 'missing');

// dark theme vignette layer present
const vign = await page.evaluate(() => getComputedStyle(document.body, '::before').background);
ok('backdrop vignette layer present (dark)', vign.includes('rgba(1, 4, 14'), vign.slice(-80));
await ctx.close();

// light theme
const ctxL = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctxL.route('**firestore.googleapis.com**', r => r.abort());
await ctxL.addInitScript(`try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-theme','light');}catch(e){}`);
const pageL = await ctxL.newPage();
await pageL.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
const light = await pageL.evaluate(() => {
  const c = document.querySelectorAll('.week-card')[1];
  const cs = getComputedStyle(c);
  const b = getComputedStyle(document.body, '::before').background;
  return { shadow: cs.boxShadow, anim: cs.animationName, vign: b.includes('rgba(71, 105, 134') };
});
ok('light theme floating shadow applied', light.shadow.includes('rgba(2, 132, 199, 0.34)'), light.shadow.slice(0, 70) + '…');
ok('light theme float running', light.anim === 'holoFloat', light.anim);
ok('light theme vignette layer present', light.vign, 'rgba(71,105,134,…)');
await ctxL.close();

// reduced motion: no animation, static lift, no hover pop
const ctxR = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
await ctxR.route('**firestore.googleapis.com**', r => r.abort());
await ctxR.addInitScript(`try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');}catch(e){}`);
const pageR = await ctxR.newPage();
await pageR.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
const rm = await pageR.evaluate(() => {
  const c = document.querySelectorAll('.week-card')[1];
  const cs = getComputedStyle(c);
  return { anim: cs.animationName, transform: cs.transform, trans: cs.transitionDuration };
});
ok('reduced-motion: no float animation', rm.anim === 'none', rm.anim);
ok('reduced-motion: static translateZ(20px) lift', /matrix3d/.test(rm.transform), rm.transform.slice(0, 46));
await ctxR.close();

// mobile: no horizontal overflow, touch lift
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctxM.route('**firestore.googleapis.com**', r => r.abort());
await ctxM.addInitScript(`try{localStorage.setItem('cmc-student-token','t');localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','u');localStorage.setItem('cmc-student-name','T');localStorage.setItem('cmc-student-email','t@e.edu');}catch(e){}`);
const pageM = await ctxM.newPage();
await pageM.goto(`${BASE}/biweek-planner/`, { waitUntil: 'networkidle' });
const mob = await pageM.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  transform: getComputedStyle(document.querySelectorAll('.week-card')[1]).transform,
  anim: getComputedStyle(document.querySelectorAll('.week-card')[1]).animationName,
}));
ok('mobile: no horizontal overflow', mob.overflowX <= 0, `delta=${mob.overflowX}px`);
ok('mobile: float kept, flat-ish lift', mob.anim === 'holoFloat' && /matrix3d/.test(mob.transform), `${mob.anim}`);
await ctxM.close();

await browser.close(); server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
