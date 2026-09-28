begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  member_id text not null unique,
  display_name text not null default '',
  school_name text not null default '',
  role text not null default 'Educator',
  created_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from public, anon, authenticated;
grant select on public.member_profiles to authenticated;
grant select on public.member_profiles to service_role;

drop policy if exists member_profiles_read_own on public.member_profiles;
create policy member_profiles_read_own
  on public.member_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.member_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.member_entitlements enable row level security;
revoke all on public.member_entitlements from public, anon, authenticated;
grant select on public.member_entitlements to authenticated;
grant select on public.member_entitlements to service_role;

drop policy if exists member_entitlements_read_active_own on public.member_entitlements;
create policy member_entitlements_read_active_own
  on public.member_entitlements
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'active'
    and (expires_at is null or expires_at > now())
  );

create or replace function private.bootstrap_member_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_member_id text;
begin
  generated_member_id := 'CMN-' || upper(substr(replace(new.id::text, '-', ''), 1, 8));

  insert into public.member_profiles (user_id, member_id, display_name, school_name, role)
  values (
    new.id,
    generated_member_id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Educator'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'school_name'), ''), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'Educator')
  )
  on conflict (user_id) do nothing;

  if new.email_confirmed_at is not null then
    insert into public.member_entitlements (user_id, plan, status)
    values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function private.grant_free_access_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.member_entitlements (user_id, plan, status)
    values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.bootstrap_member_profile() from public, anon, authenticated;
revoke all on function private.grant_free_access_after_email_confirmation() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
  after insert on auth.users
  for each row execute function private.bootstrap_member_profile();

drop trigger if exists on_auth_user_email_confirmed_member_access on auth.users;
create trigger on_auth_user_email_confirmed_member_access
  after update of email_confirmed_at on auth.users
  for each row execute function private.grant_free_access_after_email_confirmation();

create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('teacher_interest', 'newsletter')),
  email text not null,
  email_normalized text generated always as (lower(trim(email))) stored,
  display_name text not null default '',
  school_name text not null default '',
  role text not null default '',
  contact_consent_at timestamptz,
  newsletter_consent_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  unique (email_normalized, kind),
  check (kind <> 'newsletter' or newsletter_consent_at is not null),
  check (kind <> 'teacher_interest' or contact_consent_at is not null)
);

alter table public.contact_leads enable row level security;
revoke all on public.contact_leads from public, anon, authenticated;
grant all on public.contact_leads to service_role;

create table if not exists private.lead_rate_windows (
  fingerprint text primary key,
  window_started_at timestamptz not null,
  requests integer not null check (requests > 0)
);

create or replace function public.consume_lead_rate_limit(
  p_fingerprint text,
  p_window_started_at timestamptz,
  p_max_requests integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_requests integer;
begin
  if p_fingerprint is null or length(p_fingerprint) < 32 or p_max_requests < 1 or p_max_requests > 20 then
    return false;
  end if;

  insert into private.lead_rate_windows as current_window (fingerprint, window_started_at, requests)
  values (p_fingerprint, p_window_started_at, 1)
  on conflict (fingerprint) do update
    set window_started_at = excluded.window_started_at,
        requests = case
          when current_window.window_started_at < excluded.window_started_at then 1
          else current_window.requests + 1
        end
  returning requests into current_requests;

  return current_requests <= p_max_requests;
end;
$$;

revoke all on function public.consume_lead_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_lead_rate_limit(text, timestamptz, integer) to service_role;

create or replace function public.purge_expired_contact_leads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  delete from public.contact_leads where expires_at <= now();
  get diagnostics removed_count = row_count;
  delete from private.lead_rate_windows where window_started_at < now() - interval '1 day';
  return removed_count;
end;
$$;

revoke all on function public.purge_expired_contact_leads() from public, anon, authenticated;
grant execute on function public.purge_expired_contact_leads() to service_role;

create extension if not exists pg_cron;
select cron.schedule(
  'cmn-purge-expired-contact-leads',
  '17 3 * * *',
  'select public.purge_expired_contact_leads();'
);

commit;