-- v3 of the voice/gesture copilot registry — adds a per-command reply_voice
-- choice (JM/KF, the two Aura speakers already mapped in tts.ts) so the
-- control tab can offer "change the voice" per command. Run once, AFTER
-- migration_voice_commands.sql + migration_voice_commands_v2.sql.

begin;

alter table public.hq_voice_command
  add column if not exists reply_voice text not null default 'JM'
    check (reply_voice in ('JM','KF'));

commit;

-- Rollback:
--   alter table public.hq_voice_command drop column if exists reply_voice;
