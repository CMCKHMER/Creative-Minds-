/*
 * Copyright © 2026 CMCKHMER.
 * All rights reserved.
 * No use, reproduction, redistribution, or adaptation of this project content
 * is permitted without the express written permission of the copyright owner.
 */

import { Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { TestThanksOverlay } from './components/TestThanksOverlay';
import { QuickDrawer } from './components/QuickDrawer';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { TeacherToolsPage } from './components/TeacherTools';
import { NewsSidePanel, NewsPage } from './components/NewsWindow';
import { LazyMount } from './components/LazyMount';
import { ErrorBoundary } from './components/ErrorBoundary';
import { retryImport } from './lib/lazyRetry';
import { Sparkles, ArrowUp } from 'lucide-react';
import { useMemberAuth } from './hooks/useMemberAuth';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { restoreSession } from './lib/firebaseAuth';
import { AUTH_PROMPT_EVENT, type AuthPromptRequest } from './lib/authPrompt';
import { currentRelativeUrl, parseAuthSearch, safeReturnUrl, stripAuthParams } from './lib/authLinks';
import type { AccountType } from './lib/userProfile';
import { supabase } from './lib/supabase';
import { TickerBanner } from './components/TickerBanner';
import { PendingTeacherGate } from './components/PendingTeacherGate';
import { isAwaitingTeacherVerification } from './lib/gameAccess';
import { SectionDirectory, PageBar, MoreInGroup } from './components/SectionDirectory';
import { AiFutureShowcase } from './components/AiFutureShowcase';
import { DIRECTORY_HASH, findPage, hashKey, isInPageAnchor, resolveRoute } from './lib/sitePages';
import { postIdFromSearch } from './lib/announcementMedia';

/**
 * The sections that used to be stacked on the one-page home. Each is now a
 * page of its own (see src/lib/sitePages.ts) and still (a) its own async
 * chunk — the code downloads only when its page is opened, and (b) memoized —
 * App-level state changes (Quick Drawer, modals) do not re-render it.
 * Paired with <LazyMount> in the JSX, which keeps the per-section error
 * boundary and the placeholder that carries the section's anchor id.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- `pick` projects each
 * module's export; memo() re-wraps it. (ComponentType<any> avoids React's
 * contravariance fight on the generic constraint; every call site passes
 * the same props the statically-imported components were type-checked with
 * before this refactor.)
 *
 * `load` must be the bare import() so retryImport can re-request the same
 * module after a failed download; the export is picked afterwards. */
function lazySection<M>(load: () => Promise<M>, pick: (module: M) => ComponentType<any>) {
  return lazy(() => retryImport(load).then((m) => ({ default: memo(pick(m)) })));
}
/* eslint-enable @typescript-eslint/no-explicit-any */
const AnnouncementBoard = lazySection(() => import('./components/AnnouncementBoard'), (m) => m.AnnouncementBoard);
const BlogSection = lazySection(() => import('./components/BlogSection'), (m) => m.default);
const DailyAssessmentCard = lazySection(() => import('./components/DailyAssessmentCard'), (m) => m.DailyAssessmentCard);
const TOEFLiBTCard = lazySection(() => import('./components/TOEFLiBTCard'), (m) => m.TOEFLiBTCard);
const LMSCard = lazySection(() => import('./components/LMSCard'), (m) => m.LMSCard);
const BiWeekPlannerCard = lazySection(() => import('./components/BiWeekPlannerCard'), (m) => m.BiWeekPlannerCard);
const SocialProof = lazySection(() => import('./components/SocialProof'), (m) => m.SocialProof);
const KidGradeHub = lazySection(() => import('./components/KidGradeHub'), (m) => m.KidGradeHub);
const GEPISecHub = lazySection(() => import('./components/GEPISecHub'), (m) => m.GEPISecHub);
const InteractiveShowcase = lazySection(() => import('./components/InteractiveShowcase'), (m) => m.InteractiveShowcase);
const FeaturesBento = lazySection(() => import('./components/FeaturesBento'), (m) => m.FeaturesBento);
const ToeflJuniorAssessments = lazySection(() => import('./components/ToeflJuniorAssessments'), (m) => m.ToeflJuniorAssessments);
const ResourceLibrary = lazySection(() => import('./components/ResourceLibrary'), (m) => m.ResourceLibrary);
const RoiCalculator = lazySection(() => import('./components/RoiCalculator'), (m) => m.RoiCalculator);
const ComparisonTable = lazySection(() => import('./components/ComparisonTable'), (m) => m.ComparisonTable);
const Testimonials = lazySection(() => import('./components/Testimonials'), (m) => m.Testimonials);
const Pricing = lazySection(() => import('./components/Pricing'), (m) => m.Pricing);
const FaqSection = lazySection(() => import('./components/FaqSection'), (m) => m.FaqSection);
const CtaSection = lazySection(() => import('./components/CtaSection'), (m) => m.CtaSection);

// Lazy-load heavy modals and the games route into separate chunks so they
// don't bloat the initial landing-page download. They load on demand.
// Every chunk import is retried (retryImport) and rendered under its own
// <Suspense> + <ErrorBoundary>, so a slow or failed download can neither
// hold up the first paint nor blank the page.
const TeacherPassModal = lazy(() => retryImport(() => import('./components/TeacherPassModal')).then(m => ({ default: m.TeacherPassModal })));
const StudentDemoModal = lazy(() => retryImport(() => import('./components/StudentDemoModal')).then(m => ({ default: m.StudentDemoModal })));
const BookshelfComingSoonModal = lazy(() =>
  retryImport(() => import('./components/BookshelfComingSoonModal')).then(m => ({
    default: m.BookshelfComingSoonModal,
  })),
);
const MiniMockTest = lazy(() => retryImport(() => import('./components/MiniMockTest')).then(m => ({ default: memo(m.MiniMockTest) })));
const LibraryPage = lazy(() => retryImport(() => import('./components/LibraryPage')).then(m => ({ default: m.LibraryPage })));
const LearningGamesPage = lazy(() => retryImport(() => import('./components/LearningGamesPage')).then(m => ({ default: m.LearningGamesPage })));
const BrainLoungePage = lazy(() => retryImport(() => import('./components/BrainLoungePage')).then(m => ({ default: m.BrainLoungePage })));
const FirebaseDashboard = lazy(() => retryImport(() => import('./components/FirebaseDashboard')).then(m => ({ default: memo(m.FirebaseDashboard) })));
const AdminUsersPanel = lazy(() => retryImport(() => import('./components/AdminUsersPanel')).then(m => ({ default: memo(m.AdminUsersPanel) })));

const HOME_TITLE = typeof document !== 'undefined' ? document.title : '';

interface NavState {
  /** 'home' or the id of a page in SITE_PAGES. */
  route: string;
  /** The hash that produced it — also names an anchor to scroll to. */
  hash: string;
  /** Counts navigations, so the scroll effect runs on every one. */
  tick: number;
}

export function App() {
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [teacherPassModalOpen, setTeacherPassModalOpen] = useState(false);
  const [studentDemoModalOpen, setStudentDemoModalOpen] = useState(false);
  /** Which bookshelf shelf the hero asked about; null = panel closed. */
  const [bookshelfShelf, setBookshelfShelf] = useState<'pdf' | 'interactive' | null>(null);
  const [authInitialMode, setAuthInitialMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const [authAccountType, setAuthAccountType] = useState<AccountType | null>(null);
  const [authContext, setAuthContext] = useState<string | null>(null);
  const [authReturnUrl, setAuthReturnUrl] = useState<string | null>(null);
  const memberAuth = useMemberAuth();
  // Firebase REST session — used as a fallback for the MiniMockTest
  // access gate when Supabase member-auth is not configured (which is the
  // case for this deployment). Without this, a Firebase-signed-in user
  // sees the misleading "Secure membership is not configured" gate even
  // though they're fully authenticated.
  const firebaseAuth = useFirebaseAuth();

  // Which page is open. The hash is the address: `/#pricing` is the Pricing
  // page, `/#games` the Play Lab, no hash (or #top / #sections) the home page.
  const [nav, setNav] = useState<NavState>(() => {
    let hash = typeof window !== 'undefined' ? window.location.hash : '';
    // A shared announcement (`?post=<id>`) opens the Announcements page even
    // when the site that carried the link dropped the `#announcements` part.
    if (!hash && typeof window !== 'undefined' && postIdFromSearch(window.location.search)) {
      hash = '#announcements';
      try { window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`); } catch { /* the page still opens */ }
    }
    return { route: resolveRoute(hash), hash, tick: 0 };
  });
  const route = nav.route;
  const page = route === 'home' ? undefined : findPage(route);

  const openMemberAuth = useCallback((mode: 'sign-up' | 'sign-in' = 'sign-up') => {
    setAuthInitialMode(mode);
    setAuthAccountType(null);
    setAuthContext(null);
    setAuthReturnUrl(null);
    setTeacherPassModalOpen(true);
  }, []);

  const handleMemberSignOut = useCallback(() => {
    void supabase?.auth.signOut();
  }, []);

  /** Open a page by its id — the hashchange listener below does the rest. */
  const openPage = useCallback((id: string) => {
    window.location.hash = id;
  }, []);

  const openGamesPage = useCallback(() => openPage('games'), [openPage]);
  const openTeacherToolsPage = useCallback(() => openPage('teacher-tools'), [openPage]);
  const openNewsPage = useCallback(() => openPage('news'), [openPage]);

  // "Back" on a page with its own header: return to the cards on the home
  // page — that is where the visitor chose the page.
  const returnHome = useCallback(() => openPage(DIRECTORY_HASH), [openPage]);

  const handleQuickLinkSelect = useCallback((toolId: string) => {
    if (toolId === 'learning-games') {
      openPage('games');
    } else if (toolId === 'daily-assessment') {
      openPage('daily-assessment');
    } else if (toolId === 'kid-grades' || toolId === 'kid-program') {
      openPage('kid-grades');
    } else if (toolId === 'toefl-assessments') {
      openPage('toefl-junior-assessments');
    } else if (toolId === 'toefl-suite') {
      openPage('toefl-mini-test');
    } else if (toolId === 'toefl-ibt-mock') {
      // The Quick Link declares path '#toefl-ibt-mock' — the full mock-test
      // page, not the generic features page.
      openPage('toefl-ibt-mock');
    } else if (toolId === 'toefl-itp-planner') {
      // Declared path './biweek-planner/' — open the standalone planner hub.
      window.location.assign('./biweek-planner/');
    } else if (toolId === 'worksheet-uploads' || toolId === 'prefix-suffix' || toolId === 'pre-kid' || toolId === 'chinese-language') {
      // Declared path '#resources': printable handouts + the morphology
      // assignment with its teacher key live in the Resource Library vault.
      openPage('resources');
    } else if (toolId === 'auto-grading' || toolId === 'worksheets') {
      openPage('interactive-demo');
    } else if (toolId === 'gep-program' || toolId === 'isec-program') {
      openPage('gep-isec');
    } else if (toolId === 'teacher-tools') {
      openPage('teacher-tools');
    } else if (toolId === 'cm-studio') {
      window.location.assign('./studio/');
    } else if (toolId === 'lms-workspace') {
      openPage('lms-workspace');
    } else if (toolId === 'cambodia-news') {
      openPage('news');
    } else if (toolId === 'brain-lounge') {
      openPage('brain-lounge');
    } else {
      openPage('features');
    }
  }, [openPage]);

  const handleHeroFeatureSelect = useCallback((feature: string) => {
    if (feature === 'auto-grading' || feature === 'prefix-suffix' || feature === 'analytics') {
      openPage('interactive-demo');
    } else if (feature === 'resources') {
      openPage('resources');
    } else if (feature === 'kid-grades') {
      openPage('kid-grades');
    } else if (feature === 'toefl-ibt-mock') {
      // Quick-launch card promises the full mock test — it has its own page.
      openPage('toefl-ibt-mock');
    } else if (feature === 'games') {
      // Quick-launch card promises the games — open the Play Lab page.
      openPage('games');
    } else {
      openPage('features');
    }
  }, [openPage]);

  // An anchor inside a page (`#privacy-notice`) does not say which page it
  // belongs to, so the page is written into that history entry: going Back
  // to it later, from anywhere, shows the page it was opened on.
  const routeRef = useRef(route);
  useEffect(() => {
    const syncRoute = () => {
      const hash = window.location.hash;
      let base = routeRef.current;
      if (isInPageAnchor(hash)) {
        const remembered: unknown = window.history.state?.cmcPage;
        if (typeof remembered === 'string' && (remembered === 'home' || findPage(remembered))) {
          base = remembered;
        } else {
          try {
            window.history.replaceState({ ...(window.history.state ?? {}), cmcPage: base }, '');
          } catch {
            /* history unavailable — the anchor still works */
          }
        }
      }
      const next = resolveRoute(hash, base);
      routeRef.current = next;
      setNav((prev) => ({ route: next, hash, tick: prev.tick + 1 }));
    };
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  // Where the window sits after a navigation. Every page opens at its top
  // (main.tsx turns the browser's own scroll restoration off); `#sections`
  // shows the home page at its cards; any other hash that is not a page is an
  // anchor inside the page already open (`#privacy-notice` in the footer).
  // behavior 'instant': the stylesheet sets scroll-behavior: smooth, and a
  // page change must not glide down from wherever the last page was left.
  useLayoutEffect(() => {
    const key = hashKey(nav.hash);
    const anchor = key === DIRECTORY_HASH || isInPageAnchor(nav.hash) ? document.getElementById(key) : null;
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [nav.tick, nav.hash]);

  // The tab title names the page that is open.
  useEffect(() => {
    document.title = page ? `${page.title} · CMC Network Hub` : HOME_TITLE;
  }, [page]);

  // Deep-link support for every locked surface: `?auth=signup|signin|student|
  // teacher|user` opens the account dialog in the right mode, and a validated
  // relative `next=` target is remembered so the visitor lands where they were
  // headed (a hash route inside the SPA, or a static page path). The params are
  // stripped after handling so a refresh does not re-pop the dialog. Visitors
  // who are ALREADY signed in skip straight to the target.
  useEffect(() => {
    try {
      const request = parseAuthSearch(window.location.search);
      const cleaned = stripAuthParams(window.location.search);
      if (cleaned !== window.location.search.replace(/^\?/, '')) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + (cleaned ? `?${cleaned}` : '') + window.location.hash,
        );
      }
      if (!request.mode && !request.returnUrl) return;

      const existing = restoreSession();
      if (existing?.emailVerified) {
        // Already signed in — honour the destination and never re-open auth.
        if (request.returnUrl?.startsWith('#')) window.location.hash = request.returnUrl.slice(1);
        else if (request.returnUrl) window.location.assign(request.returnUrl);
        return;
      }
      if (request.accountType === 'teacher') {
        // Teacher links only make sense on the teacher sign-in screen.
        setAuthInitialMode('sign-in');
      } else if (request.mode) {
        setAuthInitialMode(request.mode);
      }
      setAuthAccountType(request.accountType ?? null);
      setAuthContext(request.contextPrompt ?? null);
      setAuthReturnUrl(safeReturnUrl(request.returnUrl));
      setTeacherPassModalOpen(true);
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMemberAuth]);

  // Global "open the account dialog" channel — locked cards, download buttons
  // and games call requestAuth()/requestSignUp() instead of prop-drilling a
  // callback through every component.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AuthPromptRequest>).detail ?? {};
      setAuthInitialMode(detail.mode ?? 'sign-up');
      setAuthAccountType(detail.accountType ?? null);
      setAuthContext(detail.contextPrompt ?? null);
      setAuthReturnUrl(safeReturnUrl(detail.returnUrl) ?? currentRelativeUrl());
      setTeacherPassModalOpen(true);
    };
    window.addEventListener(AUTH_PROMPT_EVENT, handler as EventListener);
    return () => window.removeEventListener(AUTH_PROMPT_EVENT, handler as EventListener);
  }, []);

  // The teacher sign-in / sign-up modal is rendered on EVERY route. It used
  // to live only in the landing-page tree, so "Sign in as teacher" on the
  // locked #teacher-tools page set the open flag with nothing mounted to
  // show it (the dialog then popped up later, back on the homepage).
  // Own Suspense: the modal chunk never suspends the page around it.
  const authModal = (
    <ErrorBoundary variant="silent" label="teacher-pass-modal">
      <Suspense fallback={null}>
        <TeacherPassModal
          isOpen={teacherPassModalOpen}
          onClose={() => setTeacherPassModalOpen(false)}
          initialMode={authInitialMode}
          initialAccountType={authAccountType}
          contextPrompt={authContext}
          returnUrl={authReturnUrl}
        />
      </Suspense>
    </ErrorBoundary>
  );

  // ── Pages that bring their own header ──────────────────────────────
  if (route === 'games') return (
    <>
      <Suspense fallback={null}>
        <LearningGamesPage onBackHome={returnHome} />
      </Suspense>
      {authModal}
    </>
  );

  // The Reading room: books read on the site (list in public/library/catalog.json).
  if (route === 'library') return (
    <>
      <Suspense fallback={null}>
        <LibraryPage onBackHome={returnHome} />
      </Suspense>
      {authModal}
    </>
  );

  if (route === 'teacher-tools') return (
    <>
      <Suspense fallback={null}>
        <TeacherToolsPage onBackHome={returnHome} onOpenAuth={() => openMemberAuth('sign-up')} />
      </Suspense>
      {authModal}
    </>
  );

  if (route === 'news') return (
    <>
      <Suspense fallback={null}>
        <NewsPage onBackHome={returnHome} />
      </Suspense>
      {authModal}
    </>
  );

  // The Brain Lounge — dedicated arcade page for CMC-built games
  // (cartridge registry in src/games/registry.ts). Reachable from the
  // navbar, Quick Links, its card, or directly via #brain-lounge.
  if (route === 'brain-lounge') return (
    <>
      <Suspense fallback={null}>
        <BrainLoungePage onBackHome={returnHome} />
      </Suspense>
      {authModal}
    </>
  );

  // ── Section pages: one former home section each ────────────────────
  // LazyMount keeps what it gave the long page: a per-section error
  // boundary, a placeholder of about the right height while the chunk
  // downloads, and the section's anchor id.
  const sectionBody = (id: string): ReactNode => {
    switch (id) {
      // Blog-style announcement board. Public to read. Only approved admins
      // (site owner + accounts approved in the board's "Approve admins"
      // panel, stored in site_config/admins) can publish/edit/pin/delete.
      // Under it, "From the Blog": one small Blogger-style badge linking to
      // creativemindscambodia.blogspot.com — the director's own writings.
      case 'announcements': return (
        <>
          <LazyMount id="announcements" minHeight={620}>
            <AnnouncementBoard />
          </LazyMount>
          <LazyMount id="blog" minHeight={96}>
            <BlogSection />
          </LazyMount>
        </>
      );
      // Link to the separate daily student record workspace
      case 'daily-assessment': return (
        <LazyMount id="daily-assessment" minHeight={480}>
          <DailyAssessmentCard onOpenAuth={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      // Full TOEFL iBT mock test card — opens 4-section practice exam
      case 'toefl-ibt-mock': return (
        <LazyMount id="toefl-ibt-mock" minHeight={460}>
          <TOEFLiBTCard />
        </LazyMount>
      );
      // Admin-only: every registered account + one-click teacher verification.
      // The panel itself renders the strict `isCmcAdmin()` check (a verified
      // teacher who opens the hash gets the "admin only" screen, never data).
      case 'users-admin': return (
        <LazyMount id="users-admin" minHeight={420}>
          <AdminUsersPanel />
        </LazyMount>
      );
      // Creative Minds Studio — teacher-only gated feature (requires signup)
      case 'lms-workspace': return (
        <LazyMount id="lms-workspace" minHeight={480}>
          <LMSCard onOpenAuth={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      // Firebase real-time dashboard — live class results + student score
      // tracking. Lazy chunk: the Firebase SDK and its live listeners start
      // only when this page is opened.
      case 'live-results': return (
        <LazyMount minHeight={240}>
          <FirebaseDashboard />
        </LazyMount>
      );
      // TOEFL ITP Bi-Weekly Planner card — opens 8-week study plan with 15
      // test pages. Teacher-account-only: the planner content is gated inside
      // the card (RoleGate); the standalone planner hub is gated by
      // public/biweek-planner/teacher-gate.js.
      case 'toefl-itp-planner': return (
        <LazyMount id="toefl-itp-planner" minHeight={560}>
          <BiWeekPlannerCard onOpenAuth={() => openMemberAuth('sign-in')} />
        </LazyMount>
      );
      // Available learning materials and skills
      case 'toolkit': return (
        <LazyMount id="toolkit" minHeight={520}>
          <SocialProof />
        </LazyMount>
      );
      // Kid Program grade 5-12 resource pathway; Kid 6, 7, 8 and 11 have live materials.
      case 'kid-grades': return (
        <LazyMount id="kid-grades" minHeight={640}>
          <KidGradeHub onOpenAuth={() => openMemberAuth('sign-in')} />
        </LazyMount>
      );
      // GEP & ISEC adult-level program resources (Bi-Weekly Planner + ISEC drills).
      case 'gep-isec': return (
        <LazyMount id="gep-isec" minHeight={640}>
          <GEPISecHub />
        </LazyMount>
      );
      // Live Interactive Sandbox: Auto-Grader, Worksheet Generator & Roster
      case 'interactive-demo': return (
        <LazyMount id="interactive-demo" minHeight={720}>
          <InteractiveShowcase />
        </LazyMount>
      );
      // Core Features Bento Grid
      case 'features': return (
        <LazyMount id="features" minHeight={640}>
          <FeaturesBento
            onExploreMockTest={() => openPage('toefl-mini-test')}
            onExploreJuniorAssessments={() => openPage('toefl-junior-assessments')}
            onExploreGames={openGamesPage}
            onExploreDailyAssessment={() => openPage('daily-assessment')}
            onExploreKidGrades={() => openPage('kid-grades')}
          />
        </LazyMount>
      );
      // Member-gated timed TOEFL-style mini mock
      case 'toefl-mini-test': return (
        <LazyMount id="toefl-mini-test" minHeight={560}>
          <MiniMockTest
            key={memberAuth.member?.userId ?? firebaseAuth.session?.localId ?? 'guest'}
            accessStatus={memberAuth.status}
            member={memberAuth.member}
            firebaseSession={firebaseAuth.session}
            onOpenAuth={openMemberAuth}
            onSignOut={handleMemberSignOut}
          />
        </LazyMount>
      );
      case 'toefl-junior-assessments': return (
        <LazyMount id="toefl-junior-assessments" minHeight={620}>
          <ToeflJuniorAssessments />
        </LazyMount>
      );
      // Teacher Resource Library & Download Vault
      case 'resources': return (
        <LazyMount id="resources" minHeight={560}>
          <ResourceLibrary />
        </LazyMount>
      );
      // Time Savings / ROI Calculator
      case 'roi-calc': return (
        <LazyMount id="roi-calc" minHeight={520}>
          <RoiCalculator onOpenTeacherPass={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      // Honest product status: what is live and what is planned
      case 'whats-live': return (
        <LazyMount id="whats-live" minHeight={560}>
          <ComparisonTable onOpenTeacherPass={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      // What educators can explore in the current build
      case 'practice-notes': return (
        <LazyMount id="practice-notes" minHeight={520}>
          <Testimonials />
        </LazyMount>
      );
      // Teacher & School Pricing
      case 'pricing': return (
        <LazyMount id="pricing" minHeight={560}>
          <Pricing onOpenTeacherPass={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      // Searchable FAQ
      case 'faq': return (
        <LazyMount id="faq" minHeight={560}>
          <FaqSection onOpenTeacherPass={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      // Teacher account call-to-action
      case 'get-started': return (
        <LazyMount id="get-started" minHeight={420}>
          <CtaSection onSuccess={() => openMemberAuth('sign-up')} />
        </LazyMount>
      );
      default: return null;
    }
  };

  const body = page ? sectionBody(page.id) : null;

  return (
    <div
      className="cmc-app min-h-screen bg-slate-950 text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-white"
      data-route={page && body ? page.id : 'home'}
    >
      {/* Thank-you overlay after an invited bi-weekly test submission (?thanks=1) */}
      <TestThanksOverlay />

      {/* Sticky Top Navbar */}
      <Navbar
        onOpenQuickLinks={() => setQuickDrawerOpen(true)}
        onOpenTeacherPass={() => openMemberAuth('sign-up')}
        onOpenStudentDemo={() => setStudentDemoModalOpen(true)}
      />

      {page && body ? (
        /* A section page: the strip that says where you are, the section,
           and the neighbouring pages. `key` remounts the body on every page
           change so one page's state never leaks into the next. */
        <main className="cmc-page flex-1" key={page.id}>
          <PageBar page={page} />
          <div className="cmc-page-body">{body}</div>
          <MoreInGroup page={page} />
        </main>
      ) : (
        /* The home page: the hero and one card per page — nothing else, so
           there is no long scroll to hunt through. */
        <main className="flex-1">
          {/* Hero Section with Quick Feature Cards + News side panel (lg+) */}
          <Hero
            onExploreTools={openTeacherToolsPage}
            onOpenStudentDemo={() => setStudentDemoModalOpen(true)}
            onOpenTeacherPass={() => openMemberAuth('sign-up')}
            onSelectFeatureCard={handleHeroFeatureSelect}
            onOpenPdfLibrary={() => openPage('library')}
            onOpenInteractiveBooks={() => setBookshelfShelf('interactive')}
            sidePanel={<NewsSidePanel onSeeAll={openNewsPage} />}
          />

          {/* One card per page, in groups. The News group is first and its
              Announcements card shows the newest posts, so news is still
              what a visitor sees first (owner request). */}
          <SectionDirectory />

          {/* Futuristic floating-3D holographic AI Roadmap showcase */}
          <AiFutureShowcase />
        </main>
      )}

      {/* Footer */}
      <Footer
        onOpenQuickLinks={() => setQuickDrawerOpen(true)}
        onOpenTeacherPass={() => openMemberAuth('sign-up')}
      />

      {/* Slide-out Quick Links Drawer (matching the user's screenshot) */}
      <QuickDrawer
        isOpen={quickDrawerOpen}
        onClose={() => setQuickDrawerOpen(false)}
        onSelectAction={handleQuickLinkSelect}
      />

      {/* Teacher Free Pass Modal — uses Firebase Authentication (Email/Password
          + Google), independent of the Supabase member-entitlement flow that
          gates the MiniMockTest. */}
      {authModal}

      {/* Live stats + Top Teachers ticker — fixed at the bottom of the
          viewport. Shown on the home page only. */}
      {!page && <TickerBanner onOpenTeacherPass={() => openMemberAuth('sign-up')} />}

      {/* Teacher accounts that are not verified yet (no school email and no
          admin approval) get no platform access — cover the site until then. */}
      {firebaseAuth.hydrated && isAwaitingTeacherVerification(firebaseAuth.session) && (
        <PendingTeacherGate onSignOut={firebaseAuth.signOut} />
      )}

      {/* Live Student Experience Demo Modal */}
      <ErrorBoundary variant="silent" label="student-demo-modal">
        <Suspense fallback={null}>
          <StudentDemoModal
            isOpen={studentDemoModalOpen}
            onClose={() => setStudentDemoModalOpen(false)}
            onOpenTeacherPass={() => openMemberAuth('sign-up')}
          />
        </Suspense>
      </ErrorBoundary>

      {/* Bookshelf shelves (PDF packs + interactive books) — both still being
          uploaded, so the hero asks here rather than linking nowhere. */}
      <ErrorBoundary variant="silent" label="bookshelf-modal">
        <Suspense fallback={null}>
          <BookshelfComingSoonModal kind={bookshelfShelf} onClose={() => setBookshelfShelf(null)} />
        </Suspense>
      </ErrorBoundary>

      {/* Floating Quick Action Dock — sits above the TickerBanner so
          neither overlaps the other, respecting iOS safe-area insets. */}
      <div className={`cmc-dock fixed right-4 sm:right-6 z-40 flex items-center gap-2 ${page ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-24'}`}>
        <button
          onClick={() => setQuickDrawerOpen(true)}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick Links</span>
        </button>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
export default App;
