-- ============================================================
--  ARGANTA STUDIO · game_scores — cloud leaderboards for
--  wizard-built games ("My Circle" tab in the in-game leaderboard).
--  Run in the Supabase SQL editor. Local play works without it;
--  the app degrades silently until this exists.
-- ============================================================

create table if not exists public.game_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  player_name text not null default 'Player',
  score integer not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_scores_game_idx on public.game_scores (game_id, score desc);
create index if not exists game_scores_user_idx on public.game_scores (user_id);

alter table public.game_scores enable row level security;

-- Anyone signed in can read scores (leaderboards are public inside the app).
drop policy if exists game_scores_read on public.game_scores;
create policy game_scores_read on public.game_scores
  for select to authenticated using (true);

-- You can only submit scores as yourself.
drop policy if exists game_scores_insert on public.game_scores;
create policy game_scores_insert on public.game_scores
  for insert to authenticated with check (auth.uid() = user_id);

-- Keep the table tidy: one row per submission is fine, but cap reads client-side.
