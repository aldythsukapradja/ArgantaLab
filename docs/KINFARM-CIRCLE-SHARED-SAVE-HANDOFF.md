# KinFarm Circle Shared Save Handoff

Date: 2026-07-06

## Goal

Make KinFarm have exactly one shared saved farm per KinetikCircle circle.

Today, two members in the same circle can open the farm and see different state. The intended behavior is:

- Same circle + same KinFarm game = same farm save.
- Different circle = different farm save.
- Standalone LashiraBloom games still keep personal per-user saves.

## Current Finding

KinetikCircle already passes the active circle id into the LashiraBloom iframe:

- `apps/kinetik/src/pages/Farm.tsx`
- Source URL shape: `/?embed=kinetik&circle=<activeCircleId>`

But LashiraBloom's game save bridge ignores that circle id:

- `apps/web/src/lib/circleBridge.ts`
- `saveState` calls `save_game_state(p_game, p_slot, p_data)`.
- `loadState` calls `load_game_state(p_game, p_slot)`.

The backing table is account-scoped:

- `supabase/schema.sql`
- `game_saves` primary key is `(user_id, game_id, slot)`.

So the circle id reaches the farm URL, but it never becomes the save owner. That is the disconnect.

## Battle Test Result

The solution is viable, but only if both layers change:

1. Database ownership must support `circle_id + game_id + slot`.
2. The LashiraBloom bridge must route saves to the circle RPC when `?circle=` exists.

Changing only KinetikCircle will not work, because it already sends the circle id.

Changing only the farm genre will not work reliably, because generated games are sandboxed and save through the parent bridge.

Changing only `game_saves` to include `circle_id` is risky, because personal saves and circle saves have different authorization rules. A separate `circle_game_saves` table is cleaner.

## Proposed Database Migration

Create a new migration, for example:

`supabase/migration_circle_game_saves.sql`

Recommended shape:

```sql
create table if not exists public.circle_game_saves (
  circle_id  uuid not null references public.circles(id) on delete cascade,
  game_id    text not null,
  slot       text not null default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (circle_id, game_id, slot)
);

alter table public.circle_game_saves enable row level security;

drop policy if exists circle_game_saves_member_rw on public.circle_game_saves;
create policy circle_game_saves_member_rw on public.circle_game_saves
  for all
  using (public.is_member(circle_id) or public.kinetik_is_member(circle_id))
  with check (public.is_member(circle_id) or public.kinetik_is_member(circle_id));
```

Important: if `public.kinetik_is_member` is not guaranteed in every environment, use one canonical helper. `public.is_member(p_circle uuid)` already exists in `supabase/migration_spine.sql`.

RPCs:

```sql
create or replace function public.save_circle_game_state(
  p_circle uuid,
  p_game text,
  p_slot text,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_member(p_circle) then raise exception 'not a member of this circle'; end if;

  insert into public.circle_game_saves(circle_id, game_id, slot, data, updated_by, updated_at)
  values (p_circle, p_game, coalesce(p_slot, 'default'), coalesce(p_data, '{}'::jsonb), auth.uid(), now())
  on conflict (circle_id, game_id, slot)
  do update set data = excluded.data, updated_by = auth.uid(), updated_at = now();

  return true;
end;
$$;

grant execute on function public.save_circle_game_state(uuid, text, text, jsonb) to authenticated;

create or replace function public.load_circle_game_state(
  p_circle uuid,
  p_game text,
  p_slot text default 'default'
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare v_data jsonb;
begin
  if auth.uid() is null then return null; end if;
  if not public.is_member(p_circle) then raise exception 'not a member of this circle'; end if;

  select data into v_data
  from public.circle_game_saves
  where circle_id = p_circle
    and game_id = p_game
    and slot = coalesce(p_slot, 'default');

  return v_data;
end;
$$;

grant execute on function public.load_circle_game_state(uuid, text, text) to authenticated;
```

## Proposed LashiraBloom Changes

File:

`apps/web/src/lib/circleBridge.ts`

Add circle id to the runtime context:

- Parse `new URLSearchParams(window.location.search).get('circle')`.
- Store it on `CircleCtx`, for example `circleId?: string | null`.
- Include it in `window.__CIRCLE__`.
- Make `handleCircleCall` receive the circle id, or resolve it from the URL.

Save routing:

```ts
case 'saveState': {
  const slot = String(args[0] ?? 'default')
  const data = args[1] ?? {}
  if (circleId) {
    await rpc('save_circle_game_state', {
      p_circle: circleId,
      p_game: gameId,
      p_slot: slot,
      p_data: data,
    })
    return true
  }
  await rpc('save_game_state', { p_game: gameId, p_slot: slot, p_data: data })
  return true
}

case 'loadState': {
  const slot = String(args[0] ?? 'default')
  if (circleId) {
    return await rpc('load_circle_game_state', {
      p_circle: circleId,
      p_game: gameId,
      p_slot: slot,
    })
  }
  return await rpc('load_game_state', { p_game: gameId, p_slot: slot })
}
```

Do not remove the existing personal save RPCs. They are still correct for standalone public games.

## Stable Game Id Requirement

Every circle member must hit the same `game_id`. If the embedded farm uses a changing generated-game id, the save will still fragment.

Recommended canonical id:

`builtin:kinfarm`

Check the embedded LashiraBloom entry route and make sure the farm launched from Kinetik always boots with that id.

## Autosave Decision

Current generated-game save behavior is manual:

- Player pauses.
- Player chooses a slot.
- `game.serialize()` is sent through the bridge.

The farm genre already supports serialization:

- `apps/web/src/engine/genres/farm.ts`
- `serialize()` saves coins, plots, unlocked plots, and harvest count.
- `restore()` hydrates that data.

For a first implementation, manual save is acceptable.

For the real shared-farm feeling, add debounced autosave after these farm actions:

- plant
- water
- harvest
- unlock plot

This probably belongs in the engine shell or bridge, not directly in the farm genre, so other sim genres can reuse it later.

## Test Matrix

Database tests:

1. User A is a member of Circle X.
2. User B is a member of Circle X.
3. User C is not a member of Circle X.
4. User A calls `save_circle_game_state(X, 'builtin:kinfarm', '1', dataA)`.
5. User B calls `load_circle_game_state(X, 'builtin:kinfarm', '1')` and gets `dataA`.
6. User C calls `load_circle_game_state(X, 'builtin:kinfarm', '1')` and is rejected.
7. User A saves Circle Y and confirm Circle X data is unchanged.

Frontend tests:

1. Open KinetikCircle as Player 1 in Aldyth's Family.
2. Open KinetikCircle as Player 2 in the same circle.
3. Player 1 plants crops, saves slot 1.
4. Player 2 reloads farm, continues slot 1, sees Player 1's farm.
5. Player 2 harvests, saves slot 1.
6. Player 1 reloads farm, sees the harvested state.
7. Switch to a different circle and confirm the farm starts separate/empty.

Regression tests:

1. Open a standalone public LashiraBloom game without `?circle=`.
2. Save and load still uses personal `game_saves`.
3. Leaderboards still work.
4. Offline/guest preview still falls back to local behavior.

Security tests:

1. Try to load a circle save while authenticated as a non-member.
2. Try to save with a forged `circle` URL param for a circle the user does not belong to.
3. Confirm RLS and RPC both block access.

## Risks and Mitigations

Risk: helper function mismatch.

Mitigation: standardize on `public.is_member(uuid)` for ArgantaLab and KinetikCircle shared tables.

Risk: save conflicts when two users save at the same time.

Mitigation: last write wins is acceptable for v1. Store `updated_by` and `updated_at` so the UI can later show who saved last.

Risk: users expect live sync while both windows are open.

Mitigation: v1 can be reload/continue based. v2 can add realtime subscription on `circle_game_saves` or autosave plus polling.

Risk: game id fragmentation.

Mitigation: hardcode/stabilize the KinFarm embedded game id to `builtin:kinfarm`.

## Implementation Order

1. Add `circle_game_saves` migration and RPCs.
2. Update `circleBridge.ts` to detect circle context and route save/load.
3. Ensure Kinetik Farm opens canonical KinFarm game id.
4. Build `apps/web`.
5. Build `apps/kinetik`.
6. Run the two-player manual test.
7. Optional: add debounced autosave.

## Acceptance Criteria

The implementation is done when:

- Two members of the same circle can share one farm save.
- Different circles do not share farm state.
- Non-members cannot read or write another circle's farm.
- Existing personal game saves still work without a circle id.
- The behavior matches the screenshot scenario: the left and right players in Aldyth's Family can see the same saved farm once they load the shared save.
