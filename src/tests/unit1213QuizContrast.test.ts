import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const quiz = readFileSync(resolve(process.cwd(), 'public/rfc3/unit12-13-quiz.html'), 'utf8');
const light = (token: string) => `html[data-theme="light"] ${token}`;

/**
 * "Hard to view text" — the Kid 11 Units 12–13 secure quiz syncs with the
 * site theme. In light mode its cards flipped to white while the gate/quiz
 * text kept the dark theme's near-white colours (#f8fafc / #cbd5e1 / …),
 * rendering white-on-white. These tests pin the light-theme foregrounds and
 * the removal of inline colours that CSS could never override.
 */
describe('Units 12–13 secure quiz — readable in both themes', () => {
  it('syncs with the site theme and restyles the gate card text dark on white', () => {
    expect(quiz).toContain("localStorage.getItem('cmc-theme')");
    expect(quiz).toContain(light('.gate-card{background:rgba(255,255,255,.96)'));
    expect(quiz).toContain(light('.gate-card h1'));
    expect(quiz).toContain('color:#0f172a');
    expect(quiz).toContain(light('.gate-card p{color:#475569}'));
    expect(quiz).toContain(light('.rule{'));
    expect(quiz).toContain(light('.kicker{color:#0369a1}'));
  });

  it('makes the name/ID form readable: labels, inputs and placeholders', () => {
    expect(quiz).toContain(light('.field label{color:#475569}'));
    expect(quiz).toContain(light('.field input'));
    expect(quiz).toContain('color:#0f172a');
    expect(quiz).toContain(light('.field input::placeholder'));
    expect(quiz).toContain('.field input::placeholder,.write input::placeholder,.write textarea::placeholder{color:#94a3b8;opacity:1}');
  });

  it('covers the quiz body, result panel chrome and bottom bar in light mode', () => {
    for (const token of [
      light('.passage h4'),
      light('.sec-head h2'),
      light('.stat b'),
      light('.score{color:#0f172a}'),
      light('.leader li{'),
      light('.teacher-note{'),
      light('.btm{'),
      light('.btn{'),
      light('.note{color:#475569}'),
      light('#gateMsg{color:#b91c1c}'),
    ]) {
      expect(quiz, token).toContain(token);
    }
  });

  it('remaps pale inline colours in JS-injected markup instead of leaving them washed out', () => {
    for (const hex of ['#94a3b8', '#e2e8f0', '#cbd5e1', '#67e8f9', '#6ee7b7', '#fecaca']) {
      expect(quiz, hex).toContain(light(`[style*="color:${hex}"]`));
    }
    // The toast keeps its dark chip in both themes.
    expect(quiz).toContain(light('#toast{color:#e2e8f0!important}'));
  });

  it('keeps theme-critical colours out of inline styles so both themes can style them', () => {
    expect(quiz).not.toContain('id="violPill" style=');
    expect(quiz).not.toContain('id="gateMsg" style="margin-top');
    expect(quiz).toContain('<label class="agree">');
    expect(quiz).toContain('#violPill:not(.warn):not(.bad)');
    expect(quiz).toContain('#gateMsg{');
  });
});
