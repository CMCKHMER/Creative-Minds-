import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Regression guard — homepage placement of the announcement board.
 *
 * The site owner asked for the "News & announcements" board to sit at the
 * TOP of the homepage (directly under the hero) because it is news and
 * info that visitors should see first. These invariants stop a future
 * edit from accidentally re-burying the section lower down the page.
 */
const here = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(here, '..', 'App.tsx'), 'utf8');
const boardSrc = readFileSync(join(here, '..', 'components', 'AnnouncementBoard.tsx'), 'utf8');

// Every homepage content section that must render BELOW the announcement
// board (i.e. appear after it in App.tsx's JSX).
const SECTIONS_BELOW_BOARD = [
  '<DailyAssessmentCard',
  '<TOEFLiBTCard',
  '<LMSCard',
  '<FirebaseDashboard',
  '<BiWeekPlannerCard',
  '<SocialProof',
  '<KidGradeHub',
  '<GEPISecHub',
  '<InteractiveShowcase',
  '<FeaturesBento',
  '<MiniMockTest',
  '<ToeflJuniorAssessments',
  '<ResourceLibrary',
  '<RoiCalculator',
  '<ComparisonTable',
  '<Testimonials',
  '<Pricing',
  '<FaqSection',
  '<CtaSection',
] as const;

describe('homepage announcements placement', () => {
  it('renders the announcement board exactly once', () => {
    expect(appSrc.split('<AnnouncementBoard />').length - 1).toBe(1);
  });

  it('sits directly under the hero — above every other content section', () => {
    const board = appSrc.indexOf('<AnnouncementBoard />');
    expect(board).toBeGreaterThan(-1);

    // Anchor on the Hero JSX (its sidePanel prop is unique to that usage):
    // the board must come after the hero renders.
    const heroAnchor = appSrc.indexOf('sidePanel={<NewsSidePanel onSeeAll={openNewsPage} />}');
    expect(heroAnchor).toBeGreaterThan(-1);
    expect(board, 'board must render after the hero').toBeGreaterThan(heroAnchor);

    for (const usage of SECTIONS_BELOW_BOARD) {
      expect(appSrc.indexOf(usage), `${usage} must render after the announcement board`).toBeGreaterThan(board);
    }
  });

  it('board keeps its public anchor and pinned-first copy', () => {
    expect(boardSrc).toContain('id="announcements"');
    expect(boardSrc).toContain('Pinned posts stay highlighted at the top.');
  });
});
