-- ============================================================
--  KINETIK · SEED  (run AFTER 01_schema.sql)
--  Real data for Aldyth's Family.
--  Idempotent: re-running upserts the same rows.
--
--  Uses the EXISTING `circles` table (not a new one).
--  Circle UUID is fixed so re-runs stay idempotent.
-- ============================================================

-- ── 1. Insert / update the family circle into the EXISTING circles table ──
-- owner_id is looked up by email so this is safe across environments.
insert into public.circles (id, owner_id, name, kind, accent) values
  ('a1d00001-0000-0000-0000-000000000001'::uuid,
   (select id from public.profiles where email = 'aldhyt.sukapradja@gmail.com'),
   'Sukapradja Family', 'family', '#F43F5E')
on conflict (id) do update set
  name   = excluded.name,
  accent = excluded.accent;

-- ── 2. People ─────────────────────────────────────────────────────────────
insert into public.kinetik_people (id, circle_id, name, color, role) values
  ('person_4v6ze8s', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Aldyth',  '#6366f1', 'owner'),
  ('person_5v6ze8s', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Kinara',  '#0ea5e9', 'coleader'),
  ('person_6v6ze8s', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Baginda', '#10b981', 'member'),
  ('person_7v6ze8s', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Keyla',   '#f59e0b', 'member')
on conflict (id) do update set
  name  = excluded.name,
  color = excluded.color,
  role  = excluded.role;

-- ── 3. Routines (weekly recurring) ────────────────────────────────────────
insert into public.kinetik_routines (id, circle_id, title, who, responsible, day, start_time, end_time, duration_min) values
  ('ro_uqtpbda', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'English',                  ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 0, '15:00', '16:00', null),
  ('ro_brhub6i', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Basket',                   ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 0, '17:00', '18:00', null),
  ('ro_1u4oxd6', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'English',                  ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 0, '16:30', '17:30', null),
  ('ro_nolrqjq', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Guitar',                   ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 1, '14:15', '15:00', null),
  ('ro_c3j3us9', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Ngaji',                    ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 1, '15:00', '16:30', null),
  ('ro_0a5g2du', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Tennis',                   ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 1, '17:00', '18:00', null),
  ('ro_cewtbtw', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Math',                     ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 1, '14:15', '15:15', null),
  ('ro_pbywag7', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Tennis',                   ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 1, '15:30', '16:30', null),
  ('ro_3nxchh6', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Guitar',                   ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 2, '14:15', '15:00', null),
  ('ro_utp47ka', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Basket',                   ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 2, '17:00', '18:00', null),
  ('ro_4itmfdj', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Ngaji',                    ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 2, '15:00', '16:00', null),
  ('ro_h41gt49', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Math',                     ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 2, '16:15', '17:15', null),
  ('ro_7o1csbr', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Math',                     ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 3, '15:00', '16:00', null),
  ('ro_89z921o', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Ngaji',                    ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 3, '16:30', '17:30', null),
  ('ro_v1zjwuk', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'English',                  ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 3, '15:00', '16:00', null),
  ('ro_k2nvp3y', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'English',                  ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 4, '15:00', '16:30', null),
  ('ro_7vso4mg', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Tennis',                   ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 4, '17:00', '18:00', null),
  ('ro_sq46mb3', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Math',                     ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 4, '14:30', '15:30', null),
  ('ro_31m5woa', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Ingatan Gajah',            ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 5, '09:15', '10:15', null),
  ('ro_ulfv3i7', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Ingatan Gajah',            ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 5, '12:30', '14:00', null),
  ('ro_zt3yoch', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Padel',                    ARRAY['person_4v6ze8s']::text[], 'person_4v6ze8s', 0, '19:00', '21:00', null),
  ('ro_qqhh695', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Padel',                    ARRAY['person_4v6ze8s']::text[], 'person_4v6ze8s', 3, '19:00', '21:00', null),
  ('ro_ejmpz40', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Padel City center',        ARRAY['person_5v6ze8s']::text[], 'person_4v6ze8s', 3, '08:00', '10:00', null),
  ('ro_sxfo3kj', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Anter Tenis',              ARRAY['person_5v6ze8s']::text[], 'person_4v6ze8s', 1, '15:50', '16:50', null),
  ('ro_kw7yq2r', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Padel',                    ARRAY['person_4v6ze8s', 'person_5v6ze8s']::text[], 'person_4v6ze8s', 6, '08:00', '09:00', null),
  ('ro_frmudjk', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Anter Keyla Gymnastic',    ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 0, '15:55', '19:15', null),
  ('ro_r76ltg0', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Jemput Anak sekolah',      ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 1, '13:30', '18:00', null),
  ('ro_kdms9yu', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Jemput Anak sekolah',      ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 0, '13:30', '18:00', null),
  ('ro_c5crtea', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Jemput abdil intercon',    ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 1, '16:50', '18:00', null),
  ('ro_ay2sza0', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Gym or Pilates',           ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 2, '08:00', '09:00', null),
  ('ro_co3rqvr', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Anter Gymnastic',          ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 2, '15:55', '19:15', null),
  ('ro_rpfuuai', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Jemput sekolah',           ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 4, '13:30', '13:50', null),
  ('ro_acuvl46', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Jemput abdil di Intercon', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 4, '16:50', '18:00', 70),
  ('ro_pdlvn34', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'gymnastic',                ARRAY['person_7v6ze8s']::text[], 'person_5v6ze8s', 0, '16:14', '19:14', 180),
  ('ro_vp7thfs', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'gymnastic',                ARRAY['person_7v6ze8s']::text[], 'person_5v6ze8s', 2, '16:15', '19:15', 180),
  ('ro_6w5mnzr', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'gymnastic',                ARRAY['person_7v6ze8s']::text[], 'person_5v6ze8s', 3, '16:15', '19:15', 180)
on conflict (id) do update set
  title      = excluded.title,
  who        = excluded.who,
  start_time = excluded.start_time,
  end_time   = excluded.end_time;

-- ── 4. Events (one-off, dated) ────────────────────────────────────────────
insert into public.kinetik_events (id, circle_id, title, event_date, start_time, end_time, who, prep, duration_min, end_date) values
  ('ev_q16vly1', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Anter Gymnastic Keyla',                 '2026-06-17', '15:55', '19:15', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_5vvzu6g', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Flight to jkt',                         '2026-07-24', '17:00', '18:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_7rxnhul', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Flight back to doha',                   '2026-08-28', '22:00', '23:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_pdbpbau', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Tennis',                                '2026-06-11', '16:00', '17:00', ARRAY['person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_ew4lv3r', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Doha - Jakarta',                        '2026-07-24', '08:40', '21:40', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_j671gnh', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Jakarta - Doha',                        '2026-08-29', '18:30', '22:40', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_m2bzm0n', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Pilates',                               '2026-06-08', '09:00', '10:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_51ykv0r', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Padel',                                 '2026-06-13', '08:00', '09:30', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 90, '2026-06-13'),
  ('ev_ppy1uc9', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Tenis Keyla',                           '2026-06-18', '15:55', '16:58', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_spxutvk', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Abdil Dapet Awards',                    '2026-06-17', '07:15', '08:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_ofqkx67', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Intercon la parrisien w/ annis',        '2026-06-21', '07:30', '07:45', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 15, '2026-06-21'),
  ('ev_b34ivao', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Salma House',                           '2026-06-18', '08:00', '11:59', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_c07mgub', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Acara Ira marriot',                     '2026-06-17', '09:00', '13:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 240, '2026-06-17'),
  ('ev_qafs6p5', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Aanter Abdil Basket',                   '2026-06-20', '18:00', '19:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 60, '2026-06-20'),
  ('ev_6a8dy4b', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Basket',                                '2026-06-20', '18:00', '19:00', ARRAY['person_6v6ze8s']::text[], ARRAY[]::text[], 60, '2026-06-20'),
  ('ev_4gserzd', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Padel Cicen Dian cita nanda',           '2026-06-22', '08:00', '09:30', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 90, '2026-06-22'),
  ('ev_60hu3cs', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Lunch w/Ira',                           '2026-06-24', '10:00', '12:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 120, '2026-06-24'),
  ('ev_0mn3h42', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Moza''s B''day curiocity the pearls tower 17', '2026-06-20', '10:00', '12:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 120, '2026-06-20'),
  ('ev_ni12jd7', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Moza''s Bday curiocity the pearls tower 17',   '2026-06-20', '10:00', '12:00', ARRAY['person_7v6ze8s']::text[], ARRAY[]::text[], 120, '2026-06-20'),
  ('ev_klpjwpw', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Izy''s House',                          '2026-06-20', '11:00', '15:00', ARRAY['person_6v6ze8s']::text[], ARRAY[]::text[], 240, '2026-06-20'),
  ('ev_b73b6n8', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Return - Liburan summer',               '2026-06-17', '00:00', '20:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_uiovl9c', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Return - Liburan Summer',               '2026-06-24', '00:00', '20:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_naonkvm', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Depart - Liburan Summer',               '2026-06-23', '08:00', '23:59', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY['Check-in online', 'Confirm passport', 'Pack bags']::text[], null, null),
  ('ev_f8g8esq', 'a1d00001-0000-0000-0000-000000000001'::uuid, 'Return - Liburan Summer',               '2026-06-24', '00:00', '20:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null)
on conflict (id) do update set
  title      = excluded.title,
  event_date = excluded.event_date,
  who        = excluded.who;
