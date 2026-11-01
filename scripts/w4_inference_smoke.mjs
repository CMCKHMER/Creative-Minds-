/**
 * W4 inference drill — local preview smoke (before deploy).
 * Asserts the page boots its runtime to the expected gate (no student auth in
 * this browser), the payload parsed with 17 questions, multi-select questions
 * exist in data, and the built panel bundle registers the new test.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4191;
const BASE = `http://localhost:${PORT}/`;
try { const p = spawn('pkill', ['-f', `vite preview.*${PORT}`]); p.on('error', () => {}); } catch {}
await new Promise((r) => setTimeout(r, 600));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: '/home/z/my-project/tmp/cmc-site', stdio: 'ignore', detached: true,
});
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fails = [];
const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails.push(label); };

try {
  const res = await page.goto(BASE + 'biweek-planner/tests/private/isec2-w4-inference.html', { waitUntil: 'networkidle', timeout: 45000 });
  ok(res.status() === 200, 'page serves (HTTP 200)');

  const state = await page.evaluate(() => {
    const T = window.CMC_PRIVATE_TEST;
    const headerText = (document.getElementById('test-header') || {}).textContent || '';
    return {
      hasPayload: !!T,
      testId: T && T.testId,
      qCount: T ? T.questions.length : 0,
      multi: T ? T.questions.filter((q) => q.multi).map((q) => q.qnum) : [],
      groups: T ? T.groups.map((g) => g.id) : [],
      gateShown: /sign in|assignment/i.test(headerText),
      passagePresent: /Keeping a city clean is not only the job of sanitation workers/.test(document.body.textContent),
      teacherGateBlocked: !!document.querySelector('[data-cmc-teacher-lock], .cmc-teacher-locked'),
      pageTitle: document.title,
    };
  });

  ok(state.hasPayload, 'CMC_PRIVATE_TEST payload parsed');
  ok(state.testId === 'biweek-isec2-w4-inference', 'testId correct (' + state.testId + ')');
  ok(state.qCount === 17, '17 questions in payload (got ' + state.qCount + ')');
  ok(JSON.stringify(state.multi) === '[1,3,6]', 'multi-select questions are 1, 3, 6');
  ok(state.groups.join(',') === 'w4i-comprehension,w4i-inference-types,w4i-support-assume', '3 sections in order');
  ok(state.gateShown, 'runtime booted to a gate (no auth in test browser)');
  ok(state.passagePresent, 'reading passage rendered');
  ok(state.pageTitle.includes('Recognizing Inference'), 'title updated');

  // built panel bundle must know the slug (dist/assets/*.js)
  const bundleHit = await page.evaluate(async () => {
    const idx = await fetch(location.origin + '/index.html').then((r) => r.text());
    return idx;
  });
  ok(bundleHit.includes('translate="no"'), 'site shell still English-locked');
} catch (e) {
  fails.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch {}
}

console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL SMOKE CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
