-- LashiraBloom — "list the circles I belong to" (for the in-game circle selector
-- in Settings). The base `circles` table is owner-only under RLS (circles_own:
-- auth.uid() = owner_id), so a member who does NOT own a circle can't even SELECT
-- it. This SECURITY DEFINER function returns every circle the caller owns OR is a
-- member of, with a friendly name/kind/emoji + a live member count, so the game
-- can render a real chooser (not just the one bound circle it already knows).
--
-- Safe: read-only, returns only the caller's own circles (owner_id = auth.uid()
-- or an explicit circle_members row for auth.uid()); never leaks other people's.
-- Idempotent — run in Supabase project bdagdxgpnlialkppjwor.

create or replace function public.list_my_circles()
returns table (
  circle_id    uuid,
  name         text,
  kind         text,
  emoji        text,
  is_owner     boolean,
  member_count int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with mine as (
    -- circles I own
    select c.id, c.name, c.kind, c.emoji, true as is_owner
    from public.circles c
    where c.owner_id = auth.uid()
    union
    -- circles I'm an explicit member of (may or may not own)
    select c.id, c.name, c.kind, c.emoji, (c.owner_id = auth.uid()) as is_owner
    from public.circles c
    join public.circle_members m on m.circle_id = c.id
    where m.member_id = auth.uid()
  )
  select
    mine.id,
    coalesce(mine.name, 'Circle')   as name,
    coalesce(mine.kind, 'friends')  as kind,
    mine.emoji,
    bool_or(mine.is_owner)          as is_owner,
    (select count(*)::int from public.circle_members cm where cm.circle_id = mine.id) as member_count
  from mine
  group by mine.id, mine.name, mine.kind, mine.emoji
  -- owned circles first, then alphabetical
  order by bool_or(mine.is_owner) desc, coalesce(mine.name, 'Circle');
end;
$$;

grant execute on function public.list_my_circles() to authenticated;
