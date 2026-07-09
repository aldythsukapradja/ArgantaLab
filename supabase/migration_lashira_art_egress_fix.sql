-- ============================================================
--  LASHIRA PIXEL ART · egress fix (additive, idempotent)
--  Problem: apps/hq's art panel + the game's farm-art-runtime both SELECT the
--  full `image_data` (base64 PNG, can be tens–hundreds of KB) for every row on
--  every load — the panel does it on every mount AND after every save/delete;
--  the game does it on every boot. That's the dominant driver behind exceeding
--  the Supabase free-tier egress quota (Database → Reports → Egress).
--
--  Fix: a cheap generated `has_image` boolean lets the ADMIN PANEL's list view
--  ask "does this slot have custom art?" WITHOUT pulling the bytes — the full
--  image is now fetched only for the one slot actually being edited (see
--  artCloud.ts loadLashiraArtImage). The game's runtime keeps needing the real
--  bytes (it has to draw them) — that side is fixed with a fingerprint cache
--  instead (farm-art-runtime.js), no schema change needed there.
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

alter table public.lashira_pixel_art
  add column if not exists has_image boolean generated always as (image_data is not null) stored;

commit;
