export type TickerHighlightBadge = 'NEW' | 'UPGRADED' | 'UPDATED';
export type TickerHighlightAccent = 'cyan' | 'emerald' | 'violet' | 'amber';

export interface TickerHighlight {
  id: string;
  badge: TickerHighlightBadge;
  title: string;
  summary: string;
  href: string;
  accent: TickerHighlightAccent;
}

/**
 * Promoted new and recently upgraded features surfaced right at the front of
 * the homepage Live Activity ticker so visitors and teachers can discover and
 * launch them directly. Keep descriptions crisp (~6-10 words) and link every
 * item to a live route (`#...`) or standalone page (`./...html`).
 */
export const TICKER_HIGHLIGHTS: readonly TickerHighlight[] = [
  {
    id: 'syntax-clash-rpg',
    badge: 'NEW',
    title: 'Syntax Clash: Cybernetic Breach RPG',
    summary: 'Cyberpunk hacking RPG · 4-phase AI boss & 4 Hacker Academies',
    href: './syntax-clash-pro.html',
    accent: 'cyan',
  },
  {
    id: 'talk-to-me-rpg',
    badge: 'NEW',
    title: 'Talk to me: Srok Speak RPG',
    summary: 'Explore 8 Cambodian zones & speak English with animated NPCs',
    href: './voice-quest.html',
    accent: 'emerald',
  },
  {
    id: 'cryo-vault-lockdown',
    badge: 'UPGRADED',
    title: 'Cryo-Vault Lockdown',
    summary: '3D sci-fi escape redesigned with dark & light glass themes',
    href: './cryo-lockdown.html',
    accent: 'cyan',
  },
  {
    id: 'reason-lab',
    badge: 'UPGRADED',
    title: 'Reason Lab',
    summary: 'Detective case files redesigned with 4 reasoning modes',
    href: './reason-lab.html',
    accent: 'violet',
  },
  {
    id: '30-student-activation-tactics',
    badge: 'NEW',
    title: '30 Student Activation Tactics',
    summary: 'ESL teacher guide + 7-part interactive workshop',
    href: '#library/30-student-activation-tactics',
    accent: 'amber',
  },
  {
    id: 'how-to-talk-so-kids-will-listen',
    badge: 'NEW',
    title: 'How to Talk So Kids Will Listen',
    summary: 'Parent & teacher book + 100-item communication workshop',
    href: '#library/how-to-talk-so-kids-will-listen',
    accent: 'amber',
  },
  {
    id: 'gep-level-9',
    badge: 'NEW',
    title: 'GEP Level 9 · World Class 1',
    summary: 'Unified teacher book hub covering Units 1–12',
    href: '#gep-isec',
    accent: 'violet',
  },
  {
    id: 'biweek-planner',
    badge: 'UPDATED',
    title: 'TOEFL ITP Bi-Weekly Planner',
    summary: '8-week teacher schedule with new 3D Aii welcome hero',
    href: '#toefl-itp-planner',
    accent: 'emerald',
  },
];
