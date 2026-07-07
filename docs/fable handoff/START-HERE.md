# 🚀 START HERE — Fable Handoff
### Target location: C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab\docs\fable handoff
### Date-critical: Fable is included in Cowork until END OF DAY July 7. After that, the toughest work costs API rates.

---

## WHAT'S IN THIS FOLDER

```
/prompts/           → paste these into Cowork (in order)
  01-FABLE-MASTER-PROMPT.md      ← TODAY. The big one: recon squad + wire all blind signals
  02-FABLE-DIGITAL-TWIN-PROMPT   ← TODAY (parallel session): mine your judgment → persona core
  03-...-superseded.md           ← older version of 01, kept for reference only. Ignore.
  04-...-original.md             ← the first handoff. Superseded by 01. Reference only.

/vault-and-skills/  → unzip these into your setup
  obsidian-brain-vault.zip       → unzip into Obsidian
  arganta-skills.zip             → unzip the SKILL.md files into .claude/skills/
  VAULT-HANDOFF.md               → the to-do list for filling the vault

/reference/         → read, don't paste
  HANDOFF-to-sonnet.md           → the full discussion thread, if you need context
  MEASUREMENT-AND-SENSOR-PLAN.md → before/after metrics + sensor map
  knowledge-graph-map.md         → skills ↔ graph nodes
  mcp-connector-map.html         → the media/marketing connector map (open in browser)
  private-os-spec.html           → the Opus-parity skillset spec (open in browser)
```

---

## THE MODEL PLAN (why the order matters)

- **Fable = included in Cowork ONLY until end of day July 7.** Use it TODAY for the 3
  frame-inventing milestones: recon, wiring, orchestration spec.
- **Sonnet 4.6 = 2× usage promo in Cowork until Aug 5.** Use it AFTER today for the
  execution milestones: activation model, vector DB, media pipeline, daily loop.
- The vault + skills are the RAILS. Once Fable lays them today, Sonnet rides them cheaply
  all month. Consistency lives in the rails, not the model.

---

## STEP BY STEP — DO THIS NOW

### ☐ STEP 0 — Put this folder in place (2 min)
Move this whole `fable handoff` folder into:
`C:\Users\aldhy\OneDrive\Documents\GitHub\ArgantaLab\docs\fable handoff`
It's already inside your repo, which matters — Cowork needs to see the repo + these docs together.

### ☐ STEP 1 — Set up the sandbox (3 min)
Open Cowork → "Work in a project or folder" → point it at your ArgantaLab repo folder.
ONLY that folder. This is the single most important safety habit — heavy autonomous runs
interpret "clean up" broadly, so the folder boundary is your wall.

### ☐ STEP 2 — Pick Fable (1 min)
In Cowork's model picker, select **Fable 5** ("Included until July 7 — for your toughest
challenges"). Set Effort to High if you can.

### ☐ STEP 3 — Run the recon + wiring (the heavy one, start early)
Paste the full contents of `/prompts/01-FABLE-MASTER-PROMPT.md`.
This does: form a subagent squad → scan repo + graph + memory → produce a real gap list →
wire every blind signal → verify → write PLAN-followup.md for anything unfinished.
Let it run. This is a long session — the 2× window is what keeps it from hitting the wall.

### ☐ STEP 4 — Start the persona core in PARALLEL (separate Cowork session)
Open a second Cowork session, Fable again, paste `/prompts/02-FABLE-DIGITAL-TWIN-PROMPT.md`.
This mines your judgment into `persona-core.md`. It doesn't depend on Step 3, so run both.

### ☐ STEP 5 — If runway holds today: orchestration spec
Still on Fable, ask it to design the Circle HQ Layer-3 router (the orchestration spec —
it's described in the reference docs and the vault's roadmap-tracker). This is the third
and last frame-inventing job worth Fable.

### ☐ STEP 6 — Tomorrow onward: switch to Sonnet, ride the rails
Everything else — activation model, vector DB, media pipeline — run on Sonnet 4.6 in Cowork
on the 2× promo (through Aug 5). Point it at the PLAN-<slug>.md files Fable wrote. It executes;
it doesn't need to invent.

### ☐ STEP 7 — Plug in the vault
Unzip `obsidian-brain-vault.zip` into Obsidian. Unzip `arganta-skills.zip` into `.claude/skills/`.
Fable's Phase 3 (in prompt 01/02) fills the `[[TO FILL]]` markers with real content.

---

## THE ONE RULE FOR TODAY
Real, wired signals beat a modeled guess about them. If you have to cut scope, finish the
recon + wiring (Step 3) completely before anything else. That's the foundation the whole
month builds on.

## AFTER EACH FABLE RUN
Check the "verify" discipline: did an adversarial pass actually confirm it, or is it just
"claimed done"? Fable's prompts include this check — don't skip reading its verification section.
