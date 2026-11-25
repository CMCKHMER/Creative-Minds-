// @vitest-environment jsdom
//
// The motion layer (src/motion.css + BusyButton + the two hooks) is skin-deep,
// which is exactly the kind of thing that rots silently: a class gets renamed,
// the light-theme override is forgotten, or an effect ships without its
// reduced-motion off-switch. These pins are cheap and they catch all three:
//
//   css     every behaviour + its light-theme and reduced-motion variant exists
//   order   motion.css is imported LAST, or the button skins win the cascade
//   wiring  the hero CTA tilts, the class-creation button reports progress,
//           the score button nudges — and the hero has exactly one tilt
//   logic   the tilt maths clamps, and the hooks respect the device
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BusyButton } from '../components/BusyButton';
import { MAX_TILT_DEG, tiltFromPointer, tiltSupported, useMagneticTilt } from '../hooks/useMagneticTilt';
import { useIdleNudge } from '../hooks/useIdleNudge';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');
const MOTION = read('src/motion.css');

/** Extract one rule block by selector so assertions stay local. */
function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function stubMatchMedia(answered: (query: string) => boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: answered(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('motion.css — the five behaviours', () => {
  it('defines the shared timing tokens', () => {
    expect(MOTION).toMatch(/--cmc-spring:\s*cubic-bezier/);
    expect(MOTION).toMatch(/--cmc-ease:\s*cubic-bezier/);
    expect(MOTION).toMatch(/--cmc-press-ms:\s*120ms/);
  });

  it('1a · press depth is the default for every native control', () => {
    // No class needed: button / [role=button] / summary / submit inputs.
    expect(MOTION).toMatch(/button:not\(:disabled\)[^{]*:active\s*\{\s*translate: 0 2px;/);
    expect(MOTION).toContain('[role="button"]:not([aria-disabled="true"])');
    expect(MOTION).toContain('summary:not([class*="cmc-btn-"]):not([data-press="off"]):active');
    expect(MOTION).toContain('input[type="submit"]:not(:disabled)');
    // Uses the individual `translate` property so it composes with a
    // component's own transform instead of overwriting it.
    expect(MOTION).toMatch(/:active\s*\{\s*translate: 0 2px;/);
    // The skins already sink on their own — they must be excluded.
    expect(MOTION).toContain(':not([class*="cmc-btn-"])');
    expect(MOTION).toContain(':not([class*="cmc-press"])');
    // Escape hatch for anything positioned BY translate.
    expect(MOTION).toContain('[data-press="off"]');
    // Zero-specificity default transition so utilities still win.
    expect(MOTION).toMatch(/:where\(\s*button:not\(:disabled\)/);
  });

  it('1b · the static worksheet pages get the same press rule', () => {
    const staticCss = readFileSync(resolve(process.cwd(), 'public/assets/css/cmc-iridescent.css'), 'utf8');
    expect(staticCss).toContain('translate: 0 2px;');
    expect(staticCss).toContain(':not([class*="cmc-btn-"])');
    expect(staticCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(staticCss).toContain('translate: none !important;');
  });

  it('1c · no <button> is positioned by translate without opting out', () => {
    // A global `translate` on :active would fight a centring utility, so any
    // such button has to carry data-press="off" (none need it today).
    const files = ['src/App.tsx', ...readdirSync(resolve(process.cwd(), 'src/components')).map((f) => `src/components/${f}`)]
      .filter((f) => f.endsWith('.tsx'));
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      for (const tag of src.match(/<button\b[^>]*>/gs) ?? []) {
        if (/-translate-[xy]-1\/2/.test(tag) && !tag.includes('data-press="off"')) {
          throw new Error(`${file}: a <button> centred with translate must set data-press="off" — ${tag.slice(0, 120)}`);
        }
      }
    }
  });

  it('1d · press depth answers the finger on touch screens', () => {
    const press = block(MOTION, '.cmc-press:active');
    expect(press).toContain('translateY(2px)');
    // Hover never fires on a phone, so :active has to carry it.
    expect(MOTION).toMatch(/@media \(hover: none\)/);
    expect(MOTION).toContain('touch-action: manipulation');
    expect(MOTION).toContain('-webkit-tap-highlight-color: transparent');
  });

  it('2 · tilt is bounded and self-perspectived', () => {
    const tilt = block(MOTION, '\n.cmc-tilt {');
    expect(tilt).toContain('perspective(620px)');
    expect(tilt).toContain('rotateX(var(--cmc-tilt-x))');
    expect(tilt).toContain('rotateY(var(--cmc-tilt-y))');
    // The glare must not reuse ::after — the primary skin owns it.
    expect(MOTION).toMatch(/\.cmc-tilt::before\s*\{/);
    expect(MOTION).toContain('radial-gradient');
    // And it must out-specify .cmc-btn-primary:hover from iridescent.css.
    expect(MOTION).toMatch(/html \.cmc-tilt:hover/);
  });

  it('3 · busy state reports progress without touching layout', () => {
    expect(MOTION).toContain('.cmc-busy[data-state="working"] .cmc-busy__spin');
    const fill = block(MOTION, '.cmc-busy__fill');
    expect(fill).toContain('transform: scaleX(var(--cmc-busy-p, 0))');
    expect(fill).toContain('height: 3px');
    // Progress is scaleX, never width — no layout on every tick.
    expect(fill).not.toContain('width: var(--cmc-busy-p');
    expect(MOTION).toContain('font-variant-numeric: tabular-nums');
  });

  it('4 · the stamp only animates in the done state', () => {
    expect(MOTION).toContain('.cmc-busy--stamp[data-state="done"] .cmc-busy__tick');
    expect(MOTION).toContain('@keyframes cmc-busy-halo');
    expect(MOTION).toContain('@keyframes cmc-busy-pop');
  });

  it('5 · the idle nudge is inert until is-nudging', () => {
    expect(block(MOTION, '.cmc-nudge.is-nudging {')).toContain('animation');
    expect(block(MOTION, '.cmc-nudge__bubble')).toContain('opacity: 0');
    expect(block(MOTION, '.cmc-nudge.is-nudging .cmc-nudge__bubble')).toContain('opacity: 1');
  });

  it('gives every behaviour a light-theme variant', () => {
    expect(MOTION).toContain('html.light .cmc-tilt::before');
    expect(MOTION).toContain('html.light .cmc-busy__halo');
    expect(MOTION).toContain('html.light .cmc-nudge__bubble');
  });

  it('turns every behaviour off under prefers-reduced-motion, last in the file', () => {
    const reduced = MOTION.slice(MOTION.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('html .cmc-tilt:hover');
    expect(reduced).toContain('.cmc-busy[data-state="working"]');
    expect(reduced).toContain('.cmc-nudge.is-nudging');
    expect(reduced).toContain('animation: none !important');
    // the site-wide press is turned off too
    expect(reduced).toContain('translate: none !important');
    // Nothing after the block may re-enable motion.
    expect(MOTION.trimEnd().endsWith('}')).toBe(true);
    expect(MOTION.lastIndexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
      MOTION.indexOf('.cmc-nudge.is-nudging::after'),
    );
  });

  it('is imported last in main.tsx so it out-cascades the button skins', () => {
    const main = read('src/main.tsx');
    const motion = main.indexOf('motion.css');
    expect(motion).toBeGreaterThan(main.indexOf('iridescent.css'));
    expect(motion).toBeGreaterThan(main.indexOf('glass.css'));
    expect(motion).toBeGreaterThan(main.indexOf('index.css'));
  });
});

describe('wiring — where the behaviours are actually used', () => {
  it('tilts exactly one hero CTA', () => {
    const hero = read('src/components/Hero.tsx');
    expect(hero).toContain('useMagneticTilt');
    expect(hero.match(/cmc-tilt/g)?.length).toBe(1);
    expect(hero).toContain('ref={primaryCtaRef}');
  });

  it('reports real progress on the 14-class creation run', () => {
    const panel = read('src/components/RosterRegistrationPanel.tsx');
    expect(panel).toContain('<BusyButton');
    expect(panel).toContain('workingLabel={`Creating ${Math.min(done + 1, missing.length)} of ${missing.length}…`}');
    expect(panel).toContain('progress={missing.length > 0 ? done / missing.length : 0}');
    // The confirmation beat before the dialog closes.
    expect(panel).toContain("setPhase('done')");
  });

  it('nudges the student who cannot find their score', () => {
    const sheet = read('src/components/KidMyHomeworkScore.tsx');
    expect(sheet).toContain('useIdleNudge');
    expect(sheet).toContain('cmc-nudge cmc-nudge--below');
    expect(sheet).toContain('The name you wrote on the homework');
  });
});

describe('tiltFromPointer', () => {
  it('is neutral in the middle', () => {
    expect(tiltFromPointer(0.5, 0.5)).toEqual({ x: 0, y: 0, gx: 50, gy: 50 });
  });

  it('tips the top edge back and the right edge forward', () => {
    const topRight = tiltFromPointer(1, 0);
    expect(topRight.x).toBe(MAX_TILT_DEG); // pointer high → top tips away
    expect(topRight.y).toBe(MAX_TILT_DEG); // pointer right → right edge forward
    expect(topRight.gx).toBe(100);
    expect(topRight.gy).toBe(0);
  });

  it('clamps outside the box instead of spinning', () => {
    const far = tiltFromPointer(-3, 4); // left of and below the box
    expect(far.x).toBe(-MAX_TILT_DEG);  // pointer low → top edge tips forward
    expect(far.y).toBe(-MAX_TILT_DEG);
    expect(far.gx).toBe(0);
    expect(far.gy).toBe(100);
  });

  it('survives NaN (zero-size element)', () => {
    expect(tiltFromPointer(Number.NaN, Number.NaN)).toEqual({ x: 0, y: 0, gx: 50, gy: 50 });
  });
});

describe('tiltSupported', () => {
  it('needs a fine hover pointer', () => {
    stubMatchMedia((q) => q.includes('hover: hover'));
    expect(tiltSupported()).toBe(true);
  });

  it('is off on touch-only devices', () => {
    stubMatchMedia(() => false);
    expect(tiltSupported()).toBe(false);
  });

  it('is off when the user asked for reduced motion, even with a mouse', () => {
    stubMatchMedia((q) => (q.includes('prefers-reduced-motion') ? true : q.includes('hover: hover')));
    expect(tiltSupported()).toBe(false);
  });
});

describe('useMagneticTilt', () => {
  function TiltProbe() {
    const ref = useMagneticTilt<HTMLButtonElement>();
    return createElement('button', { ref, type: 'button' }, 'tilt me');
  }

  it('writes the custom properties from the pointer position', () => {
    stubMatchMedia((q) => q.includes('hover: hover'));
    const { container } = render(createElement(TiltProbe));
    const btn = container.querySelector('button')!;
    btn.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });

    btn.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 0 }));

    expect(btn.style.getPropertyValue('--cmc-tilt-y')).toBe(`${MAX_TILT_DEG.toFixed(2)}deg`);
    expect(btn.style.getPropertyValue('--cmc-tilt-x')).toBe(`${MAX_TILT_DEG.toFixed(2)}deg`);
    expect(btn.style.getPropertyValue('--cmc-tilt-gx')).toBe('100.0%');

    fireEvent.pointerLeave(btn);
    expect(btn.style.getPropertyValue('--cmc-tilt-x')).toBe('0.00deg');
    expect(btn.style.getPropertyValue('--cmc-tilt-gx')).toBe('50.0%');
  });

  it('does nothing on a touch device (no listeners, no vars)', () => {
    stubMatchMedia(() => false);
    const { container } = render(createElement(TiltProbe));
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('style')).toBeNull();
  });
});

describe('useIdleNudge', () => {
  function NudgeProbe() {
    const ref = useIdleNudge<HTMLButtonElement>(6000);
    return createElement('button', { ref, type: 'button', className: 'cmc-nudge' }, 'Hint');
  }

  beforeEach(() => {
    stubMatchMedia(() => false); // reduced motion NOT requested
  });

  it('stays still, then nudges after the idle window', () => {
    vi.useFakeTimers();
    const { container } = render(createElement(NudgeProbe));
    const btn = container.querySelector('button')!;

    expect(btn.classList.contains('is-nudging')).toBe(false);
    vi.advanceTimersByTime(5999);
    expect(btn.classList.contains('is-nudging')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(btn.classList.contains('is-nudging')).toBe(true);
  });

  it('silences itself on interaction and re-arms on leaving', () => {
    vi.useFakeTimers();
    const { container } = render(createElement(NudgeProbe));
    const btn = container.querySelector('button')!;

    vi.advanceTimersByTime(6000);
    expect(btn.classList.contains('is-nudging')).toBe(true);

    fireEvent.pointerEnter(btn);
    expect(btn.classList.contains('is-nudging')).toBe(false);

    fireEvent.pointerLeave(btn);
    vi.advanceTimersByTime(6000);
    expect(btn.classList.contains('is-nudging')).toBe(true);
  });

  it('never nudges when the user asked for reduced motion', () => {
    vi.useFakeTimers();
    stubMatchMedia((q) => q.includes('prefers-reduced-motion'));
    const { container } = render(createElement(NudgeProbe));
    const btn = container.querySelector('button')!;
    vi.advanceTimersByTime(20000);
    expect(btn.classList.contains('is-nudging')).toBe(false);
  });
});

describe('BusyButton', () => {
  const base = { type: 'button' as const };

  it('renders the idle label with no busy semantics', () => {
    render(createElement(BusyButton, { ...base, state: 'idle', idleLabel: 'Create 14 classes' }));
    const btn = screen.getByRole('button');
    expect(btn.textContent).toBe('Create 14 classes');
    expect(btn.getAttribute('data-state')).toBe('idle');
    expect(btn.getAttribute('aria-busy')).toBeNull();
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('shows the progress label while working and blocks double submits', () => {
    const onClick = vi.fn();
    render(
      createElement(BusyButton, {
        ...base,
        state: 'working',
        idleLabel: 'Create 14 classes',
        workingLabel: 'Creating 3 of 14…',
        progress: 2 / 14,
        onClick,
      }),
    );
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('Creating 3 of 14…');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(true);
    // tabular alignment + the fill bar both read the same number
    expect(Number(btn.style.getPropertyValue('--cmc-busy-p'))).toBeCloseTo(2 / 14, 5);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    // The live region is what a screen reader hears.
    expect(btn.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('clamps progress into 0…1', () => {
    const { container } = render(createElement(BusyButton, { ...base, state: 'working', idleLabel: 'x', progress: 4 }));
    expect(container.querySelector('button')!.style.getPropertyValue('--cmc-busy-p')).toBe('1');

    cleanup();
    const second = render(createElement(BusyButton, { ...base, state: 'working', idleLabel: 'x', progress: -2 }));
    expect(second.container.querySelector('button')!.style.getPropertyValue('--cmc-busy-p')).toBe('0');
  });

  it('stamps a tick and the done label when stamped', () => {
    const { container } = render(
      createElement(BusyButton, { ...base, state: 'done', stamp: true, idleLabel: 'Submit', doneLabel: '14 classes created' }),
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('cmc-busy--stamp');
    expect(btn.textContent).toContain('14 classes created');
    expect(btn.querySelector('.cmc-busy__tick')).not.toBeNull();
    expect(btn.querySelector('.cmc-busy__halo')).not.toBeNull();
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('keeps caller classes and disabled/aria props intact', () => {
    render(
      createElement(BusyButton, {
        ...base,
        state: 'idle',
        idleLabel: 'All fourteen classes exist',
        disabled: true,
        className: 'w-full rounded-xl',
        'data-testid': 'kid-classes-create',
      } as unknown as Parameters<typeof BusyButton>[0]),
    );
    const btn = screen.getByTestId('kid-classes-create');
    expect(btn.className).toContain('cmc-busy');
    expect(btn.className).toContain('w-full');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
