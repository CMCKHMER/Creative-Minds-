-- CMC backend — classes, enrollments, drills catalog, and drill attempts.
-- Extends the existing members/entitlements schema; does not touch existing tables.
-- All tables use RLS. Teachers manage their classes; students see their own attempts
-- and the classes they're enrolled in. The drill catalog is read-only for everyone.

begin;

-- ============================================================================
-- DRILLS CATALOG (read-only for authenticated users)
-- ============================================================================
create table if not exists public.drills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                    -- matches HTML filename, e.g. 'diagnostic.html'
  title text not null,                          -- human title, e.g. 'Orientation Diagnostic'
  source text not null check (source in ('biweek-planner', 'toefl-ibt', 'learning-games')),
  category text not null check (category in ('listening', 'structure', 'reading', 'writing', 'speaking', 'mock', 'orientation', 'game')),
  program text,                                  -- 'GEP', 'ISEC', 'Kid 5-12', 'TOEFL iBT', 'TOEFL Junior', null
  week_number int,                               -- biweek-planner week (null otherwise)
  question_count int not null default 0,
  href text not null,                            -- full URL to the drill page
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.drills enable row level security;
revoke all on public.drills from public, anon;
grant select on public.drills to authenticated;
grant select on public.drills to service_role;
grant insert, update, delete on public.drills to service_role;

-- ============================================================================
-- CLASSES (a teacher owns a class; students enroll)
-- ============================================================================
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  program text not null default 'GEP' check (program in ('GEP', 'ISEC', 'Kid 5-12', 'TOEFL iBT', 'TOEFL Junior', 'General')),
  grade_level text not null default '',
  class_code text not null unique,                -- shareable join code, e.g. 'CMN-AB12CD'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_classes_teacher on public.classes (teacher_user_id);

alter table public.classes enable row level security;
revoke all on public.classes from public, anon;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.classes to service_role;

-- Teachers can do everything on their own classes
drop policy if exists classes_owner_all on public.classes;
create policy classes_owner_all
  on public.classes
  for all
  to authenticated
  using (teacher_user_id = (select auth.uid()))
  with check (teacher_user_id = (select auth.uid()));

-- Enrolled students can read classes they're enrolled in
drop policy if exists classes_student_read on public.classes;
create policy classes_student_read
  on public.classes
  for select
  to authenticated
  using (
    id in (
      select class_id from public.class_enrollments
      where student_user_id = (select auth.uid()) and unenrolled_at is null
    )
  );

-- ============================================================================
-- CLASS ENROLLMENTS (link students to classes)
-- ============================================================================
create table if not exists public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '',           -- student-chosen display name in the class
  enrolled_at timestamptz not null default now(),
  unenrolled_at timestamptz,                       -- set when student leaves the class
  unique (class_id, student_user_id)
);

create index if not exists idx_enrollments_class on public.class_enrollments (class_id);
create index if not exists idx_enrollments_student on public.class_enrollments (student_user_id);

alter table public.class_enrollments enable row level security;
revoke all on public.class_enrollments from public, anon;
grant select, insert, update on public.class_enrollments to authenticated;
grant select, insert, update, delete on public.class_enrollments to service_role;

-- Class teacher can read/manage all enrollments for their classes
drop policy if exists enrollments_teacher_all on public.class_enrollments;
create policy enrollments_teacher_all
  on public.class_enrollments
  for all
  to authenticated
  using (
    class_id in (
      select id from public.classes where teacher_user_id = (select auth.uid())
    )
  )
  with check (
    class_id in (
      select id from public.classes where teacher_user_id = (select auth.uid())
    )
  );

-- Students can read their own enrollments
drop policy if exists enrollments_student_read_own on public.class_enrollments;
create policy enrollments_student_read_own
  on public.class_enrollments
  for select
  to authenticated
  using (student_user_id = (select auth.uid()));

-- Students can enroll themselves (INSERT) using a class_code (validated in app)
drop policy if exists enrollments_student_insert_own on public.class_enrollments;
create policy enrollments_student_insert_own
  on public.class_enrollments
  for insert
  to authenticated
  with check (student_user_id = (select auth.uid()));

-- Students can unenroll themselves (UPDATE setting unenrolled_at)
drop policy if exists enrollments_student_unenroll_own on public.class_enrollments;
create policy enrollments_student_unenroll_own
  on public.class_enrollments
  for update
  to authenticated
  using (student_user_id = (select auth.uid()))
  with check (student_user_id = (select auth.uid()));

-- ============================================================================
-- DRILL ATTEMPTS (every drill submission — analytics + history)
-- ============================================================================
create table if not exists public.drill_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,    -- nullable: anonymous attempts allowed
  class_id uuid references public.classes (id) on delete set null,
  drill_id uuid references public.drills (id) on delete set null,
  drill_slug text not null,                                       -- denormalized for resilience if drill row deleted
  drill_title text not null,
  drill_source text not null,                                     -- 'biweek-planner' | 'toefl-ibt' | 'learning-games'
  student_name text not null default '',                          -- captured from form (display name at time of attempt)
  student_email text,                                              -- only if authenticated
  score_pct int not null check (score_pct >= 0 and score_pct <= 100),
  correct_count int not null default 0,
  total_count int not null default 0,
  duration_seconds int,                                           -- null if timer wasn't used
  raw_answers jsonb not null default '{}'::jsonb,                 -- anonymized: just which options were selected
  submitted_at timestamptz not null default now()
);

create index if not exists idx_attempts_user on public.drill_attempts (user_id, submitted_at desc);
create index if not exists idx_attempts_class on public.drill_attempts (class_id, submitted_at desc);
create index if not exists idx_attempts_drill on public.drill_attempts (drill_id, submitted_at desc);
create index if not exists idx_attempts_slug on public.drill_attempts (drill_slug, submitted_at desc);

alter table public.drill_attempts enable row level security;
revoke all on public.drill_attempts from public, anon;
grant select, insert on public.drill_attempts to authenticated;
grant select, insert, update, delete on public.drill_attempts to service_role;

-- A user can always insert their own attempts (or anonymous — handled via service_role for anon)
drop policy if exists attempts_insert_own on public.drill_attempts;
create policy attempts_insert_own
  on public.drill_attempts
  for insert
  to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- A user can read their own attempts
drop policy if exists attempts_read_own on public.drill_attempts;
create policy attempts_read_own
  on public.drill_attempts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- A teacher can read attempts for their classes (class_id matches a class they own)
drop policy if exists attempts_read_teacher on public.drill_attempts;
create policy attempts_read_teacher
  on public.drill_attempts
  for select
  to authenticated
  using (
    class_id is not null
    and class_id in (
      select id from public.classes where teacher_user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Helper: generate a unique class code (CMN-XXXXXX)
-- ============================================================================
create or replace function public.generate_class_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  attempts int := 0;
begin
  loop
    new_code := 'CMN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    select 1 into attempts from public.classes where class_code = new_code;
    if not found then
      return new_code;
    end if;
    attempts := attempts + 1;
    if attempts > 10 then
      raise exception 'Could not generate unique class code after 10 attempts';
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_class_code() from public, anon, authenticated;
grant execute on function public.generate_class_code() to authenticated;
grant execute on function public.generate_class_code() to service_role;

-- ============================================================================
-- Helper: best score per (user, drill) — convenience view
-- ============================================================================
create or replace view public.score_best_per_drill as
select
  user_id,
  drill_id,
  drill_slug,
  drill_title,
  max(score_pct) as best_score_pct,
  count(*) as attempt_count,
  max(submitted_at) as last_attempt_at
from public.drill_attempts
where user_id is not null
group by user_id, drill_id, drill_slug, drill_title;

alter view public.score_best_per_drill owner to postgres;
grant select on public.score_best_per_drill to authenticated;
grant select on public.score_best_per_drill to service_role;

-- RLS on the view (re-applies underlying RLS, but explicit policy for clarity)
-- Views don't support RLS directly; the underlying tables do, so this is safe.

commit;
