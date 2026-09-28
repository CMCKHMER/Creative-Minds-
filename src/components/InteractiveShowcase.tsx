import React, { useState } from 'react';
import { 
  Sparkles, FileText, CheckCircle2, 
  RotateCcw, Download, Printer, Copy, Check, 
  ChevronRight, Award, Flame, BrainCircuit,
  Sliders, ArrowRight
} from 'lucide-react';
import { INTERACTIVE_TOEFL_SAMPLES } from '../data/landingData';

export const InteractiveShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'grader' | 'generator' | 'roster'>('grader');

  // --- TAB 1: AUTO GRADER STATE ---
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [customAnswer, setCustomAnswer] = useState(INTERACTIVE_TOEFL_SAMPLES[0].studentSubmission);
  const [isGrading, setIsGrading] = useState(false);
  const [gradedResult, setGradedResult] = useState<typeof INTERACTIVE_TOEFL_SAMPLES[0]['aiScore'] | null>(
    INTERACTIVE_TOEFL_SAMPLES[0].aiScore
  );
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [approvedStatus, setApprovedStatus] = useState(false);

  const handleSelectSample = (idx: number) => {
    setSelectedSampleIndex(idx);
    setCustomAnswer(INTERACTIVE_TOEFL_SAMPLES[idx].studentSubmission);
    setGradedResult(INTERACTIVE_TOEFL_SAMPLES[idx].aiScore);
    setApprovedStatus(false);
  };

  const handleRunGrading = () => {
    setIsGrading(true);
    setApprovedStatus(false);
    setTimeout(() => {
      // Demonstrate state changes without presenting a heuristic as AI scoring.
      const wordCount = customAnswer.trim().split(/\s+/).length;
      setGradedResult({
        overall: 'Preview only',
        cefr: 'No score',
        grammar: 0,
        coherence: 0,
        vocabulary: 0,
        feedback: `Local interface example: the response contains ${wordCount} words. No AI model, official rubric, or validated scoring method is applied.`
      });
      setIsGrading(false);
    }, 700);
  };

  // --- TAB 2: WORKSHEET GENERATOR STATE ---
  const [genGrade, setGenGrade] = useState<'Pre-Kid' | 'Kid Program' | 'TOEFL Junior'>('Kid Program');
  const [genTopic, setGenTopic] = useState<'Prefix & Suffix' | 'Reading Comp' | 'Phonics Blends'>('Prefix & Suffix');
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleGenerateWorksheet = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 500);
  };

  const handleSimulatedDownload = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  // --- TAB 3: ROSTER STATE ---
  const [filterStruggling, setFilterStruggling] = useState(false);
  const [rosterStudents] = useState([
    { id: 1, name: 'Liam Chen', grade: '94%', toeflScore: 'B2+', status: 'Mastered', prefixSkill: '100%', struggling: false, lastActive: '12m ago' },
    { id: 2, name: 'Sophia Martinez', grade: '71%', toeflScore: 'A2', status: 'Needs Help', prefixSkill: '65%', struggling: true, lastActive: '1h ago' },
    { id: 3, name: 'Alex Rivera', grade: '88%', toeflScore: 'B1', status: 'On Track', prefixSkill: '85%', struggling: false, lastActive: '30m ago' },
    { id: 4, name: 'Mei Lin Zhou', grade: '98%', toeflScore: 'C1', status: 'Mastered', prefixSkill: '100%', struggling: false, lastActive: '5m ago' },
    { id: 5, name: 'Noah Johnson', grade: '64%', toeflScore: 'Pre-A1', status: 'Intervention', prefixSkill: '52%', struggling: true, lastActive: '2h ago' }
  ]);
  const [assignedIntervention, setAssignedIntervention] = useState<string | null>(null);

  const filteredRoster = filterStruggling 
    ? rosterStudents.filter(s => s.struggling)
    : rosterStudents;

  return (
    <section id="interactive-demo" className="cmc-section relative scroll-mt-24 overflow-hidden bg-slate-950 py-20 sm:py-24 lg:py-28">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-xs font-semibold text-cyan-400">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Interactive UI Preview</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            Explore the interface with sample data
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            These browser-only interactions demonstrate the layout. They do not call an AI service, create files, sync a roster, or save student work.
          </p>

          {/* Interactive Mode Tabs */}
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-full overflow-x-auto">
            <button
              onClick={() => setActiveTab('grader')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'grader'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Feedback example</span>
            </button>

            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'generator'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Worksheet preview</span>
            </button>

            <button
              onClick={() => setActiveTab('roster')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 ${
                activeTab === 'roster'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Roster sample</span>
            </button>
          </div>
        </div>

        {/* Tab 1: AI AUTO GRADER SIMULATOR */}
        {activeTab === 'grader' && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 animate-in fade-in duration-300">
            
            {/* Left Column: Input and Sample Selector */}
            <div className="lg:col-span-7 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between space-y-6">
              
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <h3 className="text-base font-bold text-white">Example response review</h3>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
                    {INTERACTIVE_TOEFL_SAMPLES[selectedSampleIndex].level}
                  </span>
                </div>

                {/* Sample selector buttons */}
                <div className="space-y-1.5 mb-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Choose an included example response:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {INTERACTIVE_TOEFL_SAMPLES.map((sample, idx) => (
                      <button
                        key={sample.id}
                        onClick={() => handleSelectSample(idx)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
                          selectedSampleIndex === idx
                            ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {sample.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Question */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 mb-4">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                    Practice prompt · original sample:
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 font-medium">
                    {INTERACTIVE_TOEFL_SAMPLES[selectedSampleIndex].question}
                  </p>
                </div>

                {/* Student Answer Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Editable example response · not submitted:
                    </label>
                    <span className="text-[11px] text-slate-500">
                      {customAnswer.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans transition resize-none"
                    placeholder="Type or paste any student sentence or essay..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => setCustomAnswer(INTERACTIVE_TOEFL_SAMPLES[selectedSampleIndex].studentSubmission)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset example</span>
                </button>

                <button
                  onClick={handleRunGrading}
                  disabled={isGrading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 font-bold text-xs sm:text-sm text-white shadow-lg shadow-cyan-500/20 flex items-center gap-2 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isGrading ? 'animate-spin' : ''}`} />
                  <span>{isGrading ? 'Preparing sample feedback…' : 'Show sample feedback'}</span>
                </button>
              </div>

            </div>

            {/* Right Column: sample interaction feedback */}
            <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-950/50 flex flex-col justify-between space-y-6">
              
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Illustrative sample</span>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      Example layout · no score generated
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-cyan-400">
                      {gradedResult?.overall}
                    </span>
                    <span className="block text-[10px] text-emerald-400 font-semibold uppercase">
                      {gradedResult?.cefr}
                    </span>
                  </div>
                </div>

                <div className="mb-6 rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <span className="text-[9px] font-bold tracking-[0.14em] text-slate-500 uppercase">Example review areas · not measured</span>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-300"><span className="rounded-md border border-white/8 px-2 py-1">Sentence clarity</span><span className="rounded-md border border-white/8 px-2 py-1">Organization</span><span className="rounded-md border border-white/8 px-2 py-1">Word choice</span></div>
                </div>

                {/* Static example feedback; this sandbox does not call an AI service. */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                      Example teacher-style commentary:
                    </span>
                    <button
                      onClick={() => {
                        if (gradedResult) {
                          navigator.clipboard?.writeText(gradedResult.feedback);
                          setCopiedFeedback(true);
                          setTimeout(() => setCopiedFeedback(false), 2000);
                        }
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      title="Copy comment to clipboard"
                    >
                      {copiedFeedback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedFeedback ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">
                    "{gradedResult?.feedback}"
                  </p>
                </div>
              </div>

              {/* Teacher Approval Action */}
              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Local preview state only</span>
                </div>

                <button
                  onClick={() => setApprovedStatus(true)}
                  className={`text-xs px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                    approvedStatus 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{approvedStatus ? 'Marked reviewed locally' : 'Mark sample reviewed'}</span>
                </button>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: static worksheet layout example */}
        {activeTab === 'generator' && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Controls */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Worksheet layout preview</h3>
                  <p className="text-xs text-slate-400">
                    Switch sample topics to preview a page layout. This example does not generate or download a custom worksheet.
                  </p>
                </div>

                {/* Grade Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2 uppercase tracking-wider">
                    1. Select Program / Grade Level:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Pre-Kid', 'Kid Program', 'TOEFL Junior'] as const).map((grade) => (
                      <button
                        key={grade}
                        onClick={() => {
                          setGenGrade(grade);
                          handleGenerateWorksheet();
                        }}
                        className={`text-xs py-2 px-2 rounded-xl border text-center font-semibold transition cursor-pointer ${
                          genGrade === grade
                            ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2 uppercase tracking-wider">
                    2. Select Skill / Focus Domain:
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {(['Prefix & Suffix', 'Reading Comp', 'Phonics Blends'] as const).map((topic) => (
                      <button
                        key={topic}
                        onClick={() => {
                          setGenTopic(topic);
                          handleGenerateWorksheet();
                        }}
                        className={`text-xs py-2.5 px-3 rounded-xl border text-left font-semibold flex items-center justify-between transition cursor-pointer ${
                          genTopic === topic
                            ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>{topic === 'Prefix & Suffix' ? 'Prefix & Suffix Morphology Lab' : topic === 'Reading Comp' ? 'TOEFL Academic Reading Passage' : 'Phonics CVC & Digraphs'}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Output Options */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Show Teacher Answer Key</span>
                    <button
                      onClick={() => setShowAnswerKey(!showAnswerKey)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showAnswerKey ? 'bg-cyan-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showAnswerKey ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Extra bilingual content</span>
                    <span className="text-slate-400 font-semibold text-[11px]">Not included in this preview</span>
                  </div>
                </div>

                {/* Download / Print CTA */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSimulatedDownload}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{downloadSuccess ? 'Preview only · no file saved' : 'Simulate export (no file)'}</span>
                  </button>

                  <button
                    onClick={handleSimulatedDownload}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                    title="File printing is not enabled in this preview"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Live Worksheet Preview */}
              <div className="lg:col-span-7">
                <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 sm:p-7 shadow-inner min-h-[420px] font-sans">
                  
                  {/* Top Sheet Header */}
                  <div className="border-b-2 border-dashed border-slate-800 pb-4 mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">Creative Minds Network</span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-[10px] text-slate-400 font-medium">Example layout · standards not verified</span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-white">
                        {genTopic === 'Prefix & Suffix' && 'Unit 4: Prefixes & Suffixes Discovery Lab'}
                        {genTopic === 'Reading Comp' && 'TOEFL Junior Reading: Ocean Biodiversity'}
                        {genTopic === 'Phonics Blends' && 'Pre-Kid Phonics: /sh/ and /ch/ Sound Masters'}
                      </h4>
                    </div>

                    <div className="text-right text-[11px] text-slate-400">
                      <div>Name: ____________________</div>
                      <div>Date: ____________ Score: ____</div>
                    </div>
                  </div>

                  {/* Worksheet Content Body */}
                  {isGenerating ? (
                    <div className="py-24 text-center space-y-2">
                      <Sparkles className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                      <p className="text-xs text-slate-400">Switching example layout…</p>
                    </div>
                  ) : genTopic === 'Prefix & Suffix' ? (
                    <div className="space-y-4 text-xs sm:text-sm">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide block mb-1">
                          Rule Box:
                        </span>
                        <p className="text-slate-300 text-xs">
                          • <span className="font-mono text-cyan-400 font-bold">un-</span> means "not" or "opposite" (happy → unhappy)
                          <br />
                          • <span className="font-mono text-cyan-400 font-bold">-able</span> means "capable of being" (break → breakable)
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <p className="font-bold text-slate-200">
                          Part A: Add the correct prefix or suffix to complete the sentences:
                        </p>
                        
                        <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/80">
                          <p className="text-slate-300">
                            1. It was very ________ (fair) that only three students were allowed outside during rain.
                          </p>
                          {showAnswerKey && (
                            <p className="text-xs text-emerald-400 font-mono font-semibold mt-1">
                              ✓ Answer Key: <span className="underline">unfair</span> (Root: fair + prefix un-)
                            </p>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/80">
                          <p className="text-slate-300">
                            2. This reusable bottle is 100% ________ (recycle) and safe for the environment.
                          </p>
                          {showAnswerKey && (
                            <p className="text-xs text-emerald-400 font-mono font-semibold mt-1">
                              ✓ Answer Key: <span className="underline">recyclable</span> (Root: recycle + suffix -able)
                            </p>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/80">
                          <p className="text-slate-300">
                            3. The teacher asked the class to ________ (write) their essays to fix spelling mistakes.
                          </p>
                          {showAnswerKey && (
                            <p className="text-xs text-emerald-400 font-mono font-semibold mt-1">
                              ✓ Answer Key: <span className="underline">rewrite</span> (Root: write + prefix re-)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : genTopic === 'Reading Comp' ? (
                    <div className="space-y-4 text-xs sm:text-sm">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                        <span className="font-bold text-cyan-400 block mb-1">Passage 1 (TOEFL Junior Level 3):</span>
                        "Coral reefs occupy less than 0.1% of the world ocean surface, yet they provide a home for at least 25% of all marine species. Scientists frequently refer to reefs as the 'rainforests of the sea' due to their astonishing biodiversity..."
                      </div>
                      
                      <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                        <p className="font-semibold text-slate-200">
                          Question 1: According to the passage, why are coral reefs compared to rainforests?
                        </p>
                        <p className="text-xs text-slate-400 pl-2">
                          (A) They both receive high amounts of rainfall.<br />
                          (B) They both support an immense diversity of organisms.<br />
                          (C) They are both located solely in tropical mountain areas.
                        </p>
                        {showAnswerKey && (
                          <p className="text-xs text-emerald-400 font-mono font-semibold mt-1">
                            ✓ Answer Key: <span className="underline">(B)</span> Supports 25% of all marine species despite small area.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs sm:text-sm">
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                        <span className="font-bold text-amber-400 block mb-1">Pre-Kid Auditory Focus:</span>
                        Circle the pictures that start with the <span className="font-mono text-cyan-400 font-bold">/sh/</span> sound like <span className="underline">ship</span>, and box words with <span className="font-mono text-indigo-400 font-bold">/ch/</span> like <span className="underline">chair</span>.
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                          <span className="text-xl block mb-1">🚢</span>
                          <span className="font-bold text-slate-200">[ s h _ _ ]</span>
                          {showAnswerKey && <span className="block text-emerald-400 text-[10px] mt-1">Answer: ship (/sh/)</span>}
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center">
                          <span className="text-xl block mb-1">🧀</span>
                          <span className="font-bold text-slate-200">[ c h _ _ _ _ ]</span>
                          {showAnswerKey && <span className="block text-emerald-400 text-[10px] mt-1">Answer: cheese (/ch/)</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Watermark badge */}
                  <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Static worksheet example • alignment not verified</span>
                    <span className="font-semibold text-slate-400">Page 1 of 1</span>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: fictional roster interface sample */}
        {activeTab === 'roster' && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden p-6 sm:p-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <span>Fictional roster preview</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                    5 sample rows
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Example interface only. These fictional rows are not connected to an account, assessment, or school roster.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFilterStruggling(!filterStruggling)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                    filterStruggling 
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Show Students Needing Attention ({rosterStudents.filter(s => s.struggling).length})</span>
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 font-semibold">Student Name</th>
                    <th className="py-3 px-4 font-semibold">Current Mastery</th>
                    <th className="py-3 px-4 font-semibold">TOEFL Level</th>
                    <th className="py-3 px-4 font-semibold">Prefix / Suffix Drill</th>
                    <th className="py-3 px-4 font-semibold">Diagnostic Flag</th>
                    <th className="py-3 px-4 font-semibold text-right">Instant Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRoster.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-950/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-bold text-[10px] text-white">
                            {student.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <span>{student.name}</span>
                            <span className="block text-[10px] text-slate-500 font-normal">{student.lastActive}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white">{student.grade}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-medium">
                          {student.toeflScore}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${student.struggling ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                              style={{ width: student.prefixSkill }}
                            />
                          </div>
                          <span className="text-slate-300 font-mono text-[11px]">{student.prefixSkill}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          student.struggling 
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/80' 
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {assignedIntervention === student.name ? (
                          <span className="text-emerald-400 font-semibold inline-flex items-center gap-1 text-[11px]">
                            <Check className="w-3.5 h-3.5" /> Drill Sent
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setAssignedIntervention(student.name);
                              setTimeout(() => setAssignedIntervention(null), 3000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 font-medium text-[11px] transition inline-flex items-center gap-1 active:scale-95"
                          >
                            <span>{student.struggling ? 'Preview support action' : 'Preview challenge'}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom summary info */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <span>Sample rows only · no school integration is configured</span>
              <span className="text-cyan-400 font-medium">No learner assessment data is stored</span>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
