# KinetikCircle — Design Handoff Brief

**For:** Claude (design) · **From:** Product/eng · **Status:** concept → design
**One line:** A private, invite-only **family operating system** — plan together, learn together, remember together — built around a single Circle, one identity model, and one diamond economy.

> This brief is self-contained: a designer (human or AI) should be able to design from it without prior context. Where it says *“exists today”* the thing is already built/shipping; *“to design”* is new.

---

## 1. Vision & positioning

KinetikCircle is **one product for a family’s whole shared life**, not a bundle of apps. Three things every family does together become three pillars under one Circle:

- **Plan** — what’s happening (calendar, routines, today).
- **Learn** — how the kids are growing (gamified worlds, progress, rewards).
- **Remember** — what we’ll keep (a private social feed, stories, short video, albums, milestones).

**Non-negotiable character:** private, invite-only, **no public, no strangers, no ads, child-safe by default**. The opposite of open social media. Grandparents and relatives can be brought in as *viewers*.

**Brand:** KinetikCircle is the umbrella. The existing learning product **ArgantaLab** becomes the **Learn** pillar inside it (its brand can persist as a sub-brand). Tone: warm, premium, calm, trustworthy — “Ultrahuman/Apple-grade polish for families,” not childish.

---

## 2. Who it’s for (personas)

1. **The organizing parent (primary)** — owner of the circle. Runs the calendar, sees every kid’s progress, posts/curates moments, manages members and the diamond economy. Power user; wants density + control on desktop, speed on mobile.
2. **The co-parent / co-leader** — same powers minus delete. Mostly mobile.
3. **The kid** — own account, age-tier (Tiny → Legend), logs into the Learn worlds, earns diamonds/XP, appears in Moments, can post within kid-safe limits.
4. **Extended family / grandparent (viewer)** — invited to *see and react* to Moments/Albums; cannot touch planning or kids’ learning. Low-frequency, emotional engagement (“watch them grow”).

Design for **parent-first**, kid-safe, grandparent-delightful.

---

## 3. Information architecture

**Bottom nav (mobile) / left sidebar (desktop) — 5 surfaces:**

| Tab | Pillar | What it is |
|---|---|---|
| **Today** | Plan | Next-up, the day’s rhythm, gentle nudges, tomorrow preview |
| **Calendar** | Plan | Events + weekly routines; board & month views |
| **Moments** | Remember | Feed · Stories · Reels · Albums · Milestones |
| **Learn** | Learn | Each kid’s six worlds, rings, XP, tiers, rewards |
| **Circle** | Shared | Members & roles, the **diamond wallet**, installed **Apps**, profile, settings |

> Six tabs didn’t fit, so **Apps**, **Me/profile**, and the **wallet** were folded into **Circle**. Today + Calendar stay separate (both are Plan but used differently).

**Responsive:** mobile = floating glass bottom bar; tablet = 84px icon rail; desktop = 252px full sidebar + multi-column content (already built this way).

---

## 4. The pillars in detail

### 4.1 Plan (exists today, refine)
- **Today:** greeting, “Happening now / next up” card, tomorrow preview, today’s timeline. Energy-colored.
- **Calendar:** per-member board (columns = members) + month grid; events and recurring routines; quick-add sheet.
- Activities carry an *energy* (care/focus/growth/memory/play/calm) that colors them.

### 4.2 Learn (exists in ArgantaLab; surface into the shell)
- **Six worlds:** Number, Word, Wonder, Logic, World, Life (keys NUM/WRD/WON/LOG/WLD/LIF; fixed brand colors amber/blue/green/purple/red/pink).
- Per kid: a **ring per world** (% mastery), XP, level, **age-tier** (Tiny 1–6, Starter 6–8, Explorer 8–11, Builder 11–14, Champion 14–16, Legend 16–19).
- Kids *play* the worlds (drills/labs); parents *see* the progress. Diamonds are earned here.
- Design need: a parent-facing **family learning dashboard** (all kids’ rings at a glance) + a kid-facing play surface (already exists in ArgantaLab — align visual language).

### 4.3 Remember — the big new build (to design)
The private social layer. Patterns borrowed from mainstream social apps, **reframed as family-private and keepsake-first**. Sub-surfaces:
- **Feed** — photo/video posts; author, caption, `@member` tags (“with Keyla”), time. Reactions are a **cluster** (❤️ proud 🏆 haha 😂), not a single like. Threaded comments.
- **Stories** — 24h ephemeral, accent rings on avatars, tap-through.
- **Reels** — full-screen vertical short video, swipe, autoplay, “Circle vs For-you” top tabs, glass action rail.
- **Albums (from FamilyAlbum)** — auto-organized keepsakes: per kid, per event, per year (“Baginda’s year”). The *durable* counterpart to the ephemeral feed.
- **Milestones** — a growing-up timeline (first bike ride, a Learn milestone crossing a threshold, birthdays).
- **Create** — capture/upload photo or video, caption, tag members, **audience selector** (whole circle / just grown-ups / custom), optional **“reward this moment”** (attach diamonds).
- **Profile** — member grid + Reels + Tagged tabs, stats (moments / hearts), tier badge.

**The differentiators vs generic social:** (a) **diamond rewards** on moments tie recognition to the real economy; (b) **ArgantaLab tie-in** — a kid’s learning milestone can auto-suggest a Moment; (c) **grandparent viewer** role — consume + react, never post; (d) **everything circle-scoped & kid-safe**.

---

## 5. Shared systems (one of each, used by every surface)

- **Identity & roles** — real accounts. `profiles` (adults + kids, kids have `role='kid'`, dob, username, friend_code, guardian_id), `circle_members` (member_id, role), `guardianships`. Roles: **owner > co-leader > member > viewer**; kids are members with an age-tier. *(See §7.)*
- **Diamond economy** — a single wallet (`profiles.diamonds`). Earned in Learn, **rewarded on Moments**, **given/adjusted by parents**, spent in Apps. Must feel consistent everywhere a 💎 appears.
- **Per-circle theme** — each circle has an accent color; it tints the canvas, dots, active states, and headers across *all* surfaces, so you feel which circle you’re in. (Already implemented app-wide.)
- **Privacy & safety** — circle-scoped by default; kids-safe content rules; viewers are read+react only; no public surface, no discovery of strangers.
- **Notifications / Activity** — unified: reactions, comments, mentions, new moments, learning milestones, plan reminders.
- **Apps** — mini-apps published from an internal builder (**CircleHQ**) into the circle (e.g., “Family Vault” document store). They run full-screen in-app. Live in the **Circle** tab + store.

---

## 6. Design language (current baseline — match & elevate)

The KinetikCircle shell already has a defined language. **Keep and extend it; don’t reinvent.**

- **Aesthetic:** light-first, soft, glassy, premium (Ultrahuman/iOS feel). Calm neutral canvas, floating white cards.
- **Surfaces:** white cards, `0.5px` hairline borders, soft shadows, radius 16–20px. Frosted-glass for the floating nav and overlays (`backdrop-blur`).
- **Color:** neutral bg `#EFEFF3`; brand purple `#8B5CF6` + circle-accent (default coral `#F43F5E→#FB7185`); diamonds = purple `#8B5CF6`; six energy colors for activities; six world colors for Learn. **Dark mode is mandatory** (already supported).
- **Signature element:** the **circle “emblem”** — a glossy gradient orb framed by a soft halo ring (used as the circle dot everywhere).
- **Icons:** one cohesive outline set, 24px grid, ~1.9 stroke, **duotone fill when active**. Bottom-nav active state = circle accent + a soft glass pill behind the icon.
- **Motion:** restrained GSAP micro-motion — active icons spring in and gently “breathe”; reaction bursts; sheet slide-ups. Premium, never bouncy-toy.
- **Typography:** system sans, tight headings, two weights. Sentence case.
- **Responsive:** phone column / tablet rail / desktop sidebar + multi-column (built).

**Where design is most needed:** the entire **Remember** pillar (feed/stories/reels/albums/milestones/create), the **parent Learn dashboard**, the **grandparent/viewer experience**, and the **onboarding** (create circle → add kids → invite family).

---

## 7. Data model (real, so designs map to what exists)

Supabase (Postgres). The product is **read from real tables — no placeholder data.**

- **circles** — `id, owner_id, name, kind, accent`. Read-open; write owner-only (RPCs `create_circle`, `delete_circle`).
- **circle_members** — `circle_id, member_id, role`. Owner-RLS.
- **profiles** — adults + kids. `role` (`kid` vs adult), `display_name, photo_url, username, dob, friend_code, guardian_id, diamonds, xp, level`. Own-row + guardian-readable RLS.
- **child_profiles** — legacy/lightweight kid records (`display_name, color, emoji, age, username`). Fallback only; new kids are `profiles role='kid'`.
- **guardianships** — parent↔kid links.
- **worlds** — the six learning worlds (`key, name, color, order_idx`).
- **world_progress / skill_mastery** — per-kid mastery → rings.
- **kinetik_routines / kinetik_events / kinetik_moments** — the Plan + (current) Moments data. `kinetik_moments` will be extended for the new Remember pillar (media_url, media_kind, audience, reactions, comments).
- **kinetik_people** — *legacy* lightweight calendar identities (linked to real profiles via `link_id`). The Plan calendar uses these; the new family roster uses real `profiles`/`circle_members`. (Migration target: converge on real identities.)
- **hq_app** — apps published from CircleHQ (`product='kinetik'`, `html` artifact, `category, thumbnail, visibility, circle_ids, featured`).

**Key RPCs (security-definer, owner/guardian-scoped):** `social_stats` (circles/connections/friends), `kid_world_rings(kid)`, `kinetik_member_progress(circle)`, `create_circle` / `delete_circle`, `add_kid_to_circle`, `search_users` / `my_friends` (directory), `adjust_kid_diamonds`.

**Implication for design:** member rosters, rings, diamonds, and stats only resolve **when signed in as the owner/guardian** (RLS). Design empty/loading/locked states accordingly.

---

## 8. Key flows to design

1. **Onboarding:** sign in (Google for parents; username+PIN for kids) → create or join a circle → add kids → invite a co-parent / grandparent → land on Today.
2. **Post a moment:** capture/upload → caption + tag members → choose audience → optional diamond reward → share to circle → appears in feed/stories/reels.
3. **Reward & recognize:** parent attaches diamonds to a moment or a learning milestone; kid sees it in their wallet/notifications.
4. **Kid plays Learn:** kid logs in → worlds → drill/lab → earns XP/diamonds → ring fills → (optional) milestone surfaces as a Moment.
5. **Grandparent view:** viewer opens the circle → sees curated Moments/Albums → reacts/comments → cannot navigate into planning or kids’ private learning.
6. **Manage circle:** owner edits circle (name/theme/delete), manages members & roles, manages installed Apps.

---

## 9. Constraints & principles (must respect)

- **Privacy & child safety first.** No public surface, no stranger discovery, kid content defaults to kid-safe. Viewers are read+react only.
- **Real data, honest states.** Show real values or honest empty/locked states; never fabricate (e.g., don’t show fake diamonds/rings).
- **One economy, one identity, one theme** — consistent across all five surfaces.
- **Performance/feel** — instant, glassy, micro-animated; mobile-first but desktop-capable.
- **Tech canvas (FYI):** React + Vite + Supabase, deployed on Vercel; light/dark; responsive shell already built. Media will use Supabase Storage with circle-scoped access.

---

## 10. Current state vs to-design

**Exists today (shipping):** the Circle shell (responsive nav/sidebar, per-circle theming, glass design language), Plan (Today/Calendar/routines), the **Circle/Me** surface (real members + roles + tiers + rings + diamonds wallet, circle create/rename/delete), the **Apps** store + full-screen app runner, ArgantaLab’s kid learning worlds.

**To design (new):**
1. **Remember pillar** — feed, stories, reels, albums, milestones, create, profile, reactions/comments. *(Top priority.)*
2. **Learn dashboard (parent view)** — all kids’ worlds at a glance; per-kid deep dive.
3. **Grandparent/viewer experience** — a calm, consume-first variant.
4. **Onboarding** — first-run, create circle, add kids, invite family.
5. **Unified notifications/activity.**

---

## 11. Open questions for the designer

- **Moments v1 scope:** photos + stories + create first, with reels/video in v2? Or video from day one?
- **Reactions:** the multi-emoji cluster vs a single heart — how far toward “rich reactions” without feeling like a vanity metric?
- **Albums vs feed:** how explicit is the line between ephemeral feed and durable albums? Auto-curate, or manual?
- **Grandparent surface:** a trimmed version of Moments, or a distinct “Family” digest experience?
- **Learn ↔ Remember bridge:** how prominent are auto-suggested milestone moments — celebratory nudge, or quiet timeline entry?
- **Kid posting rights:** what can kids post/see, and what needs parent approval?
- **Brand expression:** how much should ArgantaLab’s playful kid identity show through inside the calmer parent shell?

---

*Appendix — visuals already concepted (request from the requester): Login redesign; top-bar circle dropdown; App store; bottom nav; Me/profile (v1–v3); Moments concept (reel/feed/create/profile); this unified architecture diagram.*
