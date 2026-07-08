---
title: SYNC
product: HQ
type: spec
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-08
owner: aldyth
confidence: high
domain: [ai-context]
tags: [rail, sync, runbook]
---

# SYNC — load all of vault-hq into Obsidian + your phone

How to get everything in this folder into Obsidian and onto your phone, and keep it synced
with the git source of truth. Runbook — run it yourself.

## A. Get the files on your computer
```
git clone <ArgantaLab repo>                      # first time
cd ArgantaLab
git fetch origin claude/digital-brain-twin-os-omes01
git checkout claude/digital-brain-twin-os-omes01
git pull
```
The vault is the `vault-hq/` folder.

## B. Open it in Obsidian
1. Obsidian → **Open folder as vault** → select **`vault-hq/`** (the subfolder, not the repo
   root — keeps app code out of your vault).
2. Trust author, enable. Open **Graph View** (`Cmd/Ctrl+G`) → turn on **Groups**, color by
   folder or `tag:moc`. Enable **Properties** to see `class` / `canonical` / `status`.

## C. Keep desktop ↔ GitHub in sync
`vault-hq` is a subfolder of the monorepo, so the Obsidian-Git plugin (which wants vault-root =
git-root) doesn't fit. Use a **background git job at the repo root**, every ~10 min:
```
git -C /path/to/ArgantaLab pull --rebase
git -C /path/to/ArgantaLab add vault-hq \
  && git -C /path/to/ArgantaLab commit -m "vault edits" \
  && git -C /path/to/ArgantaLab push
```
(Task Scheduler / cron / launchd.) Claude writes only `60-CAPTURES/`; you edit the distilled
notes — disjoint write domains keep it conflict-free.

## D. Get it on your phone
- **Easiest:** Obsidian Sync (paid) mirrors your desktop `vault-hq` vault to the mobile app.
  Git handles Claude↔desktop↔HQ-app; Obsidian Sync handles desktop↔phone.
- **Free:** a git client app (Working Copy on iOS / Obsidian-Git on Android) pulling the repo,
  opening `vault-hq` as the vault. Clunkier on a monorepo subfolder.

## E. Verify the loop
Edit a note on desktop → wait one sync cycle → confirm it changed on your phone. Full ring proven.

## Links
- Data contract: [[PIPELINE]] · Entry: [[HOME]]
