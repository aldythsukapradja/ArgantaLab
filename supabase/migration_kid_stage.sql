-- ============================================================
--  ARGANTALAB · KID STAGE OVERRIDE  (additive, idempotent)
--  Age (DOB) only SEEDS a kid's level. A circle owner/guardian can then pin a
--  different stage (Tiny … Legend) from the Profile — e.g. an advanced 7-yo on
--  Explorer, or a gentle restart on Starter. Stored as profiles.stage_override
--  (null = auto-by-age). update_kid gains a p_stage arg ('' or 'auto' clears it).
--  Run after migration_circles_admin.sql. Safe to re-run.
-- ============================================================
begin;

alter table public.profiles add column if not exists stage_override text;

-- 5-arg overload (the client calls this one). Guardian-only, kid-only.
create or replace function public.update_kid(
  p_kid uuid, p_display_name text, p_dob date, p_gender text, p_stage text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_guardian_of(p_kid) then raise exception 'not your child'; end if;
  if exists(select 1 from public.profiles where id = p_kid and role <> 'kid') then raise exception 'not a kid account'; end if;
  update public.profiles set
    display_name   = coalesce(nullif(trim(p_display_name),''), display_name),
    dob            = coalesce(p_dob, dob),
    gender         = coalesce(nullif(p_gender,''), gender),
    stage_override = case
                       when p_stage is null then stage_override          -- unchanged
                       when p_stage in ('', 'auto') then null            -- back to auto-by-age
                       else p_stage end
  where id = p_kid;
  return found;
end; $$;
grant execute on function public.update_kid(uuid, text, date, text, text) to authenticated;

-- expose stage_override on my_children() so the Profile cards show the real level
create or replace function public.my_children()
returns table(id uuid, display_name text, username text, photo_url text, dob date, gender text,
              diamonds int, xp int, level int, last_seen timestamptz, friend_code text, stage_override text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.photo_url, p.dob, p.gender,
         coalesce(p.diamonds,0), coalesce(p.xp,0), coalesce(p.level,1), p.last_seen, p.friend_code, p.stage_override
  from public.profiles p
  where p.role = 'kid'
    and (p.guardian_id = auth.uid()
         or exists(select 1 from public.guardianships g where g.child_id = p.id and g.guardian_id = auth.uid()))
  order by p.display_name;
$$;
grant execute on function public.my_children() to authenticated;

commit;
