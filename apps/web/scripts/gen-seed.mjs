// Generates supabase/seed_content.sql from the bundled local content.
// Run: node scripts/gen-seed.mjs   (from apps/web)
import esbuild from 'esbuild'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const res = await esbuild.build({
  entryPoints: ['src/data/learn.ts'],
  bundle: true, format: 'esm', write: false, platform: 'node', logLevel: 'silent',
})
const tmp = join(mkdtempSync(join(tmpdir(), 'alab-')), 'learn.mjs')
writeFileSync(tmp, res.outputFiles[0].text)
const { WORLDS, LOCAL_ITEMS, STAGES, INTERACTIONS } = await import(pathToFileURL(tmp).href)

const q = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`
const jsonb = (o) => `${q(JSON.stringify(o ?? {}))}::jsonb`
const arr = (a) => a && a.length ? `array[${a.map(q).join(',')}]` : `array[]::text[]`
const num = (n) => (n === undefined || n === null ? 'null' : Number(n))

const out = []
out.push('-- ============================================================')
out.push('-- ARGANTALAB · CONTENT SEED  (generated — do not edit by hand)')
out.push('-- Paste into Supabase → SQL Editor → Run. Idempotent (re-runnable).')
out.push('-- ============================================================')
out.push('begin;')

// content version table (drives client auto-refresh)
out.push('\n-- content_meta: a single row whose version bumps on every seed')
out.push('create table if not exists public.content_meta (id int primary key, version int default 1, updated_at timestamptz default now());')
out.push('alter table public.content_meta enable row level security;')
out.push('drop policy if exists "content_meta_read" on public.content_meta;')
out.push('create policy "content_meta_read" on public.content_meta for select using (true);')
out.push('drop policy if exists "content_meta_admin" on public.content_meta;')
out.push('create policy "content_meta_admin" on public.content_meta for all using (public.is_admin()) with check (public.is_admin());')

// stages
out.push('\n-- stages')
STAGES.forEach((s, i) => out.push(
  `insert into public.stages (key,label,min_age,max_age,order_idx) values (${q(s.key)},${q(s.label)},${num(s.minAge)},${num(s.maxAge)},${i})\n  on conflict (key) do update set label=excluded.label, min_age=excluded.min_age, max_age=excluded.max_age, order_idx=excluded.order_idx;`))

// worlds
out.push('\n-- worlds')
WORLDS.forEach((w, i) => out.push(
  `insert into public.worlds (key,name,color,icon,signature_tab,status,order_idx) values (${q(w.key)},${q(w.name)},${q(w.color)},${q(w.icon)},${q(w.signature)},${q(w.status)},${i})\n  on conflict (key) do update set name=excluded.name, color=excluded.color, icon=excluded.icon, signature_tab=excluded.signature_tab, status=excluded.status, order_idx=excluded.order_idx;`))

// interaction_types (items.interaction_type FK-references this — must exist first)
out.push('\n-- interaction types (the 18 question formats)')
INTERACTIONS.forEach(it => out.push(
  `insert into public.interaction_types (key,name,payload_schema,notes) values (${q(it.key)},${q(it.name)},${jsonb({ hint: it.payloadHint })},${q(it.desc)})\n  on conflict (key) do update set name=excluded.name, payload_schema=excluded.payload_schema, notes=excluded.notes;`))

// skills (flat, denormalised by world_key)
out.push('\n-- skills (rebuilt)')
out.push('delete from public.skills;')
WORLDS.forEach(w => w.skills.forEach((s, i) => out.push(
  `insert into public.skills (world_key,key,label,difficulty_band,order_idx) values (${q(w.key)},${q(s.key)},${q(s.label)},${num(s.band)},${i});`)))

// journey units + nodes
out.push('\n-- journeys (rebuilt)')
out.push('delete from public.journey_nodes;')
out.push('delete from public.journey_units;')
WORLDS.forEach(w => w.units.forEach((u, ui) => {
  out.push(`insert into public.journey_units (world_key,key,title,color,order_idx) values (${q(w.key)},${q(u.key)},${q(u.title)},${q(u.color)},${ui});`)
  u.nodes.forEach((n, ni) => out.push(
    `insert into public.journey_nodes (unit_id,world_key,title,type,skill_keys,item_count,reward_diamonds,order_idx)\n  select u.id,${q(w.key)},${q(n.title)},${q(n.type)},${arr(n.skills)},${num(n.itemCount)},${num(n.rewardDiamonds)},${ni} from public.journey_units u where u.world_key=${q(w.key)} and u.key=${q(u.key)};`))
}))

// badges
out.push('\n-- badges (rebuilt)')
out.push('delete from public.badges;')
WORLDS.forEach(w => w.badges.forEach((b, i) => out.push(
  `insert into public.badges (world_key,key,name,icon,unlock_rule,order_idx) values (${q(w.key)},${q(b.key)},${q(b.name)},${q(b.icon)},${jsonb(b.rule)},${i});`)))

// items (the bulk)
out.push('\n-- items (rebuilt — the question bank)')
out.push('delete from public.items;')
LOCAL_ITEMS.forEach((it, i) => out.push(
  `insert into public.items (world_key,skill_key,interaction_type,stage_key,difficulty,prompt,payload,hint,explanation,xp,diamonds,status,order_idx) values (${q(it.world)},${q(it.skill)},${q(it.type)},${q(it.stage)},${num(it.difficulty)},${q(it.prompt)},${jsonb(it.payload)},${it.hint ? q(it.hint) : 'null'},${it.explanation ? q(it.explanation) : 'null'},${num(it.xp ?? 10)},${num(it.diamonds ?? 0)},'live',${i});`))

// bump a content version so clients know to refresh
out.push('\n-- content version bump (clients auto-refresh when this changes)')
out.push(`insert into public.content_meta (id, version, updated_at) values (1, 1, now())\n  on conflict (id) do update set version = public.content_meta.version + 1, updated_at = now();`)

out.push('\ncommit;')

const sql = out.join('\n') + '\n'
writeFileSync('../../supabase/seed_content.sql', sql)
console.log(`Wrote supabase/seed_content.sql`)
console.log(`  stages=${STAGES.length} worlds=${WORLDS.length} skills=${WORLDS.reduce((a, w) => a + w.skills.length, 0)} items=${LOCAL_ITEMS.length}`)
