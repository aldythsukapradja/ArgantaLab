-- ============================================================
--  KINETIK · SEED  (run AFTER 01_schema.sql)
--  Real data for Aldyth’s Family — generated from the original
--  Google-Sheet snapshot. This is the one and only home for this
--  data now: it lives in Supabase tables, not baked into the app.
--  Idempotent: re-running upserts the same rows.
-- ============================================================

insert into public.kinetik_circles (id, name, accent, kind) values
  ('circle_t9sqx2t', 'Aldyth’s Family', '#F43F5E', 'family')
on conflict (id) do update set name = excluded.name, accent = excluded.accent;

-- people
insert into public.kinetik_people (id, circle_id, name, color, role) values
  ('person_4v6ze8s', 'circle_t9sqx2t', 'Aldyth', '#6366f1', 'owner'),
  ('person_5v6ze8s', 'circle_t9sqx2t', 'Kinara', '#0ea5e9', 'coleader'),
  ('person_6v6ze8s', 'circle_t9sqx2t', 'Baginda', '#10b981', 'member'),
  ('person_7v6ze8s', 'circle_t9sqx2t', 'Keyla', '#f59e0b', 'member')
on conflict (id) do update set name = excluded.name, color = excluded.color, role = excluded.role;

-- routines (weekly recurring)
insert into public.kinetik_routines (id, circle_id, title, who, responsible, day, start_time, end_time, duration_min) values
  ('ro_uqtpbda', 'circle_t9sqx2t', 'English', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 0, '15:00', '16:00', null),
  ('ro_brhub6i', 'circle_t9sqx2t', 'Basket', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 0, '17:00', '18:00', null),
  ('ro_1u4oxd6', 'circle_t9sqx2t', 'English', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 0, '16:30', '17:30', null),
  ('ro_nolrqjq', 'circle_t9sqx2t', 'Guitar', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 1, '14:15', '15:00', null),
  ('ro_c3j3us9', 'circle_t9sqx2t', 'Ngaji', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 1, '15:00', '16:30', null),
  ('ro_0a5g2du', 'circle_t9sqx2t', 'Tennis', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 1, '17:00', '18:00', null),
  ('ro_cewtbtw', 'circle_t9sqx2t', 'Math', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 1, '14:15', '15:15', null),
  ('ro_pbywag7', 'circle_t9sqx2t', 'Tennis', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 1, '15:30', '16:30', null),
  ('ro_3nxchh6', 'circle_t9sqx2t', 'Guitar', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 2, '14:15', '15:00', null),
  ('ro_utp47ka', 'circle_t9sqx2t', 'Basket', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 2, '17:00', '18:00', null),
  ('ro_4itmfdj', 'circle_t9sqx2t', 'Ngaji', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 2, '15:00', '16:00', null),
  ('ro_h41gt49', 'circle_t9sqx2t', 'Math', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 2, '16:15', '17:15', null),
  ('ro_7o1csbr', 'circle_t9sqx2t', 'Math', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 3, '15:00', '16:00', null),
  ('ro_89z921o', 'circle_t9sqx2t', 'Ngaji', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 3, '16:30', '17:30', null),
  ('ro_v1zjwuk', 'circle_t9sqx2t', 'English', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 3, '15:00', '16:00', null),
  ('ro_k2nvp3y', 'circle_t9sqx2t', 'English', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 4, '15:00', '16:30', null),
  ('ro_7vso4mg', 'circle_t9sqx2t', 'Tennis', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 4, '17:00', '18:00', null),
  ('ro_sq46mb3', 'circle_t9sqx2t', 'Math', ARRAY['person_7v6ze8s']::text[], 'person_4v6ze8s', 4, '14:30', '15:30', null),
  ('ro_31m5woa', 'circle_t9sqx2t', 'Ingatan Gajah', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 5, '09:15', '10:15', null),
  ('ro_ulfv3i7', 'circle_t9sqx2t', 'Ingatan Gajah', ARRAY['person_6v6ze8s']::text[], 'person_4v6ze8s', 5, '12:30', '14:00', null),
  ('ro_zt3yoch', 'circle_t9sqx2t', 'Padel', ARRAY['person_4v6ze8s']::text[], 'person_4v6ze8s', 0, '19:00', '21:00', null),
  ('ro_qqhh695', 'circle_t9sqx2t', 'Padel', ARRAY['person_4v6ze8s']::text[], 'person_4v6ze8s', 3, '19:00', '21:00', null),
  ('ro_ejmpz40', 'circle_t9sqx2t', 'Padel City center', ARRAY['person_5v6ze8s']::text[], 'person_4v6ze8s', 3, '08:00', '10:00', null),
  ('ro_sxfo3kj', 'circle_t9sqx2t', 'Anter Tenis', ARRAY['person_5v6ze8s']::text[], 'person_4v6ze8s', 1, '15:50', '16:50', null),
  ('ro_kw7yq2r', 'circle_t9sqx2t', 'Padel', ARRAY['person_4v6ze8s', 'person_5v6ze8s']::text[], 'person_4v6ze8s', 6, '08:00', '09:00', null),
  ('ro_frmudjk', 'circle_t9sqx2t', 'Anter Keyla Gymnastic', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 0, '15:55', '19:15', null),
  ('ro_r76ltg0', 'circle_t9sqx2t', 'Jemput Anak" sekolah', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 1, '13:30', '18:00', null),
  ('ro_kdms9yu', 'circle_t9sqx2t', 'Jemput Anak" sekolah', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 0, '13:30', '18:00', null),
  ('ro_c5crtea', 'circle_t9sqx2t', 'Jemput abdil intercon', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 1, '16:50', '18:00', null),
  ('ro_ay2sza0', 'circle_t9sqx2t', 'Gym or Pilates', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 2, '08:00', '09:00', null),
  ('ro_co3rqvr', 'circle_t9sqx2t', 'Anter Gymnastic', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 2, '15:55', '19:15', null),
  ('ro_rpfuuai', 'circle_t9sqx2t', 'Jemput sekolah', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 4, '13:30', '13:50', null),
  ('ro_acuvl46', 'circle_t9sqx2t', 'Jemput abdil di Intercon', ARRAY['person_5v6ze8s']::text[], 'person_5v6ze8s', 4, '16:50', '18:00', 70),
  ('ro_pdlvn34', 'circle_t9sqx2t', 'gymnastic', ARRAY['person_7v6ze8s']::text[], 'person_5v6ze8s', 0, '16:14', '19:14', 180),
  ('ro_vp7thfs', 'circle_t9sqx2t', 'gymnastic', ARRAY['person_7v6ze8s']::text[], 'person_5v6ze8s', 2, '16:15', '19:15', 180),
  ('ro_6w5mnzr', 'circle_t9sqx2t', 'gymnastic', ARRAY['person_7v6ze8s']::text[], 'person_5v6ze8s', 3, '16:15', '19:15', 180)
on conflict (id) do update set title = excluded.title, who = excluded.who, start_time = excluded.start_time, end_time = excluded.end_time;

-- events (one-off, dated)
insert into public.kinetik_events (id, circle_id, title, event_date, start_time, end_time, who, prep, duration_min, end_date) values
  ('ev_q16vly1', 'circle_t9sqx2t', 'Anter Gymnastic Keyla', '2026-06-17', '15:55', '19:15', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_5vvzu6g', 'circle_t9sqx2t', 'Flight to jkt', '2026-07-24', '17:00', '18:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_7rxnhul', 'circle_t9sqx2t', 'Flight back to doha', '2026-08-28', '22:00', '23:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_pdbpbau', 'circle_t9sqx2t', 'Tennis', '2026-06-11', '16:00', '17:00', ARRAY['person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_ew4lv3r', 'circle_t9sqx2t', 'Doha - Jakarta', '2026-07-24', '08:40', '21:40', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_j671gnh', 'circle_t9sqx2t', 'Jakarta - Doha', '2026-08-29', '18:30', '22:40', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_m2bzm0n', 'circle_t9sqx2t', 'Pilates', '2026-06-08', '09:00', '10:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_51ykv0r', 'circle_t9sqx2t', 'Padel', '2026-06-13', '08:00', '09:30', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 90, '2026-06-13'),
  ('ev_ppy1uc9', 'circle_t9sqx2t', 'Tenis Keyla', '2026-06-18', '15:55', '16:58', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_spxutvk', 'circle_t9sqx2t', 'Abdil Dapet Awards', '2026-06-17', '07:15', '08:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_ofqkx67', 'circle_t9sqx2t', 'Intercon la parrisien  w/ annis', '2026-06-21', '07:30', '07:45', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 15, '2026-06-21'),
  ('ev_b34ivao', 'circle_t9sqx2t', 'Salma House', '2026-06-18', '08:00', '11:59', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_c07mgub', 'circle_t9sqx2t', 'Acara Ira marriot', '2026-06-17', '09:00', '13:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 240, '2026-06-17'),
  ('ev_qafs6p5', 'circle_t9sqx2t', 'Aanter Abdil Basket', '2026-06-20', '18:00', '19:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 60, '2026-06-20'),
  ('ev_6a8dy4b', 'circle_t9sqx2t', 'Basket', '2026-06-20', '18:00', '19:00', ARRAY['person_6v6ze8s']::text[], ARRAY[]::text[], 60, '2026-06-20'),
  ('ev_4gserzd', 'circle_t9sqx2t', 'Padel Cicen Dian cita nanda', '2026-06-22', '08:00', '09:30', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 90, '2026-06-22'),
  ('ev_60hu3cs', 'circle_t9sqx2t', 'Lunch w/Ira', '2026-06-24', '10:00', '12:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 120, '2026-06-24'),
  ('ev_0mn3h42', 'circle_t9sqx2t', 'Moza''s B''day curiocity the pearls tower 17', '2026-06-20', '10:00', '12:00', ARRAY['person_5v6ze8s']::text[], ARRAY[]::text[], 120, '2026-06-20'),
  ('ev_ni12jd7', 'circle_t9sqx2t', 'Moza''s Bday curiocity the pearls tower 17', '2026-06-20', '10:00', '12:00', ARRAY['person_7v6ze8s']::text[], ARRAY[]::text[], 120, '2026-06-20'),
  ('ev_klpjwpw', 'circle_t9sqx2t', 'Izy''s House', '2026-06-20', '11:00', '15:00', ARRAY['person_6v6ze8s']::text[], ARRAY[]::text[], 240, '2026-06-20'),
  ('ev_b73b6n8', 'circle_t9sqx2t', 'ð  Return – Liburan summer', '2026-06-17', '00:00', '20:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_uiovl9c', 'circle_t9sqx2t', 'ð  Return – Liburan Summer', '2026-06-24', '00:00', '20:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null),
  ('ev_naonkvm', 'circle_t9sqx2t', '✈️ Depart – Liburan Summer', '2026-06-23', '08:00', '23:59', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY['Check-in online', 'Confirm passport', 'Pack bags']::text[], null, null),
  ('ev_f8g8esq', 'circle_t9sqx2t', 'ð  Return – Liburan Summer', '2026-06-24', '00:00', '20:00', ARRAY['person_4v6ze8s', 'person_5v6ze8s', 'person_6v6ze8s', 'person_7v6ze8s']::text[], ARRAY[]::text[], null, null)
on conflict (id) do update set title = excluded.title, event_date = excluded.event_date, who = excluded.who;
