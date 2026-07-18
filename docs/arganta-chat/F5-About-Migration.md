# F5 · About Migration Map — where today's landing goes

**Rule:** the decks are re-used untouched internally; only their front door changes.
About is **public** (it IS the company page); Chat is gated.

## 1 · Inventory → destination

| Today (`apps/landing`) | Lines | Destination |
|---|---|---|
| `appscreens.tsx` `Home` (GSAP hero, stat counters, magnetic CTA) | ~75 | **Company Profile pill** hero section — the CTA retargets to "Open Arganta Chat" (→ `/` gate) |
| `appscreens.tsx` `Products` (Flip-launch cards → GeneralDeck flights) | ~50 | **Products pill**, unchanged incl. flight launches |
| `appscreens.tsx` `About` | ~80 | **About pill**, unchanged |
| `PitchDeck.tsx` | 397 | **Pitch pill** (lazy) |
| `decks/GeneralDeck` (camera-flight) | lazy | launched from Company Profile + Products pills, exit returns to the pill (today it returns to `products` tab — keep equivalent) |
| `decks/EditorialDeck` (+present mode) | lazy | launched from Products pill; `?present` preserved |
| `CommandTab.tsx` + `auth/LoginButton.tsx` (◆ operator) | 26+ | **DELETED** (audit A5). Operators live in HQ. |
| `AppShell.tsx` tab chrome | 78 | replaced by the F1 shell; pill bar is the only nav inside About |
| `HubBgLazy`, `stage/`, `three/`, `components/` (orbs, sprites, charts) | — | stay, still consumed by decks; no chat usage |
| `theme.tsx` | — | superseded by F1 tokens app-wide; decks keep their internal styling |

## 2 · Routes & redirects (old hash → new)

| Old | New |
|---|---|
| `#/` | `/` (gate → Hearth) — **note: the root changes meaning**; first-visit unauthenticated shows login with the "About Arganta" link visible |
| `#/home` | `/about?pill=company` |
| `#/products` | `/about?pill=products` |
| `#/about` | `/about` (default pill: About) |
| `#/pitch` | `/about?pill=pitch` |
| `#/command` | `/login` |
| `#/general[/flight]` | `/about/deck/general[/flight]` |
| `#/editorial[/present]` | `/about/deck/editorial[?present]` |

Redirect shim: keep the hash parser one release, mapping old hashes → new paths on load.

## 3 · Public/SEO
About pages get real titles/meta/OG (company page duty): *"Arganta — The family's second
brain"* + per-pill descriptions from F4 voice. Chat routes are `noindex`.

## 4 · Kill list
`CommandTab.tsx`, `auth/LoginButton.tsx` (◆ pattern), operator copy in decks' chrome
(EditorialDeck's operator hints if any), old tab bar CSS. Nothing else dies.
