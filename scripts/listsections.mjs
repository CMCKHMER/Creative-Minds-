import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
await page.goto('https://cmckhmer.github.io/Creative-Minds-/', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(3500);
const ids = await page.evaluate(() => [...document.querySelectorAll('section[id],div[id],nav[id],footer[id]')].map(e => e.id).filter(Boolean));
console.log(JSON.stringify(ids));
// also count sections
const secs = await page.evaluate(() => [...document.querySelectorAll('section')].map(s => (s.id || '(noid)') + ' :: ' + (s.querySelector('h2,h1')?.textContent || '').trim().slice(0, 60)));
console.log(JSON.stringify(secs, null, 1));
await browser.close();
