-- migration_post_library.sql — B4, the Post Library.
-- Every finished post, kept: the full PostDoc, a readable summary, and the trail
-- of where and when it was published. Post Studio's Library panel reads/writes
-- it; nothing else does.
--
-- Run in the ArgantaLab Supabase project (bdagdxgpnlialkppjwor).
-- Additive only — no existing table is touched.
--
-- THE RULE THIS TABLE ENFORCES: a post that has been published is immutable.
-- Not "shouldn't be edited" — CANNOT be. Once `published` has an entry, `locked`
-- flips true and the trigger below rejects any further UPDATE to the content.
-- Saving a change to a published post is an INSERT of a new row (the app does
-- this and links it via `derived_from`), never an overwrite. The reason is
-- archival honesty: the doc in this row is the doc that went out. If a later
-- edit could rewrite it, the library would quietly start lying about what was
-- actually posted, and it would do so exactly when it matters — at audit time.

create table if not exists post_library (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled post',
  doc           jsonb not null,                       -- the complete PostDoc, verbatim
  summary       text,                                 -- caption hook + per-slide headlines
  meta          jsonb not null default '{}'::jsonb,   -- {format, palette, brandId, fontId, slideCount, hashtags}
  published     jsonb not null default '[]'::jsonb,   -- [{dest,label,postId,at}] — moment|buffer|feed|export
  locked        boolean not null default false,       -- true once published is non-empty
  derived_from  uuid references post_library (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists post_library_created_idx on post_library (created_at desc);
create index if not exists post_library_locked_idx on post_library (locked);

-- Keep `locked` honest: it is derived from `published`, never set by hand. A
-- client that "forgot" to lock a published row would defeat the whole rule, so
-- the database decides.
create or replace function post_library_lock_guard() returns trigger as $$
begin
  new.locked := (jsonb_array_length(coalesce(new.published, '[]'::jsonb)) > 0);
  new.updated_at := now();

  if tg_op = 'UPDATE' and old.locked then
    -- Appending publish results to an already-published post is legitimate (the
    -- same post can go to a moment today and Buffer tomorrow). Changing what the
    -- post IS, is not.
    if new.doc is distinct from old.doc
       or new.title is distinct from old.title
       or new.summary is distinct from old.summary
       or new.meta is distinct from old.meta then
      raise exception 'post_library: % is published and immutable — save it as a new row instead of editing it', old.id
        using hint = 'INSERT a new row with derived_from = the published row''s id.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists post_library_lock_guard_t on post_library;
create trigger post_library_lock_guard_t
  before insert or update on post_library
  for each row execute function post_library_lock_guard();

alter table post_library enable row level security;

-- Operator-only, same gate as content_draft and every other HQ table.
drop policy if exists post_library_operator_all on post_library;
create policy post_library_operator_all on post_library
  for all using (hq_is_operator()) with check (hq_is_operator());

grant select, insert, update, delete on post_library to authenticated;
