import { useEffect, useState } from 'react';
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
import { TeacherPassModal } from './components/TeacherPassModal';
import { StudentDemoModal } from './components/StudentDemoModal';
import { MiniMockTest } from './components/MiniMockTest';
import { ToeflJuniorAssessments } from './components/ToeflJuniorAssessments';
import { LearningGamesPage } from './components/LearningGamesPage';
import { DailyAssessmentCard } from './components/DailyAssessmentCard';
import { KidGradeHub } from './components/KidGradeHub';
import { Sparkles, ArrowUp } from 'lucide-react';
import { useMemberAuth } from './hooks/useMemberAuth';
import { supabase } from './lib/supabase';

export function App() {
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [teacherPassModalOpen, setTeacherPassModalOpen] = useState(false);
  const [studentDemoModalOpen, setStudentDemoModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const memberAuth = useMemberAuth();
  const [isGamesPage, setIsGamesPage] = useState(() => typeof window !== 'undefined' && window.location.hash === '#games');

  useEffect(() => {
    const syncRoute = () => setIsGamesPage(window.location.hash === '#games');
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

  const returnHome = () => {
    setIsGamesPage(false);
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

  if (isGamesPage) return <LearningGamesPage onBackHome={returnHome} />;

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
        {/* Hero Section with Quick Feature Cards */}
        <Hero
          onExploreTools={() => scrollToSection('features')}
          onOpenStudentDemo={() => setStudentDemoModalOpen(true)}
          onOpenTeacherPass={() => openMemberAuth('sign-up')}
          onSelectFeatureCard={handleHeroFeatureSelect}
        />

        {/* Main-hero themed link to the separate daily student record workspace */}
        <DailyAssessmentCard />

        {/* Available learning materials and skills */}
        <SocialProof />

        {/* Kid Program grade 5-12 resource pathway; currently Kid 6 is linked. */}
        <KidGradeHub />

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
