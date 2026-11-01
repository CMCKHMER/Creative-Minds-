import { useEffect, useMemo, useRef, useState } from 'react';
import { Headphones, Pause, Play, RotateCcw, Volume2 } from 'lucide-react';
import {
  estimateDurationSeconds,
  formatClock,
  getEnglishVoices,
  isSpeechSupported,
  splitIntoSentences,
  stopSpeech,
} from '../utils/speech';
import { resolveListeningAudio, splitSpeechTurns } from '../utils/listeningAudio';

interface ListeningAudioPlayerProps {
  /** Full spoken transcript (kept out of the visible DOM until the learner opens it). */
  script: string;
  /** Short label, e.g. "Science Club update". */
  title?: string;
  /** Exam-style limit. Practice assignments pass no maxPlays (unlimited). */
  maxPlays?: number;
  /** Visual tone: cyan for assignments, violet for test room. */
  tone?: 'cyan' | 'violet';
  compact?: boolean;
}

type Mode = 'resolving' | 'file' | 'tts';

interface FlatLine {
  text: string;
  pitch: number;
  turnIndex: number;
}

export function ListeningAudioPlayer({
  script,
  title = 'Listening passage',
  maxPlays,
  tone = 'cyan',
  compact = false,
}: ListeningAudioPlayerProps) {
  const turns = useMemo(() => splitSpeechTurns(script), [script]);
  const [mode, setMode] = useState<Mode>('resolving');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [playsUsed, setPlaysUsed] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>('');
  const [rate, setRate] = useState(0.95);
  const [activeLine, setActiveLine] = useState(-1);
  const [status, setStatus] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const supported = isSpeechSupported();
  const limited = typeof maxPlays === 'number';
  const playsLeft = limited ? Math.max(0, (maxPlays as number) - playsUsed) : Infinity;
  const exhausted = limited && playsLeft <= 0 && !playing;
  const totalSecs = duration || estimateDurationSeconds(script, rate);

  // Flatten turns into speakable lines for the device-voice fallback.
  const flatLines = useMemo<FlatLine[]>(() => {
    const lines: FlatLine[] = [];
    turns.forEach((t, ti) => {
      const pitch = turns.length > 1 && ti % 2 === 1 ? 0.88 : 1.0;
      for (const s of splitIntoSentences(t.text)) lines.push({ text: s, pitch, turnIndex: ti });
    });
    return lines;
  }, [turns]);

  // Resolve bundled studio audio for this script (falls back to device voice).
  useEffect(() => {
    let alive = true;
    setMode('resolving');
    setStatus('');
    setAudioUrl('');
    setDuration(0);
    resolveListeningAudio(script).then((url) => {
      if (!alive) return;
      if (url) {
        setAudioUrl(url);
        setMode('file');
      } else {
        setMode('tts');
      }
    });
    return () => {
      alive = false;
    };
  }, [script]);

  // Stop any speech/audio when this player unmounts or the script changes.
  useEffect(() => () => stopSpeech(), []);
  useEffect(() => {
    stopSpeech();
    audioRef.current?.pause();
    setPlaying(false);
    setActiveLine(-1);
    setElapsed(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, [script]);

  // Load voices (Chrome loads them async) — only needed for the fallback path.
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = getEnglishVoices();
      setVoices(list);
      if (!voiceURI && list.length > 0) setVoiceURI(list[0].voiceURI || list[0].name);
    };
    load();
    try {
      window.speechSynthesis.onvoiceschanged = load;
    } catch {
      /* noop */
    }
    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {
        /* noop */
      }
    };
  }, [supported, voiceURI]);

  // Elapsed clock while playing (device-voice path has no real timeline).
  useEffect(() => {
    if (mode === 'file' || !playing) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      if (!playing) return;
    }
    const started = Date.now() - elapsed * 1000;
    timerRef.current = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 250);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mode]);

  const finishStatus = (used: number) => {
    setStatus(
      limited
        ? `Finished play ${used} of ${maxPlays}. ${maxPlays - used > 0 ? `${maxPlays - used} replay${maxPlays - used === 1 ? '' : 's'} left.` : 'No replays left — use the transcript to review.'}`
        : 'Finished. Replay as often as you like while you practise.',
    );
  };

  // ---- Studio audio path ----
  const playFile = () => {
    const el = audioRef.current;
    if (!el) return;
    if (exhausted) {
      setStatus('You have used all plays for this listening. Open the transcript to review, or move on.');
      return;
    }
    stopSpeech();
    el.currentTime = 0;
    el.playbackRate = rate;
    const used = playsUsed + 1;
    setPlaysUsed(used);
    setElapsed(0);
    setActiveLine(-1);
    setPlaying(true);
    setStatus('Playing the recorded narration for this passage.');
    el.play().catch(() => {
      setPlaying(false);
      setMode('tts');
      setStatus('The recording could not start — switching to the device voice. Press play again.');
    });
  };

  const onFileEnded = () => {
    setPlaying(false);
    setActiveLine(-1);
    finishStatus(playsUsed);
  };

  const onFileError = () => {
    if (mode === 'file') {
      setMode('tts');
      setPlaying(false);
      setStatus('Recording unavailable — using the device voice instead.');
    }
  };

  // ---- Device-voice fallback path ----
  const speak = () => {
    setStatus('');
    if (!supported) {
      setStatus('Audio is unavailable in this browser. Ask your teacher to read the script aloud, or open the transcript below.');
      return;
    }
    if (exhausted) {
      setStatus('You have used all plays for this listening. Open the transcript to review, or move on.');
      return;
    }
    stopSpeech();
    if (flatLines.length === 0) return;
    const chosen = voices.find((v) => (v.voiceURI || v.name) === voiceURI);
    activeRef.current = true;
    flatLines.forEach((line, i) => {
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      utterance.pitch = line.pitch;
      if (chosen) utterance.voice = chosen;
      utterance.onstart = () => setActiveLine(line.turnIndex);
      if (i === flatLines.length - 1) {
        utterance.onend = () => {
          activeRef.current = false;
          setPlaying(false);
          setActiveLine(-1);
          setElapsed(0);
          finishStatus(playsUsed + 1);
        };
        utterance.onerror = () => {
          activeRef.current = false;
          setPlaying(false);
          setActiveLine(-1);
          setStatus('The device voice could not play. Open the transcript to read the passage instead.');
        };
      }
      window.speechSynthesis.speak(utterance);
    });

    setPlaysUsed((n) => n + 1);
    setElapsed(0);
    setActiveLine(0);
    setPlaying(true);
    setStatus('Playing with your device’s English voice — this is synthesized practice audio, not a studio recording.');
  };

  const toggle = () => {
    if (playing) {
      stopSpeech();
      audioRef.current?.pause();
      activeRef.current = false;
      setPlaying(false);
      setActiveLine(-1);
      setStatus('Paused. Press play to hear the passage again from the start.');
      return;
    }
    if (mode === 'resolving') {
      setStatus('Preparing audio…');
      return;
    }
    if (mode === 'file') playFile();
    else speak();
  };

  const replay = () => {
    if (exhausted) {
      setStatus('No replays left for this listening. The transcript below stays available for review.');
      return;
    }
    if (mode === 'file') playFile();
    else speak();
  };

  const changeRate = (value: number) => {
    setRate(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  };

  const progress = mode === 'file' && duration > 0
    ? Math.min(1, elapsed / duration)
    : Math.min(1, elapsed / Math.max(1, totalSecs));
  const isCyan = tone === 'cyan';
  const isFile = mode === 'file';

  return (
    <div
      className={`overflow-hidden rounded-2xl border backdrop-blur-xl ${
        isCyan
          ? 'border-cyan-200/20 bg-gradient-to-br from-cyan-950/70 via-slate-950/80 to-slate-900/70'
          : 'border-violet-300/20 bg-gradient-to-br from-violet-950/60 via-slate-950/80 to-slate-900/70'
      }`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-9 w-9 place-items-center rounded-xl border ${
              isCyan ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-violet-300/25 bg-violet-300/10 text-violet-200'
            }`}
          >
            <Headphones className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold text-white">{title}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {isFile ? 'Recorded narration' : mode === 'resolving' ? 'Preparing audio…' : 'Device voice'} · ~{formatClock(totalSecs)} · {turns.length} speaker{turns.length === 1 ? '' : 's'}
              {limited ? ` · ${playsLeft} play${playsLeft === 1 ? '' : 's'} left` : ' · unlimited replays'}
            </p>
          </div>
        </div>
        {/* Waveform */}
        <div className="flex h-6 items-end gap-1" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                playing ? (isCyan ? 'bg-cyan-300' : 'bg-violet-300') : 'bg-white/15'
              } ${playing ? 'animate-pulse' : ''}`}
              style={{
                height: playing ? `${8 + ((i * 7) % 16)}px` : '5px',
                animationDelay: `${i * 90}ms`,
                opacity: playing ? 0.9 : 0.5,
              }}
            />
          ))}
        </div>
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
        <button
          type="button"
          onClick={toggle}
          disabled={exhausted || mode === 'resolving'}
          aria-pressed={playing}
          aria-label={playing ? 'Stop listening audio' : 'Play listening audio'}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isCyan
              ? 'bg-gradient-to-r from-cyan-300 to-teal-200 text-slate-950 shadow-[0_10px_30px_-14px_rgba(45,212,191,.8)] hover:-translate-y-0.5 focus-visible:outline-cyan-200'
              : 'bg-gradient-to-r from-violet-300 to-cyan-200 text-slate-950 shadow-[0_10px_30px_-14px_rgba(167,139,250,.8)] hover:-translate-y-0.5 focus-visible:outline-violet-200'
          }`}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
          {playing ? 'Stop' : playsUsed > 0 ? 'Replay passage' : 'Play passage'}
        </button>
        <button
          type="button"
          onClick={replay}
          disabled={exhausted || playing || mode === 'resolving'}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3.5 py-2.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {limited ? `Replay (${playsLeft} left)` : 'Replay'}
        </button>
        <span className="ml-auto font-mono text-[11px] text-slate-400 tabular-nums" aria-label={`About ${formatClock(totalSecs)} total`}>
          {formatClock(Math.min(elapsed, totalSecs))} / {formatClock(totalSecs)}
        </span>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3 sm:px-5" aria-hidden="true">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${isCyan ? 'bg-gradient-to-r from-cyan-300 to-teal-200' : 'bg-gradient-to-r from-violet-300 to-cyan-200'}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {/* Speed (+ voice for the device-voice fallback) */}
      <div className={`grid gap-2 px-4 pt-3 sm:px-5 ${isFile ? '' : 'sm:grid-cols-2'}`}>
        {!isFile && (
          <label className="block text-[10px] font-semibold text-slate-400">
            Voice
            <span className="relative mt-1.5 block">
              <Volume2 className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <select
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
                disabled={!supported || voices.length === 0}
                className="w-full appearance-none rounded-lg border border-white/10 bg-slate-950/70 py-2.5 pr-3 pl-9 text-[11px] text-slate-200 outline-none transition focus:border-cyan-300/50 disabled:opacity-50"
              >
                {voices.length === 0 && <option value="">System default voice</option>}
                {voices.map((v) => (
                  <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </span>
          </label>
        )}
        <div className="text-[10px] font-semibold text-slate-400">
          <span id="listening-speed-label">Speed</span>
          <div className="mt-1.5 flex gap-1" role="group" aria-labelledby="listening-speed-label">
            {[
              { label: '0.85×', value: 0.85 },
              { label: '0.95×', value: 0.95 },
              { label: '1.05×', value: 1.05 },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => changeRate(opt.value)}
                aria-pressed={Math.abs(rate - opt.value) < 0.001}
                className={`flex-1 rounded-lg border px-2 py-2 font-mono text-[11px] transition ${
                  Math.abs(rate - opt.value) < 0.001
                    ? isCyan
                      ? 'border-cyan-300/50 bg-cyan-300/10 text-cyan-100'
                      : 'border-violet-300/50 bg-violet-300/10 text-violet-100'
                    : 'border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live speaker line (device-voice path) */}
      {!isFile && playing && activeLine >= 0 && turns[activeLine] && (
        <p className="mx-4 mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-300 sm:mx-5" aria-live="polite">
          <span className={`font-bold ${isCyan ? 'text-cyan-200' : 'text-violet-200'}`}>Now playing{turns[activeLine].speaker ? ` — ${turns[activeLine].speaker}` : ''}: </span>
          {turns[activeLine].text}
        </p>
      )}

      <p role="status" aria-live="polite" className="min-h-4 px-4 pt-2 text-[10px] text-slate-400 sm:px-5">
        {status || 'Press play to hear the passage. For a real test feel, answer without opening the transcript.'}
      </p>

      {/* Transcript disclosure */}
      <div className="px-4 pb-4 sm:px-5">
        <details
          className="group rounded-xl border border-white/10 bg-white/[0.02]"
          onToggle={(e) => {
            // If the learner opens the transcript mid-play, keep audio but note it.
            if ((e.target as HTMLDetailsElement).open && playing) {
              setStatus('Transcript open — this is now a reading activity. Close it and replay for a true listening attempt.');
            }
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-[11px] font-semibold text-slate-300 hover:text-white [&::-webkit-details-marker]:hidden">
            <span>Show accessible transcript</span>
            <span className={`rounded-md px-2 py-0.5 text-[9px] ${isCyan ? 'bg-cyan-300/10 text-cyan-200' : 'bg-violet-300/10 text-violet-200'}`}>
              Practice aid
            </span>
          </summary>
          <div className="space-y-2 border-t border-white/10 p-3 font-serif text-xs leading-relaxed text-slate-300">
            {turns.map((t, i) => (
              <p key={i} className={i === activeLine ? (isCyan ? 'text-cyan-100' : 'text-violet-100') : undefined}>
                {t.speaker && <span className="font-bold">{t.speaker}: </span>}
                {t.text}
              </p>
            ))}
          </div>
        </details>
        {!compact && (
          <p className="pt-2 text-[9px] leading-relaxed text-slate-600">
            {isFile
              ? 'Recorded multi-voice narration for classroom practice — not an official TOEFL track.'
              : 'Synthesized on-device English voice for classroom practice — not a studio recording, not an official TOEFL track.'}
          </p>
        )}
      </div>

      {/* Hidden audio element for the recorded-narration path */}
      {isFile && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)}
          onEnded={onFileEnded}
          onError={onFileError}
          className="hidden"
        />
      )}
    </div>
  );
}
