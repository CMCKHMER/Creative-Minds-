import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, MessageSquare, X } from 'lucide-react';
import { listClassEnrollments } from '../lib/firebaseDb';
import {
  loadPracticeReview,
  loadStudentAttempts,
  savePracticeReview,
  type PracticeAttempt,
  type PracticeReview,
} from '../lib/practiceAttempts';

/**
 * PracticeReviewPanel — the teacher's side of AI Phase 01.
 *
 * The automatic band is a rubric read-out, not a verdict: a teacher can see the
 * student's saved attempts (essay text included) and leave one review per
 * attempt — a band of their own, or "keep the automatic band", plus a comment.
 * The attempt document is never modified; the review lives in
 * practice_reviews/{attemptId} (see firestore.rules).
 */

interface ClassOption {
  id: string;
  name: string;
}

interface Props {
  teacherUid: string | null;
  teacherName?: string;
  classes: ClassOption[];
  defaultClassId?: string | null;
}

interface Enrollment {
  id: string;
  studentName?: string;
}

const BAND_CHOICES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Keep the automatic band' },
  { value: '0', label: '0.0 — no response' },
  { value: '1', label: '1.0' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: '2.0' },
  { value: '2.5', label: '2.5' },
  { value: '3', label: '3.0' },
  { value: '3.5', label: '3.5' },
  { value: '4', label: '4.0' },
  { value: '4.5', label: '4.5' },
  { value: '5', label: '5.0 — strong for level' },
];

function formatDate(ms: number): string {
  if (!ms) return 'undated';
  try {
    return new Date(ms).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'undated';
  }
}

function traitLine(traits: Record<string, number>): string {
  const parts = Object.entries(traits)
    .filter(([, v]) => Number.isFinite(v))
    .map(([key, value]) => `${key} ${Number(value).toFixed(1)}`);
  return parts.length ? parts.join(' · ') : 'no trait detail';
}

function AttemptRow({
  attempt,
  studentUid,
  teacherName,
}: {
  attempt: PracticeAttempt;
  studentUid: string;
  teacherName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<PracticeReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [band, setBand] = useState<string>(attempt.band.toFixed(1));
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    let alive = true;
    loadPracticeReview(attempt.id).then((existing) => {
      if (!alive) return;
      setReview(existing);
      setLoaded(true);
      if (existing) {
        setBand(existing.band == null ? '' : existing.band.toFixed(1));
        setComment(existing.comment);
      }
    });
    return () => {
      alive = false;
    };
  }, [open, loaded, attempt.id]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setResult(null);
    const parsed = band === '' ? null : Number(band);
    const res = await savePracticeReview({
      attemptId: attempt.id,
      studentUid,
      band: Number.isFinite(parsed as number) ? (parsed as number) : null,
      comment,
      reviewerName: teacherName,
    });
    setSaving(false);
    if (res.ok) {
      const saved = await loadPracticeReview(attempt.id);
      setReview(saved);
      setResult('Saved.');
    } else {
      setResult(res.error || 'Could not save the review.');
    }
  }, [attempt.id, band, comment, studentUid, teacherName]);

  return (
    <li className="cmc-review-attempt">
      <div className="cmc-review-attempt-head">
        <span className="cmc-review-skill">{attempt.skill === 'speaking' ? 'Speaking' : 'Writing'}</span>
        <span className="cmc-review-band">
          auto <strong>{attempt.band.toFixed(1)}</strong>
        </span>
        {review && (
          <span className="cmc-review-flag">
            <Check size={12} aria-hidden="true" />
            {review.band == null ? 'reviewed' : `reviewed → ${review.band.toFixed(1)}`}
          </span>
        )}
        <span className="cmc-review-date">{formatDate(attempt.createdAt)}</span>
        <button
          type="button"
          className="cmc-review-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={13} aria-hidden="true" /> : <MessageSquare size={13} aria-hidden="true" />}
          {open ? 'Close' : 'Review'}
        </button>
      </div>

      <p className="cmc-review-traits">{traitLine(attempt.traits)}</p>

      {attempt.text && (
        <details className="cmc-review-text">
          <summary>Read the response</summary>
          <pre>{attempt.text.slice(0, 4000)}</pre>
        </details>
      )}

      {open && (
        <div className="cmc-review-form">
          <label className="cmc-review-field">
            <span>Band</span>
            <select value={band} onChange={(e) => setBand(e.target.value)}>
              {BAND_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          <label className="cmc-review-field cmc-review-field-wide">
            <span>Comment for the student (max 600)</span>
            <textarea
              rows={3}
              maxLength={600}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What to keep, and the one thing to fix next."
            />
          </label>
          <div className="cmc-review-actions">
            <button type="button" className="cmc-review-save" onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : review ? 'Update review' : 'Save review'}
            </button>
            {result && <span className="cmc-review-result">{result}</span>}
          </div>
        </div>
      )}
    </li>
  );
}

export function PracticeReviewPanel({ teacherUid, teacherName, classes, defaultClassId }: Props) {
  const [classId, setClassId] = useState<string | null>(defaultClassId || classes[0]?.id || null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentUid, setStudentUid] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!defaultClassId) return;
    setClassId((current) => current || defaultClassId);
  }, [defaultClassId]);

  useEffect(() => {
    if (!classId) {
      setEnrollments([]);
      return;
    }
    let alive = true;
    setBusy(true);
    listClassEnrollments(classId)
      .then((rows) => {
        if (!alive) return;
        setEnrollments(
          (rows as Enrollment[])
            .filter((row) => row && row.id)
            .map((row) => ({ id: row.id, studentName: row.studentName })),
        );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [classId]);

  useEffect(() => {
    if (!studentUid) {
      setAttempts([]);
      return;
    }
    let alive = true;
    setBusy(true);
    loadStudentAttempts(studentUid, 20)
      .then((rows) => {
        if (alive) setAttempts(rows);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [studentUid]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );

  if (!teacherUid) return null;

  return (
    <div className="cmc-review">
      <div className="cmc-review-head">
        <h3 className="cmc-review-title">Practice attempts · Phase 01</h3>
        <p className="cmc-review-sub">
          Automatic bands from the TOEFL writing and speaking practice. Pick a student to read what
          they wrote or how they delivered it; your review overrides the band for them without ever
          changing the original attempt.
        </p>
      </div>

      {classes.length === 0 ? (
        <p className="cmc-review-note">Create a class first — attempts are listed per enrolled student.</p>
      ) : (
        <>
          <div className="cmc-review-row">
            <label className="cmc-review-field">
              <span>Class</span>
              <select
                value={classId || ''}
                onChange={(e) => {
                  setClassId(e.target.value || null);
                  setStudentUid(null);
                }}
              >
                {classes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="cmc-review-students" role="group" aria-label="Students">
              {enrollments.length === 0 && !busy && (
                <span className="cmc-review-note">No enrolled students yet.</span>
              )}
              {enrollments.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className={`cmc-review-student ${studentUid === student.id ? 'is-active' : ''}`}
                  aria-pressed={studentUid === student.id}
                  onClick={() => setStudentUid(student.id)}
                >
                  {student.studentName || 'Student'}
                </button>
              ))}
            </div>
          </div>

          {busy && <p className="cmc-review-note">Loading…</p>}

          {studentUid && !busy && attempts.length === 0 && (
            <p className="cmc-review-note">
              No saved attempts for {enrollments.find((s) => s.id === studentUid)?.studentName || 'this student'} yet.
              They appear the first time the student submits a writing response or records a speaking answer.
            </p>
          )}

          {attempts.length > 0 && (
            <ul className="cmc-review-list">
              {attempts.map((attempt) => (
                <AttemptRow
                  key={attempt.id}
                  attempt={attempt}
                  studentUid={studentUid as string}
                  teacherName={teacherName}
                />
              ))}
            </ul>
          )}

          {!studentUid && enrollments.length > 0 && (
            <p className="cmc-review-note">Choose a student to see their attempts.</p>
          )}

          {selectedClass && (
            <p className="cmc-review-note cmc-review-foot">
              Heads-up: if the list stays empty after a student has practised, the practice rules have
              not been published yet (Firestore → Rules → paste firestore-min.rules → Publish).
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default PracticeReviewPanel;
