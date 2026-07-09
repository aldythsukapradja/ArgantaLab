-- Character Forge roster v2 — sources from KinetikCircle identity (public.profiles),
-- not from kingdom_characters. Fixes the real gap: a registered adult or kid who has
-- never touched Kingdom was previously invisible in the roster (the old query started
-- FROM kingdom_characters). Now every profile appears, LEFT JOINed to their hero if
-- they have one. Adds platform-wide pagination + search + adult/kid counts for the
-- capsule toggle. Addendum to migration_hq_character_admin.sql — run this AFTER that
-- one (hq_is_operator(), kingdom_characters, kingdom_character_appearance must exist).
--
-- Replaces ONLY hq_character_roster(); hq_character_get/save are untouched.

begin;

-- The original migration created a 0-arg hq_character_roster(). Postgres treats a
-- 0-arg function and a 4-arg-all-defaulted function as DIFFERENT overloads — leaving
-- both in place makes a no-args RPC call ambiguous ("function is not unique"). Drop
-- the old one explicitly before creating the paginated replacement.
drop function if exists public.hq_character_roster();

create or replace function public.hq_character_roster(
  p_search text default null,
  p_kind   text default null,   -- 'adult' | 'kid' | null (= all)
  p_limit  int  default 20,
  p_offset int  default 0
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  items jsonb := '[]'::jsonb;
  total_count int := 0;
  count_all int := 0;
  count_adult int := 0;
  count_kid int := 0;
begin
  if not public.hq_is_operator() then
    return jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'counts', jsonb_build_object('all', 0, 'adult', 0, 'kid', 0));
  end if;

  -- Stable tab counts (platform-wide, ignoring the active search/page) for the
  -- All/Adults/Kids toggle labels.
  select count(*) filter (where true),
         count(*) filter (where coalesce(ch.account_type, case when p.guardian_id is not null then 'kid' else 'adult' end) = 'adult'),
         count(*) filter (where coalesce(ch.account_type, case when p.guardian_id is not null then 'kid' else 'adult' end) = 'kid')
    into count_all, count_adult, count_kid
  from public.profiles p
  left join public.kingdom_characters ch on ch.profile_id = p.id;

  select coalesce(jsonb_agg(row_json order by ord), '[]'::jsonb), coalesce(max(full_count), 0)
    into items, total_count
  from (
    select
      jsonb_build_object(
        'profileId', p.id, 'characterId', ch.id,
        'name', coalesce(ch.name, p.display_name, p.email, p.username, 'Unnamed'),
        'displayName', coalesce(p.display_name, p.email, p.username, 'Unnamed'),
        'email', p.email,
        'accountType', coalesce(ch.account_type, case when p.guardian_id is not null then 'kid' else 'adult' end),
        'pathId', ch.path_id, 'level', ch.level,
        'hasHero', (coalesce(a.synced_spec_json, '{}'::jsonb) <> '{}'::jsonb
                 or coalesce(a.draft_spec_json, '{}'::jsonb) <> '{}'::jsonb
                 or coalesce(a.appearance_json, '{}'::jsonb) ? 'spec'),
        'guardianId', p.guardian_id, 'guardianName', g.display_name
      ) as row_json,
      row_number() over (order by
        coalesce(ch.account_type, case when p.guardian_id is not null then 'kid' else 'adult' end),
        lower(coalesce(p.display_name, p.email, p.username, ''))
      ) as ord,
      count(*) over () as full_count
    from public.profiles p
    left join public.profiles g on g.id = p.guardian_id
    left join public.kingdom_characters ch on ch.profile_id = p.id
    left join public.kingdom_character_appearance a on a.character_id = ch.id
    where (p_kind is null or
           coalesce(ch.account_type, case when p.guardian_id is not null then 'kid' else 'adult' end) = p_kind)
      and (p_search is null or btrim(p_search) = '' or
           p.display_name ilike '%' || p_search || '%' or
           p.email ilike '%' || p_search || '%' or
           p.username ilike '%' || p_search || '%' or
           ch.name ilike '%' || p_search || '%')
    order by
      coalesce(ch.account_type, case when p.guardian_id is not null then 'kid' else 'adult' end),
      lower(coalesce(p.display_name, p.email, p.username, ''))
    limit greatest(1, coalesce(p_limit, 20)) offset greatest(0, coalesce(p_offset, 0))
  ) sub;

  return jsonb_build_object(
    'items', items, 'total', total_count,
    'counts', jsonb_build_object('all', count_all, 'adult', count_adult, 'kid', count_kid)
  );
end $$;

grant execute on function public.hq_character_roster(text, text, int, int) to authenticated;

commit;

-- Rollback: re-run migration_hq_character_admin.sql's original hq_character_roster()
-- definition (no-arg), or: drop function public.hq_character_roster(text,text,int,int);
