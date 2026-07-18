# K1 · KinetikCircle inside Arganta Chat — concept, battle test, to-do

**Date:** 2026-07-18 · **Status:** W1 (Opus) BUILT + a working KinetikView consumer; W2–W5 (Sonnet) remain
**W1 done:** bridge v2 (`arganta:circle`/`arganta:signout` + `createEmbedController`), Kinetik child hardened
(embed-mode `autoRefreshToken:false`/`persistSession:false`, handles circle+signout), `KinetikView.tsx` mounts it,
Kinetik `.is-embedded` CSS hides its top chrome/sidebar & keeps bottom tabs, `KinetikCircle`/`← Chat` navbar toggle.
Both apps typecheck + build clean; message contract verified symmetric (parent init/session/circle/signout ↔ child
handlers; child ready ↔ parent). **Unverified without a live run:** the >65-min single-use-refresh-token soak (B1)
and real cross-origin session apply — needs landing + `kinetik` dev servers up with a signed-in parent.
**Ask:** open KinetikCircle inside the app (shared login + shared circle), Arganta's navbar
replaces Kinetik's top chrome, "Back to chat" pill; Hearth top-right becomes a ⚙ settings
menu (Profile / About Arganta / Sign out); Chats becomes a ☰ burger with ChatGPT-style
persistent history.

---

## 1 · Concept

**One navbar to rule both worlds.** The sticky Arganta navbar (mark · circle selector · ☰)
stays fixed; below it the stage swaps between three surfaces:

```
┌─ ac-navbar (sticky) ────────────────────────────────┐
│ ⟁ Arganta · [The Sukapradja family ▾]   [⚙]  [☰]   │
└─────────────────────────────────────────────────────┘
   MODE chat      → Hearth / Conversation (as today)
   MODE kinetik   → full-bleed KinetikCircle iframe
                    + a floating "← Back to chat" pill
```

- **Login shared:** the parent reads its own Supabase session and hands
  `access_token`/`refresh_token` into the iframe over the existing bridge —
  the parent never re-authenticates, the child never shows its login page.
- **Circle shared:** the Arganta circle selector is the single source of truth.
  Switching circles re-syncs the embedded Kinetik via a new `arganta:circle`
  bridge message; Kinetik's own circle switcher is hidden in embed mode.
- **Entry points:** a "KinetikCircle" starter card on the Hearth + a navbar pill;
  chat answers can deep-link (calendar answer → "Open in KinetikCircle").
- **☰ burger (ChatGPT-style):** replaces the Chats pill. Opens the history drawer;
  threads persist to the `arganta_chat_threads/messages` tables (migration already
  run), auto-titled from the first message, recency-grouped, delete + undo.
- **⚙ settings:** top-right menu with **Profile** (name/email/photo from the Google
  session + linked kids count), **About Arganta** (→ /about), **Sign out**. The
  footer About/Sign-out buttons on the Hearth are removed.

## 2 · What already exists (verified in code, not assumed)

| Piece | Where | State |
|---|---|---|
| Parent bridge `arganta:embed@1` — nonce handshake, origin allowlist derived from env, `SessionMsg` token handoff | `apps/landing/src/embed/bridge.ts`, `embeds.ts` | ✅ built |
| Child guest — accepts `?embed=<nonce>`, posts `ready`, applies `supabase.auth.setSession`, adds `.is-embedded` class, scene hook | `apps/kinetik/src/lib/embedGuest.ts` (live in `main.tsx`) | ✅ built |
| Embed URL config, dev-localhost parent trust | `EMBEDS.kinetik` env + `isDevParent` | ✅ built |
| Chat thread tables + parents-only RLS | `arganta_chat_*` (migration run) | ✅ in DB, not wired to UI |
| Sticky navbar + circle selector | `ChatApp.tsx` / `CircleSelect` | ✅ built |

**The whole "open KinetikCircle with shared login" is ~80% reuse.** The gaps: a
full-bleed mount in the chat shell, the `arganta:circle` sync message, `.is-embedded`
CSS in Kinetik (class exists, **zero CSS rules use it yet**), and the nav/persistence UI.

## 3 · Battle test (what could break, and the counter)

| # | Risk | Verdict / counter |
|---|---|---|
| B1 | **Refresh-token collision.** Parent and child are two Supabase clients holding the same refresh token; both auto-refresh → the second refresh of a used token can revoke the session (sporadic sign-outs after ~1h). | REAL, the one subtle problem. Counter: child applies the session but the parent re-sends a **fresh** session on every `ready` (each mount), and the child's client is configured `autoRefreshToken: false` **in embed mode only** — parent owns refresh, pushes updated tokens down via `onAuthStateChange → arganta:session`. This is the Opus-grade piece. |
| B2 | **Dev origins.** Parent :5174 and child :5180 are different origins; prod uses circle.arganta.app. | Already handled by design: child trusts localhost parents (`isDevParent`), parent's `EMBEDS.kinetik` is env-driven → set `VITE_EMBED_KINETIK=http://localhost:5180` in landing `.env`; Kinetik dev server must be running (launch config `kinetik`). |
| B3 | **Kinetik chrome inside the frame.** `.is-embedded` has no CSS today — the full Kinetik header/circle switcher would render under Arganta's navbar. | Add small, additive `.is-embedded` rules in Kinetik: hide its top bar + circle switcher, keep bottom tab nav (Today/Calendar/Moments…) — that's the useful in-app navigation. Standalone Kinetik untouched (class only appears with `?embed=`). |
| B4 | **Circle sync direction.** If Kinetik could also change circles, the two selectors fight. | One-way: Arganta selector → `arganta:circle` → child `setCircle()`. Kinetik's switcher is hidden (B3). "All circles" in Arganta = pass the first circle + show a hint (Kinetik has no multi-circle view). |
| B5 | **iframe viewport on mobile.** 100dvh minus sticky navbar, iOS scroll quirks. | Fixed-position stage (`top: navbar-height; inset 0`), `touch-action: pan-y`; the floating Back-to-chat pill bottom-center where the composer used to be. |
| B6 | **History rehydration.** Stored answers must re-render components (calendar/today/pulse) months later. | Store the `Answer` JSON verbatim in `messages.blocks`; interactive components already fetch live data on mount from `scope` — a restored thread shows *today's* truth, not a stale snapshot (grounding law holds). Text lead is stored as written. |
| B7 | **RLS on threads.** Already parents-only + owner-only (migration run) — kid accounts can't read chat history even with a session. | ✅ done. |
| B8 | **Sign-out while embedded.** Parent signs out but iframe still holds a session. | ⚙ Sign out → parent posts a new `arganta:signout` message (child calls `supabase.auth.signOut()`), then parent signs out itself. |

**Verdict:** plan is sound; every risk has a concrete counter; B1 is the only piece that
needs senior judgment.

## 4 · Sonnet or Opus? (the honest split)

**~85% Sonnet.** The UI work (burger, drawer, settings menu, profile sheet, pills,
mode switch, persistence CRUD against existing tables, `.is-embedded` CSS) is
mechanical against this spec. **One workstream is Opus-grade: W1**, the auth/session
lifecycle across origins (B1 + B8) — single-use refresh tokens, embed-mode
`autoRefreshToken` handling in Kinetik, token re-push on refresh. Getting that wrong
looks like "works in the demo, random sign-outs in real life," which is the most
expensive kind of bug to chase later. Run W1 on Opus first; everything after is Sonnet.

## 5 · To-do list (build order, LLM per task)

| # | Task | Files | LLM |
|---|---|---|---|
| W1a | Bridge v2: add `arganta:circle` + `arganta:signout` msgs; parent re-sends fresh session on every `ready` and on `onAuthStateChange` | `apps/landing/src/embed/bridge.ts` | **Opus** |
| W1b | Kinetik embed hardening: in embed mode set `autoRefreshToken:false`, accept `arganta:circle`→`setCircle`, `arganta:signout`→`signOut` | `apps/kinetik/src/lib/embedGuest.ts` (+supabase client opt) | **Opus** |
| W1c | Verify end-to-end: sign-in parent → iframe live data, circle switch syncs, >65min session survives (token re-push), sign-out clears both | manual + console | **Opus** |
| W2a | `KinetikView.tsx`: full-bleed iframe under navbar, nonce mount, ready→init+session, loading/error states, floating "← Back to chat" pill | `apps/landing/src/chat/KinetikView.tsx` | Sonnet |
| W2b | Mode switch in ChatApp (`chat` \| `kinetik`), navbar "KinetikCircle" pill, Hearth starter card, `.env` `VITE_EMBED_KINETIK` for dev | `ChatApp.tsx`, `Hearth.tsx`, theme.css | Sonnet |
| W2c | Kinetik `.is-embedded` CSS: hide top bar/circle switcher, keep bottom tabs; zero standalone impact | `apps/kinetik/src/styles/*` | Sonnet |
| W3a | `chatStore.ts`: threads CRUD on `arganta_chat_threads/messages` (create on first turn, append user+answer JSON, auto-title, list, load, delete) | `apps/landing/src/chat/chatStore.ts` | Sonnet |
| W3b | ☰ burger replaces Chats pill; drawer lists persistent threads (Today/This week/Earlier), open→rehydrate turns, delete+5s undo, New chat | `ChatApp.tsx`, `Drawer.tsx`, theme.css | Sonnet |
| W4 | ⚙ settings menu (Profile sheet: photo/name/email/kids; About Arganta; Sign out incl. `arganta:signout`); remove Hearth footer buttons | `SettingsMenu.tsx`, `ChatApp.tsx` | Sonnet |
| W5 | Polish pass: mobile iframe viewport, drawer/menu a11y (Esc, focus trap), reduced-motion | theme.css + components | Sonnet |

Dependencies: W1 → W2 (embed needs the hardened bridge) · W3a → W3b · W4 independent.
Founder actions: none new — no migrations, no secrets (tables + RLS already live; embed
URLs are env).

## 6 · Out of scope (named so it's a choice, not a miss)

Two-way circle sync; multi-circle Kinetik view; embedding ArgantaLab/LashiraBloom the
same way (same bridge — natural v2 once Kinetik proves the pattern); search inside chat
history (add after >12 threads exist, per F1 §3.3).
