begin;
select plan(8);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.member_profiles'::regclass),
  'member profiles have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.member_entitlements'::regclass),
  'member entitlements have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.contact_leads'::regclass),
  'contact leads have row-level security enabled'
);
select ok(
  not has_table_privilege('anon', 'public.member_profiles', 'SELECT'),
  'anonymous visitors cannot read member profiles'
);
select ok(
  not has_table_privilege('anon', 'public.member_entitlements', 'SELECT'),
  'anonymous visitors cannot read membership entitlements'
);
select ok(
  not has_table_privilege('anon', 'public.contact_leads', 'SELECT'),
  'anonymous visitors cannot read contact-lead records'
);
select ok(
  not has_table_privilege('authenticated', 'public.member_entitlements', 'INSERT'),
  'authenticated users cannot grant themselves member access'
);
select ok(
  not has_function_privilege('anon', 'public.consume_lead_rate_limit(text,timestamp with time zone,integer)', 'EXECUTE'),
  'anonymous visitors cannot call the service-only rate-limit function'
);

select * from finish();
rollback;