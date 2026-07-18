-- Tri-Brain: record which agent ran each Bridge mission (claude | codex).
-- Safe to run anytime; the Bridge's persist.ts already writes missions without
-- this column and only starts sending `engine` once it exists.
alter table public.mission
  add column if not exists engine text not null default 'claude';

comment on column public.mission.engine is 'Which Bridge engine ran the mission: claude | codex';
