// Capture key homepage sections (live site) for visual identification.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/shots3', { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();
await page.goto('https://cmckhmer.github.io/Creative-Minds-/', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3500);

const targets = ['toefl-itp-planner', 'kid-grades', 'lms-workspace', 'gep-isec', 'interactive-demo', 'daily-assessment', 'toefl-mini-test', 'features', 'resources'];
for (const id of targets) {
  const ok = await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' });
    return true;
  }, id);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `/tmp/shots3/sec-${id}.png` });
  console.log(id, ok);
}
await browser.close();
