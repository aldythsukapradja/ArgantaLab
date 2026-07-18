-- Live calendar sync: let Arganta Chat receive realtime change events for the
-- family calendar, so an edit made in KinetikCircle appears in the chat instantly
-- (and vice-versa). Without this the chat still updates on its own edits via
-- refetch — this only adds the cross-app push. Safe to run more than once.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.kinetik_events'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.kinetik_routines'; exception when duplicate_object then null; end;
end $$;
