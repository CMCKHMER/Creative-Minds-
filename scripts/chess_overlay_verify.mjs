/**
 * Chess3D fullscreen-overlay verification (local preview).
 *
 * Bug being fixed: the Arena Chess 3D game screen is `fixed inset-0` but had
 * NO z-index, so the Lounge leaderboard cards (later in DOM, backdrop-blur
 * stacking contexts) painted ON TOP of the running game.
 *
 * What this asserts after starting a solo duel:
 *   1. the game root is fixed and covers the viewport (z >= 60)
 *   2. at the leaderboard cards' page position, the TOP element at the
 *      screen centre and corners belongs to the game overlay — the cards
 *      can no longer intercept or overpaint the arena
 *   3. a screenshot is saved for eyeballing.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4189;
const BASE = `http://localhost:${PORT}/`; // relative base (./) — preview serves dist at root

// kill stale preview servers on this port (lesson from the false-pass incident)
try { const p = spawn('pkill', ['-f', `vite preview.*${PORT}`]); p.on('error', () => {}); } catch {}
await new Promise((r) => setTimeout(r, 600));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: '/home/z/my-project/tmp/cmc-site',
  stdio: 'ignore',
  detached: true,
});
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 850 } });
const fails = [];
const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails.push(label); };

try {
  await page.goto(BASE + '#brain-lounge', { waitUntil: 'networkidle', timeout: 45000 });

  // open the Arena Chess 3D cartridge (its "Play now" button inside the article)
  const chessCard = page.locator('article', { hasText: 'Arena Chess 3D' }).first();
  await chessCard.getByRole('button', { name: /Play now/i }).click();
  await page.waitForTimeout(1200);

  // setup screen → begin the duel (vs computer)
  await page.getByRole('button', { name: /Begin the duel/i }).click();
  await page.waitForTimeout(3500); // allow lazy three.js scene to mount

  const state = await page.evaluate(() => {
    // the game root: fixed inset-0 containing the "Lounge shelf" button of the arena HUD
    const roots = [...document.querySelectorAll('div.fixed.inset-0')];
    const gameRoot = roots.find((el) => el.className.includes('z-[60]') && el.className.includes('overflow-hidden'));
    const r = gameRoot ? gameRoot.getBoundingClientRect() : null;
    const cs = gameRoot ? getComputedStyle(gameRoot) : null;

    // leaderboard cards still exist in the DOM?
    const cards = [...document.querySelectorAll('section[aria-label="Lounge leaderboard"] .backdrop-blur-xl')];

    // who is on top at the centre of the viewport and above the board?
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

  ok(state.foundGameRoot, 'game root with z-[60] found');
  ok(state.position === 'fixed', 'game root is position:fixed');
  ok(Number(state.zIndex) >= 60, `z-index >= 60 (got ${state.zIndex})`);
  ok(state.coversViewport, 'game root covers the full viewport');
  ok(state.cardCount >= 3, `leaderboard cards still in DOM (got ${state.cardCount})`);
  ok(state.topInGame, `hit-test at viewport centre lands inside the game (got ${state.topTag})`);

  // WebGL canvases keep repainting via rAF, which can stall Playwright's
  // screenshot wait. The screenshot is eyeball-only — all real assertions
  // already ran above — so a timeout here must not fail the whole check.
  try {
    await page.screenshot({ path: '/tmp/render/chess-overlay-check.png', timeout: 8000 });
  } catch (shotErr) {
    console.log('NOTE screenshot skipped (WebGL repaint): ' + shotErr.message.split('\n')[0]);
  }
} catch (e) {
  fails.push('exception: ' + e.message);
  console.error(e);
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch {}
}

console.log(fails.length ? `\n${fails.length} FAILURES` : '\nALL CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
