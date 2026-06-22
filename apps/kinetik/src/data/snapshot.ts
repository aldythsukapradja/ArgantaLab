// AUTO-GENERATED baked snapshot of Aldyth's circle from the Kinetik Google Sheet.
// Source: spreadsheet 1x_3d1N_GQF... · circle circle_t9sqx2t. Regenerate, don't hand-edit.

export interface RawPerson { id: string; name: string; color: string; role: string }
export interface RawRoutine { id: string; title: string; who: string[]; responsible: string; day: number; start: string; end: string; category: string; durationMin: number | null }
export interface RawEvent { id: string; title: string; date: string; start: string; end: string; who: string[]; category: string; prep: string[]; durationMin: number | null; endDate: string | null }

export const CIRCLE_ID = "circle_t9sqx2t"
export const CIRCLE_NAME = "Aldyth’s Family"
export const CIRCLE_ACCENT = "#F43F5E"

export const RAW_PEOPLE: RawPerson[] = [{"id": "person_4v6ze8s", "name": "Aldyth", "color": "#6366f1", "role": "owner"}, {"id": "person_5v6ze8s", "name": "Kinara", "color": "#0ea5e9", "role": "coleader"}, {"id": "person_6v6ze8s", "name": "Baginda", "color": "#10b981", "role": "member"}, {"id": "person_7v6ze8s", "name": "Keyla", "color": "#f59e0b", "role": "member"}]

export const RAW_ROUTINES: RawRoutine[] = [
  {"id": "ro_uqtpbda", "title": "English", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 0, "start": "15:00", "end": "16:00", "category": "activity", "durationMin": null},
  {"id": "ro_brhub6i", "title": "Basket", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 0, "start": "17:00", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_1u4oxd6", "title": "English", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 0, "start": "16:30", "end": "17:30", "category": "activity", "durationMin": null},
  {"id": "ro_nolrqjq", "title": "Guitar", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 1, "start": "14:15", "end": "15:00", "category": "activity", "durationMin": null},
  {"id": "ro_c3j3us9", "title": "Ngaji", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 1, "start": "15:00", "end": "16:30", "category": "activity", "durationMin": null},
  {"id": "ro_0a5g2du", "title": "Tennis", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 1, "start": "17:00", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_cewtbtw", "title": "Math", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 1, "start": "14:15", "end": "15:15", "category": "activity", "durationMin": null},
  {"id": "ro_pbywag7", "title": "Tennis", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 1, "start": "15:30", "end": "16:30", "category": "activity", "durationMin": null},
  {"id": "ro_3nxchh6", "title": "Guitar", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 2, "start": "14:15", "end": "15:00", "category": "activity", "durationMin": null},
  {"id": "ro_utp47ka", "title": "Basket", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 2, "start": "17:00", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_4itmfdj", "title": "Ngaji", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 2, "start": "15:00", "end": "16:00", "category": "activity", "durationMin": null},
  {"id": "ro_h41gt49", "title": "Math", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 2, "start": "16:15", "end": "17:15", "category": "activity", "durationMin": null},
  {"id": "ro_7o1csbr", "title": "Math", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 3, "start": "15:00", "end": "16:00", "category": "activity", "durationMin": null},
  {"id": "ro_89z921o", "title": "Ngaji", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 3, "start": "16:30", "end": "17:30", "category": "activity", "durationMin": null},
  {"id": "ro_v1zjwuk", "title": "English", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 3, "start": "15:00", "end": "16:00", "category": "activity", "durationMin": null},
  {"id": "ro_k2nvp3y", "title": "English", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 4, "start": "15:00", "end": "16:30", "category": "activity", "durationMin": null},
  {"id": "ro_7vso4mg", "title": "Tennis", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 4, "start": "17:00", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_sq46mb3", "title": "Math", "who": ["person_7v6ze8s"], "responsible": "person_4v6ze8s", "day": 4, "start": "14:30", "end": "15:30", "category": "activity", "durationMin": null},
  {"id": "ro_31m5woa", "title": "Ingatan Gajah", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 5, "start": "09:15", "end": "10:15", "category": "activity", "durationMin": null},
  {"id": "ro_ulfv3i7", "title": "Ingatan Gajah", "who": ["person_6v6ze8s"], "responsible": "person_4v6ze8s", "day": 5, "start": "12:30", "end": "14:00", "category": "activity", "durationMin": null},
  {"id": "ro_zt3yoch", "title": "Padel", "who": ["person_4v6ze8s"], "responsible": "person_4v6ze8s", "day": 0, "start": "19:00", "end": "21:00", "category": "activity", "durationMin": null},
  {"id": "ro_qqhh695", "title": "Padel", "who": ["person_4v6ze8s"], "responsible": "person_4v6ze8s", "day": 3, "start": "19:00", "end": "21:00", "category": "activity", "durationMin": null},
  {"id": "ro_ejmpz40", "title": "Padel City center", "who": ["person_5v6ze8s"], "responsible": "person_4v6ze8s", "day": 3, "start": "08:00", "end": "10:00", "category": "activity", "durationMin": null},
  {"id": "ro_sxfo3kj", "title": "Anter Tenis", "who": ["person_5v6ze8s"], "responsible": "person_4v6ze8s", "day": 1, "start": "15:50", "end": "05:00", "category": "activity", "durationMin": null},
  {"id": "ro_kw7yq2r", "title": "Padel", "who": ["person_4v6ze8s", "person_5v6ze8s"], "responsible": "person_4v6ze8s", "day": 6, "start": "08:00", "end": "09:00", "category": "activity", "durationMin": null},
  {"id": "ro_frmudjk", "title": "Anter Keyla Gymnastic", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 0, "start": "15:55", "end": "19:15", "category": "activity", "durationMin": null},
  {"id": "ro_r76ltg0", "title": "Jemput Anak\" sekolah", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 1, "start": "13:30", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_kdms9yu", "title": "Jemput Anak\" sekolah", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 0, "start": "13:30", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_c5crtea", "title": "Jemput abdil intercon", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 1, "start": "16:50", "end": "18:00", "category": "activity", "durationMin": null},
  {"id": "ro_ay2sza0", "title": "Gym or Pilates", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 2, "start": "08:00", "end": "09:00", "category": "activity", "durationMin": null},
  {"id": "ro_co3rqvr", "title": "Anter Gymnastic", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 2, "start": "15:55", "end": "19:15", "category": "activity", "durationMin": null},
  {"id": "ro_rpfuuai", "title": "Jemput sekolah", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 4, "start": "13:30", "end": "13:50", "category": "activity", "durationMin": null},
  {"id": "ro_acuvl46", "title": "Jemput abdil di Intercon", "who": ["person_5v6ze8s"], "responsible": "person_5v6ze8s", "day": 4, "start": "16:50", "end": "18:00", "category": "activity", "durationMin": 70},
  {"id": "ro_pdlvn34", "title": "gymnastic", "who": ["person_7v6ze8s"], "responsible": "person_5v6ze8s", "day": 0, "start": "16:14", "end": "19:14", "category": "activity", "durationMin": 180},
  {"id": "ro_vp7thfs", "title": "gymnastic", "who": ["person_7v6ze8s"], "responsible": "person_5v6ze8s", "day": 2, "start": "16:15", "end": "19:15", "category": "activity", "durationMin": 180},
  {"id": "ro_6w5mnzr", "title": "gymnastic", "who": ["person_7v6ze8s"], "responsible": "person_5v6ze8s", "day": 3, "start": "16:15", "end": "19:15", "category": "activity", "durationMin": 180},
]

export const RAW_EVENTS: RawEvent[] = [
  {"id": "ev_q16vly1", "title": "Anter Gymnastic Keyla", "date": "2026-06-17", "start": "15:55", "end": "19:15", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_5vvzu6g", "title": "Flight to jkt", "date": "2026-07-24", "start": "17:00", "end": "18:00", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_7rxnhul", "title": "Flight back to doha", "date": "2026-08-28", "start": "22:00", "end": "23:00", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_pdbpbau", "title": "Tennis", "date": "2026-06-11", "start": "16:00", "end": "17:00", "who": ["person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_ew4lv3r", "title": "Doha - Jakarta", "date": "2026-07-24", "start": "08:40", "end": "21:40", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_j671gnh", "title": "Jakarta - Doha", "date": "2026-08-29", "start": "18:30", "end": "22:40", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_m2bzm0n", "title": "Pilates", "date": "2026-06-08", "start": "09:00", "end": "10:00", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_51ykv0r", "title": "Padel", "date": "2026-06-13", "start": "08:00", "end": "09:30", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 90, "endDate": "2026-06-13"},
  {"id": "ev_ppy1uc9", "title": "Tenis Keyla", "date": "2026-06-18", "start": "15:55", "end": "16:58", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_spxutvk", "title": "Abdil Dapet Awards", "date": "2026-06-17", "start": "07:15", "end": "08:00", "who": ["person_4v6ze8s", "person_5v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_ofqkx67", "title": "Intercon la parrisien  w/ annis", "date": "2026-06-21", "start": "07:30", "end": "07:45", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 15, "endDate": "2026-06-21"},
  {"id": "ev_b34ivao", "title": "Salma House", "date": "2026-06-18", "start": "08:00", "end": "11:59", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_c07mgub", "title": "Acara Ira marriot", "date": "2026-06-17", "start": "09:00", "end": "13:00", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 240, "endDate": "2026-06-17"},
  {"id": "ev_qafs6p5", "title": "Aanter Abdil Basket", "date": "2026-06-20", "start": "18:00", "end": "19:00", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 60, "endDate": "2026-06-20"},
  {"id": "ev_6a8dy4b", "title": "Basket", "date": "2026-06-20", "start": "18:00", "end": "19:00", "who": ["person_6v6ze8s"], "category": "event", "prep": [], "durationMin": 60, "endDate": "2026-06-20"},
  {"id": "ev_4gserzd", "title": "Padel Cicen Dian cita nanda", "date": "2026-06-22", "start": "08:00", "end": "09:30", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 90, "endDate": "2026-06-22"},
  {"id": "ev_60hu3cs", "title": "Lunch w/Ira", "date": "2026-06-24", "start": "10:00", "end": "12:00", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 120, "endDate": "2026-06-24"},
  {"id": "ev_0mn3h42", "title": "Moza's B'day curiocity the pearls tower 17", "date": "2026-06-20", "start": "10:00", "end": "12:00", "who": ["person_5v6ze8s"], "category": "event", "prep": [], "durationMin": 120, "endDate": "2026-06-20"},
  {"id": "ev_ni12jd7", "title": "Moza's Bday curiocity the pearls tower 17", "date": "2026-06-20", "start": "10:00", "end": "12:00", "who": ["person_7v6ze8s"], "category": "event", "prep": [], "durationMin": 120, "endDate": "2026-06-20"},
  {"id": "ev_klpjwpw", "title": "Izy's House", "date": "2026-06-20", "start": "11:00", "end": "15:00", "who": ["person_6v6ze8s"], "category": "event", "prep": [], "durationMin": 240, "endDate": "2026-06-20"},
  {"id": "ev_b73b6n8", "title": "ð  Return – Liburan summer", "date": "2026-06-17", "start": "00:00", "end": "20:00", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_uiovl9c", "title": "ð  Return – Liburan Summer", "date": "2026-06-24", "start": "00:00", "end": "20:00", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
  {"id": "ev_naonkvm", "title": "✈️ Depart – Liburan Summer", "date": "2026-06-23", "start": "08:00", "end": "23:59", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": ["Check-in online", "Confirm passport", "Pack bags"], "durationMin": null, "endDate": null},
  {"id": "ev_f8g8esq", "title": "ð  Return – Liburan Summer", "date": "2026-06-24", "start": "00:00", "end": "20:00", "who": ["person_4v6ze8s", "person_5v6ze8s", "person_6v6ze8s", "person_7v6ze8s"], "category": "event", "prep": [], "durationMin": null, "endDate": null},
]
