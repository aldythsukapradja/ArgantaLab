# M3 UI Build Spec — Knowledge OS (drawer shell · vault · extraction studio · Cosmonaut)
v1.0.0 · 2026-07-21 · Status: LOCKED (Fable). Executor: Opus. App: `apps/energy` (Vite/React/TS, port 5279).

## Hard rules (override anything ambiguous)
1. Contracts are LOCKED: `src/knowledge/types.ts` (VaultNote/Claim/Extraction*), `src/knowledge/links.ts`, `src/model/schema-meta.ts`, `src/data/kb.json` shape (from `scripts/build-knowledge.mjs`). Consumers adapt to them, never the reverse.
2. Deterministic-first: NO LLM call anywhere in M3. The Cosmonaut router is keyword/rule-based with a visible truthful trace ("tier 0 · deterministic · no LLM call"). LLM tiers render as a declared, disabled upgrade seam.
3. Truth rules: every figure carries dataNature badge + evidence; dead wikilinks render `.wikilink.dead` (never silent); extraction candidates NEVER enter the vault without accept; ambiguous entity matches stay `noteId:null` (propose, don't merge).
4. Design tokens only (`theme.css` vars — both themes must work); no new colors; mono for ids/units; WCAG AA; `prefers-reduced-motion` disables all orb/graph animation.
5. New deps allowed (exactly): `pdfjs-dist`, `xlsx` (SheetJS CE), `jszip`. LAZY-load all three only inside the Extraction Studio (dynamic import) — keep the base bundle lean.
6. No `window.*` globals for pipeline state (the reference's smell) — thread through the zustand store or local state.
7. tsc strict must pass; verify in browser (both themes, desktop 1440×900 + mobile 375×812).

## 1 · Shell rework (drawer navigation)
Replace the current 58px icon rail + top domain TabBar with:
- **Left drawer** (the MAIN nav): expanded by default (~232px), collapsible to 60px icon rail (chevron toggle, persisted `ae_drawer`). Sections from `nav.ts` zones: "MOTHERSHIP" group label, then platform domains; "VERTICALS" label, then vertical domains; sibling-apps (locked) at bottom. Each item: icon + label + phase chip (hidden when collapsed → tooltip).
- **Top bar** becomes the SUB-TAB bar: brand (compact) + current domain's sub-tabs (see §2) + well selector + ⌘K + theme toggle + route badge. Sub-tabs render from a `SUBTABS: Record<DomainId, {id,label}[]>` config in `nav.ts` (config-driven, like DOMAINS).
- **Mobile (≤820px)**: drawer hidden → **bottom tab bar** (like the reference screenshot): 4-5 key items (Core, Data, Knowledge, Cosmonaut orb center-raised, Field Dev) + a "⋯ More" sheet listing all domains. Sub-tabs become a horizontally scrollable strip under the top bar. All panes single-column.
- Keep: command palette (⌘K, now also lists sub-tabs), status bar, existing tab content.

## 2 · Sub-tabs per domain (initial)
- foundation/Core: `overview` (existing Foundation) · `schema` (move SchemaCanvas here later — optional, keep Schema domain too for now).
- data: `inventory` (existing DataTab) · `pipeline` (simple stage cards: mirror→decode→validate with real counts).
- knowledge: **`explorer` · `graph` · `extraction`** (the heart of M3, §3–4).
- others: single `overview` sub-tab (existing content/stubs).

## 3 · Knowledge surface
### 3a Explorer (upgrade existing three-pane)
Load `src/data/kb.json` (77 notes) + user/extracted notes from IndexedDB (`ae_kb_user` via a tiny idb wrapper, no dep — localStorage fallback ok if simpler, size is small). Merge: user notes with same id override generated (precedence user ▸ generated). Run `recomputeLinks` from `src/knowledge/links.ts` on the merged set.
Tree pane: folders from kb.folders + note count badges + search (title+tags). Center: rendered markdown (extend existing renderer: `[[Title|alias]]` → clickable wikilink or `.wikilink.dead`; blockquote `>` callouts; tables). Right pane: frontmatter chips (type/folder/dataNature/version), evidence list (source_ids → click shows sha256 from data.json evidence ledger), backlinks, claims (with confidence + flags).
### 3b Graph
Canvas2D force/radial graph of `toGraph(notes)` (~77 nodes now, design for 5k): node color by `type` (map to accent vars), radius ∝ degree, labels for top-degree + hovered, pan/zoom/drag, click → open note in Explorer, hover → neighbor highlight (dim rest). Layout: seeded radial by type-ring (field center; wells ring 1; wellbores ring 2; surfaces ring 3; tables/docs ring 4) then a few relax iterations; positions cached. Shape switcher (galaxy/rings at minimum, like the reference screenshot). rAF-gated; reduced-motion = static.
### 3c Extraction Studio (the auto data extractor — office docs)
Layout (three-pane studio): LEFT source queue (drag-drop zone + file input, batch list, per-file status/progress, Extract button) · CENTER results canvas (flow-line Source→Extract→Review→Compile with animated stage states; then candidate cards grouped by doc) · RIGHT inspector (selected candidate: preview, matched entities with how-badges exact/alias/fuzzy, locator, accept/reject).
Pipeline (all client-side, deterministic — `src/knowledge/extract.ts`):
- **PDF** (`pdfjs-dist`, worker via `?url` import): per-page `getTextContent` → page text blocks; caption-anchored figure/table capture optional-v2 (SKIP images in v1 — text+tables only, keep scope tight).
- **XLSX/CSV** (`xlsx`): `sheet_to_json` per sheet → `ExtractedBlock{kind:'table', columns, rows, locator:'sheet <name>'}` (REAL table reconstruction — fixes the reference's gap).
- **DOCX/PPTX** (`jszip` + DOMParser): `word/document.xml` paragraphs; `ppt/slides/slideN.xml` sorted NUMERICALLY; text per block with locator 'slide N'.
- **TXT**: paragraphs.
- sha256 each file (WebCrypto) → `ExtractedDoc` per contract.
- **Tagging** (`src/knowledge/tag.ts`): three-tier cascade — (1) labelled `key: value` regexes (well:, formation:, date:, depth NUM+unit m/ft, volume NUM+unit Sm3/bbl); (2) shape patterns: wellbore ids via `normalizeWellbore` candidates (`15/9-...`, `F-\d+...`), surface names from the 16-surface bridge (exact + case-insensitive alias); (3) evidence window `slice(i-110,i+170)` per match, max 3. Match → `matchedEntities` with `noteId` looked up in the merged KB (by deterministic id `kb-wellbore-<slug>` etc.) — `how:'exact'|'alias'`, unresolved → `noteId:null` (`fuzzy`).
- **Candidates**: per doc — 1 document-note candidate (summary + entity coverage) + 1 claim candidate per high-signal `key: value` hit + 1 table candidate per sheet/table block. All `status:'proposed'`.
- **Review**: accept → build VaultNote (`gen:'extract'`, `type:'extracted'`, folder '05 Documents', evidence `upload:<sha256>#<locator>`, body embeds `[[wikilinks]]` for matched entities with resolved notes) → persist to user layer → `recomputeLinks` → visible in Explorer+Graph immediately. Reject → keep record, excluded. Batch log strip with timestamps (studio feel).

## 4 · Cosmonaut (agent surface + orb)
- **Orb**: fixed bottom-right (desktop) / center-raised in the mobile bottom bar. Layered CSS: blurred radial halo (slow pulse), conic-gradient blob (slow spin) + reverse overlay, glassy core (breathe), expanding ring on hover; label pill slides out on hover ("Cosmonaut"). ALL animation off under reduced-motion. Clicking toggles the Cosmonaut overlay.
- **Overlay**: full-screen 3-pane — LEFT history drawer (sessions in localStorage `ae_cosmo_sessions`, new-chat button, collapsible; over-canvas sheet on mobile) · CENTER chat canvas (message stream, centered max-width ~720px, suggestion chips from router intents, input bar bottom) · RIGHT artifact drawer (renders the latest artifact: table or SVG chart; collapsible; sheet on mobile). Animated grid-template-columns on drawer toggle (like the reference). Esc closes overlay.
- **Router** (`src/cosmo/router.ts`, deterministic): lowercase prompt → buckets:
  - production/oil/rate/decline → per-well or field production summary from `foundation.json` production data + a bar/line SVG artifact;
  - wells/wellbore/coverage → coverage table artifact (wellbores × has production/logs/traj/picks);
  - schema/model/table/relationship → answer generated from `schema-meta.ts` FKS (markdown FK table artifact);
  - surface/formation/top → surface list w/ pick counts from kb notes;
  - knowledge/note/link → KB stats + top-degree entities;
  - else → capability card.
  Every reply carries a visible "thinking trace": `intent → classification C1-internal → route tier 0A (deterministic, no LLM call) → grounded to <tables> → evidence attached`, plus dataNature badges on numbers. Tier rack shown in a small footer: DET (active) · SOV · FRO (locked, "upgrade seam — not wired").
- Streaming feel: typewriter reveal (setInterval ~15ms/word), skip under reduced-motion.

## 5 · Acceptance (Definition of Done)
1. tsc strict clean; `npm run build` green; zero console errors.
2. Drawer shell: expand/collapse persists; mobile bottom bar + More sheet work at 375px; sub-tabs render per domain; ⌘K still works.
3. Knowledge: Explorer shows 77+ notes w/ working wikilinks + backlinks + evidence; Graph interactive (hover/click/pan/zoom, shape switch); Extraction Studio ingests a real PDF + XLSX + PPTX end-to-end → candidates → accept → note appears in Explorer & Graph with provenance.
4. Cosmonaut: orb animates (and freezes under reduced-motion); 3-pane overlay responsive; at least 4 intents answer with real data + artifacts + truthful trace.
5. Both themes verified; screenshots desktop+mobile of: drawer shell, Knowledge explorer, graph, extraction studio, Cosmonaut.
6. Append `apps/energy/knowledge/99 Archaeology/2026-07-21-M3-ui.md`; do NOT touch data-energy, contracts/, scripts/volve-mirror|decode*|validate|schema-check.

## What NOT to do
No LLM wiring; no seismic anything; no new nav frameworks/routers; no server; no Supabase; don't refactor the locked contracts; don't inline bulk data (lazy-load extraction deps); don't break the existing Foundation/Data/Schema tabs.
