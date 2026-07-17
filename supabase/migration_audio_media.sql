-- ============================================================
--  CIRCLE HQ · AUDIO MEDIA LIBRARY  (additive, idempotent)
--  S1 Audio Studio — the single source of truth for entire-Arganta AUDIO
--  (music · sfx · voice). Distinct from audio_library (that is the game-tuning
--  override table). Binaries live in a PRIVATE Storage bucket (audio-artifacts);
--  one row per audio asset here. Mirrors the pixel_ingest posture exactly.
--
--  Producers: the media-gen MCP (ComfyUI ACE-Step music, future SFX/voice) via
--  the service key; the HQ Audio Studio "Record" button via the admin session.
--  Consumers: Video Studio timeline, Post Studio reels, Cinema, game publish.
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

create table if not exists public.audio_asset (
  id           text primary key,               -- audio.<kind>.<slug>-<shortid>
  name         text not null,
  kind         text not null default 'music',  -- music | sfx | voice | anthem
  prompt       text,                            -- tags/brief that produced it
  voice_id     text,                            -- for kind=voice → voice_profile id
  duration_sec numeric,
  mime         text not null default 'audio/flac',
  bytes        bigint,
  provider     text,                            -- 'comfyui-acestep' | 'browser-record' | …
  model        text,
  tags         jsonb not null default '[]',
  storage_path text not null,                   -- object path in audio-artifacts bucket (REQUIRED)
  source_ref   text,                            -- e.g. music theme realm, cinema scene id
  status       text not null default 'ready',   -- ready | archived
  created_at   timestamptz not null default now()
);
alter table public.audio_asset enable row level security;
create index if not exists audio_asset_kind_idx    on public.audio_asset (kind);
create index if not exists audio_asset_created_idx on public.audio_asset (created_at desc);

drop policy if exists audio_asset_read  on public.audio_asset;
drop policy if exists audio_asset_write on public.audio_asset;
-- any signed-in user reads (games/consumers need it); admins write from client;
-- the MCP writes with the service key (bypasses RLS).
create policy audio_asset_read  on public.audio_asset for select using (auth.uid() is not null);
create policy audio_asset_write on public.audio_asset for all    using (public.is_admin()) with check (public.is_admin());

-- PRIVATE storage bucket for the audio binaries
insert into storage.buckets (id, name, public)
values ('audio-artifacts', 'audio-artifacts', false)
on conflict (id) do nothing;

drop policy if exists audio_artifacts_read  on storage.objects;
drop policy if exists audio_artifacts_write on storage.objects;
create policy audio_artifacts_read  on storage.objects for select
  using (bucket_id = 'audio-artifacts' and auth.uid() is not null);
create policy audio_artifacts_write on storage.objects for all
  using (bucket_id = 'audio-artifacts' and public.is_admin())
  with check (bucket_id = 'audio-artifacts' and public.is_admin());

-- ── voice profile registry — the centralized voice home (S1) ────────────────
-- Copilot control (52 commands) and Cinema (46 scenes) resolve voices BY ID
-- from here instead of hard-coding JM/KF. Sovereign-only: engine is a browser
-- preset or local ComfyUI TTS; no billing engines seeded.
create table if not exists public.voice_profile (
  id          text primary key,                 -- 'jarvis' | 'lady' | (later) 'founder'
  name        text not null,                    -- display, e.g. 'JM · Jarvis'
  engine      text not null default 'browser',  -- browser | comfy-tts (never a paid engine by default)
  accent      text,                             -- 'en-GB' …
  gender      text,                             -- 'male' | 'female' | 'neutral'
  sample_path text,                             -- reference sample in audio-artifacts (for cloning engines)
  params      jsonb not null default '{}',      -- { rate, pitch, browserVoiceHint, … }
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.voice_profile enable row level security;
drop policy if exists voice_profile_read  on public.voice_profile;
drop policy if exists voice_profile_write on public.voice_profile;
create policy voice_profile_read  on public.voice_profile for select using (auth.uid() is not null);
create policy voice_profile_write on public.voice_profile for all    using (public.is_admin()) with check (public.is_admin());

-- seed the two sovereign assistant voices (Jarvis-style British male + British lady).
-- NOTE: 'jarvis' is a STYLE (calm RP assistant), not a clone of any actor's voice.
insert into public.voice_profile (id, name, engine, accent, gender, params, sort) values
  ('jarvis', 'JM · Jarvis', 'browser', 'en-GB', 'male',   '{"rate":0.98,"pitch":0.92,"browserVoiceHint":"en-GB male"}', 1),
  ('lady',   'KF · Lady',   'browser', 'en-GB', 'female', '{"rate":1.0,"pitch":1.05,"browserVoiceHint":"en-GB female"}', 2)
on conflict (id) do nothing;

commit;
