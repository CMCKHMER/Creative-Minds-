// Types for the CMC backend schema (see supabase/migrations/202610160001_classes_students_scores.sql)

export type DrillSource = 'biweek-planner' | 'toefl-ibt' | 'learning-games';

export type DrillCategory =
  | 'listening'
  | 'structure'
  | 'reading'
  | 'writing'
  | 'speaking'
  | 'mock'
  | 'orientation'
  | 'game';

export type ClassProgram =
  | 'GEP'
  | 'ISEC'
  | 'Kid 5-12'
  | 'TOEFL iBT'
  | 'TOEFL Junior'
  | 'General';

export interface Drill {
  id: string;
  slug: string;
  title: string;
  source: DrillSource;
  category: DrillCategory;
  program: string | null;
  week_number: number | null;
  question_count: number;
  href: string;
  is_active: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  teacher_user_id: string;
  name: string;
  description: string;
  program: ClassProgram;
  grade_level: string;
  class_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ClassEnrollment = {
  id: string;
  class_id: string;
  student_user_id: string;
  display_name: string;
  enrolled_at: string;
  unenrolled_at: string | null;
};

export interface DrillAttempt {
  id: string;
  user_id: string | null;
  class_id: string | null;
  drill_id: string | null;
  drill_slug: string;
  drill_title: string;
  drill_source: DrillSource;
  student_name: string;
  student_email: string | null;
  score_pct: number;
  correct_count: number;
  total_count: number;
  duration_seconds: number | null;
  raw_answers: Record<string, unknown>;
  submitted_at: string;
}

export interface ScoreBestPerDrill {
  user_id: string;
  drill_id: string;
  drill_slug: string;
  drill_title: string;
  best_score_pct: number;
  attempt_count: number;
  last_attempt_at: string;
}

// Payload used when creating a new drill attempt from the biweek-planner test pages
export interface NewDrillAttemptInput {
  drill_slug: string;
  drill_title: string;
  drill_source: DrillSource;
  student_name: string;
  student_email?: string | null;
  score_pct: number;
  correct_count: number;
  total_count: number;
  duration_seconds?: number | null;
  raw_answers?: Record<string, unknown>;
  class_id?: string | null;
  drill_id?: string | null;
}
