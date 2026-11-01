/**
 * Chess3D fullscreen-overlay verification — LIVE (production GitHub Pages).
 *
 * Same assertions as scripts/chess_overlay_verify.mjs, but against
 * https://cmckhmer.github.io/Creative-Minds-/ after the deploy:
 *   1. the game root is fixed and covers the viewport (z >= 60)
 *   2. hit-test at viewport centre lands inside the game, not the
 *      Lounge leaderboard cards
 *   3. the page is locked to English (translate="no" on <html>)
 */
import { chromium } from 'playwright';

const BASE = 'https://cmckhmer.github.io/Creative-Minds-/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 } });
const fails = [];
const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails.push(label); };

try {
  await page.goto(BASE + '#brain-lounge', { waitUntil: 'networkidle', timeout: 60000 });

  ok((await page.evaluate(() => document.documentElement.getAttribute('translate'))) === 'no',
    'html[translate="no"] (auto-translate locked off)');

  // open the Arena Chess 3D cartridge
  const chessCard = page.locator('article', { hasText: 'Arena Chess 3D' }).first();
  await chessCard.getByRole('button', { name: /Play now/i }).click();
  await page.waitForTimeout(1500);

  // setup screen → begin the duel (vs computer)
  await page.getByRole('button', { name: /Begin the duel/i }).click();
  await page.waitForTimeout(5000); // lazy three.js scene on CDN can be slow

  const state = await page.evaluate(() => {
    const roots = [...document.querySelectorAll('div.fixed.inset-0')];
    const gameRoot = roots.find((el) => el.className.includes('z-[60]') && el.className.includes('overflow-hidden'));
    const r = gameRoot ? gameRoot.getBoundingClientRect() : null;
    const cs = gameRoot ? getComputedStyle(gameRoot) : null;
    const cards = [...document.querySelectorAll('section[aria-label="Lounge leaderboard"] .backdrop-blur-xl')];
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const topEl = document.elementFromPoint(cx, cy);
    const topInGame = !!gameRoot && (gameRoot === topEl || gameRoot.contains(topEl));
    return {
      foundGameRoot: !!gameRoot,
      zIndex: cs ? cs.zIndex : null,
      position: cs ? cs.position : null,
      coversViewport: !!r && r.width >= innerWidth - 2 && r.height >= innerHeight - 2,
      cardCount: cards.length,
      topInGame,
      topTag: topEl ? topEl.tagName + '.' + String(topEl.className).slice(0, 40) : 'none',
    };
  });

  ok(state.foundGameRoot, 'game root with z-[60] found (live build)');
  ok(state.position === 'fixed', 'game root is position:fixed');
  ok(Number(state.zIndex) >= 60, `z-index >= 60 (got ${state.zIndex})`);
  ok(state.coversViewport, 'game root covers the full viewport');
  ok(state.cardCount >= 3, `leaderboard cards still in DOM (got ${state.cardCount})`);
  ok(state.topInGame, `hit-test at viewport centre lands inside the game (got ${state.topTag})`);

  try {
    await page.screenshot({ path: '/tmp/render/chess-overlay-live.png', timeout: 8000 });
  } catch (shotErr) {
    console.log('NOTE screenshot skipped (WebGL repaint): ' + shotErr.message.split('\n')[0]);
  }
} catch (e) {
  fails.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
}

console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL LIVE CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
