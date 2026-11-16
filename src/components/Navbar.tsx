import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import {
  Menu, X, Sparkles,
  ExternalLink, ArrowRight,
  Compass, GraduationCap,
  User as UserIcon, LogOut, ChevronDown, ImagePlus,
} from 'lucide-react';
import { useSignedInSession } from '../hooks/useSignedInSession';
import { clearPersistedSession } from '../lib/firebaseAuth';
import { sessionAccountTitle, sessionBadgeLabel } from '../lib/userProfile';
import { requestAuth } from '../lib/authPrompt';
import { ThemeToggle } from './ThemeToggle';
import { SpinLogo } from './SpinLogo';
import { AvatarBadge } from './AvatarBadge';
import { useAvatar } from '../hooks/useAvatar';

// The profile-picture panel is opened rarely: keep it out of the first load.
const ProfilePhotoModal = lazy(() => import('./ProfilePhotoModal').then((m) => ({ default: m.ProfilePhotoModal })));

interface NavbarProps {
  onOpenQuickLinks: () => void;
  onOpenTeacherPass: () => void;
  onOpenStudentDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenQuickLinks,
  onOpenTeacherPass,
  onOpenStudentDemo
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  // User session — used to switch the "Join CMC" button to a "Hi, [name]"
  // pill + dropdown when the user is already signed in. Re-renders on
  // `cmc-auth-changed` events (fired by TeacherPassModal / useFirebaseAuth).
  const session = useSignedInSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Profile picture: a photo or a built-in avatar, chosen from the account menu.
  const [photoPanelOpen, setPhotoPanelOpen] = useState(false);
  const avatar = useAvatar(session?.localId, Boolean(session?.emailVerified));
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    // The page can open already scrolled (/#sections shows the cards), and
    // that scroll happens before this listener exists — read it once.
    const frame = window.requestAnimationFrame(handleScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close the user dropdown on outside click / Escape
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

  // First-name greeting — display name might be "First Last" or just an
  // email, so grab the first chunk to keep the pill compact.
  const firstName = session?.displayName
    ? session.displayName.split(' ')[0].split('@')[0]
    : session?.email
      ? session.email.split('@')[0]
      : '';
  const isTeacher = session?.role === 'teacher';
  const isAdmin = Boolean(session?.isAdmin);
  const badgeLabel = session
    ? sessionBadgeLabel({ localId: session.localId, role: session.role, accountType: session.accountType, teacherVerified: session.teacherVerified })
    : '';
  const accountTitle = session
    ? sessionAccountTitle({ localId: session.localId, role: session.role, accountType: session.accountType, teacherVerified: session.teacherVerified })
    : '';
  /** Amber for admin, emerald for verified teachers, cyan for everyone else,
   *  amber-outline for a teacher awaiting verification. */
  const badgeTone = isAdmin
    ? 'bg-amber-300/15 text-amber-200'
    : isTeacher
      ? 'bg-emerald-400/15 text-emerald-200'
      : session?.accountType === 'teacher'
        ? 'bg-amber-200/15 text-amber-100'
        : 'bg-cyan-400/15 text-cyan-200';
  const avatarTone = isAdmin
    ? 'bg-amber-300/20 text-amber-200'
    : isTeacher
      ? 'bg-emerald-400/20 text-emerald-200'
      : 'bg-cyan-400/20 text-cyan-200';

  const handleSignOut = () => {
    clearPersistedSession();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent('cmc-auth-changed'));
  };

  return (
    <>
      {/* Top Announcement Bar */}
      {bannerVisible && (
        <div data-keep-dark className="cmc-topbar bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium relative z-50 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase">
            <Sparkles className="w-3 h-3 text-cyan-200" /> New
          </span>
          <span className="hidden sm:inline">TOEFL iBT Full Mock Test is live.</span>
          <span className="sm:hidden">TOEFL iBT mock test live.</span>
          <a
            href="#toefl-ibt-mock"
            onClick={() => setBannerVisible(false)}
            className="underline font-semibold hover:text-cyan-100 transition inline-flex items-center gap-0.5 ml-1"
          >
            Try it now <ArrowRight className="w-3.5 h-3.5 inline" />
          </a>
          <button
            onClick={() => setBannerVisible(false)}
            aria-label="Close notification"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Sticky Navbar */}
      <header className={`cmc-nav sticky top-0 z-40 w-full transition-all duration-300 ${
        isScrolled 
          ? 'cmc-nav-scrolled bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 shadow-2xl shadow-cyan-950/20 py-3' 
          : 'bg-slate-950/50 backdrop-blur-sm border-b border-white/5 py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            
            {/* Left: Quick Links button + Logo */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={onOpenQuickLinks}
                className="group relative flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/60 hover:border-cyan-500/50 text-slate-200 hover:text-white transition shadow-sm hover:shadow-cyan-500/10 active:scale-95 cursor-pointer"
                title="Open Quick Navigation Menu"
              >
                <div className="flex flex-col gap-1 w-4">
                  <span className="h-0.5 w-4 bg-cyan-400 rounded-full transition group-hover:w-3"></span>
                  <span className="h-0.5 w-3 bg-indigo-400 rounded-full transition group-hover:w-4"></span>
                  <span className="h-0.5 w-4 bg-cyan-400 rounded-full"></span>
                </div>
                <span className="text-xs font-semibold tracking-wide uppercase text-slate-300 group-hover:text-cyan-300 hidden lg:inline">Menu</span>
              </button>

              {/* Official CMC logo — the spinning coin (teacher's 360° spin video) */}
              <a href="#top" aria-label="CMC Network home" className="flex items-center gap-2.5 group">
                <SpinLogo size={56} className="w-[56px] h-[56px]" />
                <div className="flex flex-col leading-none">
                  <span className="cmc-nav-wordmark hidden whitespace-nowrap font-bold text-base sm:inline sm:text-lg tracking-tight text-white group-hover:text-cyan-200 transition">
                    CMC Network Hub
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium hidden xl:inline">
                    Creative Minds Network
                  </span>
                </div>
              </a>
            </div>

            {/* Middle Nav Links - Desktop. Hard-capped at 4 primary links
                (see src/tests/navbarPrimary.test.ts): with the Menu button,
                brand, theme toggle, Demo and the user pill, anything more
                overlaps the logo at 1280px. Features + FAQ live in the
                footer/mobile menu; every other destination is in the
                Quick Links drawer. */}
            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 xl:flex" aria-label="Primary">
              <a href="#toefl-junior-assessments" className="cmc-nav-link">Assessments</a>
              <a href="#toefl-ibt-mock" className="cmc-nav-link" title="TOEFL iBT Full Mock Test">TOEFL iBT</a>
              <a href="#games" className="cmc-nav-link">Games</a>
              <a href="#brain-lounge" className="cmc-nav-link" title="The Brain Lounge · CMC arcade games">Brain Lounge</a>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Light/dark theme toggle — site-wide, choice persisted */}
              <ThemeToggle />

              {/* View Student Demo Button */}
              <button
                onClick={onOpenStudentDemo}
                className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 transition active:scale-95"
                title="View student experience demo"
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                <span className="hidden xl:inline">Demo</span>
              </button>

              {/* Primary CTA — switches between "Join CMC" (signed out)
                  and a "Hi, [name] · Role" pill + dropdown (signed in).
                  The pill is in the same spot as the Join CMC button so
                  the visual weight stays the same; users immediately see
                  they're logged in from any scroll position. */}
              {session ? (
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="inline-flex items-center gap-2 !min-h-0 !rounded-full !px-3 !py-2 !text-xs sm:!text-sm font-semibold transition active:scale-95 border border-cyan-300/30 bg-gradient-to-r from-cyan-300/10 to-emerald-300/10 text-cyan-100 hover:from-cyan-300/20 hover:to-emerald-300/20"
                    aria-label={`Signed in as ${session.email}. Click to open user menu.`}
                    aria-expanded={userMenuOpen}
                  >
                    <AvatarBadge avatar={avatar} initial={firstName} size={24} toneClass={avatarTone} />
                    <span className="hidden sm:inline max-w-[120px] truncate">
                      Hi, {firstName}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeTone}`} data-cmc-badge={badgeLabel}>
                      {badgeLabel}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {userMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl z-50"
                    >
                      <div className="px-3 py-2 border-b border-slate-700/60 mb-1">
                        <div className="flex items-center gap-2.5">
                          <AvatarBadge avatar={avatar} initial={firstName} size={36} toneClass={avatarTone} />
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold text-white truncate">{session.displayName || session.email}</span>
                            {session.email && session.email !== session.displayName && (
                              <p className="text-[10px] text-slate-500 truncate">{session.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeTone}`}>
                            {accountTitle}
                          </span>
                          {session.emailVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                              ✓ Verified
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setUserMenuOpen(false); setPhotoPanelOpen(true); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
                        data-testid="profile-photo-open"
                      >
                        <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {avatar ? 'Change profile picture' : 'Add a profile picture'}
                      </button>
                      <a
                        href="#toefl-mini-test"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Member practice room
                      </a>
                      {isTeacher && (
                        <a
                          href="#teacher-tools"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Teacher Tools (Dice, Wheel, Studio)
                        </a>
                      )}
                      {isAdmin && (
                        <a
                          href="#users-admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-300/10 hover:text-amber-100 transition"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Users &amp; Teacher Verification
                        </a>
                      )}
                      {session.needsAccountTypePrompt && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            requestAuth({ mode: 'sign-in', contextPrompt: 'Confirm whether you are a Student, Teacher, or General user.' });
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10 transition"
                        >
                          <UserIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          Confirm account type
                        </button>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-200 hover:bg-rose-300/10 hover:text-rose-100 transition"
                      >
                        <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => { onOpenTeacherPass(); requestAuth({ mode: 'sign-up' }); }}
                  className="cmc-btn-primary !min-h-0 !rounded-full !px-5 !py-2.5 !text-[0.68rem]"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign up free</span>
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
                aria-label="Toggle Mobile Menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl px-4 pt-4 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-2 pb-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenQuickLinks();
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-cyan-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Quick Links Hub
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenStudentDemo();
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-indigo-300"
              >
                <Compass className="w-3.5 h-3.5" />
                Student Demo
              </button>
            </div>

            <nav className="flex flex-col space-y-1 text-sm font-medium">
              <a 
                href="#features" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900 transition"
              >
                Platform Features
              </a>
              <a 
                href="#interactive-demo" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-cyan-300 hover:bg-cyan-950/30 transition flex items-center justify-between"
              >
                <span>Live Interactive Sandbox</span>
                <span className="text-[10px] bg-cyan-900/60 px-2 py-0.5 rounded text-cyan-300">Try Live</span>
              </a>
              <a
                href="#toefl-junior-assessments"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-cyan-200 transition hover:bg-cyan-950/30"
              >
                <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" aria-hidden="true" /> TOEFL Junior Assessments</span>
                <span className="rounded bg-cyan-900/60 px-2 py-0.5 text-[10px] text-cyan-200">15 sets</span>
              </a>
              <a href="#games" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-900"><span>Learning Games</span><span className="rounded bg-violet-900/50 px-2 py-0.5 text-[10px] text-violet-200">Play Lab</span></a>
              <a href="#brain-lounge" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-900"><span>The Brain Lounge · Arcade</span><span className="rounded bg-fuchsia-900/50 px-2 py-0.5 text-[10px] text-fuchsia-200">New</span></a>
              <a href="#teacher-tools" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-900"><span>Teacher Tools · Dice & Wheel</span><span className="rounded bg-cyan-900/50 px-2 py-0.5 text-[10px] text-cyan-200">Live</span></a>
              <a href="#daily-assessment" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-900"><span>Daily Student Assessment</span><span className="rounded bg-cyan-900/50 px-2 py-0.5 text-[10px] text-cyan-200">Records</span></a>
              <a href="#kid-grades" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-900"><span>Kid Program · Grades 5–12</span><span className="rounded bg-cyan-900/50 px-2 py-0.5 text-[10px] text-cyan-200">Kid 6 + 11</span></a>
              <a href="#gep-isec" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-200 transition hover:bg-slate-900"><span>GEP & ISEC Programs</span><span className="rounded bg-violet-900/50 px-2 py-0.5 text-[10px] text-violet-200">TOEFL + C2</span></a>
              <a 
                href="#resources" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900 transition"
              >
                Teacher Resource Library
              </a>
              <a 
                href="#roi-calc" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900 transition"
              >
                Time Savings Calculator
              </a>
              <a 
                href="#pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900 transition"
              >
                Pricing Plans
              </a>
              <a 
                href="#faq" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-900 transition"
              >
                FAQ & Support
              </a>
            </nav>

            <div className="pt-2 border-t border-slate-800">
              {session ? (
                <div className="space-y-2">
                  {/* Signed-in mobile card — shows name + email + role,
                      then quick links, then Sign out. Mirrors the desktop
                      dropdown menu's content. */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
                    <div className="flex items-center gap-2">
                      <AvatarBadge avatar={avatar} initial={firstName} size={36} toneClass={avatarTone} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{session.displayName || session.email}</p>
                        {session.email && session.email !== session.displayName && (
                          <p className="truncate text-[10px] text-slate-500">{session.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeTone}`}>
                        {accountTitle}
                      </span>
                      {session.emailVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); setPhotoPanelOpen(true); }}
                    className="flex w-full items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/80"
                    data-testid="profile-photo-open-mobile"
                  >
                    <ImagePlus className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                    {avatar ? 'Change profile picture' : 'Add a profile picture'}
                  </button>
                  <a
                    href="#toefl-mini-test"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/80"
                  >
                    <GraduationCap className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                    Member practice room
                  </a>
                  {isTeacher && (
                    <a
                      href="#teacher-tools"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/80"
                    >
                      <Sparkles className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                      Teacher Tools (Dice, Wheel, Studio)
                    </a>
                  )}
                  {isAdmin && (
                    <a
                      href="#users-admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/5 px-3 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/10"
                    >
                      <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Users &amp; Teacher Verification
                    </a>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/5 px-3 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/10"
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenTeacherPass();
                  }}
                  className="cmc-btn-primary w-full"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Create a free account
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {photoPanelOpen && session && (
        <Suspense fallback={null}>
          <ProfilePhotoModal
            uid={session.localId}
            name={session.displayName && !session.displayName.includes('@') ? session.displayName : firstName}
            current={avatar}
            toneClass={avatarTone}
            onClose={() => setPhotoPanelOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};
