-- HQ Character Forge — operator-only admin over ANY user's character. Lets the
-- Circle HQ operator list every character, load one, and save its appearance back
-- to the SAME canonical rows the games read (kingdom_characters /
-- kingdom_character_appearance). So the Forge is the single edit point of truth:
-- what an operator saves here is what LashiraBloom + Kingdom Heroes render for that
-- user via kingdom_get_player_state().
--
-- Security: every function is SECURITY DEFINER and gated on the existing
-- hq_is_operator() (profiles.role in operator/admin). Run in the ArgantaLab
-- Supabase project (bdagdxgpnlialkppjwor).

begin;

-- Roster: one row per existing character, with a friendly name + whether it has a
-- built appearance yet. Operator only.
create or replace function public.hq_character_roster()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.hq_is_operator() then coalesce((
    select jsonb_agg(jsonb_build_object(
      'profileId', ch.profile_id,
      'characterId', ch.id,
      'name', ch.name,
      'displayName', coalesce(p.display_name, p.email, ch.name),
      'email', p.email,
      'accountType', ch.account_type,
      'pathId', ch.path_id,
      'level', ch.level,
      'hasHero', (coalesce(a.synced_spec_json, '{}'::jsonb) <> '{}'::jsonb
               or coalesce(a.draft_spec_json, '{}'::jsonb) <> '{}'::jsonb
               or coalesce(a.appearance_json, '{}'::jsonb) ? 'spec')
    ) order by ch.account_type, lower(coalesce(p.display_name, ch.name)))
    from public.kingdom_characters ch
    left join public.profiles p on p.id = ch.profile_id
    left join public.kingdom_character_appearance a on a.character_id = ch.id
  ), '[]'::jsonb) else '[]'::jsonb end
$$;

-- Load one user's character + its live spec (synced > draft > legacy). Operator only.
create or replace function public.hq_character_get(p_profile_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  select jsonb_build_object(
    'character', jsonb_build_object('id', ch.id, 'profileId', ch.profile_id, 'name', ch.name,
       'accountType', ch.account_type, 'pathId', ch.path_id, 'level', ch.level),
    'displayName', coalesce(p.display_name, p.email, ch.name),
    'spec', coalesce(
       nullif(a.synced_spec_json, '{}'::jsonb),
       nullif(a.draft_spec_json, '{}'::jsonb),
       a.appearance_json -> 'spec')
  ) into result
  from public.kingdom_characters ch
  left join public.profiles p on p.id = ch.profile_id
  left join public.kingdom_character_appearance a on a.character_id = ch.id
  where ch.profile_id = p_profile_id;
  return result;  -- null if that user has no character
end $$;

-- Save an appearance spec (and optionally the path) for a user's character. Writes
-- synced + draft + legacy appearance_json.spec and denormalises the columns, so
-- every reader (kingdom_get_player_state, legacy paths, the games) sees it. Operator only.
create or replace function public.hq_character_save(p_profile_id uuid, p_spec jsonb, p_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if not public.hq_is_operator() then raise exception 'operator only'; end if;
  select id into cid from public.kingdom_characters where profile_id = p_profile_id;
  if cid is null then
    return jsonb_build_object('ok', false, 'message', 'That user has no character yet.');
  end if;
  if p_path is not null and p_path <> '' then
    update public.kingdom_characters set path_id = lower(p_path) where id = cid;
  end if;
  insert into public.kingdom_character_appearance (character_id) values (cid)
    on conflict (character_id) do nothing;
  update public.kingdom_character_appearance
     set synced_spec_json = p_spec,
         draft_spec_json = p_spec,
         appearance_json = jsonb_set(coalesce(appearance_json, '{}'::jsonb), '{spec}', p_spec, true),
         synced_at = now(),
         draft_updated_at = now(),
         updated_at = now()
   where character_id = cid;
  perform public.kingdom_apply_appearance_columns(cid, p_spec);
  return jsonb_build_object('ok', true, 'characterId', cid);
end $$;

grant execute on function public.hq_character_roster() to authenticated;
grant execute on function public.hq_character_get(uuid) to authenticated;
grant execute on function public.hq_character_save(uuid, jsonb, text) to authenticated;

commit;

-- Rollback:
--   drop function if exists public.hq_character_roster();
--   drop function if exists public.hq_character_get(uuid);
--   drop function if exists public.hq_character_save(uuid, jsonb, text);
