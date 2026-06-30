-- ============================================================
--  KINETIK · SECURITY  (run AFTER 06_sync_people.sql)
--
--  FIXES THE BREACH: until now `circles` was read-open (true) and the
--  four kinetik_* tables were read+write-open (true). That meant ANY
--  signed-in user could read EVERY family's circle, people, routines,
--  events and moments.
--
--  This locks every kinetik table (and the circles read policy) to
--  CIRCLE MEMBERSHIP: you may see/modify a circle's data only if you
--  are its owner OR you appear in circle_members for it.
--
--  The kinetik app always runs as an authenticated user (Google /
--  kid auth), so auth.uid() is always present — membership checks work.
--
--  Idempotent · safe to re-run.  Paste into Supabase → SQL Editor → Run.
-- ============================================================
begin;

-- ── Membership helper (security definer so the policy can read
--    circles / circle_members past their own RLS) ──────────────
create or replace function public.kinetik_is_circle_member(p_circle uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circles c
     where c.id = p_circle and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.circle_members cm
     where cm.circle_id = p_circle and cm.member_id = auth.uid()
  );
$$;
grant execute on function public.kinetik_is_circle_member(uuid) to anon, authenticated;

-- ── 1. circles: drop the read-everything policy, scope reads to
--    membership (owner writes stay covered by the existing
--    "circles_own" FOR ALL policy from schema.sql) ──────────────
drop policy if exists "circles_read_all"    on public.circles;
drop policy if exists "circles_read_member" on public.circles;
create policy "circles_read_member" on public.circles
  for select using (public.kinetik_is_circle_member(id));

-- ── 2. The four kinetik_* tables: replace the open "_all" policy
--    with a membership-scoped read+write policy ─────────────────
do $$
declare t text;
begin
  foreach t in array array['kinetik_people','kinetik_routines','kinetik_events','kinetik_moments']
  loop
    execute format('drop policy if exists "%s_all" on public.%I;', t, t);
    execute format('drop policy if exists "%s_member" on public.%I;', t, t);
    execute format(
      'create policy "%s_member" on public.%I for all '
      || 'using (public.kinetik_is_circle_member(circle_id)) '
      || 'with check (public.kinetik_is_circle_member(circle_id));', t, t);
  end loop;
end $$;

commit;
