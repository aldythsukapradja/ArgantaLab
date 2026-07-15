-- Voice/gesture copilot command registry — lets Circle HQ's Landing copilot
-- read its command set from the DB instead of hardcoded code, so commands can
-- be added / removed / re-worded without a deploy. Run once in the ArgantaLab
-- Supabase project (bdagdxgpnlialkppjwor).
--
-- Security posture (mirrors migration_video_assets.sql):
--   • hq_voice_command: PUBLIC READ (commands carry no secrets; the landing
--     page is operator-facing but the list itself is harmless), OPERATOR WRITE.
--   • action_kind is a CLOSED enum mapped to real app functions in code — a
--     row can only ever remap to an action the app already exposes, never
--     inject behaviour. The DB stores data, not executable code.
--   • voice-replies bucket: PUBLIC READ (cached Aura mp3s), OPERATOR WRITE.

begin;

-- ── operator guard ─────────────────────────────────────────────────────────
create or replace function public.copilot_is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce((auth.jwt() ->> 'email'), '')) = 'aldhyt.sukapradja@gmail.com'
$$;

-- ── command table ──────────────────────────────────────────────────────────
create table if not exists public.hq_voice_command (
  id                uuid primary key default gen_random_uuid(),
  intent_id         text not null unique,                 -- stable id, e.g. 'open-product-lashira'
  category          text not null default 'navigate'
                      check (category in ('navigate','product','control','system')),
  label             text not null,                        -- cheat-sheet + command-flash label
  phrases           text[] not null default '{}',         -- trigger phrases (substring match)
  reply_text        text not null default '',             -- what Jarvis says back
  action_kind       text not null
                      check (action_kind in (
                        'go','openProduct','openPalette','toggleTheme','toggleAgent',
                        'playCinema','close','refresh','disarm','help')),
  action_arg        text,                                 -- e.g. 'lashira' / 'portfolio' (nullable)
  gesture           text,                                 -- optional cheat-sheet gesture note ('swipe'|'pinch')
  reply_audio_path  text,                                 -- cached Aura mp3 in voice-replies bucket (nullable)
  enabled           boolean not null default true,
  sort              int not null default 100,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists hq_voice_command_sort_idx on public.hq_voice_command (enabled, sort);

alter table public.hq_voice_command enable row level security;

drop policy if exists hq_voice_command_read on public.hq_voice_command;
create policy hq_voice_command_read on public.hq_voice_command for select using (true);

drop policy if exists hq_voice_command_write on public.hq_voice_command;
create policy hq_voice_command_write on public.hq_voice_command
  for all using (public.copilot_is_operator()) with check (public.copilot_is_operator());

grant execute on function public.copilot_is_operator() to authenticated, anon;

-- ── cached-reply storage bucket ────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('voice-replies', 'voice-replies', true, 5242880)   -- 5MB is plenty for short mp3 lines
on conflict (id) do nothing;

drop policy if exists voice_replies_read on storage.objects;
create policy voice_replies_read on storage.objects
  for select using (bucket_id = 'voice-replies');

drop policy if exists voice_replies_insert on storage.objects;
create policy voice_replies_insert on storage.objects
  for insert with check (bucket_id = 'voice-replies' and public.copilot_is_operator());

drop policy if exists voice_replies_update on storage.objects;
create policy voice_replies_update on storage.objects
  for update using (bucket_id = 'voice-replies' and public.copilot_is_operator());

drop policy if exists voice_replies_delete on storage.objects;
create policy voice_replies_delete on storage.objects
  for delete using (bucket_id = 'voice-replies' and public.copilot_is_operator());

-- ── seed the canonical command set ─────────────────────────────────────────
-- Mirrors SEED_ROWS in apps/hq/src/copilot/intents.ts. Idempotent: re-running
-- updates wording/phrases but preserves any reply_audio_path already generated.
insert into public.hq_voice_command (intent_id, category, label, phrases, reply_text, action_kind, action_arg, gesture, sort) values
  ('wake',                 'system',   'Wake Jarvis',        array['hey arganta','hey jarvis'],           'Yes?',                       'toggleAgent', null,        null,    10),
  ('help',                 'system',   'Show commands',      array['help','what can i say','show commands'],'Here is what you can say.', 'help',        null,        null,    20),
  ('open-portfolio',       'navigate', 'Open Portfolio',     array['open portfolio'],                     'Opening Portfolio.',         'go',          'portfolio', null,    30),
  ('open-growth',          'navigate', 'Open Analytics',     array['open growth','open analytics'],        'Opening Analytics.',        'go',          'growth',    null,    40),
  ('open-command',         'navigate', 'Open Command',       array['open command'],                       'Opening Command.',           'go',          'command',   null,    50),
  ('open-build',           'navigate', 'Open Build',         array['open build','open game builder'],      'Opening Build.',            'go',          'game',      null,    60),
  ('open-media',           'navigate', 'Open Media Center',  array['open media center','open media'],      'Opening Media Center.',     'go',          'media',     null,    70),
  ('open-vault',           'navigate', 'Open Vault',         array['open vault'],                         'Opening the Vault.',         'go',          'vault',     null,    80),
  ('open-menu',            'system',   'Open menu',          array['open menu','search'],                 'Menu.',                      'openPalette', null,        null,    90),
  ('theme',                'control',  'Switch theme',       array['dark mode','light mode','switch theme'],'Switching theme.',          'toggleTheme', null,        null,   100),
  ('refresh',              'control',  'Refresh signals',    array['refresh signals','refresh'],           'Refreshing signals.',       'refresh',     null,        null,   110),
  ('play-cinema',          'control',  'Play cinematic',     array['activate'],                           'Activating.',                'playCinema',  null,        null,   120),
  ('close',                'control',  'Close',              array['close this','close it','close','go back'],'Closing.',               'close',       null,        'pinch', 130),
  ('stop',                 'control',  'Stop listening',     array['stop listening','cancel'],             'Standing by.',              'disarm',      null,        null,   140),
  ('open-product-lashira', 'product',  'Open Lashira Bloom', array['open lashirabloom','open lashira'],    'Opening Lashira Bloom.',    'openProduct', 'lashira',   'swipe', 150),
  ('open-product-kinetik', 'product',  'Open KinetikCircle', array['open kinetikcircle','open kinetik'],   'Opening KinetikCircle.',    'openProduct', 'kinetik',   'swipe', 160),
  ('open-product-hq',      'product',  'Open HQ',            array['open hq'],                            'Opening HQ.',                'openProduct', 'hq',        'swipe', 170),
  ('open-product-landing', 'product',  'Open Landing',       array['open landing'],                       'Opening Landing.',           'openProduct', 'landing',   'swipe', 180),
  ('open-product-arganta', 'product',  'Open ArgantaLab',    array['open argantalab','open arganta'],      'Opening ArgantaLab.',       'openProduct', 'arganta',   'swipe', 190)
on conflict (intent_id) do update set
  category = excluded.category, label = excluded.label, phrases = excluded.phrases,
  reply_text = excluded.reply_text, action_kind = excluded.action_kind,
  action_arg = excluded.action_arg, gesture = excluded.gesture, sort = excluded.sort,
  updated_at = now();

commit;

-- Rollback:
--   drop table if exists public.hq_voice_command;
--   drop function if exists public.copilot_is_operator();
--   delete from storage.buckets where id = 'voice-replies';
--   drop policy if exists voice_replies_read on storage.objects;
--   drop policy if exists voice_replies_insert on storage.objects;
--   drop policy if exists voice_replies_update on storage.objects;
--   drop policy if exists voice_replies_delete on storage.objects;
