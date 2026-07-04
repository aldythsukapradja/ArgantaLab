# Supabase Data Schema

This document defines the target Supabase schema groups for the real MMORPG.

## Identity And Accounts

```sql
profiles
- id uuid primary key
- auth_user_id uuid
- account_type text -- adult, kid, guardian, gm, admin
- display_name text
- avatar_url text
- argantalab_user_id text
- kinetik_circle_user_id text
- created_at timestamptz
- last_seen_at timestamptz

account_sync_links
- id uuid primary key
- profile_id uuid
- provider text -- google, kinetik_circle, argantalab
- provider_user_id text
- status text
- synced_at timestamptz

circles
- id uuid primary key
- kinetik_circle_id text
- name text
- type text -- family, class, group
- owner_profile_id uuid
- created_at timestamptz

guardian_child_links
- id uuid primary key
- guardian_profile_id uuid
- child_profile_id uuid
- circle_id uuid
- relationship text
- permissions_json jsonb
- created_at timestamptz
```

## Characters

```sql
characters
- id uuid primary key
- profile_id uuid
- account_type text -- adult or kid copied for fast validation
- name text
- path_id text -- mage, poet, warrior, rogue
- level int
- progression_exp bigint
- lifetime_adult_exp bigint
- lifetime_kid_education_exp bigint
- created_at timestamptz
- deleted_at timestamptz

character_stats
- character_id uuid primary key
- vita bigint
- mana bigint
- might int
- will int
- grace int
- armor int
- hit int
- damage_min int
- damage_max int

character_position
- character_id uuid primary key
- map_id text
- map_instance_id uuid
- x int
- y int
- direction text
- updated_at timestamptz

character_appearance
- character_id uuid primary key
- body_part_id int
- face_part_id int
- hair_part_id int
- coat_part_id int
- weapon_part_id int
- shield_part_id int
- mount_id int
- hair_palette_id int
- coat_palette_id int
- skin_palette_id int

character_progression_policy
- character_id uuid primary key
- exp_mode text -- adult_combat, kid_education
- allow_monster_exp boolean
- allow_education_exp boolean
```

## Static Game Data

```sql
maps
- id text primary key
- name text
- map_type text
- region_id text
- image_asset_id text
- width int
- height int
- source_json jsonb

map_edges
- id text primary key
- from_map_id text
- to_map_id text
- edge_type text
- metadata jsonb

portals
- id uuid primary key
- from_map_id text
- to_map_id text
- trigger_json jsonb
- arrival_json jsonb
- enabled boolean

tile_maps
- id uuid primary key
- map_id text
- width int
- height int
- format text
- storage_path text

collision_tiles
- id uuid primary key
- tile_map_id uuid
- x int
- y int
- passable boolean
- static_object_id int
```

## Monsters And Spawns

```sql
monster_templates
- id text primary key
- name text
- default_experience bigint
- client_mob_id int
- client_palette_id int
- provenance text
- enabled boolean

monster_stats
- monster_id text primary key
- hp bigint
- attack_min int
- attack_max int
- armor int
- hit int
- dodge int
- aggro_radius int
- ai_profile_id text

monster_spawns
- id uuid primary key
- map_id text
- monster_id text
- spawn_group text
- x int
- y int
- count int
- respawn_seconds int
- enabled boolean

monster_instances
- id uuid primary key
- map_instance_id uuid
- monster_id text
- spawn_id uuid
- hp bigint
- x int
- y int
- state text
- target_character_id uuid
- spawned_at timestamptz
- died_at timestamptz
```

## Items, Inventory, And Shops

```sql
item_templates
- id text primary key
- name text
- kind text
- icon_index int
- palette_id int
- stack_limit int
- equip_slot text
- enabled boolean

equipment_stats
- item_id text primary key
- weapon_damage_min int
- weapon_damage_max int
- armor int
- might int
- will int
- grace int
- required_level int
- required_path text

item_instances
- id uuid primary key
- item_id text
- owner_character_id uuid
- quantity int
- durability int
- bind_state text
- created_at timestamptz

character_inventory
- character_id uuid
- slot_index int
- item_instance_id uuid

character_equipment
- character_id uuid
- equip_slot text
- item_instance_id uuid

shops
- id uuid primary key
- map_id text
- npc_id uuid
- name text
- enabled boolean

shop_inventory
- id uuid primary key
- shop_id uuid
- item_id text
- price bigint
- stock_limit int
- restock_seconds int
- enabled boolean
```

## Skills And Effects

```sql
skills
- id text primary key
- name text
- path text
- level_number int
- mana_cost int
- aether_seconds int
- duration_raw text
- target text
- spell_type text
- enabled boolean

skill_requirements
- id text primary key
- skill_id text
- requirement_type text
- item_id text
- quantity int
- quest_id text

skill_effect_links
- id uuid primary key
- skill_id text
- client_effect_id int
- role text -- cast, projectile, impact, aura, trap, area
- target_mode text
- timing_offset_ms int
- duration_override_ms int
- confidence numeric
- method text
- status text
- notes text

character_skills
- character_id uuid
- skill_id text
- learned_at timestamptz

skill_cooldowns
- character_id uuid
- skill_id text
- available_at timestamptz

active_status_effects
- id uuid primary key
- character_id uuid
- source_character_id uuid
- skill_id text
- effect_type text
- expires_at timestamptz
- metadata jsonb
```

## Quests

```sql
quests
- id text primary key
- key text
- name text
- description text
- category text
- repeatable boolean
- cooldown_seconds int
- enabled boolean
- provenance text
- status text

quest_steps
- id text primary key
- quest_id text
- step_order int
- name text
- objective_type text -- talk, collect, kill, visit, craft, education
- objective_ref_id text
- required_count int
- map_id text
- npc_id uuid
- item_id text
- monster_id text
- next_step_id text

quest_requirements
- id uuid primary key
- quest_id text
- requirement_type text
- ref_id text
- quantity int
- operator text

quest_rewards
- id uuid primary key
- quest_id text
- reward_type text -- exp, item, skill, title, diamond_request, cosmetic
- ref_id text
- quantity int

character_quest_state
- character_id uuid
- quest_id text
- status text -- not_started, active, completed, failed
- current_step_id text
- progress_json jsonb
- started_at timestamptz
- completed_at timestamptz
```

## Ledgers

```sql
adult_exp_ledger
- id uuid primary key
- character_id uuid
- profile_id uuid
- source_type text -- monster, quest, admin_adjustment
- source_id text
- amount bigint
- map_id text
- created_at timestamptz
- metadata jsonb

monster_exp_ledger
- id uuid primary key
- character_id uuid
- monster_id text
- monster_instance_id uuid
- map_id text
- amount bigint
- party_id uuid
- created_at timestamptz

kid_education_exp_ledger
- id uuid primary key
- kid_profile_id uuid
- character_id uuid
- argantalab_event_id text
- education_quest_id text
- subject text
- skill_area text
- amount bigint
- occurred_at timestamptz
- synced_at timestamptz
- metadata jsonb

argantalab_diamond_mirror
- id uuid primary key
- argantalab_user_id text
- profile_id uuid
- balance bigint
- last_ledger_event_id text
- last_synced_at timestamptz
- checksum text

diamond_ledger_refs
- id uuid primary key
- profile_id uuid
- argantalab_event_id text
- event_type text
- amount bigint
- balance_after bigint
- source text -- always argantalab
- occurred_at timestamptz
- synced_at timestamptz

character_milestones
- id uuid primary key
- character_id uuid
- milestone_id text
- achieved_at timestamptz
- source_event_id uuid
- metadata jsonb
```

## Admin And Audit

```sql
gm_actions
- id uuid primary key
- gm_profile_id uuid
- action_type text
- entity_type text
- entity_id text
- before_json jsonb
- after_json jsonb
- created_at timestamptz

override_packs
- id uuid primary key
- name text
- status text -- draft, validating, published, archived
- created_by uuid
- published_by uuid
- created_at timestamptz
- published_at timestamptz

audit_findings
- id uuid primary key
- severity text
- category text
- entity_type text
- entity_id text
- message text
- status text
- created_at timestamptz

server_events
- id uuid primary key
- event_type text
- profile_id uuid
- character_id uuid
- metadata jsonb
- created_at timestamptz
```

