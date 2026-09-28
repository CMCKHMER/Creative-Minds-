export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore – speech is best-effort
    }
  }
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  try {
    const voices = window.speechSynthesis.getVoices() ?? [];
    const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
    return (en.length > 0 ? en : voices).slice().sort((a, b) => {
      // Prefer high-quality / Google / natural voices first, then by name
      const score = (v: SpeechSynthesisVoice) =>
        (/google/i.test(v.name) ? 0 : 10) +
        (/natural|neural|premium|enhanced/i.test(v.name) ? 0 : 5) +
        (v.localService ? 1 : 0);
      return score(a) - score(b) || a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

/** Split transcript into speakable sentences while keeping speaker labels intact. */
export function splitIntoSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  // Split on sentence enders, but keep abbreviations like "9:10" and "U.S." together-ish.
  const parts = clean.match(/[^.!?]+[.!?]+["']?|\S[^.!?]*$/g) ?? [clean];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function estimateDurationSeconds(text: string, rate = 0.95): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wpm = 150 * rate;
  return Math.max(4, Math.round((words / wpm) * 60));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
