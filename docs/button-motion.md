# Button motion

How the site's controls respond, and the rules that keep that response from
becoming noise. Chosen from the six candidates in `docs/lab/buttons.html`.

**Files**

| File | What it holds |
| --- | --- |
| `src/motion.css` | Every behaviour, its light-theme variant and its reduced-motion off-switch. Imported **last** in `src/main.tsx`. |
| `src/hooks/useMagneticTilt.ts` | Pointer → tilt/glare maths (`tiltFromPointer`), device gate (`tiltSupported`). |
| `src/hooks/useIdleNudge.ts` | The idle timer behind the hint bubble. |
| `src/components/BusyButton.tsx` | The AI working state **and** the success stamp — one control, two moments. |
| `src/tests/buttonMotion.test.ts` | CSS pins, wiring pins, math and hook behaviour. |

`motion.css` must stay **after** `glass.css` and `iridescent.css`: the button
skins there set `transform` with `!important`, and the tilt has to win the
cascade. A test enforces the import order.

## The three tiers

Motion carries meaning, so it comes in three flavours and a control should only
ever use one:

| Tier | Feels like | Used for |
| --- | --- | --- |
| **Instant** (`120ms`, `.cmc-press`, `:active`) | "this responds" | every button, every tap |
| **Informative** (`~340ms`, unfold/expansion) | "this reveals something" | answer keys, score panels — **not shipped yet** (candidate 5 in the lab, still a plain panel) |
| **Thinking** (breathing + tabular progress, `.cmc-busy`) | "this is working *for* you" | grading, publishing, AI actions |

A student should be able to tell, from the motion alone, whether a control is
going to submit, open something, or think. That is the whole design goal — not
decoration.

## 1 · Press depth — everywhere (site-wide default)

**Nothing to add to a component.** `motion.css` applies the press to every
`<button>`, `[role="button"]`, `<summary>` and submit/button/reset input:

```css
button:not(:disabled):not([class*="cmc-btn-"]):not([class*="cmc-press"]):active { translate: 0 2px; }
```

Three details make that safe:

- **`translate`, not `transform`.** `transform` is already spoken for by
  entrance animations, the hero tilt and Tailwind's `-translate-y-*`; writing
  `transform` here would make those elements jump. The individual `translate`
  property composes with whatever transform the element already has. A test
  scans the components to make sure no `<button>` is positioned *by* translate
  (a centred close button) without `data-press="off"`.
- **The skins are excluded** (`.cmc-btn-*`, `.cmc-press`). They already collapse
  their own edge; without the exclusion a primary button would sink twice.
- **Zero-specificity transition.** The `:where(...)` rule sets
  `transition: translate 110ms`, so a component's own `transition-*` utility
  still wins and nothing else changes behaviour.

`.cmc-press` remains for `<a>`/custom elements that are not native controls, and
gives the stronger version (2px + sheen + brightness). `.cmc-btn-primary`,
`.cmc-btn-3d*` and `.cmc-btn-ghost` also carry `touch-action: manipulation`
(kills the 300 ms double-tap delay) and `-webkit-tap-highlight-color`.

A phone never fires `:hover`, so under `@media (hover: none)` the skins' press is
deepened to 3px: on touch, `:active` is the whole show.

**Static pages** (`public/rfc3/*`, quizzes, planner) are plain HTML and do not
load `motion.css`; the same rule is appended to
`public/assets/css/cmc-iridescent.css`, which those pages already include.
`cmc-utilities.css` is generated — never hand-edit it.

**Opt out** with `data-press="off"` on anything positioned by `translate`.

## 2 · Magnetic tilt — one hero CTA, hover devices only

```tsx
const ctaRef = useMagneticTilt<HTMLButtonElement>();
<button ref={ctaRef} className="cmc-btn-primary cmc-tilt">Explore teacher tools</button>
```

- Max **8°** (`MAX_TILT_DEG`), clamped to the element's box, so a fast pointer
  can never spin it.
- Off on touch (`(hover: hover) and (pointer: fine)` required) and off under
  `prefers-reduced-motion`.
- Zero-size elements are ignored — no `NaN` written into a custom property.
- The glare uses `::before` because the primary skin already owns `::after`
  for its travelling sheen.
- **Budget: one per screen.** Two competing highlights read as a broken page.

## 3 · Busy / AI working state

The label *is* the progress read-out, so a 14-write run never looks stuck.

```tsx
<BusyButton
  state={phase}                                   // 'idle' | 'working' | 'done'
  idleLabel={`Create ${missing.length} classes`}
  workingLabel={`Creating ${done + 1} of ${missing.length}…`}
  doneLabel={`${missing.length} classes created`}
  progress={done / missing.length}                // 0…1 → the 3px bar
  stamp                                           // tick + halo on 'done'
  className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-3"
/>
```

- `working` sets `aria-busy`, disables the button (no double submits) and
  announces the label through `aria-live="polite"`.
- Progress is `scaleX(var(--cmc-busy-p))` on a 3 px bar — never a width
  animation, so a progress tick costs no layout.
- Keep the working text **coarse** ("Creating 3 of 14…"), not every write —
  screen readers re-read the live region.
- Numbers use `font-variant-numeric: tabular-nums` so the label does not jitter
  as digits change.

Live example: the Kid 5–11 class setup dialog
(`src/components/RosterRegistrationPanel.tsx`), which writes fourteen classes
one at a time. It now also holds the confirmation beat — the tick stamps for
650 ms before the dialog closes, instead of the panel vanishing under the
teacher's finger.

## Not shipped yet — unfold

Candidate 5 in the lab (a button that grows into the answer-key/score panel)
is deliberately left out of this pass: it needs its own accessible disclosure
component (`aria-expanded`, focus handling, Esc), not just a class. The lab
sheet still demonstrates it; `docs/lab/buttons.html` stays the reference until
it earns a component.

## 4 · Success stamp

`stamp` on `BusyButton`: squash, tick stamp, halo — 420 ms total, once, no
confetti. Use it for a student's submission, not for navigation.

## 5 · Idle nudge

```tsx
const ref = useIdleNudge<HTMLButtonElement>();      // 6s default
<button ref={ref} className="cmc-nudge cmc-nudge--below">
  Find my score
  <span className="cmc-nudge__bubble" aria-hidden="true">The name you wrote on the homework</span>
</button>
```

Nothing at rest; after the idle window it breathes twice and shows the bubble.
Any `pointerenter` / `pointerdown` / `focusin` / `keydown` silences it, and
leaving re-arms it. Use `.cmc-nudge--below` when the control sits near the top
of a sheet. **Budget: one per screen**, and only where being stuck is a real
possibility.

## Rules for any new effect

1. **Transform and opacity only.** No `width`, `height`, `top`/`left`, and no
   repeating `box-shadow` — those repaint or reflow every frame. The nudge ring
   is the one exception (a 2.4 s pulse, not a loop on a CTA).
2. **Light theme or it does not ship.** `index.css` re-states the dark skins
   under `html.light`; add the pale-theme variant in the same commit.
3. **`prefers-reduced-motion` or it does not ship.** The block at the bottom of
   `motion.css` kills every decoration; the *state changes* must still happen.
4. **Touch first.** If the effect only exists in `:hover`, a phone never sees
   it — and most students are on phones.
5. **Never rotate, flip or scramble a label.** The CTAs are uppercase with
   `letter-spacing: .14em`, and many readers use English as a second language.
   Animate around text, never the text itself.
6. **Pin it.** Add a line to `src/tests/buttonMotion.test.ts` — CSS strings,
   wiring, or behaviour — so a later refactor cannot silently drop it.

## Adding a control — checklist

- [ ] press depth: `.cmc-press`, or one of the `.cmc-btn-*` skins (free)
- [ ] if it runs a multi-step write: `BusyButton` with real `progress`
- [ ] if it confirms a kid's submission: `stamp`
- [ ] if it is the one thing a stuck student needs: `useIdleNudge`
- [ ] light-theme rule + reduced-motion rule (motion.css)
- [ ] a pin in `src/tests/buttonMotion.test.ts`
