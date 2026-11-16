# The Brain Lounge — cartridges, chrome and the audit

The arcade at `/#brain-lounge` is one page plus one registry. Everything a
cartridge needs to appear, launch, gate, score and get back home is checked by
`npm run check:lounge`.

## The five moving parts

| Piece | Where | Job |
|---|---|---|
| Registry | `src/games/registry.ts` | One entry per cartridge: id, copy, genre, difficulty, mode, launch target, cover art |
| Shelf | `src/components/BrainLoungePage.tsx` | Renders the grid **straight from the registry** — never edit it to add a game |
| React cartridges | `src/games/<id>/` | Lazy-loaded chunks, receive `{ onExit }` |
| Standalone cartridges | `public/arcade/<id>/`, `public/mafia.html` | Self-contained pages, served as-is |
| Shared chrome | `public/assets/js/cmc-game-chrome.js` | ← Back to CMC, class board, share sheet, how-to-play sheet |

## The rule this repo now enforces

**Every cartridge must offer a way back to CMC.** On the shelf that is the glass
top bar; inside a React cartridge it is the `onExit` button; inside a
standalone page it is either a `#brain-lounge` link or the shared chrome.

`npm run check:lounge` fails the build when a cartridge:

- has no id, title, tagline, genre, difficulty or status
- points at a lazy chunk that does not exist, or has no default export
- points at a `public/` page that does not exist
- has no `CMC_GATE.guard(...)` account gate
- has no `drillSource 'brain-lounge'` score sync
- has no `<title>`, meta description or viewport meta
- has no back-to-CMC control
- references a local image that is not on disk
- declares cover art that is missing (or over 400 KB)

```
npm run check:lounge           # human report, exit 1 on a problem
node scripts/check_brain_lounge_games.mjs --json   # machine report
```

## Adding a cartridge

1. Build the game.
   **React** → `src/games/<id>/<Id>Game.tsx`, default export, accept
   `BrainGameProps` (`{ onExit }`) and call `onExit` from a visible button.
   **Standalone** → `public/arcade/<id>/index.html` with
   `cmc-auth-gate.js` + `CMC_GATE.guard('account', …)` at the top.
2. Add the registry entry (`status: 'live'`, `mode`, `load` or `launchUrl`,
   `controls`, `scoreLabel`, `art`).
3. Drop a cover at `public/arcade/art/cover-<id>.jpg` (~1000×560, under
   400 KB — `convert in.jpg -resize 1000x -quality 84 out.jpg`).
4. Post a run to the shared board (`submitScore` with
   `drillSource: 'brain-lounge'`).
5. `npm run check:lounge` until it is green.

## The shared chrome

```html
<script>window.CMC_GAME_CHROME = {
  theme: 'neon',            // neon | aurora | noir | glass
  title: 'Galica',
  bay: 'Bay 03',
  help: { intro: '…', sections: [{ h: 'Controls', items: ['…'] }],
          art: [{ src: '../art/galica-sector-1.jpg', title: 'Sector 1', sub: 'Deep Space' }] },
  mount: '#cmcGcSlot',      // optional: inline cluster inside the page's own header
  inline: true,
  actions: ['back']         // default: back, board, share (+ help when help is set)
};</script>
<script src="../../assets/js/cmc-game-chrome.js"></script>
```

It renders:

- **← Back to CMC** — `#brain-lounge`, in the same corner on every game
- **🏆 Class board** — the Lounge leaderboard
- **📣 Share** — copy link, Google Classroom, WhatsApp, Telegram, email
- **? How to play** — a readable sheet built from the page's own words

While a sheet is open the chrome dispatches `cmc-chrome:modal`
(`{ detail: { open: true|false } }`). Galica freezes its run on that event; any
other cartridge can pause the same way:

```js
window.addEventListener('cmc-chrome:modal', (e) => { paused = e.detail.open; });
```

Escape closes a sheet. `src/games/brainLoungeChrome.test.ts` runs the script in
jsdom and asserts the back link, the share channels, the pause event and the
inline mount, so the furniture cannot quietly disappear.

## Cartridge notes

| Bay | Game | Mode | Back to CMC | Notes |
|---|---|---|---|---|
| 01 | BrickForge | React | Lounge shelf (`onExit`) | 1-level guest trial, then account |
| 02 | Arena Chess 3D | React | Lounge shelf (`onExit`) | 3D pieces, online rooms |
| 03 | Galica | standalone | Shared chrome + briefing link | Briefing screen (key art, ships, sectors), pause-aware |
| 04 | Mafia Noir | standalone | Header `← CMC` + hub bar | Its own share kit gained Google Classroom |
| 05 | Word Creator | standalone | Chrome cluster in its own header + hub links | Online rooms, lexicon |
| 06 | — | reserved | — | Drop the next game here |

## Art

`public/arcade/art/` holds the shelf art: five `cover-<id>.jpg` cartridges
(shown on the shelf and on the “Now playing” stage header) plus Galica's
`galica-keyart.jpg` and four `galica-sector-*.jpg` posters, which appear in the
briefing and in its how-to-play sheet. Covers are decorative in the accessible
sense — the title, genre and badges carry the meaning, so the `alt` stays short.

## After a deploy

`public/sw.js` is a stale-while-revalidate cache. Bump `CACHE_VERSION` (and add
a line to its changelog comment) whenever you change a page or an asset that a
student may already have cached — otherwise a phone keeps the old copy.
