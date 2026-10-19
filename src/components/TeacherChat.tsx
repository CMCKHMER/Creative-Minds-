import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, GraduationCap, LockKeyhole, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { FIREBASE_PROJECT_ID, restoreSession } from '../lib/firebaseAuth';
import { useSignedInSession } from '../hooks/useSignedInSession';

/**
 * Teacher-only chat stream for announcements + communication.
 *
 * - Teachers (signed in with .edu / .edu.kh email) can post messages.
 * - Students / signed-out users see a locked "Teacher access required" prompt.
 * - Messages are stored in Firestore collection `teacher_chat` with
 *   public read + teacher-only write (enforced by Firestore security rules).
 * - The chat auto-refreshes every 15 seconds to pick up new messages.
 * - Messages show: author name, role badge, timestamp, message text.
 * - Max 50 messages loaded (newest at bottom, auto-scroll to bottom on new).
 *
 * Firestore rule needed (add to your rules):
 *   match /teacher_chat/{msgId} {
 *     allow read: if true;  // anyone can read
 *     allow create: if request.auth != null
 *                   && request.auth.token.email.matches(".*@.*edu.*");
 *     allow update, delete: if false;
 *   }
 */

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

interface ChatMessage {
  id: string;
  authorName: string;
  authorEmail: string;
  isAnnouncement: boolean;
  text: string;
  timestamp: number;
}

const REFRESH_MS = 15_000;
const MAX_MESSAGES = 50;

async function fetchMessages(): Promise<ChatMessage[]> {
  const url = `${FIRESTORE_BASE}/teacher_chat?pageSize=${MAX_MESSAGES}&orderBy=timestamp%20desc`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!data.documents) return [];
  const messages: ChatMessage[] = data.documents.map((doc: any) => {
    const f = doc.fields || {};
    const ts = f.timestamp?.timestampValue;
    return {
      id: doc.name?.split('/').pop() || '',
      authorName: f.authorName?.stringValue || 'Unknown',
      authorEmail: f.authorEmail?.stringValue || '',
      isAnnouncement: f.isAnnouncement?.booleanValue || false,
      text: f.text?.stringValue || '',
      timestamp: ts ? Date.parse(ts) : 0,
    };
  });
  // Reverse so newest is at the bottom (chat order)
  return messages.reverse();
}

async function postMessage(
  idToken: string,
  text: string,
  authorName: string,
  authorEmail: string,
  isAnnouncement: boolean,
): Promise<void> {
  const body = {
    fields: {
      authorName: { stringValue: authorName },
      authorEmail: { stringValue: authorEmail },
      isAnnouncement: { booleanValue: isAnnouncement },
      text: { stringValue: text },
      timestamp: { timestampValue: new Date().toISOString() },
    },
  };
  const res = await fetch(`${FIRESTORE_BASE}/teacher_chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
}

function timeAgo(epochMs: number): string {
  if (!epochMs) return 'just now';
  const diff = Date.now() - epochMs;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(epochMs).toLocaleDateString();
}

function timeFull(epochMs: number): string {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TeacherChat({ onOpenAuth }: { onOpenAuth?: () => void }) {
  const session = useSignedInSession();
  const isTeacher = session?.role === 'teacher';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      setLoading(true);
      try {
        const result = await fetchMessages();
        if (cancelled) return;
        setMessages(result);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not load messages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const t = window.setTimeout(refresh, 500);
    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearInterval(interval);
    };
  }, []);

  // Auto-scroll to bottom when messages change — but ONLY if the user
  // is already viewing the chat (not on page load). This prevents the
  // page from jumping to the Teacher Chat section on refresh.
  useEffect(() => {
    if (messages.length === 0) return; // Don't scroll on empty
    const chatEl = document.getElementById('teacher-chat');
    if (!chatEl) return;
    const rect = chatEl.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (isVisible) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !isTeacher || !session) return;

    const idToken = localStorage.getItem('cmc-student-token');
    if (!idToken) return;

    setSending(true);
    try {
      await postMessage(
        idToken,
        text,
        session.displayName || session.email,
        session.email,
        isAnnouncement,
      );
      setInput('');
      setIsAnnouncement(false);
      // Refresh immediately to show the new message
      const result = await fetchMessages();
      setMessages(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <section id="teacher-chat" aria-labelledby="teacher-chat-title" className="cmc-section relative scroll-mt-24 border-y border-white/10 bg-[#081522] py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-[-13rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-cyan-500/[0.08] blur-[135px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-[-14rem] -z-10 h-[36rem] w-[36rem] rounded-full bg-indigo-500/[0.10] blur-[135px]" />

      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="mb-8">
          <span className="cmc-eyebrow">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> Teacher Channel
          </span>
          <h2 id="teacher-chat-title" className="cmc-h2 mt-4">
            Teacher chat &<br />
            <span className="cmc-gradient-text">announcements.</span>
          </h2>
          <p className="cmc-lead mt-4">
            A private space for verified Creative Minds teachers to communicate, share updates, and post announcements. Sign in with a work email ending in .edu or .edu.kh to join the conversation.
          </p>
        </div>

        {isTeacher ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 shadow-2xl backdrop-blur-xl">
            {/* Chat header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">Teacher Chat</p>
                  <p className="text-[10px] text-slate-500">
                    {loading ? 'Loading…' : `${messages.length} messages · auto-refresh 15s`}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>

            {/* Messages stream */}
            <div className="max-h-[400px] min-h-[200px] space-y-3 overflow-y-auto px-5 py-5">
              {error && !loading && messages.length === 0 && (
                <div className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-center text-xs text-rose-100">
                  {error}
                  <p className="mt-1 text-[10px] text-slate-500">
                    Make sure the Firestore rule for <code className="rounded bg-white/5 px-1 py-0.5">teacher_chat</code> allows public read.
                  </p>
                </div>
              )}
              {messages.length === 0 && !error && !loading && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Sparkles className="h-6 w-6 text-slate-600" aria-hidden="true" />
                  <p className="mt-3 text-sm text-slate-500">No messages yet — be the first to start the conversation!</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.isAnnouncement ? 'rounded-xl border border-amber-200/20 bg-amber-100/[0.04] p-3.5' : ''}`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${msg.isAnnouncement ? 'bg-amber-300/15 text-amber-200' : 'bg-cyan-300/10 text-cyan-200'}`}>
                    {msg.authorName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-white">{msg.authorName}</span>
                      {msg.isAnnouncement && (
                        <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                          Announcement
                        </span>
                      )}
                      <span className="text-[9px] text-slate-600" title={timeFull(msg.timestamp)}>
                        {timeAgo(msg.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-white/8 px-5 py-4">
              <form onSubmit={handleSubmit}>
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200">
                    <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="flex-1">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message to other teachers… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      maxLength={500}
                      className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
                      disabled={sending}
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAnnouncement}
                          onChange={(e) => setIsAnnouncement(e.target.checked)}
                          className="accent-amber-300"
                        />
                        <Sparkles className="h-3 w-3 text-amber-300" aria-hidden="true" />
                        Mark as announcement
                      </label>
                      <button
                        type="submit"
                        disabled={!input.trim() || sending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-300 to-teal-200 px-4 py-2 text-xs font-bold text-slate-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="h-3 w-3" aria-hidden="true" />
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200/15 bg-amber-100/[0.03] p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] text-amber-200">
              <LockKeyhole className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-5 text-sm font-semibold text-white">Teacher access required</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
              The Teacher Chat is a private space for verified Creative Minds teachers. Sign in with a work email containing "edu" (e.g., you@school.edu.kh) to join the conversation, post announcements, and communicate with other teachers.
            </p>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-200 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_35px_-12px_rgba(251,191,36,.7)] transition hover:-translate-y-0.5"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                Sign in as teacher
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
