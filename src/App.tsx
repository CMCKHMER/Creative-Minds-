import { Suspense, lazy, memo, useCallback, useEffect, useState, type ComponentType } from 'react';
import { Navbar } from './components/Navbar';
import { QuickDrawer } from './components/QuickDrawer';
import { Hero } from './components/Hero';
import { Footer } from './components/Footer';
import { TeacherToolsPage } from './components/TeacherTools';
import { NewsSidePanel, NewsPage } from './components/NewsWindow';
import { LazyMount } from './components/LazyMount';
import { Sparkles, ArrowUp } from 'lucide-react';
import { useMemberAuth } from './hooks/useMemberAuth';
import { useFirebaseAuth } from './hooks/useFirebaseAuth';
import { restoreSession } from './lib/firebaseAuth';
import { supabase } from './lib/supabase';
import { TickerBanner } from './components/TickerBanner';

/**
 * Below-the-fold homepage sections: each is (a) its own async chunk — the
 * code leaves the initial bundle and downloads only when the section
 * approaches the viewport, and (b) memoized — App-level state changes
 * (Quick Drawer, modals, hash routes) no longer re-render the whole page.
 * Paired with <LazyMount> in the JSX, which also defers every effect
 * (Firestore reads, image loads) until the section is near the viewport.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- the loader
 * projects each module's named export; memo() re-wraps it. (ComponentType<any>
 * avoids React's contravariance fight on the generic constraint; every call
 * site passes the same props the statically-imported components were
 * type-checked with before this refactor.) */
function lazySection(loader: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() => loader().then((m) => ({ default: memo(m.default) })));
}
const AnnouncementBoard = lazySection(() => import('./components/AnnouncementBoard').then(m => ({ default: m.AnnouncementBoard })));
const BlogSection = lazySection(() => import('./components/BlogSection'));
const DailyAssessmentCard = lazySection(() => import('./components/DailyAssessmentCard').then(m => ({ default: m.DailyAssessmentCard })));
const TOEFLiBTCard = lazySection(() => import('./components/TOEFLiBTCard').then(m => ({ default: m.TOEFLiBTCard })));
const LMSCard = lazySection(() => import('./components/LMSCard').then(m => ({ default: m.LMSCard })));
const BiWeekPlannerCard = lazySection(() => import('./components/BiWeekPlannerCard').then(m => ({ default: m.BiWeekPlannerCard })));
const SocialProof = lazySection(() => import('./components/SocialProof').then(m => ({ default: m.SocialProof })));
const KidGradeHub = lazySection(() => import('./components/KidGradeHub').then(m => ({ default: m.KidGradeHub })));
const GEPISecHub = lazySection(() => import('./components/GEPISecHub').then(m => ({ default: m.GEPISecHub })));
const InteractiveShowcase = lazySection(() => import('./components/InteractiveShowcase').then(m => ({ default: m.InteractiveShowcase })));
const FeaturesBento = lazySection(() => import('./components/FeaturesBento').then(m => ({ default: m.FeaturesBento })));
const ToeflJuniorAssessments = lazySection(() => import('./components/ToeflJuniorAssessments').then(m => ({ default: m.ToeflJuniorAssessments })));
const ResourceLibrary = lazySection(() => import('./components/ResourceLibrary').then(m => ({ default: m.ResourceLibrary })));
const RoiCalculator = lazySection(() => import('./components/RoiCalculator').then(m => ({ default: m.RoiCalculator })));
const ComparisonTable = lazySection(() => import('./components/ComparisonTable').then(m => ({ default: m.ComparisonTable })));
const Testimonials = lazySection(() => import('./components/Testimonials').then(m => ({ default: m.Testimonials })));
const Pricing = lazySection(() => import('./components/Pricing').then(m => ({ default: m.Pricing })));
const FaqSection = lazySection(() => import('./components/FaqSection').then(m => ({ default: m.FaqSection })));
const CtaSection = lazySection(() => import('./components/CtaSection').then(m => ({ default: m.CtaSection })));

// Lazy-load heavy modals and the games route into separate chunks so they
// don't bloat the initial landing-page download. They load on demand.
const TeacherPassModal = lazy(() => import('./components/TeacherPassModal').then(m => ({ default: m.TeacherPassModal })));
const StudentDemoModal = lazy(() => import('./components/StudentDemoModal').then(m => ({ default: m.StudentDemoModal })));
const MiniMockTest = lazy(() => import('./components/MiniMockTest').then(m => ({ default: memo(m.MiniMockTest) })));
const LearningGamesPage = lazy(() => import('./components/LearningGamesPage').then(m => ({ default: m.LearningGamesPage })));
const BrainLoungePage = lazy(() => import('./components/BrainLoungePage').then(m => ({ default: m.BrainLoungePage })));
const FirebaseDashboard = lazy(() => import('./components/FirebaseDashboard').then(m => ({ default: memo(m.FirebaseDashboard) })));

export function App() {
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [teacherPassModalOpen, setTeacherPassModalOpen] = useState(false);
  const [studentDemoModalOpen, setStudentDemoModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const memberAuth = useMemberAuth();
  // Firebase REST session — used as a fallback for the MiniMockTest
  // access gate when Supabase member-auth is not configured (which is the
  // case for this deployment). Without this, a Firebase-signed-in user
  // sees the misleading "Secure membership is not configured" gate even
  // though they're fully authenticated.
  const firebaseAuth = useFirebaseAuth();
  const [isGamesPage, setIsGamesPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#games');
  const [isTeacherToolsPage, setIsTeacherToolsPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#teacher-tools');
  const [isNewsPage, setIsNewsPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#news');
  const [isBrainLoungePage, setIsBrainLoungePage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#brain-lounge');

  const openMemberAuth = useCallback((mode: 'sign-up' | 'sign-in' = 'sign-up') => {
    setAuthInitialMode(mode);
    setTeacherPassModalOpen(true);
  }, []);

  const handleMemberSignOut = useCallback(() => {
    void supabase?.auth.signOut();
  }, []);

  const openGamesPage = useCallback(() => {
    window.location.hash = 'games';
  }, []);

  const openTeacherToolsPage = useCallback(() => {
    window.location.hash = 'teacher-tools';
  }, []);

  const openNewsPage = useCallback(() => {
    window.location.hash = 'news';
  }, []);

  const openBrainLoungePage = useCallback(() => {
    window.location.hash = 'brain-lounge';
  }, []);

  const returnHome = useCallback(() => {
    setIsGamesPage(false);
    setIsTeacherToolsPage(false);
    setIsNewsPage(false);
    setIsBrainLoungePage(false);
    window.location.hash = 'top';
  }, []);

  // Smooth scroll handler
  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleQuickLinkSelect = useCallback((toolId: string) => {
    if (toolId === 'learning-games') {
      openGamesPage();
    } else if (toolId === 'daily-assessment') {
      scrollToSection('daily-assessment');
    } else if (toolId === 'kid-grades') {
      scrollToSection('kid-grades');
    } else if (toolId === 'toefl-assessments') {
      scrollToSection('toefl-junior-assessments');
    } else if (toolId === 'toefl-suite') {
      scrollToSection('toefl-mini-test');
    } else if (toolId === 'worksheet-uploads') {
      scrollToSection('features');
    } else if (toolId === 'auto-grading' || toolId === 'worksheets' || toolId === 'prefix-suffix') {
      scrollToSection('interactive-demo');
    } else if (toolId === 'kid-program') {
      scrollToSection('kid-grades');
    } else if (toolId === 'gep-program' || toolId === 'isec-program') {
      scrollToSection('gep-isec');
    } else if (toolId === 'teacher-tools') {
      openTeacherToolsPage();
    } else if (toolId === 'cm-studio') {
      window.location.assign('./studio/');
    } else if (toolId === 'lms-workspace') {
      scrollToSection('lms-workspace');
    } else if (toolId === 'cambodia-news') {
      openNewsPage();
    } else if (toolId === 'brain-lounge') {
      openBrainLoungePage();
    } else if (toolId === 'pre-kid' || toolId === 'chinese-language') {
      scrollToSection('resources');
    } else {
      scrollToSection('features');
    }
  }, [openBrainLoungePage, openGamesPage, openNewsPage, openTeacherToolsPage, scrollToSection]);

  const handleHeroFeatureSelect = useCallback((feature: string) => {
    if (feature === 'auto-grading' || feature === 'prefix-suffix' || feature === 'analytics') {
      scrollToSection('interactive-demo');
    } else if (feature === 'resources') {
      scrollToSection('resources');
    } else if (feature === 'kid-grades') {
      scrollToSection('kid-grades');
    } else {
      scrollToSection('features');
    }
  }, [scrollToSection]);

  useEffect(() => {
    const syncRoute = () => {
      setIsGamesPage(window.location.hash === '#games');
      setIsTeacherToolsPage(window.location.hash === '#teacher-tools');
      setIsNewsPage(window.location.hash === '#news');
      setIsBrainLoungePage(window.location.hash === '#brain-lounge');
    };
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  // Deep-link support for the teacher-only planner hub: the locked screen
  // on public/biweek-planner/ (teacher-gate.js) sends unauthenticated
  // visitors here with ?auth=teacher so the teacher sign-in modal opens
  // immediately. The param is stripped after handling so a refresh doesn't
  // re-pop the modal, and already-signed-in teachers are skipped.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') !== 'teacher') return;
      params.delete('auth');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
      if (restoreSession()?.role === 'teacher') return;
      openMemberAuth('sign-in');
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMemberAuth]);

  if (isGamesPage) return (
    <Suspense fallback={null}>
      <LearningGamesPage onBackHome={returnHome} />
    </Suspense>
  );

  if (isTeacherToolsPage) return (
    <Suspense fallback={null}>
      <TeacherToolsPage onBackHome={returnHome} onOpenAuth={() => openMemberAuth('sign-up')} />
    </Suspense>
  );

  if (isNewsPage) return (
    <Suspense fallback={null}>
      <NewsPage onBackHome={returnHome} />
    </Suspense>
  );

  // The Brain Lounge — dedicated arcade page for CMC-built games
  // (cartridge registry in src/games/registry.ts). Reachable from the
  // navbar, Quick Links, or directly via #brain-lounge.
  if (isBrainLoungePage) return (
    <Suspense fallback={null}>
      <BrainLoungePage onBackHome={returnHome} />
    </Suspense>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative selection:bg-cyan-500 selection:text-white">
      {/* Sticky Top Navbar */}
      <Navbar
        onOpenQuickLinks={() => setQuickDrawerOpen(true)}
        onOpenTeacherPass={() => openMemberAuth('sign-up')}
        onOpenStudentDemo={() => setStudentDemoModalOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Hero Section with Quick Feature Cards + News side panel (lg+) */}
        <Hero
          onExploreTools={() => scrollToSection('features')}
          onOpenStudentDemo={() => setStudentDemoModalOpen(true)}
          onOpenTeacherPass={() => openMemberAuth('sign-up')}
          onSelectFeatureCard={handleHeroFeatureSelect}
          sidePanel={<NewsSidePanel onSeeAll={openNewsPage} />}
        />

        {/* Blog-style announcement board — FIRST content section on the
            homepage: news & info that visitors should see first, right under
            the hero. Public to read. Only approved admins (site owner +
            accounts approved in board's "Approve admins" panel, stored in
            site_config/admins) can publish/edit/pin/delete posts.
            LazyMount: mount + its Firestore read defer until it nears the
            viewport; the placeholder keeps the anchor id so links still work. */}
        <LazyMount id="announcements" minHeight={620}>
          <AnnouncementBoard />
        </LazyMount>

        {/* "From the Blog" — the personal stream: writings, music and videos
            mirrored from creativemindscambodia.blogspot.com. A scheduled
            Action (blog-sync.yml) regenerates ./blog/posts.json from the
            Blogger feed, same static pattern as the news headlines. The
            educational announcements stay on the board above; this section is
            the director's own thoughts & stories. Renders nothing if the
            feed file is missing, so the homepage never shows a dead panel. */}
        <LazyMount id="blog" minHeight={560}>
          <BlogSection />
        </LazyMount>

        {/* Main-hero themed link to the separate daily student record workspace */}
        <LazyMount id="daily-assessment" minHeight={480}>
          <DailyAssessmentCard onOpenAuth={() => openMemberAuth('sign-up')} />
        </LazyMount>

        {/* Full TOEFL iBT mock test card — opens 4-section practice exam */}
        <LazyMount id="toefl-ibt-mock" minHeight={460}>
          <TOEFLiBTCard />
        </LazyMount>

        {/* LMS Workspace — teacher-only gated feature (requires signup) */}
        <LazyMount id="lms-workspace" minHeight={480}>
          <LMSCard onOpenAuth={() => openMemberAuth('sign-up')} />
        </LazyMount>

        {/* Firebase real-time dashboard — live class results + student score tracking.
            Lazy chunk (Firebase SDK stays out of the initial load) AND now
            lazy-MOUNTED: the chunk download and its live listeners start only
            when the dashboard approaches the viewport. */}
        <LazyMount minHeight={240}>
          <FirebaseDashboard />
        </LazyMount>

        {/* TOEFL ITP Bi-Weekly Planner card — opens 8-week study plan with 15 test pages.
            Teacher-account-only: the planner content is gated inside the card
            (RoleGate); the standalone planner hub is gated
            by public/biweek-planner/teacher-gate.js. */}
        <LazyMount id="toefl-itp-planner" minHeight={560}>
          <BiWeekPlannerCard onOpenAuth={() => openMemberAuth('sign-in')} />
        </LazyMount>

        {/* Available learning materials and skills */}
        <LazyMount minHeight={520}>
          <SocialProof />
        </LazyMount>

        {/* Kid Program grade 5-12 resource pathway; Kid 6 + Kid 11 currently linked. */}
        <LazyMount id="kid-grades" minHeight={640}>
          <KidGradeHub />
        </LazyMount>

        {/* GEP & ISEC adult-level program resources (Bi-Weekly Planner + ISEC drills). */}
        <LazyMount id="gep-isec" minHeight={640}>
          <GEPISecHub />
        </LazyMount>

        {/* Teacher Tools: Dice, Wheel, and Studio — available at #teacher-tools
            (via Quick Drawer, navbar, or direct URL). Not shown inline on the
            homepage to keep it focused on content, not tools. */}

        {/* Live Interactive Sandbox: Auto-Grader, Worksheet Generator & Roster */}
        <LazyMount id="interactive-demo" minHeight={720}>
          <InteractiveShowcase />
        </LazyMount>

        {/* Core Features Bento Grid */}
        <LazyMount id="features" minHeight={640}>
          <FeaturesBento
            onExploreMockTest={() => scrollToSection('toefl-mini-test')}
            onExploreJuniorAssessments={() => scrollToSection('toefl-junior-assessments')}
            onExploreGames={openGamesPage}
            onExploreDailyAssessment={() => scrollToSection('daily-assessment')}
            onExploreKidGrades={() => scrollToSection('kid-grades')}
          />
        </LazyMount>

        {/* Member-gated timed TOEFL-style mini mock */}
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

        <LazyMount id="toefl-junior-assessments" minHeight={620}>
          <ToeflJuniorAssessments />
        </LazyMount>

        {/* Teacher Resource Library & Download Vault */}
        <LazyMount id="resources" minHeight={560}>
          <ResourceLibrary />
        </LazyMount>

        {/* Time Savings / ROI Calculator */}
        <LazyMount id="roi-calc" minHeight={520}>
          <RoiCalculator
            onOpenTeacherPass={() => openMemberAuth('sign-up')}
          />
        </LazyMount>

        {/* Traditional vs. CMC Comparison Matrix */}
        <LazyMount minHeight={560}>
          <ComparisonTable
            onOpenTeacherPass={() => openMemberAuth('sign-up')}
          />
        </LazyMount>

        {/* What educators can explore in the current build */}
        <LazyMount minHeight={520}>
          <Testimonials />
        </LazyMount>

        {/* Transparent Teacher & School Pricing */}
        <LazyMount id="pricing" minHeight={560}>
          <Pricing
            onOpenTeacherPass={() => openMemberAuth('sign-up')}
          />
        </LazyMount>

        {/* Searchable FAQ */}
        <LazyMount id="faq" minHeight={560}>
          <FaqSection
            onOpenTeacherPass={() => openMemberAuth('sign-up')}
          />
        </LazyMount>

        {/* High-Impact Final CTA */}
        <LazyMount minHeight={420}>
          <CtaSection
            onSuccess={() => openMemberAuth('sign-up')}
          />
        </LazyMount>
      </main>

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
          gates the MiniMockTest below. */}
      <TeacherPassModal
        isOpen={teacherPassModalOpen}
        onClose={() => setTeacherPassModalOpen(false)}
        initialMode={authInitialMode}
      />

      {/* Live stats + Top Teachers ticker — fixed at the bottom of the
          viewport. Shown on the homepage only (sub-pages render their own
          full-screen layout via early returns above). */}
      <TickerBanner onOpenTeacherPass={() => openMemberAuth('sign-up')} />

      {/* Live Student Experience Demo Modal */}
      <StudentDemoModal
        isOpen={studentDemoModalOpen}
        onClose={() => setStudentDemoModalOpen(false)}
        onOpenTeacherPass={() => openMemberAuth('sign-up')}
      />

      {/* Floating Quick Action Dock — sits above the TickerBanner so
          neither overlaps the other. */}
      <div className="fixed bottom-24 right-6 z-40 flex items-center gap-2">
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
