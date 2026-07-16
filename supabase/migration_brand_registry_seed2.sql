-- ============================================================================
-- Brand OS — founder-lane seed #2 (BS-0)
-- ----------------------------------------------------------------------------
-- migration_brand_registry.sql seeded ArgantaLab only. F1–F8 (Fable, 2026-07-16)
-- wrote the voice for the other four brands; this lands it so the Brand Studio
-- has something true to show for every world in the constellation.
--
-- Founder lane only (voice + presence text) — marks, palettes and templates stay
-- in git, per the two-lane rule. The check constraint from the first migration
-- rejects agent-lane keys, so this file physically cannot smuggle one in.
--
-- ONE-WAY: `on conflict do nothing`. If you have already edited a brand's voice
-- in HQ, re-running this must never clobber you.
--
-- Run in the Supabase SQL editor. Idempotent. Requires migration_brand_registry.sql.
-- ============================================================================

insert into public.brand_registry (brand_id, overlay) values

-- ── Arganta — the masterbrand + external gateway ──────────────
('arganta', '{
  "voice": {
    "persona": {
      "title": "The Gateway",
      "speaksAs": "Arganta speaks as the company: a founder showing you the workshop, not a fund pitching a thesis.",
      "adjectives": ["warm", "competent", "unhurried", "open"],
      "forbidden": ["venture-fund posturing", "incubator or accelerator claims", "invented traction", "category-leader claims"]
    },
    "languages": ["en", "id"],
    "taglines": { "en": "Grow together.", "id": "Tumbuh bersama." },
    "beliefHeadline": { "en": "Ideas deserve a beginning.", "id": "Setiap ide berhak untuk dimulai." },
    "boilerplates": {
      "en": {
        "w25": "Arganta is a family universe: learning games, creation tools and family rhythm apps that share one world, one economy and one promise — grow together.",
        "w50": "Arganta is a connected family universe built by a solo founder and an AI co-builder. Kids play and learn in ArgantaLab, families find their rhythm in Kinetik Circle, and everyone grows a shared world in LashiraBloom — one account, one economy, one promise: grow together."
      },
      "id": {
        "w25": "Arganta adalah semesta keluarga: game edukasi, alat berkarya, dan aplikasi ritme keluarga yang berbagi satu dunia, satu ekonomi, satu janji — tumbuh bersama."
      }
    },
    "pillars": [
      { "id": "open",   "label": "Build in the Open", "description": "The build log is the pitch.",        "accent": "#3DE08A", "icon": "hammer" },
      { "id": "universe","label": "One Universe",      "description": "Five worlds, one account.",         "accent": "#34E5FF", "icon": "orbit" },
      { "id": "signal", "label": "Founder Signal",     "description": "Decisions, honestly.",              "accent": "#8B5CF6", "icon": "radar" },
      { "id": "wins",   "label": "Family Wins",        "description": "Real moments from the products.",   "accent": "#FFC24B", "icon": "heart" }
    ],
    "ctas": { "en": ["Explore Arganta", "Build with Arganta", "Partner with Arganta"], "id": ["Jelajahi Arganta", "Bangun bersama Arganta"] },
    "hashtags": { "branded": ["#arganta", "#growtogether"], "category": ["#familyos", "#buildinpublic"], "community": ["#indiedev", "#solofounder"] },
    "touchyRules": ["Show the workshop, not the roadmap", "Name the gap before someone else does"]
  },
  "presence": {
    "instagram": { "bio": "One family universe. Play, learn, plan & build — together. 🌱 ArgantaLab · Kinetik Circle · LashiraBloom ↓", "link": "https://www.arganta.app", "linkVerified": false }
  }
}'::jsonb),

-- ── Kinetik Circle — family rhythm ────────────────────────────
('kinetikcircle', '{
  "voice": {
    "persona": {
      "title": "The Circle",
      "speaksAs": "Kinetik Circle speaks as the calm friend who already has the plan — never a boss, never a tracker.",
      "adjectives": ["calm", "warm", "organised", "unbossy"],
      "forbidden": ["tracking or surveillance framing", "guilt-tripping", "accountability language", "chaos-shaming"]
    },
    "languages": ["en", "id"],
    "taglines": { "en": "Family life, in rhythm.", "id": "Ritme keluarga, dalam genggaman." },
    "beliefHeadline": { "en": "A family isn''t managed. It''s in rhythm.", "id": "Keluarga bukan diatur — tapi seirama." },
    "boilerplates": {
      "en": { "w25": "Kinetik Circle keeps a household in rhythm: plans, people and moments in one calm place — built on participation, never tracking." },
      "id": { "w25": "Kinetik Circle menjaga ritme rumah: rencana, orang, dan momen dalam satu tempat yang tenang — dibangun atas partisipasi, bukan pelacakan." }
    },
    "pillars": [
      { "id": "week",    "label": "The Week Together", "description": "The rhythm, not the rules.",       "accent": "#22D3EE", "icon": "calendar" },
      { "id": "wins",    "label": "Small Family Wins", "description": "The moments worth keeping.",       "accent": "#3DE08A", "icon": "heart" },
      { "id": "rhythm",  "label": "Rhythm not Rules",  "description": "Participation over surveillance.", "accent": "#8B5CF6", "icon": "activity" }
    ],
    "ctas": { "en": ["Start your circle", "Bring the week together"], "id": ["Mulai lingkaranmu", "Satukan minggumu"] },
    "hashtags": { "branded": ["#kinetikcircle"], "category": ["#familycalendar", "#familyrhythm"], "community": ["#parentinghacks", "#familylife"] },
    "touchyRules": ["Show one real family moment, never a stock family", "Never imply the parent is failing"]
  },
  "presence": {
    "instagram": { "bio": "Plans, people & moments — family life, in rhythm. 🧭 No tracking, just together. Part of Arganta. ↓", "link": "https://circle.arganta.app", "linkVerified": false }
  }
}'::jsonb),

-- ── LashiraBloom — the shared world ───────────────────────────
('lashirabloom', '{
  "voice": {
    "persona": {
      "title": "The Valley",
      "speaksAs": "LashiraBloom speaks as a storybook narrator at dusk — in-world, gentle, never a grind-game announcer.",
      "adjectives": ["cozy", "unhurried", "wondering", "in-world"],
      "forbidden": ["grind mechanics language", "FOMO or streak pressure", "pay-to-win framing", "shouty announcer voice"]
    },
    "languages": ["en", "id"],
    "taglines": { "en": "Grow a world together.", "id": "Tumbuhkan dunia bersama." },
    "beliefHeadline": { "en": "Some worlds you visit. This one you grow.", "id": "Ada dunia yang dikunjungi. Yang ini ditumbuhkan." },
    "boilerplates": {
      "en": { "w25": "LashiraBloom is the cozy farm a whole family returns to — adults play, kids learn, and the same world blooms for everyone." },
      "id": { "w25": "LashiraBloom adalah ladang hangat tempat keluarga pulang — orang tua bermain, anak belajar, dan dunia yang sama ikut tumbuh." }
    },
    "pillars": [
      { "id": "diary",   "label": "Farm Diary",   "description": "What grew this week.",            "accent": "#65a30d", "icon": "sprout" },
      { "id": "kins",    "label": "Meet the Kins", "description": "The characters of the valley.",  "accent": "#f0a83a", "icon": "users" },
      { "id": "seasons", "label": "Seasons",      "description": "The world keeps its own time.",   "accent": "#6a4df5", "icon": "sun" }
    ],
    "ctas": { "en": ["Plant something today", "Come home to the farm"], "id": ["Tanam sesuatu hari ini", "Pulang ke ladang"] },
    "hashtags": { "branded": ["#lashirabloom"], "category": ["#cozygames", "#farminggame"], "community": ["#cozygamer", "#familygaming"] },
    "touchyRules": ["Show a real family''s farm, not a promo render", "Let the world speak — never sell the mechanics"]
  },
  "presence": {
    "instagram": { "bio": "The cozy farm your family returns to. 🌾 Adults play, kids learn, one world blooms. Part of Arganta. ↓", "link": "https://bloom.arganta.app", "linkVerified": false }
  }
}'::jsonb),

-- ── Circle HQ — internal only ─────────────────────────────────
('circlehq', '{
  "voice": {
    "persona": {
      "title": "The Cockpit",
      "speaksAs": "Circle HQ speaks as a precise chief of staff. Internal only — HQ is never marketed publicly.",
      "adjectives": ["precise", "calm", "unsentimental", "honest about provenance"],
      "forbidden": ["marketing tone", "hype", "selling HQ by agent or surface count", "presenting simulated numbers as measured"]
    },
    "languages": ["en"],
    "taglines": { "en": "Complexity into clarity." },
    "beliefHeadline": { "en": "Five products. One cockpit." },
    "boilerplates": { "en": { "w25": "Circle HQ is the founder operating system behind Arganta: signals, decisions, creation and governance for a five-product company, in one internal cockpit." } },
    "pillars": [
      { "id": "signals",  "label": "Signals",  "description": "Measured, never simulated.", "accent": "#3798FF", "icon": "radar" },
      { "id": "decisions","label": "Decisions","description": "Recorded, with provenance.", "accent": "#22D3EE", "icon": "scale" },
      { "id": "creation", "label": "Creation", "description": "The studios and forges.",    "accent": "#8B5CF6", "icon": "hammer" }
    ],
    "ctas": { "en": ["Record the decision", "Open the cockpit"] },
    "hashtags": {},
    "touchyRules": ["Internal surface — no public account, ever", "A green check beats a celebration"]
  }
}'::jsonb)

on conflict (brand_id) do nothing;

-- ── ArgantaLab addendum ─────────────────────────────────────────────────────
-- ArgantaLab was seeded by the FIRST migration, before F1 wrote the belief
-- headlines (Act II of every brand's book) and before the ID tagline existed.
-- Its row therefore already exists and `on conflict do nothing` above skips it.
--
-- These two statements add ONLY the missing keys, and each is guarded by a
-- `not ... ? key` check: if the founder has already written their own belief
-- headline in HQ, this is a no-op. Additive, idempotent, never clobbering.
update public.brand_registry
   set overlay = jsonb_set(overlay, '{voice,beliefHeadline}',
        '{"en":"Kids don''t need another screen. They need a workshop.",
          "id":"Anak tidak butuh layar lagi. Mereka butuh bengkel karya."}'::jsonb, true)
 where brand_id = 'argantalab'
   and not (coalesce(overlay->'voice', '{}'::jsonb) ? 'beliefHeadline');

update public.brand_registry
   set overlay = jsonb_set(overlay, '{voice,taglines,id}', '"Main. Belajar. Bikin. Rilis."'::jsonb, true)
 where brand_id = 'argantalab'
   and not (coalesce(overlay->'voice'->'taglines', '{}'::jsonb) ? 'id');
