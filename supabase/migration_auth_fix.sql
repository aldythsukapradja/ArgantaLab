-- ============================================================
--  ARGANTALAB · AUTH & SYNC FIX  (run in Supabase → SQL Editor)
--  Fixes two reported bugs, idempotent & safe to re-run:
--    (1) Kid PIN login "always incorrect"  → kid synthetic-email
--        accounts were never email-confirmed, so signInWithPassword
--        rejected them. We auto-confirm @kids.argantalab.app accounts
--        on insert AND backfill every existing kid.
--    (2) A kid shows in the local family circle but NOT in the
--        Grown-ups dashboard switcher → that switcher reads cloud
--        profiles.guardian_id, which was only set opportunistically
--        from the kid's transient session (which never exists when
--        email-confirmation is on). We now:
--          • set guardian_id authoritatively from signup metadata
--            (handle_new_user trigger), and
--          • add adopt_kid(username, pin) so a parent can re-link an
--            already-existing kid by PIN (repairs orphaned accounts
--            like ones created before this migration).
-- ============================================================

-- pgcrypto provides crypt() for verifying the PIN-derived password
-- against auth.users.encrypted_password inside adopt_kid().
create extension if not exists pgcrypto with schema extensions;

-- ── (1) Auto-confirm kid accounts ───────────────────────────
-- Kids have no real inbox; their email is synthetic. Confirm them
-- automatically so password sign-in works even when the project's
-- "Confirm email" provider setting is left ON.
create or replace function public.auto_confirm_kid_email()
returns trigger language plpgsql security definer set search_path = auth, public as $$
begin
  if new.email like '%@kids.argantalab.app' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end; $$;

drop trigger if exists on_kid_auto_confirm on auth.users;
create trigger on_kid_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_kid_email();

-- Backfill: confirm every kid account that already exists.
update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where email like '%@kids.argantalab.app' and email_confirmed_at is null;

-- ── (2a) Set guardian_id authoritatively at signup ──────────
-- The client now passes guardian_id in the signup metadata; the
-- new-user trigger writes it straight onto the profile row, so the
-- link no longer depends on a transient kid session existing.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, photo_url, username, role, dob, gender, friend_code, guardian_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    nullif(new.raw_user_meta_data->>'dob', '')::date,
    new.raw_user_meta_data->>'gender',
    public.gen_friend_code(),
    nullif(new.raw_user_meta_data->>'guardian_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- ── (2b) Adopt / re-link an existing kid by username + PIN ──
-- A signed-in guardian claims a kid account, proving control by the
-- 4-digit PIN (verified against the bcrypt password). Only links a
-- kid that is currently unparented (or already this guardian's), so
-- it can't steal another family's child. Repairs orphaned accounts.
create or replace function public.adopt_kid(p_username text, p_pin text)
returns boolean
language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_kid uuid; v_match boolean;
begin
  if auth.uid() is null then return false; end if;

  select u.id, (u.encrypted_password = crypt(p_pin || '#aLab', u.encrypted_password))
    into v_kid, v_match
  from auth.users u
  where lower(u.email) = lower(p_username) || '@kids.argantalab.app'
  limit 1;

  if v_kid is null or not coalesce(v_match, false) then return false; end if;

  update public.profiles
    set guardian_id = auth.uid()
    where id = v_kid
      and role = 'kid'
      and (guardian_id is null or guardian_id = auth.uid());

  return found;
end; $$;
grant execute on function public.adopt_kid(text, text) to authenticated;

-- ============================================================
--  END AUTH & SYNC FIX
-- ============================================================
