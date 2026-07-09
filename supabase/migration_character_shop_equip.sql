-- ============================================================
--  ARGANTALAB · COSMETIC SHOP · SELF-SERVICE EQUIP  (additive, idempotent)
--  Requires migration_character_shop.sql already run (shop_cosmetic_catalog,
--  person_cosmetic_items, buy_cosmetic_item, my_cosmetic_items).
--
--  hq_character_save() (migration_hq_character_admin.sql) is the only thing that
--  currently writes a player's composer spec — but it's operator-only, so a
--  LashiraBloom player who just bought a cosmetic piece has no door to actually
--  WEAR it themselves. This adds exactly one: equip_cosmetic_item(p_item_key).
--
--  Mirrors equip_mount()'s safety shape: verifies OWNERSHIP, patches exactly ONE
--  slot in the spec (never a full rewrite), writes the same three fields
--  hq_character_save writes (synced_spec_json / draft_spec_json /
--  appearance_json.spec) so every reader — including kingdom_get_player_state(),
--  which both Kingdom Heroes and LashiraBloom render from — sees it. Callable by
--  any authenticated player for their OWN character; no operator gate.
--
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

create or replace function public.equip_cosmetic_item(p_item_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  it record;
  spec_key text;
  cur_spec jsonb;
  new_part jsonb;
  new_spec jsonb;
  body_id int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  -- must own it (bought via buy_cosmetic_item)
  if not exists (select 1 from public.person_cosmetic_items where owner_id = uid and item_key = p_item_key) then
    return jsonb_build_object('ok', false, 'error', 'not_owned');
  end if;

  select cat, part_id into it from public.shop_cosmetic_catalog where item_key = p_item_key;
  if it.cat is null then raise exception 'unknown cosmetic item'; end if;

  -- catalog cat -> composer spec slot key (composer.ts SLOT_DEFS: sword items live
  -- under spec.weapon, not spec.sword; the rest match their cat name 1:1).
  spec_key := case it.cat when 'sword' then 'weapon' else it.cat end;

  select id into cid from public.kingdom_characters where profile_id = uid;
  if cid is null then
    return jsonb_build_object('ok', false, 'error', 'no_character', 'message', 'No character yet — visit Character Select first.');
  end if;

  insert into public.kingdom_character_appearance (character_id) values (cid)
    on conflict (character_id) do nothing;

  select coalesce(
    nullif(a.synced_spec_json, '{}'::jsonb),
    nullif(a.draft_spec_json, '{}'::jsonb),
    a.appearance_json -> 'spec',
    '{}'::jsonb
  ) into cur_spec
  from public.kingdom_character_appearance a where a.character_id = cid;

  new_part := jsonb_build_object('cat', it.cat, 'id', it.part_id, 'palette', null);
  new_spec := jsonb_set(coalesce(cur_spec, '{}'::jsonb), array[spec_key], new_part, true);

  -- Wearing a COAT needs a bare skin underneath, else it renders under a full
  -- armor-body sprite and can look like nothing changed — same rule the Lab's own
  -- pickArmor() applies. SKIN_IDS = (0, 1) per composer.ts.
  if it.cat = 'coat' then
    body_id := nullif(new_spec -> 'body' ->> 'id', '')::int;
    if new_spec -> 'body' is null or body_id is null or body_id not in (0, 1) then
      new_spec := jsonb_set(new_spec, '{body}', jsonb_build_object('cat', 'body', 'id', 0, 'palette', null), true);
    end if;
  end if;

  update public.kingdom_character_appearance
     set synced_spec_json = new_spec,
         draft_spec_json = new_spec,
         appearance_json = jsonb_set(coalesce(appearance_json, '{}'::jsonb), '{spec}', new_spec, true),
         synced_at = now(),
         draft_updated_at = now(),
         updated_at = now()
   where character_id = cid;

  perform public.kingdom_apply_appearance_columns(cid, new_spec);

  return jsonb_build_object('ok', true, 'slot', spec_key, 'spec', new_spec);
end; $$;
grant execute on function public.equip_cosmetic_item(text) to authenticated;

commit;
