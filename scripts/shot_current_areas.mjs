// Screenshots: bi-weekly planner hub (dark) + homepage student areas, to spot
// the "darkish panels with lines going through" the user describes.
import { chromium } from 'playwright';

const OUT = '/tmp/shots-current';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => { try { localStorage.setItem('cmc-theme', 'dark'); } catch {} });

// 1. Bi-weekly planner hub
const p1 = await ctx.newPage();
await p1.goto('https://cmckhmer.github.io/Creative-Minds-/biweek-planner/', { waitUntil: 'networkidle' }).catch(() => {});
await p1.waitForTimeout(2500);
await p1.evaluate(() => window.scrollTo(0, 0));
await p1.waitForTimeout(400);
await p1.screenshot({ path: `${OUT}/planner-top.png` });
await p1.evaluate(() => { const g = document.querySelectorAll('.week-card')[0]; if (g) g.scrollIntoView({ block: 'center', behavior: 'instant' }); });
await p1.waitForTimeout(800);
await p1.screenshot({ path: `${OUT}/planner-cards.png` });

// 2. Homepage
const p2 = await ctx.newPage();
await p2.goto('https://cmckhmer.github.io/Creative-Minds-/', { waitUntil: 'networkidle' }).catch(() => {});
await p2.waitForTimeout(3000);
await p2.screenshot({ path: `${OUT}/home-hero.png` });
for (const [name, sel] of [['home-dashboard', '#firebase-dashboard'], ['home-games', '#games'], ['home-resources', '#resources']]) {
  try {
    await p2.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' }); }, sel);
    await p2.waitForTimeout(1200);
    await p2.screenshot({ path: `${OUT}/${name}.png` });
  } catch {}
}
await browser.close();
console.log('done');
