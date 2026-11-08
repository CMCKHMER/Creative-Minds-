/* Studio Docs smoke: boots dist/studio, switches to Docs mode, and checks
   the new right-click tool menu, ⚙ Tools customization dialog, and the
   drag-to-resize image handles. Exits non-zero on any failure. */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

const DIST = resolve(process.argv[2] || 'dist');
const PORT = 8127;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(DIST, p);
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(PORT, ok));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const results = [];
const check = (name, ok, extra) => { results.push({ name, ok: !!ok, extra: extra || '' }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

await page.goto(`http://127.0.0.1:${PORT}/studio/`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

// 1. choose Docs from the welcome screen
await page.evaluate(() => { const b = document.querySelector('.welcome-card[data-choose="doc"]') || window.welcomeChoose && null; if (b) b.click(); else if (window.welcomeChoose) window.welcomeChoose('doc'); });
await page.waitForTimeout(700);
const docMode = await page.evaluate(() => { const el = document.getElementById('docLayer'); return el && el.offsetParent !== null; });
check('Docs mode active after welcome choice', docMode);

// 2. right-click the page → custom menu
await page.evaluate(() => {
  const dl = document.getElementById('docLayer');
  dl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: 380 }));
});
await page.waitForTimeout(300);
const menuText = await page.evaluate(() => { const m = document.querySelector('.sheet-tab-menu'); return m ? m.innerText : ''; });
check('Right-click opens the doc tool menu', /Customize tools/.test(menuText), 'entries: ' + menuText.split('\n').slice(0, 8).join(' | '));
check('Menu has clipboard + formatting entries', /Cut/.test(menuText) && /Bold/.test(menuText));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const menuHidden = await page.evaluate(() => { const m = document.querySelector('.sheet-tab-menu'); return !m || m.style.display === 'none'; });
check('Escape closes the menu', menuHidden);

// 3. ⚙ Tools customize dialog
await page.evaluate(() => window.openDocToolsCustomize());
await page.waitForTimeout(300);
const dlgRows = await page.evaluate(() => document.querySelectorAll('#docToolsList .stm-row').length);
check('⚙ Tools dialog lists doc tools', dlgRows >= 20, dlgRows + ' rows');
const dlgVisible = await page.evaluate(() => document.getElementById('docToolsModal').classList.contains('show'));
check('⚙ Tools dialog is visible', dlgVisible);
await page.evaluate(() => document.querySelector('#docToolsModal .dialog-buttons .primary').click());
await page.waitForTimeout(200);

// 4. insert an image, click it, expect selection + 8 drag handles
const imgOk = await page.evaluate(() => {
  const dl = document.getElementById('docLayer');
  dl.focus();
  document.execCommand('insertHTML', false, '<img id="smokeImg" class="doc-img" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR4nGP8z8Dwn4GBgYGJAQwAHxcCAmXfXk0AAAAASUVORK5CYII=" alt="">');
  return !!document.getElementById('smokeImg');
});
check('Image inserted into the doc', imgOk);
await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('smokeImg').dispatchEvent(new MouseEvent('click', { bubbles: true })));
await page.waitForTimeout(300);
const selState = await page.evaluate(() => {
  const img = document.getElementById('smokeImg');
  const box = document.getElementById('fxImgHandles');
  return { sel: img.classList.contains('fx-img-sel'), handles: box ? box.querySelectorAll('.fx-img-handle').length : 0, visible: box && box.style.display === 'block' };
});
check('Image selects on click', selState.sel);
check('8 resize handles shown', selState.handles === 8 && selState.visible, selState.handles + ' handles');

// 5. drag the south-east handle → image grows (aspect kept)
const before = await page.evaluate(() => { const i = document.getElementById('smokeImg'); return { w: i.offsetWidth, h: i.offsetHeight }; });
const handleBox = await page.evaluate(() => {
  const b = document.getElementById('fxImgHandles').getBoundingClientRect();
  return { x: b.left + b.width - 1, y: b.top + b.height - 1 };
});
await page.mouse.move(handleBox.x, handleBox.y);
await page.mouse.down();
await page.mouse.move(handleBox.x + 160, handleBox.y + 120, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const after = await page.evaluate(() => { const i = document.getElementById('smokeImg'); return { w: i.offsetWidth, h: i.offsetHeight }; });
check('Corner drag grows the image', after.w > before.w + 100 && after.h > before.h + 60, `${before.w}×${before.h} → ${after.w}×${after.h}`);
const ratioBefore = before.w / before.h, ratioAfter = after.w / after.h;
check('Aspect ratio kept on corner drag', Math.abs(ratioBefore - ratioAfter) < 0.05, ratioBefore.toFixed(3) + ' vs ' + ratioAfter.toFixed(3));

// 6. right-click the image → image menu with size entries
await page.evaluate(() => {
  const img = document.getElementById('smokeImg');
  img.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 520, clientY: 420 }));
});
await page.waitForTimeout(300);
const imgMenu = await page.evaluate(() => { const m = document.querySelector('.sheet-tab-menu'); return m ? m.innerText : ''; });
check('Image menu shows size + float entries', /25% of page/.test(imgMenu) && /Float left/.test(imgMenu), 'first: ' + imgMenu.split('\n').slice(0, 4).join(' | '));

// 7. 50% preset from the menu resizes by percentage
await page.evaluate(() => { const btns = [...document.querySelectorAll('.sheet-tab-menu button')]; const b = btns.find((x) => /50% of page/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(300);
const after50 = await page.evaluate(() => { const i = document.getElementById('smokeImg'); return i.style.width; });
check('50% preset applies', /50%/.test(after50 || ''), 'style.width=' + after50);

// 8. undo via native command still works after resize
const undoOk = await page.evaluate(() => { document.execCommand('undo'); return true; });
check('Undo executes without error', undoOk);

// 9. legacy image (no doc-img class) is healed and selectable
const healed = await page.evaluate(() => {
  const dl = document.getElementById('docLayer');
  dl.insertAdjacentHTML('beforeend', '<img id="legacyImg" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR4nGP8z8Dwn4GBgYGJAQwAHxcCAmXfXk0AAAAASUVORK5CYII=">');
  const img = document.getElementById('legacyImg');
  img.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return img.classList.contains('fx-img-sel');
});
check('Legacy class-less image is selectable (healed)', healed);

if (errs.length) { console.log('\nPage errors:'); errs.slice(0, 10).forEach((e) => console.log('  ', e)); }
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
server.close();
process.exit(failed.length || errs.length ? 1 : 0);
