// Types for public/assets/js/cmc-practice-attempts.js — the Score Trajectory
// store shared by the static TOEFL pages (and mirrored by
// src/lib/practiceAttempts.ts for the React app).
declare module '*cmc-practice-attempts.js' {
  export interface PracticeAttempt {
    id: string;
    skill: string;
    band: number;
    traits: Record<string, number>;
    stats: Record<string, number>;
    text: string;
    source: string;
    createdAt: number;
  }

  export interface TrajectoryPoint {
    band: number;
    createdAt: number;
  }

  export interface Trajectory {
    count: number;
    points: TrajectoryPoint[];
    latest: number;
    previous: number;
    delta: number;
    best: number;
    direction: 'up' | 'down' | 'flat' | 'first';
  }

  export interface AttemptInput {
    skill: 'writing' | 'speaking';
    band: number;
    traits?: Record<string, number>;
    stats?: Record<string, number>;
    text?: string;
    source?: string;
    rubricVersion?: string;
    createdAt?: number;
  }

  export function buildTrajectory(attempts: Partial<PracticeAttempt>[], options?: { limit?: number }): Trajectory;
  export function trajectoryMarkup(
    traj: Trajectory,
    options?: { label?: string; empty?: string; href?: string },
  ): string;
  export function fromDocument(doc: unknown): PracticeAttempt | null;
  export function currentStudent(): { uid: string; token: string } | null;
  export function saveAttempt(input: AttemptInput): Promise<{ id: string | null; queued: boolean; reason?: string }>;
  export function flushOutbox(): Promise<{ sent: number }>;
  export function loadAttempts(options?: { limit?: number }): Promise<PracticeAttempt[]>;
  export function loadTrajectory(options?: {
    skill?: string;
    limit?: number;
  }): Promise<{ attempts: PracticeAttempt[]; trajectory: Trajectory }>;

  export const ATTEMPTS_COLLECTION: string;
  export const ATTEMPTS_RUBRIC_VERSION: string;
}
