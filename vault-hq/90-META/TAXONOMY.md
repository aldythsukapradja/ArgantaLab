# Taxonomy — the controlled vocabulary

> The words the whole vault agrees on. If it's not here, don't invent a new one silently —
> add it here first. This is what keeps captures queryable years from now.

## Frontmatter fields (allowed values)

| Field | Allowed values |
|---|---|
| `status` | `raw` · `reviewing` · `distilled` |
| `intent` | `capture` · `digest` · `decision` · `action` · `repo-context` · `fable-brief` · `archive` |
| `confidence` | `low` · `medium` · `high` |
| `promoted` | `false` · `true` |
| `captured` | `YYYY-MM-DD` |

## Domains (the life areas — use one or more)

- `self` — personal identity, habits, reflection
- `family` — Kinara, Baginda (Abdil), Keyla, family life
- `work` — North Oil / reservoir / enterprise-AI day job
- `arganta` — startup / building (ArgantaLab, KinetikCircle, Circle HQ)
- `health` — physical + mental
- `learning` — skills, study, notes-to-self
- `money` — finance, treasury, pricing, CAC
- `relationships` — network, people
- `decisions` — choices, tradeoffs, principles
- `ai-context` — prompts, model behavior, agent instructions

## Tags (cross-cutting, optional — `#tag` in body)

- `#inferred` — a guess, not observed. **Required** on anything not evidenced.
- `#known` — observed / sourced. Used on persona + truth claims.
- `#decision` · `#action` · `#principle` · `#reference` · `#inspiration`
- `#privacy` — contains sensitive personal/family detail; handle with care.
- `#ip-risk` — involves third-party material; principle-only, never copy.

## Provenance discipline

Every persona/truth claim carries its source tag (`#known` / `#inferred`). Every metric
carries whether it's measured or simulated. No orphan opinions — a claim with no source
is a claim to verify, not to trust.

## Links
- Applied by: [[DIGEST]] · [[CONVENTIONS]]
