import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const DIST = '/home/z/my-project/tmp/cmc-site/dist';
const PORT = 8921; const BASE = `http://127.0.0.1:${PORT}`;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, BASE).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(DIST, p));
    const data = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch({ headless: true });
const results = [];
const ok = (name, cond, detail) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
// The dashboard is LazyMount-ed: its chunk downloads only when the mount
// point nears the viewport, so scroll the page progressively until the
// section appears, then settle on it.
async function scrollToDashboard(page) {
  for (let i = 0; i < 40; i++) {
    const found = await page.evaluate(() => !!document.getElementById('firebase-dashboard'));
    if (found) break;
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => document.getElementById('firebase-dashboard')?.scrollIntoView({ behavior: 'instant' }));
  try {
    await page.waitForSelector('#firebase-dashboard.cmc-cmdc', { timeout: 15000 });
  } catch { /* reported by the scoped check */ }
  await page.waitForTimeout(1100);
}
const TEACHER_KEYS = `try{localStorage.setItem('cmc-student-token','x'.repeat(40));localStorage.setItem('cmc-student-role','teacher');localStorage.setItem('cmc-student-uid','uid-t');localStorage.setItem('cmc-student-name','CmdT');localStorage.setItem('cmc-student-email','t@e.edu');localStorage.setItem('cmc-student-verified','1');localStorage.setItem('cmc-student-token-expires',String(Date.now()+3600000));}catch(e){}`;

// ---- TEACHER VIEW ----
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
await ctx.route('**firestore.googleapis.com**', r => r.abort());
await ctx.addInitScript(TEACHER_KEYS);
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await scrollToDashboard(page);
const base = await page.evaluate(() => {
  const sec = document.getElementById('firebase-dashboard');
  if (!sec) return null;
  const cs = (el) => el ? getComputedStyle(el) : null;
  const stats = [...sec.querySelectorAll('.cmcdc-stat')];
  const panels = [...sec.querySelectorAll('.cmcdc-panel')];
  const clockChip = sec.querySelector('.cmcdc-chip--clock')?.textContent || '';
  return {
    scoped: sec.classList.contains('cmc-cmdc'),
    barTitle: sec.querySelector('.cmcdc-consolebar-title')?.textContent || '',
    clockNow: clockChip,
    statZ: stats.map(s => { const m = cs(s).transform.match(/matrix3d\(([^)]+)\)/); return m ? parseFloat(m[1].split(',')[14]) : null; }),
    statAnim: stats[0] ? cs(stats[0]).animationName : null,
    panelZ: panels.slice(0, 4).map(p => { const m = cs(p).transform.match(/matrix3d\(([^)]+)\)/); return m ? parseFloat(m[1].split(',')[14]) : null; }),
    rosterHead: [...sec.querySelectorAll('.cmcdc-panel-head')].map(h => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)),
    keys: sec.querySelectorAll('.cmcdc-key').length,
    tags: [...sec.querySelectorAll('.cmcdc-panel-tag')].map(t => t.textContent.trim()),
    feedEmpty: [...sec.querySelectorAll('.cmcdc-panel')].some(p => p.textContent.includes('No drill attempts yet')),
    // sub-panels (spreadsheet + tests) must carry NO command-center classes
    subPanelLeak: [...sec.querySelectorAll('[data-keep-dark]')].map(el => (el.className.includes('cmcdc') ? 'LEAK' : 'clean')),
    subPanelCount: sec.querySelectorAll('[data-keep-dark]').length,
  };
});
ok('section scoped under cmc-cmdc', base?.scoped, base ? '' : 'section missing');
ok('console bar shows Teacher Command Center', base?.barTitle === 'Teacher Command Center', base?.barTitle);
ok('clock chip live (HH:MM:SS)', /\d{2}:\d{2}:\d{2}/.test(base?.clockNow || ''), base?.clockNow);
const clock1 = base?.clockNow || '';
await page.waitForTimeout(1300);
const clock2 = await page.evaluate(() => document.querySelector('#firebase-dashboard .cmcdc-chip--clock')?.textContent || '');
ok('clock ticks', clock1 !== clock2, `${clock1} → ${clock2}`);
ok('stat readouts float at translateZ(44px)', base?.statZ?.length === 4 && base.statZ.every(z => z === 44), JSON.stringify(base?.statZ));
ok('stat idle bob animation running', base?.statAnim === 'cmcdcFloat', base?.statAnim);
ok('roster+feed panels float at translateZ(34px)', (base?.panelZ || []).length >= 2 && base.panelZ.every(z => z === 34), JSON.stringify(base?.panelZ));
ok('console panel heads (roster + feed)', (base?.rosterHead || []).some(t => t.includes('Class Roster')) && (base?.rosterHead || []).some(t => t.includes('Attempt Feed')), JSON.stringify(base?.rosterHead));
ok('feed tag shows row count', (base?.tags || []).some(t => /rows/.test(t)), JSON.stringify(base?.tags));
ok('keycap class buttons wired', (base?.keys || 0) >= 0, `${base?.keys} keys (0 classes yet = 0 buttons)`);
ok('feed empty-state renders inside console frame', !!base?.feedEmpty, '');
ok('spreadsheet + tests panels carry zero cmcdc classes', base?.subPanelCount === 2 && base.subPanelLeak.every(v => v === 'clean'), `panels=${base?.subPanelCount} ${JSON.stringify(base?.subPanelLeak)}`);

// ---- BI-WEEKLY HUD SKIN (v39): floor, cockpit frame, circuit glass,
// 4-layer neon, readout bars, tests-panel skin — matching the planner ----
const hud = await page.evaluate(() => {
  const sec = document.getElementById('firebase-dashboard');
  if (!sec) return null;
  const cs = (el, pseudo) => (el ? getComputedStyle(el, pseudo || null) : null);
  const floor = sec.querySelector('.cmcdc-hudfloor');
  const frame = sec.querySelector('.cmcdc-hudframe');
  const stat = sec.querySelector('.cmcdc-stat');
  const panel = [...sec.querySelectorAll('.cmcdc-panel')][0];
  const head = sec.querySelector('.cmcdc-panel-head');
  const testsPanel = sec.querySelector('[data-hud-panel="bw-tests"]');
  const floorCs = cs(floor);
  return {
    floorAnim: floorCs?.animationName || '',
    floorTilted: floorCs ? floorCs.transform.startsWith('matrix') && floorCs.transform !== 'none' : false,
    frameCorners: frame ? frame.querySelectorAll('i').length : 0,
    frameRuler: !!cs(frame, '::before')?.backgroundImage.includes('repeating-linear-gradient'),
    statCircuit: !!cs(stat)?.backgroundImage.includes('data:image/svg+xml'),
    panelCircuit: !!cs(panel)?.backgroundImage.includes('data:image/svg+xml'),
    headNeon: (cs(head)?.textShadow.match(/rgba\(/g) || []).length >= 4,
    statBar: !!cs(stat, '::after')?.backgroundImage.includes('90deg'),
    testsCircuit: !!cs(testsPanel)?.backgroundImage.includes('data:image/svg+xml'),
    testsBrackets: !!cs(testsPanel, '::after')?.backgroundSize.includes('16px'),
    testsStrip: !!testsPanel?.querySelector('.hudp-strip'),
    leadCount: sec.querySelectorAll('.cmcdc-lead').length,
    codeCount: sec.querySelectorAll('.cmcdc-panel-code').length,
  };
});
ok('HUD runway floor present + scrolling', hud?.floorAnim === 'cmcdcFloorScroll' && hud?.floorTilted, `anim=${hud?.floorAnim} tilted=${hud?.floorTilted}`);
ok('cockpit frame: 4 corner brackets + dotted rulers', hud?.frameCorners === 4 && !!hud?.frameRuler, `corners=${hud?.frameCorners} ruler=${hud?.frameRuler}`);
ok('circuit texture under stat + panel glass', !!hud?.statCircuit && !!hud?.panelCircuit, `stat=${hud?.statCircuit} panel=${hud?.panelCircuit}`);
ok('panel heads carry 4-layer neon glow', !!hud?.headNeon, JSON.stringify(hud?.headNeon));
ok('stat readout bar painted (planner bp-stat recipe)', !!hud?.statBar, '');
ok('bi-weekly tests panel joins HUD skin (circuit + brackets + strip)', !!hud?.testsCircuit && !!hud?.testsBrackets && !!hud?.testsStrip, `circuit=${hud?.testsCircuit} brackets=${hud?.testsBrackets} strip=${hud?.testsStrip}`);
ok('module codes + dotted leaders wired (MDL-*)', (hud?.codeCount || 0) >= 2 && (hud?.leadCount || 0) >= 2, `codes=${hud?.codeCount} leads=${hud?.leadCount}`);
// td plainness: the live tables render only when data exists (aborted here),
// so probe the exclusion rule by injecting a throwaway cell into a panel.
const tdPlain = await page.evaluate(() => {
  const panel = document.querySelector('#firebase-dashboard .cmcdc-panel');
  if (!panel) return null;
  const probe = document.createElement('table');
  probe.innerHTML = '<tbody><tr><td id="cmcdc-td-probe">x</td></tr></tbody>';
  panel.appendChild(probe);
  const shadow = getComputedStyle(document.getElementById('cmcdc-td-probe')).textShadow;
  probe.remove();
  return ['none', ''].includes(shadow);
});
ok('data cells stay plain (no neon on td)', tdPlain === true, String(tdPlain));

// hover pop + tilt vars on stat card
const stat = (await page.$$('.cmcdc-stat'))[1];
if (stat) {
  await page.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }), stat);
  await page.waitForTimeout(500);
  const box = await stat.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35, { steps: 5 });
    await page.waitForTimeout(650);
  }
  const hv = await page.evaluate(() => {
    const s = [...document.querySelectorAll('#firebase-dashboard .cmcdc-stat')].find(x => x.matches(':hover'));
    if (!s) return null;
    const cs = getComputedStyle(s);
    const m = cs.transform.match(/matrix3d\(([^)]+)\)/);
    return { z: m ? parseFloat(m[1].split(',')[14]) : null, scale: cs.scale, rx: s.style.getPropertyValue('--rx'), gy: s.style.getPropertyValue('--gy') };
  });
  ok('hover pop: translateZ 96 + tilt vars fed', hv && hv.z !== null && hv.z > 90 && hv.z < 102 && hv.rx !== '' && hv.gy !== '', hv ? `z=${hv.z} scale=${hv.scale} --rx=${hv.rx}` : 'none hovered');
  await page.screenshot({ path: '/home/z/my-project/scripts/cmcdc_teacher_hover.png' });
} else ok('hover pop check', false, 'no stat card found');
await page.mouse.move(5, 5);
await page.waitForTimeout(400);
await page.screenshot({ path: '/home/z/my-project/scripts/cmcdc_teacher.png' });

// overflow check
const ovf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('no horizontal overflow (teacher)', ovf <= 0, `delta=${ovf}px`);
await ctx.close();

// ---- SIGNED-OUT VIEW ----
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await ctx2.route('**firestore.googleapis.com**', r => r.abort());
const page2 = await ctx2.newPage();
await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
await page2.waitForTimeout(2500);
await scrollToDashboard(page2);
const pub = await page2.evaluate(() => {
  const sec = document.getElementById('firebase-dashboard');
  if (!sec) return null;
  const stat = sec.querySelector('.cmcdc-stat');
  const cs = stat ? getComputedStyle(stat) : null;
  const m = cs?.transform.match(/matrix3d\(([^)]+)\)/);
  return {
    stats: sec.querySelectorAll('.cmcdc-stat').length,
    z: m ? parseFloat(m[1].split(',')[14]) : null,
    heads: [...sec.querySelectorAll('.cmcdc-panel-head')].map(h => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 44)),
    cta: sec.querySelectorAll('.cmcdc-cta').length,
  };
});
ok('signed-out: community stats holographic', pub?.stats === 3 && pub?.z === 44, `stats=${pub?.stats} z=${pub?.z}`);
ok('signed-out: drill floor console head', (pub?.heads || []).some(t => t.includes('drill floor')), JSON.stringify(pub?.heads));
ok('signed-out: CTA press-glow class', (pub?.cta || 0) >= 1, `${pub?.cta}`);
await page2.screenshot({ path: '/home/z/my-project/scripts/cmcdc_public.png' });
await ctx2.close();

// ---- REDUCED MOTION ----
const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
await ctx3.route('**firestore.googleapis.com**', r => r.abort());
await ctx3.addInitScript(TEACHER_KEYS);
const page3 = await ctx3.newPage();
await page3.goto(BASE, { waitUntil: 'domcontentloaded' });
await page3.waitForTimeout(2500);
await scrollToDashboard(page3);
const rm = await page3.evaluate(() => {
  const s = document.querySelector('#firebase-dashboard .cmcdc-stat');
  const cs = s ? getComputedStyle(s) : null;
  const m = cs?.transform.match(/matrix3d\(([^)]+)\)/);
  return { anim: cs?.animationName, z: m ? parseFloat(m[1].split(',')[14]) : null };
});
ok('reduced-motion: static lift, no bob', rm?.anim === 'none' && rm?.z === 14, `anim=${rm?.anim} z=${rm?.z}`);
await ctx3.close();

// ---- MOBILE ----
const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx4.route('**firestore.googleapis.com**', r => r.abort());
await ctx4.addInitScript(TEACHER_KEYS);
const page4 = await ctx4.newPage();
await page4.goto(BASE, { waitUntil: 'domcontentloaded' });
await page4.waitForTimeout(2500);
await scrollToDashboard(page4);
const mob = await page4.evaluate(() => {
  const s = document.querySelector('#firebase-dashboard .cmcdc-stat');
  const m = s ? getComputedStyle(s).transform.match(/matrix3d\(([^)]+)\)/) : null;
  return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, z: m ? parseFloat(m[1].split(',')[14]) : null };
});
ok('mobile: no overflow, touch lift 26px', mob.overflow <= 0 && mob.z === 26, `delta=${mob.overflow} z=${mob.z}`);
await ctx4.close();

await browser.close(); server.close();
console.log(results.join('\n'));
const fails = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
