# IG Simulator — Instagram clone inside AI Influencer Studio (build handoff)

> **Purpose:** a pixel-faithful Instagram simulation per creator so the founder can *plan posts in batches, preview the profile grid and stories exactly as followers will see them*, then push approved items into Post Studio's existing drafts inbox → Buffer → Instagram.
> **Scope now:** Arganta fully seeded and usable. The other four creators get the same pipeline automatically (everything is keyed by `creatorId` — zero per-character code).
> **Executor:** Opus for Phase 1–2 (the clone's visual fidelity is the product), Sonnet for Phase 3–5 (wiring + CRUD). Escalate to founder after each phase screenshot.

---

## 0 · Context the executor needs

- Surface: `apps/hq/src/surfaces/influencer/` — "AI Influencer" tab (Studio group), a **non-scrollable** command deck (`.inf-root` fills `.content-flush`; the page NEVER scrolls, inner panels may).
- Character data: `influencerData.ts` — `CREATORS` array. Each has `igKit` (username, displayName, bio, highlights, pinned, cadence), `looks` (normal/formal/spicy webp paths in `apps/hq/public/influencer/`), `rituals` (Morning/Afternoon/Night story frames), `weekly` (Mon–Sun), accent colors.
- **Existing downstream pipeline (do not rebuild):** Post Studio (`surfaces/broadcast/PostStudio.tsx`) has an S7 drafts inbox polling Supabase `content_draft` every 12s (`lib/contentDrafts.ts`), a verbatim `docJson` channel, and shipped Buffer→Instagram publishing. The simulator only needs to *write* one row to join that river.
- Theme: every color via `theme.css` tokens (`--bg/--bg2/--bg3/--tx/--tx2/--tx3/--bd/--bd2`), both light and dark must work. The phone's *interior* may stay IG-dark permanently (Instagram's own dark mode) — that's a deliberate exception; the chrome around it follows the HQ theme.
- Commits go to **main**. Typecheck with `npx tsc --noEmit` in `apps/hq`. Verify in browser via `hq-offline` launch config. Known quirk: synthetic clicks from the preview pane sometimes miss — verify interactions with real DOM `.click()` via javascript_tool and confirm state, plus screenshots.

## 1 · UX concept

A third element in the influencer topbar: a **mode switch** `STRATEGY | INSTAGRAM` (strategy = current deck, untouched). Instagram mode replaces the 3-column body with:

```
┌──────────────────────────────────────────────────────────────────┐
│ topbar (unchanged: title · creator tabs · NEW mode switch)       │
├───────────────┬──────────────────────────┬───────────────────────┤
│ PLAN RAIL     │      PHONE FRAME         │  COMPOSER / DETAIL    │
│ 300px         │  390×~800 centered,      │  320px                │
│               │  IG-dark interior        │                       │
│ week strip    │  ┌────────────────────┐  │  selected item editor │
│ Mon…Sun       │  │ profile header     │  │  · kind post/reel/    │
│ (from weekly) │  │ avatar+counts+bio  │  │    story              │
│               │  │ highlight bubbles  │  │  · media (look asset  │
│ slot list     │  │ [Grid][Reels] tabs │  │    or upload path or  │
│ grouped by    │  │ 3×N photo grid     │  │    Post Library ref)  │
│ day, status   │  │ (planned posts +   │  │  · caption, hashtags  │
│ chips:        │  │  placeholder tiles)│  │  · day slot, pillar   │
│ idea/ready/   │  └────────────────────┘  │  · status             │
│ sent/posted   │  tap avatar → STORY      │  [Send to Post Studio]│
│ [+ add][batch]│  VIEWER overlay          │  [Preview in phone]   │
├───────────────┴──────────────────────────┴───────────────────────┤
│ footer ribbon (unchanged weekly ritual)                          │
└──────────────────────────────────────────────────────────────────┘
```

**Profile view (the money shot)** — must read instantly as Instagram:
- Header: avatar (creator `looks.normal`, ring when unseen stories exist), `igKit.username`, posts/followers/following counters (planned-count · simulated numbers, clearly labeled "SIM"), display name + bio (verbatim from `igKit.bio`, line breaks preserved), Edit-profile-style button reading **"Plan post"**.
- Highlights row: bubbles from `igKit.highlights` (accent-tinted initial circles now; cover images later).
- Tab row: Grid / Reels icons. Grid = 3-column, 1:1 tiles, 2px gaps, ordered newest-first by slot; **pinned** items (from `igKit.pinned`) show the pin badge and sort first. Planned-but-unfilled slots render as dashed placeholder tiles with the day label — the founder sees holes in the grid before followers do.
- Tapping a tile selects it (composer shows detail) and shows a lightweight post overlay: media, username header, caption with "more" folding, like/comment/share row (decorative).

**Story viewer** — full-height overlay inside the phone: segmented progress bars (auto-advance ~4s, tap right/left = next/prev, Esc/X closes), each segment = one planned story item; when a day has none, fall back to the character's ritual frames (from `rituals`) rendered as styled text-card frames over the accent gradient — so the story rhythm is previewable from day one with zero media.

**Reels tab:** 3-column grid of 9:16 tiles from items with `kind:'reel'` — placeholder-first, same selection behavior. No video playback in P1; static cover + duration chip.

## 2 · Data model (the plan store)

New file `surfaces/influencer/igsim/planStore.ts` — zustand, persisted to localStorage key `hq_igsim_v1` (one bucket, items keyed by creator), same pattern as Vault/postStyle stores. Supabase comes later (P5); the store API must not leak the storage choice.

```ts
export type IgKind = 'post' | 'reel' | 'story'
export type IgStatus = 'idea' | 'ready' | 'sent' | 'posted'   // sent = handed to Post Studio
export interface IgPlanItem {
  id: string; creatorId: string; kind: IgKind
  day: string            // ISO date the slot belongs to
  slot?: 'morning' | 'afternoon' | 'night'   // stories only
  media?: string         // /influencer/... asset path, data URL, or postLibrary ref `pl:<id>`
  look?: 'normal' | 'formal' | 'spicy'       // quick-fill: use the creator's look shot
  caption: string; hashtags: string
  pillar?: string        // from creator posts.pillars names
  pinned?: boolean
  status: IgStatus
  sentDraftId?: string   // content_draft id after bridge
  createdAt: string; updatedAt: string
}
```

Store API: `itemsFor(creatorId)`, `upsert`, `remove`, `moveDay`, `markStatus`, `importBatch(creatorId, items[])`. **Batch import** is first-class: a "Batch" button opens a textarea accepting a JSON array of partial items (day/kind/caption/hashtags/media) — this is how the founder plans a week in one paste, and later how Claude sessions inject plans.

Seed: on first run, if Arganta has zero items, seed his current week from the blueprint — 4 Reels (Mon/Wed/Fri/Sun, captions from `reels.hooks`), 1 carousel Tue, 1 premium still Sat (media = `looks.formal`), and daily story slots (morning/afternoon/night from `rituals` titles). All `status:'idea'`. Other creators start empty — same seeding function works for them when invoked.

## 3 · The bridge to Post Studio (P3)

One function, `igsim/bridge.ts` → `sendToPostStudio(item, creator)`:
- Online (cloudEnabled): insert one row into Supabase `content_draft` matching `lib/contentDrafts.ts` exactly — `brief` = `[IG plan · ${creator.name} · ${item.day}] ${caption first 80 chars}`, `status:'ready'`, `copy: { slides:[{ template:'headline', headline: caption.slice(0,60), body: caption, imageUrl: absolute media url }], caption, hashtags, brandId: creator.id }`, `platform:'instagram'`, `format: item.kind`. It then appears in Post Studio's existing inbox within 12s and rides the shipped Buffer path. Mark item `status:'sent'`, store `sentDraftId`.
- Offline: button disabled with tooltip "connect Supabase to send" — never fake success.
- **Never** call Buffer directly from the simulator; Post Studio stays the single publish gate (founder approval semantics already live there).

## 4 · Phases + QA gates

| Phase | Deliverable | Gate |
|---|---|---|
| ~~**P1** (Opus)~~ **DONE** `4e479336` | Mode switch + phone frame + profile view + grid from store + story viewer with ritual fallback; Arganta seeded | ✅ verified: squint test passes, non-scrollable, both themes, Lashira/Kinney/Bloom/Labz render own igKit + empty grid + seed button |
| ~~**P2** (Opus)~~ **DONE** `4e479336` | Plan rail (week strip + slot list) + composer drawer + batch import + look quick-fill | ✅ verified: composer edits persist to localStorage and reflect in rail; batch import 29→31 with pinned/kind honored |
| ~~**P3** (Sonnet)~~ **DONE** `3b693971` | Post Studio bridge | ✅ verified via localStorage state injection (sent-state UI, tile dot, rail chip, Post Studio nav); ⚠️ live insert path unverified — no connected Supabase project in dev. Confirm once `.env.local` has real creds: send an item, check it lands in Post Studio's inbox within 12s. |
| **P4** (Sonnet) | Reels tab + post overlay polish + pinned handling | Grid/reels parity for all five creators |
| **P5** (Sonnet, later) | Supabase persistence of the plan (migration `migration_ig_plan.sql`) + posted-status readback from `published_to` | Survives browser wipe; posted items show ✓ |

Rules: one commit per phase, main branch, typecheck + browser verify before each commit. No new nav entries (mode lives inside the existing surface — the CommandPalette hard-coded `surfs` array does NOT need touching). Images: reuse existing look webps; any new sim assets stay under `apps/hq/public/influencer/`.

## 4b · Notes for the P3 executor (from the P1/P2 build)

- **The store is already P3-shaped.** `markStatus(id, 'sent', draftId)` exists and `IgPlanItem.sentDraftId` is defined — the bridge only needs to insert the row and call it. The `Send to Post Studio` button is rendered and `disabled` in `IgSimulator.tsx` (`.igs-send`); wire it there.
- **Verify with real DOM clicks.** Synthetic mouse clicks from the preview pane frequently miss; assert state via `javascript_tool` (`el.click()` then read back) *and* screenshot.
- **The pane backgrounds the tab** (`document.hidden === true`), which throttles `setTimeout`, so the story's 4s auto-advance looks stalled under test — it isn't. Don't "fix" it.
- **Screenshots time out on the CEO Orb landing** (WebGL). Navigate to the surface via the landing's Studio launcher before screenshotting, or open a fresh tab.
- **Never call `onClose()`/parent setState inside a `setState` updater** — that bug cost a debug cycle here (React: "Cannot update a component while rendering a different component").

## 5 · Non-goals (now)

No real IG API/scraping, no follower simulation beyond static counters, no video playback, no direct Buffer calls, no auth. The simulator is a *planning mirror*, not a metrics product.
