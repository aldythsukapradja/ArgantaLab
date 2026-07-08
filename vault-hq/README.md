# Vault HQ

This folder **is** my second brain. One self-contained unit that plays three roles at once:

1. an **Obsidian vault** — open this folder in Obsidian and it works;
2. a **portable package** — copy-paste it anywhere, or onto a new device;
3. a **standalone repo** — `git init` inside it and it becomes its own repo.

Those are the same folder. I never restructure to switch between them.

---

## The One-Folder Principle (do not break these)

1. **Self-contained** — nothing inside references a file *outside* this folder.
2. **Vault-relative links only** — Obsidian `[[wikilinks]]` + the internal `attachments/`
   folder. No absolute paths, no `../`.
3. **Config travels** — `.obsidian/` (when present) lives inside, so a clone opens identical.
4. **One source of truth for the rules** — [[DIGEST]]. Everything else obeys it.

If a change would violate one of these, it doesn't belong in the vault.

---

## Map

| Folder | Holds |
|---|---|
| `00-CORE/` | who I am + how the system thinks (persona, daily-loop, mental-model) |
| `10-PROJECTS/` | the actual products (ArgantaLab, KinetikCircle, Circle HQ) |
| `20-SYSTEM/` | the rails (skills-index, connectors, ladders) + `skills/` reference copies |
| `30-DATA/` | memory + measurement (graph-map, sensor-plan, coverage) |
| `40-ROADMAP/` | live initiative state |
| `50-PROFESSIONAL/` | career thread |
| `60-CAPTURES/` | intake — `_INBOX/` (raw drops) + `_ARCHIVE/` (interesting, not useful now) |
| `90-META/` | the rules: [[TAXONOMY]], [[CONVENTIONS]], and `_provenance/` (historical build docs) |
| `attachments/` | pasted images / screenshots (keeps links from breaking) |

Start at [[HOME]]. Read [[DIGEST]] to understand how raw input becomes organized notes.

---

## Transplanting this vault

- **New Obsidian / new device** → point Obsidian at this folder. Done.
- **Copy elsewhere** → copy the whole `vault-hq/` folder. Self-contained, so it just works.
- **Dedicated repo** → `cd vault-hq && git init && git add . && git commit`. No edits needed.

*This vault is the DISTILLED layer. Raw material lands in `60-CAPTURES/_INBOX/` and is
harvested by hand — nothing reaches a distilled/"truth" state until I've reviewed it.*
