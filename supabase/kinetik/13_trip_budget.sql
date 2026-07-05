-- Trip planned budget (separate from actual logged expenses)
alter table public.kinetik_trip add column if not exists budget numeric;
