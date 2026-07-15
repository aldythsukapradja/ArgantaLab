-- v2 of the voice/gesture copilot registry — expands action_kind to cover
-- sub-nav switching (Command offices, Data tabs, Builder sub-tabs, product
-- inspector view) and seeds the 17 previously-unreachable surfaces + the
-- switching commands. Run once, AFTER migration_voice_commands.sql, in the
-- ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
--
-- Mirrors the SEED_ROWS additions in apps/hq/src/copilot/intents.ts — keep
-- both in sync. Idempotent: safe to re-run.

begin;

-- ── widen the action_kind enum ─────────────────────────────────────────────
alter table public.hq_voice_command drop constraint if exists hq_voice_command_action_kind_check;
alter table public.hq_voice_command add constraint hq_voice_command_action_kind_check
  check (action_kind in (
    'go','openProduct','openPalette','toggleTheme','toggleAgent',
    'playCinema','close','refresh','disarm','help',
    'goOffice','openDataTab','openBuilderSub','setProductView'
  ));

-- ── seed the 17 previously-unreachable surfaces + go-home ──────────────────
insert into public.hq_voice_command (intent_id, category, label, phrases, reply_text, action_kind, action_arg, sort) values
  ('go-home',               'navigate', 'Go home',                array['go home','go to the orb','show the orb'],       'Heading home.',              'go', 'home',         200),
  ('open-data',             'navigate', 'Open Data',              array['open data'],                                    'Opening Data.',              'go', 'data',         210),
  ('open-content',          'navigate', 'Open Learn Builder',     array['open learn builder','open learn'],              'Opening Learn Builder.',     'go', 'content',      220),
  ('open-app',              'navigate', 'Open App Builder',       array['open app builder'],                             'Opening App Builder.',       'go', 'app',          230),
  ('open-agents',           'navigate', 'Open Agent Builder',     array['open agent builder','open agents'],             'Opening Agent Builder.',     'go', 'agents',       240),
  ('open-broadcast',        'navigate', 'Open Content Builder',   array['open content builder'],                         'Opening Content Builder.',   'go', 'broadcast',    250),
  ('open-pixel',            'navigate', 'Open Pixel Vault',       array['open pixel vault','open pixel'],                'Opening Pixel Vault.',       'go', 'pixel',        260),
  ('open-architecture',     'navigate', 'Open Architecture',      array['open architecture'],                            'Opening Architecture.',      'go', 'architecture', 270),
  ('open-battle',           'navigate', 'Open Battle Builder',    array['open battle builder','open battle'],            'Opening Battle Builder.',    'go', 'battle',       280),
  ('open-character',        'navigate', 'Open Character Forge',   array['open character forge','open character'],       'Opening Character Forge.',   'go', 'character',    290),
  ('open-world',            'navigate', 'Open Openworld Builder', array['open openworld builder','open world builder','open world'], 'Opening Openworld Builder.', 'go', 'world', 300),
  ('open-music',            'navigate', 'Open Music Builder',     array['open music builder','open music'],              'Opening Music Builder.',     'go', 'music',        310),
  ('open-video',            'navigate', 'Open Video Builder',     array['open video builder','open video'],              'Opening Video Builder.',     'go', 'video',        320),
  ('open-knowledge',        'navigate', 'Open Knowledge',         array['open knowledge'],                               'Opening Knowledge.',         'go', 'knowledge',    330),
  ('open-cinema-surface',   'navigate', 'Open Cinema Editor',     array['open cinema editor','open cinema builder'],     'Opening the Cinema editor.', 'go', 'cinema',       340),
  ('open-reactor',          'navigate', 'Open Reactor Builder',   array['open reactor builder','open reactor'],          'Opening Reactor Builder.',   'go', 'reactor',      350),
  ('open-rack',             'navigate', 'Open Model Rack',        array['open model rack','open rack'],                  'Opening Model Rack.',        'go', 'rack',         360)
on conflict (intent_id) do update set
  category = excluded.category, label = excluded.label, phrases = excluded.phrases,
  reply_text = excluded.reply_text, action_kind = excluded.action_kind,
  action_arg = excluded.action_arg, sort = excluded.sort, updated_at = now();

-- ── seed the sub-nav switching commands ─────────────────────────────────────
insert into public.hq_voice_command (intent_id, category, label, phrases, reply_text, action_kind, action_arg, sort) values
  ('office-bridge',      'control', 'Command · Bridge',            array['open bridge office','open bridge'],           'Bridge office.',       'goOffice',      'bridge',          400),
  ('office-operations',  'control', 'Command · Operations',        array['open operations office','open operations'],   'Operations office.',   'goOffice',      'operations',      410),
  ('office-technology',  'control', 'Command · Technology',        array['open technology office','open technology'],   'Technology office.',   'goOffice',      'technology',      420),
  ('office-treasury',    'control', 'Command · Treasury',          array['open treasury office','open treasury'],       'Treasury office.',     'goOffice',      'treasury',        430),
  ('office-legal',       'control', 'Command · Legal',             array['open legal office','open legal'],             'Legal office.',        'goOffice',      'legal',           440),
  ('office-roster',      'control', 'Command · Roster',            array['open roster','show roster'],                  'Roster.',              'goOffice',      'roster',          450),

  ('data-schema',        'control', 'Data · Schema',                array['show schema','open schema'],                 'Schema.',              'openDataTab',   'schema',          460),
  ('data-tables',        'control', 'Data · Tables',                array['show tables','open tables'],                 'Tables.',              'openDataTab',   'tables',          470),
  ('data-ontology',      'control', 'Data · Ontology',              array['show ontology','open ontology'],             'Ontology.',            'openDataTab',   'ontology',        480),

  ('game-studio',        'control', 'Game Builder · Studio',        array['open game studio','show game studio'],       'Game studio.',         'openBuilderSub','game:studio',    490),
  ('game-analytics',     'control', 'Game Builder · Analytics',     array['show game analytics','open game analytics'], 'Game analytics.',      'openBuilderSub','game:analytics', 500),
  ('app-studio',         'control', 'App Builder · Studio',         array['open app studio','show app studio'],         'App studio.',          'openBuilderSub','app:studio',     510),
  ('app-analytics',      'control', 'App Builder · Analytics',      array['show app analytics','open app analytics'],   'App analytics.',       'openBuilderSub','app:analytics',  520),

  ('view-overview',      'control', 'Product view · Overview',      array['show overview'],                             'Overview.',            'setProductView','overview',       530),
  ('view-desktop',       'control', 'Product view · Desktop',       array['show desktop'],                              'Desktop.',             'setProductView','desktop',        540),
  ('view-mobile',        'control', 'Product view · Mobile',        array['show mobile'],                               'Mobile.',              'setProductView','mobile',         550)
on conflict (intent_id) do update set
  category = excluded.category, label = excluded.label, phrases = excluded.phrases,
  reply_text = excluded.reply_text, action_kind = excluded.action_kind,
  action_arg = excluded.action_arg, sort = excluded.sort, updated_at = now();

commit;

-- Rollback:
--   delete from public.hq_voice_command where sort >= 200;
--   alter table public.hq_voice_command drop constraint if exists hq_voice_command_action_kind_check;
--   alter table public.hq_voice_command add constraint hq_voice_command_action_kind_check
--     check (action_kind in ('go','openProduct','openPalette','toggleTheme','toggleAgent',
--       'playCinema','close','refresh','disarm','help'));
