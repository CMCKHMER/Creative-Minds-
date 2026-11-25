// BusyButton — the "AI working state" and the "success stamp" from the Button
// Lab, as one component (docs/button-motion.md).
//
// Why one component: a button that reports progress and a button that confirms
// success are the same control at different moments. Keeping them together
// means the label, the width and the focus ring never jump between the two
// states — which is exactly the jitter that makes spinner-and-toast UIs feel
// unreliable.
//
//   <BusyButton
//     state={busy ? 'working' : done ? 'done' : 'idle'}
//     idleLabel="Create 14 classes"
//     workingLabel={`Creating ${n} of 14…`}
//     doneLabel="14 classes created"
//     progress={n / 14}
//     stamp
//   />
//
// CSS: .cmc-busy / .cmc-busy--stamp in src/motion.css.
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';

export type BusyState = 'idle' | 'working' | 'done';

export interface BusyButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Current phase. `working` disables the button and shows the spinner. */
  state?: BusyState;
  /** Label at rest. */
  idleLabel: string;
  /** Label while working — usually carries the real progress ("Grading 3 of 12…"). */
  workingLabel?: string;
  /** Label once finished. */
  doneLabel?: string;
  /** 0…1, drives the 3px progress bar. Ignored outside `working`. */
  progress?: number;
  /** `done` stamps a tick with a halo — use it for a student's submission. */
  stamp?: boolean;
}

function clamp01(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export const BusyButton = forwardRef<HTMLButtonElement, BusyButtonProps>(function BusyButton(
  { state = 'idle', idleLabel, workingLabel, doneLabel, progress, stamp = false, className, disabled, type = 'button', ...rest },
  ref,
) {
  const working = state === 'working';
  const label = working ? (workingLabel ?? idleLabel) : state === 'done' ? (doneLabel ?? idleLabel) : idleLabel;
  const fill = clamp01(progress);

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      data-state={state}
      aria-busy={working ? true : undefined}
      disabled={disabled || working}
      className={['cmc-busy', stamp ? 'cmc-busy--stamp' : '', className].filter(Boolean).join(' ')}
      style={{ ...rest.style, ['--cmc-busy-p' as string]: String(fill) } as CSSProperties}
    >
      {stamp ? <span className="cmc-busy__halo" aria-hidden="true" /> : null}
      <span className="cmc-busy__label" aria-live="polite" aria-atomic="true">
        <span className="cmc-busy__spin" aria-hidden="true" />
        {stamp && state === 'done' ? <span className="cmc-busy__tick" aria-hidden="true">✓</span> : null}
        {label}
      </span>
      <span className="cmc-busy__fill" aria-hidden="true" />
    </button>
  );
});

export default BusyButton;
