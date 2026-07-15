-- migration_memory_chunk_delete.sql — C5 (Sonnet). Additive: one new RPC on
-- the existing memory_chunk table (migration_arganta_core.sql, C2). Doesn't
-- touch any frozen column or table shape.
--
-- memory_chunk_upsert (C2) is insert-only despite its name — there was no
-- delete/replace path, so re-syncing an edited Vault note would accumulate
-- stale duplicate chunks forever instead of replacing them. This RPC clears
-- prior chunks for a given (source, ref) before a re-sync re-inserts fresh
-- ones — same operator-gated discipline as every other write on this table.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).

begin;

-- A long note splits into multiple chunks with refs 'noteId#1', 'noteId#2',
-- … (chunkNoteBody, vault/embed.ts) — the prefix match clears every chunk
-- from a prior sync (whatever chunk count it had) before fresh ones land,
-- so a note that shrinks from 3 chunks to 1 never leaves 2 stale orphans.
create or replace function public.memory_chunk_delete_by_ref(p_source text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not hq_is_operator() then raise exception 'operator only'; end if;
  delete from public.memory_chunk where source = p_source and (ref = p_ref or ref like p_ref || '#%');
end $$;

grant execute on function public.memory_chunk_delete_by_ref(text, text) to authenticated;

commit;

-- Rollback:
--   revoke execute on function public.memory_chunk_delete_by_ref(text, text) from authenticated;
--   drop function if exists public.memory_chunk_delete_by_ref(text, text);
