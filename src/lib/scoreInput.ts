// Daily Student Assessment Records — score-cell input sanitizer.
//
// Shared by ScoreCell (AssessmentWorkspace.tsx) so the typing rules are
// unit-testable. A score cell is a bounded integer rubric field (0–5 skills,
// 0–100 criteria/days). The sanitizer enforces that shape AT THE KEYSTROKE:
//
//   - digits only (paste of garbage degrades to its digits),
//   - length-capped to how many digits `max` spans.
//
// The length cap is the important half: a 0–5 cell is physically single-digit,
// so typing a second digit is rejected instead of producing "45" which the
// clamp then silently snapped to the cap — the "every score I type becomes 5"
// bug (Oct 2026). Out-of-range pastes still clamp in the caller (999 → 5 on a
// 0–5 cell) because a paste is a deliberate whole-value replacement, but no
// amount of extra typing can push a cell past its scale.

/** Sanitize raw typed text for a score cell bounded by `max`. */
export function sanitizeScoreText(raw: string, max: number): string {
  const digits = raw.replace(/\D/g, '');
  const cap = String(Math.max(1, Math.trunc(max) || 1)).length;
  return digits.slice(0, cap);
}
