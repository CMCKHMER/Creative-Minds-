import React, { useState } from 'react';
import { X, Volume2, Sparkles, Trophy, ArrowRight, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface StudentDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTeacherPass: () => void;
}

export const StudentDemoModal: React.FC<StudentDemoModalProps> = ({
  isOpen,
  onClose,
  onOpenTeacherPass
}) => {
  const [q1Answer, setQ1Answer] = useState<string | null>(null);
  const [q2Answer, setQ2Answer] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const q1Correct = q1Answer === 'un-';
  const q2Correct = q2Answer === 'b';
  const demoScore = (q1Correct ? 10 : 0) + (q2Correct ? 15 : 0);

  if (!isOpen) return null;

  const handleSelectQ1 = (val: string) => {
    setQ1Answer(val);
  };

  const handleSelectQ2 = (val: string) => {
    setQ2Answer(val);
  };

  const handleFinishDemo = () => {
    setSubmitted(true);
    if (demoScore === 25) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });
      } catch {
        // Fallback
      }
    }
  };

  const handlePlayVoice = () => {
    setAudioNotice(null);
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setAudioPlaying(false);
      setAudioNotice('Audio playback is unavailable in this browser. You can still read the prompt below.');
      return;
    }

    window.speechSynthesis.cancel();
    setAudioPlaying(true);
    const utterance = new SpeechSynthesisUtterance("Listen carefully. The prefix 'un-' creates the opposite meaning of a base word, such as happy to unhappy.");
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  const resetQuiz = () => {
    setQ1Answer(null);
    setQ2Answer(null);
    setSubmitted(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl z-10 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              🎓
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                Interactive quiz preview
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Reading & word-parts challenge
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!submitted ? (
          <div className="space-y-6">
            
            {/* Audio Prompt Bar */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handlePlayVoice}
                  className={`p-2 rounded-xl text-white transition ${
                    audioPlaying ? 'bg-cyan-500 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                  title="Play synthesized browser audio"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <div className="text-xs">
                  <span className="font-semibold text-slate-200 block">Sample spoken prompt</span>
                  <span className="text-[10px] text-slate-400">Synthesized using your browser's English voice</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 font-bold">{audioPlaying ? 'Playing' : 'Audio prompt'}</span>
            </div>
            {audioNotice && <p role="status" className="-mt-4 text-xs text-amber-300">{audioNotice}</p>}

            {/* Question 1: Prefix */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Question 1 • Morphology</span>
                <span className="text-[10px] text-slate-500 font-medium">10 Points</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 font-medium">
                Which prefix means "not" or "opposite" when added to the word <span className="text-cyan-300 font-bold underline">happy</span>?
              </p>

              <div className="grid grid-cols-3 gap-2">
                {['un-', 're-', 'pre-'].map((prefix) => (
                  <button
                    key={prefix}
                    onClick={() => handleSelectQ1(prefix)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold font-mono transition cursor-pointer ${
                      q1Answer === prefix
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {prefix}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 2: TOEFL Reading Comprehension */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400">Question 2 • TOEFL Reading Inference</span>
                <span className="text-[10px] text-slate-500 font-medium">15 Points</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 italic">
                "Unlike ordinary plants that require sunlight for energy, tubeworms near deep-sea thermal vents host bacteria that synthesize nutrients from hydrogen sulfide."
              </div>
              <p className="text-xs sm:text-sm text-slate-200 font-medium">
                What allows tubeworms to thrive in complete darkness?
              </p>

              <div className="space-y-2">
                {[
                  { key: 'a', label: 'They absorb infrared light from magma.' },
                  { key: 'b', label: 'Symbiotic bacteria convert chemicals into food.' },
                  { key: 'c', label: 'They swim to the ocean surface every night.' }
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectQ2(opt.key)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                      q2Answer === opt.key
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                      {opt.key}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Local quiz preview · no account sync
              </span>

              <button
                onClick={handleFinishDemo}
                disabled={!q1Answer || !q2Answer}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-40 transition shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer"
              >
                <span>Submit Student Answers</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        ) : (
          /* Result Card */
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto">
              <Trophy className="w-8 h-8 text-amber-400" />
            </div>

            <div>
              <span className="text-xs uppercase font-bold text-cyan-300 tracking-wider">
                Quiz preview complete
              </span>
              <h4 className="text-3xl font-black text-white mt-1">
                Score: {demoScore} / 25 Points ({Math.round((demoScore / 25) * 100)}%)
              </h4>
              <p className="text-xs text-cyan-300 font-medium">
                {demoScore === 25 ? 'Both answers correct.' : demoScore > 0 ? 'One answer correct. Review the feedback below.' : 'Review both concepts and try again.'}
              </p>
            </div>

            {/* Local answer explanation; no roster or account is updated. */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase text-[11px]">
                <Sparkles className="w-4 h-4" />
                <span>Answer feedback:</span>
              </div>
              <p className="space-y-1 text-slate-300">
                <span className="block">{q1Correct ? '✓ Correct:' : '↻ Review:'} <strong>un-</strong> means “not” or “opposite”; happy becomes unhappy.</span>
                <span className="block">{q2Correct ? '✓ Correct:' : '↻ Review:'} symbiotic bacteria turn chemicals into food for tubeworms.</span>
                <span className="mt-2 block text-slate-500">Practice-only result. This preview does not save answers or connect to a gradebook.</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={resetQuiz}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Demo Again</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenTeacherPass();
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
              >
                <span>Create a teacher account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
