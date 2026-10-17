import { Suspense, lazy, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { QuickDrawer } from './components/QuickDrawer';
import { Hero } from './components/Hero';
import { SocialProof } from './components/SocialProof';
import { InteractiveShowcase } from './components/InteractiveShowcase';
import { FeaturesBento } from './components/FeaturesBento';
import { ResourceLibrary } from './components/ResourceLibrary';
import { RoiCalculator } from './components/RoiCalculator';
import { ComparisonTable } from './components/ComparisonTable';
import { Testimonials } from './components/Testimonials';
import { Pricing } from './components/Pricing';
import { FaqSection } from './components/FaqSection';
import { CtaSection } from './components/CtaSection';
import { Footer } from './components/Footer';
import { ToeflJuniorAssessments } from './components/ToeflJuniorAssessments';
import { DailyAssessmentCard } from './components/DailyAssessmentCard';
import { TOEFLiBTCard } from './components/TOEFLiBTCard';
import { BiWeekPlannerCard } from './components/BiWeekPlannerCard';
import { KidGradeHub } from './components/KidGradeHub';
import { GEPISecHub } from './components/GEPISecHub';
import { TeacherToolsPage } from './components/TeacherTools';
import { NewsSidePanel, NewsPage } from './components/NewsWindow';
import { LMSCard } from './components/LMSCard';
import { FirebaseDashboard } from './components/FirebaseDashboard';
import { Sparkles, ArrowUp } from 'lucide-react';
import { useMemberAuth } from './hooks/useMemberAuth';
import { supabase } from './lib/supabase';

// Lazy-load heavy modals and the games route into separate chunks so they
// don't bloat the initial landing-page download. They load on demand.
const TeacherPassModal = lazy(() => import('./components/TeacherPassModal').then(m => ({ default: m.TeacherPassModal })));
const StudentDemoModal = lazy(() => import('./components/StudentDemoModal').then(m => ({ default: m.StudentDemoModal })));
const MiniMockTest = lazy(() => import('./components/MiniMockTest').then(m => ({ default: m.MiniMockTest })));
const LearningGamesPage = lazy(() => import('./components/LearningGamesPage').then(m => ({ default: m.LearningGamesPage })));

export function App() {
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [teacherPassModalOpen, setTeacherPassModalOpen] = useState(false);
  const [studentDemoModalOpen, setStudentDemoModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const memberAuth = useMemberAuth();
  const [isGamesPage, setIsGamesPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#games');
  const [isTeacherToolsPage, setIsTeacherToolsPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#teacher-tools');
  const [isNewsPage, setIsNewsPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#news');

  useEffect(() => {
    const syncRoute = () => {
      setIsGamesPage(window.location.hash === '#games');
      setIsTeacherToolsPage(window.location.hash === '#teacher-tools');
      setIsNewsPage(window.location.hash === '#news');
    };
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  const openMemberAuth = (mode: 'sign-up' | 'sign-in' = 'sign-up') => {
    setAuthInitialMode(mode);
    setTeacherPassModalOpen(true);
  };

  const handleMemberSignOut = () => {
    void supabase?.auth.signOut();
  };

  const openGamesPage = () => {
    window.location.hash = 'games';
  };

  const openTeacherToolsPage = () => {
    window.location.hash = 'teacher-tools';
  };

  const openNewsPage = () => {
    window.location.hash = 'news';
  };

  const returnHome = () => {
    setIsGamesPage(false);
    setIsTeacherToolsPage(false);
    setIsNewsPage(false);
    window.location.hash = 'top';
  };

  // Smooth scroll handler
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleQuickLinkSelect = (toolId: string) => {
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
      window.open('./studio/', '_blank', 'noopener,noreferrer');
    } else if (toolId === 'lms-workspace') {
      scrollToSection('lms-workspace');
    } else if (toolId === 'cambodia-news') {
      openNewsPage();
    } else if (toolId === 'pre-kid' || toolId === 'chinese-language') {
      scrollToSection('resources');
    } else {
      scrollToSection('features');
    }
  };

  const handleHeroFeatureSelect = (feature: string) => {
    if (feature === 'auto-grading' || feature === 'prefix-suffix' || feature === 'analytics') {
      scrollToSection('interactive-demo');
    } else if (feature === 'resources') {
      scrollToSection('resources');
    } else if (feature === 'kid-grades') {
      scrollToSection('kid-grades');
    } else {
      scrollToSection('features');
    }
  };

    if (isGamesPage) return (
    <Suspense fallback={null}>
      <LearningGamesPage onBackHome={returnHome} />
    </Suspense>
  );

    if (isTeacherToolsPage) return (
    <Suspense fallback={null}>
      <TeacherToolsPage onBackHome={returnHome} />
    </Suspense>
  );

    if (isNewsPage) return (
    <Suspense fallback={null}>
      <NewsPage onBackHome={returnHome} />
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

        {/* Main-hero themed link to the separate daily student record workspace */}
        <DailyAssessmentCard />

        {/* Full TOEFL iBT mock test card — opens 4-section practice exam in a new tab */}
        <TOEFLiBTCard />

        {/* LMS Workspace — teacher-only gated feature (requires signup) */}
        <LMSCard onOpenAuth={() => openMemberAuth('sign-up')} />

        {/* Firebase real-time dashboard — live class results + student score tracking */}
        <FirebaseDashboard />

        {/* TOEFL ITP Bi-Weekly Planner card — opens 8-week study plan with 15 test pages */}
        <BiWeekPlannerCard />

        {/* Available learning materials and skills */}
        <SocialProof />

        {/* Kid Program grade 5-12 resource pathway; Kid 6 + Kid 11 currently linked. */}
        <KidGradeHub />

        {/* GEP & ISEC adult-level program resources (Bi-Weekly Planner + ISEC drills). */}
        <GEPISecHub />

        {/* Teacher Tools: Dice, Wheel, and Studio — available at #teacher-tools
            (via Quick Drawer, navbar, or direct URL). Not shown inline on the
            homepage to keep it focused on content, not tools. */}

        {/* Live Interactive Sandbox: Auto-Grader, Worksheet Generator & Roster */}
        <InteractiveShowcase />

        {/* Core Features Bento Grid */}
        <FeaturesBento
          onExploreMockTest={() => scrollToSection('toefl-mini-test')}
          onExploreJuniorAssessments={() => scrollToSection('toefl-junior-assessments')}
          onExploreGames={openGamesPage}
          onExploreDailyAssessment={() => scrollToSection('daily-assessment')}
          onExploreKidGrades={() => scrollToSection('kid-grades')}
        />

        {/* Member-gated timed TOEFL-style mini mock */}
        <MiniMockTest
          key={memberAuth.member?.userId ?? 'guest'}
          accessStatus={memberAuth.status}
          member={memberAuth.member}
          onOpenAuth={openMemberAuth}
          onSignOut={handleMemberSignOut}
        />

        <ToeflJuniorAssessments />

        {/* Teacher Resource Library & Download Vault */}
        <ResourceLibrary />

        {/* Time Savings / ROI Calculator */}
        <RoiCalculator
          onOpenTeacherPass={() => openMemberAuth('sign-up')}
        />

        {/* Traditional vs. CMC Comparison Matrix */}
        <ComparisonTable
          onOpenTeacherPass={() => openMemberAuth('sign-up')}
        />

        {/* What educators can explore in the current build */}
        <Testimonials />

        {/* Transparent Teacher & School Pricing */}
        <Pricing
          onOpenTeacherPass={() => openMemberAuth('sign-up')}
        />

        {/* Searchable FAQ */}
        <FaqSection
          onOpenTeacherPass={() => openMemberAuth('sign-up')}
        />

        {/* High-Impact Final CTA */}
        <CtaSection
          onSuccess={() => openMemberAuth('sign-up')}
        />
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

      {/* Teacher Free Pass Modal */}
      <TeacherPassModal
        isOpen={teacherPassModalOpen}
        onClose={() => setTeacherPassModalOpen(false)}
        accessStatus={memberAuth.status}
        member={memberAuth.member}
        initialMode={authInitialMode}
        onContinueToMockTest={() => {
          setTeacherPassModalOpen(false);
          window.requestAnimationFrame(() => scrollToSection('toefl-mini-test'));
        }}
      />

      {/* Live Student Experience Demo Modal */}
      <StudentDemoModal
        isOpen={studentDemoModalOpen}
        onClose={() => setStudentDemoModalOpen(false)}
        onOpenTeacherPass={() => openMemberAuth('sign-up')}
      />

      {/* Floating Quick Action Dock */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <button
          onClick={() => setQuickDrawerOpen(true)}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick Links</span>
        </button>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
export default App;
