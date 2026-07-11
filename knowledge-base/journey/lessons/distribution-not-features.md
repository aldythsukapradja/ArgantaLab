---
type: lesson
status: living
tags: [arganta, lesson]
---

# Distribution is the work; features are not. Polish is not progress.

> [!quote] The principle
> A milestone is not done until a person who is not in your family has done the thing. Code shipping is not a milestone — behaviour is.

## Evidence
- Master KB §11 **D1 — Zero external users** (🔴 Existential): `hq_growth_overview()` returns household only. The prescribed fix is literally "Distribution, not features. One app, one channel, ten strangers."
- Master KB §9 *Read the shape*: "P0 → P6 is compounding platform work. **P7 is not.** The last ~40 commits are cosmetic polish on a game with zero external players."
- Master KB §12 weekly log: ~130 commits, surfaces added (Skill Forge, Character Page, cosmetics), **surfaces removed: 0, external users: 0**. The *Watch the "removed" column* caution: "It has never been non-zero. That single cell is the whole diagnosis."
- Every cluster ends the same way: HQ is "a cockpit for a plane on the tarmac" (`CONCEPT_JARVIS_CEO.md`, §10 status board); the Bridge is "a truthful dashboard over an empty room" (`apps/mcp/README.md`); LashiraBloom's P7 openworld "polishes a game with zero external players."
- `apps/kingdom/web/DEPLOY.md` — tracking the 953 MB data bundle in git "to keep deploy simple" was chosen over distribution hygiene; convenience now, history bloat forever (D2/D3).

## The pattern
Feature work feels like progress because it produces visible artifacts and green checkmarks. But if no stranger's behaviour changed, the net delta is zero. The repo is unusually good at *building* and has never once had to *remove* a surface — which means it has never been pressured by real usage.

## Watch for
- A week where "surfaces added" is long and "external users" is still 0 — that is the vanity-progress signature, not a productive week.
- Re-speccing/polishing a surface (Battle Builder 5×, Bloomwall 6× in a day) instead of putting the existing version in front of one non-household user.
- Treating "shipped clean and stayed shipped" as success. The Bridge did exactly that and is still inert because D1 is upstream of everything.
- The tell that you're avoiding distribution: adding the 15th feature to a product that has never been used by anyone outside the house.
