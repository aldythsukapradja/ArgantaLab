-- ============================================================================
-- Brand OS — the founder-lane store (BF-1)
-- ----------------------------------------------------------------------------
-- The Brand OS splits every BrandDoc across two stores, and that split IS the
-- governance rule (knowledge-base/brand/brand-os.md):
--
--   agent lane   → git: packages/brand/brands/<id>/brand.json + assets.
--                  Marks, palette, templates, KB. HQ renders these read-only;
--                  only Claude Code / Codex / MCP can change them.
--   founder lane → HERE: brand_registry.overlay jsonb.
--                  Voice, campaign spine, platform handles/bios/links,
--                  discovery copy. Edited live in Brand Forge.
--
-- @arganta/brand's resolveBrand() merges git base + this overlay. The overlay
-- must NEVER carry agent-lane fields — if it did, the DB would silently shadow
-- git and the two would fight. illegalOverlayPaths() enforces that in code; the
-- check constraint below is the backstop.
--
-- Run in the Supabase SQL editor (this project has no exec_sql RPC).
-- Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.brand_registry (
  brand_id    text primary key,
  overlay     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

comment on table public.brand_registry is
  'Founder-lane half of each BrandDoc (voice, spine, platform text, discovery copy). The agent lane lives in git at packages/brand/. See knowledge-base/brand/brand-os.md.';
comment on column public.brand_registry.overlay is
  'Founder-editable fields ONLY. Agent-lane keys (identity, kb, content, routing) are rejected — they belong in git.';

-- Backstop for the lane rule: the overlay may not carry agent-lane layers.
-- (Per-field rules for the mixed layers live in code — lanes.js — because they
-- need field-level knowledge; this catches the whole-layer mistakes.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'brand_overlay_founder_lane_only') then
    alter table public.brand_registry add constraint brand_overlay_founder_lane_only check (
      not (overlay ?| array['identity', 'kb', 'content', 'routing'])
    );
  end if;
end $$;

create or replace function public.touch_brand_registry() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists brand_registry_touch on public.brand_registry;
create trigger brand_registry_touch before insert or update on public.brand_registry
  for each row execute function public.touch_brand_registry();

-- RLS: every signed-in operator reads all brands (HQ is a single-operator
-- cockpit); writes are equally open to authenticated users. Tighten to an
-- operator role later if HQ ever gains more than one seat.
alter table public.brand_registry enable row level security;

drop policy if exists brand_read on public.brand_registry;
create policy brand_read on public.brand_registry for select to authenticated using (true);

drop policy if exists brand_write on public.brand_registry;
create policy brand_write on public.brand_registry for all to authenticated using (true) with check (true);

-- ── Seed ────────────────────────────────────────────────────────────────────
-- ONE-WAY seed of the founder lane from packages/brand/brands/argantalab/
-- seed.overlay.json (itself transcribed from the Instagram Profile Pack).
-- `on conflict do nothing` is deliberate: after the first run the DATABASE is
-- authoritative and the founder's edits must never be clobbered by a re-run.
insert into public.brand_registry (brand_id, overlay) values (
  'argantalab',
  '{
    "voice": {
      "persona": {
        "title": "The Lab",
        "speaksAs": "The account speaks as The Lab, not as the founder''s personal page.",
        "adjectives": ["inventive", "slightly mysterious", "encouraging", "always building"],
        "forbidden": ["corporate buzzwords", "fake traction", "exaggerated safety claims", "exaggerated learning claims", "generic AI-agency voice"]
      },
      "languages": ["en", "id"],
      "taglines": { "en": "Play. Learn. Build. Ship." },
      "boilerplates": {
        "en": {
          "w25": "ArgantaLab is the kid-powered creation studio inside Arganta: play learning games, build with AI-assisted tools, and publish what you make.",
          "w200": "ArgantaLab is the kid-powered creation studio inside Arganta. Children play learning games, explore six learning worlds, build games with AI-assisted tools, and publish what they make. KinQuest gives the experience a daily adventure loop, while the wider Arganta family system gives parents a trusted view of growth."
        }
      },
      "pitches": {
        "en": {
          "parent": "Games that teach. Tools that let kids create. Play, learn, build, ship — inside the Arganta family OS.",
          "kid": "A game studio you can actually use. Learn the skill. Build the game. Ship it."
        }
      },
      "pillars": [
        { "id": "play",  "label": "Play the world",  "description": "KinQuest, games and characters.",                    "accent": "#4D9FFF", "icon": "gamepad" },
        { "id": "learn", "label": "Learn the skill", "description": "Visible learning moments and challenges.",           "accent": "#34E5FF", "icon": "book" },
        { "id": "build", "label": "Build the thing", "description": "Creation process, prompts, tools and prototypes.",   "accent": "#8B5CF6", "icon": "code" },
        { "id": "ship",  "label": "Ship the result", "description": "Published games, player reactions and build logs.",  "accent": "#FF5EA0", "icon": "rocket" }
      ],
      "ctas": { "en": ["Enter the Lab", "Ship your first game", "Built in the Lab", "Adventure becomes learning."] }
    },
    "presence": {
      "instagram": {
        "handle": "argantalab",
        "name": "ArgantaLab · Play, Learn & Build",
        "category": "Education",
        "bio": "Kids play. Learn. Build. Ship. 🎮\nKinQuest + AI creation tools.\nPart of Arganta — the trusted family OS.\n↓ Enter the Lab",
        "link": "https://lab.arganta.app",
        "linkVerified": false,
        "pinned": [
          { "id": "start-here",        "label": "Start Here — the Play → Learn → Build → Ship loop" },
          { "id": "meet-kinquest",     "label": "Meet KinQuest — the RPG that turns lessons into adventure" },
          { "id": "what-parents-see",  "label": "What Parents See — growth and creations, not raw screen time" }
        ]
      }
    }
  }'::jsonb
) on conflict (brand_id) do nothing;
