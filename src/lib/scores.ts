// Supabase queries for the CMC backend — classes, enrollments, drills, drill_attempts.
// All functions are safe to call when Supabase is not configured: they return null/empty.
import { supabase, supabaseConfigured } from './supabase';
import type {
  Class,
  ClassEnrollment,
  ClassProgram,
  Drill,
  DrillAttempt,
  NewDrillAttemptInput,
  ScoreBestPerDrill,
} from '../types/scores';

// ---------------------------------------------------------------------------
// DRILLS CATALOG (read-only)
// ---------------------------------------------------------------------------
export async function listDrills(): Promise<Drill[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[scores] listDrills:', error.message);
    return [];
  }
  return (data ?? []) as Drill[];
}

export async function getDrillBySlug(slug: string): Promise<Drill | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('[scores] getDrillBySlug:', error.message);
    return null;
  }
  return (data as Drill) ?? null;
}

// ---------------------------------------------------------------------------
// CLASSES (teacher-owned)
// ---------------------------------------------------------------------------
export async function listMyClasses(): Promise<Class[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[scores] listMyClasses:', error.message);
    return [];
  }
  return (data ?? []) as Class[];
}

export async function createClass(input: {
  name: string;
  description?: string;
  program?: ClassProgram;
  grade_level?: string;
}): Promise<Class | null> {
  if (!supabase) return null;
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    console.warn('[scores] createClass: no authenticated user');
    return null;
  }
  // Generate a unique class code via the helper function
  const { data: codeData, error: codeErr } = await supabase.rpc('generate_class_code');
  if (codeErr || !codeData) {
    console.warn('[scores] createClass: class code generation failed', codeErr?.message);
    return null;
  }
  const { data, error } = await supabase
    .from('classes')
    .insert({
      teacher_user_id: userData.user.id,
      name: input.name,
      description: input.description ?? '',
      program: input.program ?? 'General',
      grade_level: input.grade_level ?? '',
      class_code: codeData as string,
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[scores] createClass:', error.message);
    return null;
  }
  return data as Class;
}

export async function updateClass(
  classId: string,
  updates: Partial<Pick<Class, 'name' | 'description' | 'program' | 'grade_level' | 'is_active'>>,
): Promise<Class | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('classes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', classId)
    .select('*')
    .single();
  if (error) {
    console.warn('[scores] updateClass:', error.message);
    return null;
  }
  return data as Class;
}

export async function deleteClass(classId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) {
    console.warn('[scores] deleteClass:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// CLASS ENROLLMENTS (student side)
// ---------------------------------------------------------------------------
export async function enrollInClass(
  classCode: string,
  displayName: string,
): Promise<{ ok: boolean; message: string; class_id?: string }> {
  if (!supabase) return { ok: false, message: 'Supabase not configured.' };
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false, message: 'You must be signed in to enroll.' };
  }
  // Look up the class by code
  const { data: classRow, error: classErr } = await supabase
    .from('classes')
    .select('id, is_active')
    .eq('class_code', classCode.toUpperCase().trim())
    .maybeSingle();
  if (classErr || !classRow) {
    return { ok: false, message: 'Class code not found.' };
  }
  if (!classRow.is_active) {
    return { ok: false, message: 'This class is no longer accepting students.' };
  }
  // Insert enrollment (UPSERT to handle re-enrollment after un-enroll)
  const { error: enrollErr } = await supabase
    .from('class_enrollments')
    .upsert(
      {
        class_id: classRow.id,
        student_user_id: userData.user.id,
        display_name: displayName.trim() || 'Student',
        unenrolled_at: null,
      },
      { onConflict: 'class_id,student_user_id' },
    );
  if (enrollErr) {
    return { ok: false, message: enrollErr.message };
  }
  return { ok: true, message: 'Enrolled!', class_id: classRow.id };
}

export async function listMyEnrollments(): Promise<ClassEnrollment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('class_enrollments')
    .select('*')
    .is('unenrolled_at', null)
    .order('enrolled_at', { ascending: false });
  if (error) {
    console.warn('[scores] listMyEnrollments:', error.message);
    return [];
  }
  return (data ?? []) as ClassEnrollment[];
}

export async function listClassEnrollments(classId: string): Promise<ClassEnrollment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('class_enrollments')
    .select('*')
    .eq('class_id', classId)
    .is('unenrolled_at', null)
    .order('display_name', { ascending: true });
  if (error) {
    console.warn('[scores] listClassEnrollments:', error.message);
    return [];
  }
  return (data ?? []) as ClassEnrollment[];
}

// ---------------------------------------------------------------------------
// DRILL ATTEMPTS (the core score-submission API)
// ---------------------------------------------------------------------------

/**
 * Submit a drill attempt. Used by the biweek-planner test pages and the
 * TOEFL iBT section pages after a student submits their answers.
 *
 * Behavior:
 * - If Supabase is configured AND the user is signed in: inserts a row tied to their user_id.
 * - If Supabase is configured BUT the user is anonymous: still inserts (user_id = null) so we capture analytics.
 * - If Supabase is NOT configured: no-op (returns null) — the page keeps working.
 */
export async function submitDrillAttempt(
  input: NewDrillAttemptInput,
): Promise<DrillAttempt | null> {
  if (!supabase) return null;

  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      userId = userData.user.id;
      userEmail = userData.user.email ?? null;
    }
  } catch {
    // ignore — fall through to insert with user_id = null
  }

  const row = {
    user_id: userId,
    class_id: input.class_id ?? null,
    drill_id: input.drill_id ?? null,
    drill_slug: input.drill_slug,
    drill_title: input.drill_title,
    drill_source: input.drill_source,
    student_name: input.student_name,
    student_email: input.student_email ?? userEmail,
    score_pct: input.score_pct,
    correct_count: input.correct_count,
    total_count: input.total_count,
    duration_seconds: input.duration_seconds ?? null,
    raw_answers: input.raw_answers ?? {},
  };

  const { data, error } = await supabase
    .from('drill_attempts')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    console.warn('[scores] submitDrillAttempt:', error.message);
    return null;
  }
  return data as DrillAttempt;
}

export async function listMyAttempts(limit = 50): Promise<DrillAttempt[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('drill_attempts')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[scores] listMyAttempts:', error.message);
    return [];
  }
  return (data ?? []) as DrillAttempt[];
}

export async function listClassAttempts(classId: string, limit = 200): Promise<DrillAttempt[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('drill_attempts')
    .select('*')
    .eq('class_id', classId)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[scores] listClassAttempts:', error.message);
    return [];
  }
  return (data ?? []) as DrillAttempt[];
}

export async function listBestScoresPerDrill(): Promise<ScoreBestPerDrill[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('score_best_per_drill')
    .select('*')
    .order('last_attempt_at', { ascending: false });
  if (error) {
    console.warn('[scores] listBestScoresPerDrill:', error.message);
    return [];
  }
  return (data ?? []) as ScoreBestPerDrill[];
}

export const scoresClient = {
  listDrills,
  getDrillBySlug,
  listMyClasses,
  createClass,
  updateClass,
  deleteClass,
  enrollInClass,
  listMyEnrollments,
  listClassEnrollments,
  submitDrillAttempt,
  listMyAttempts,
  listClassAttempts,
  listBestScoresPerDrill,
  isConfigured: supabaseConfigured,
};
