# SKILL: hq-router
Knowledge graph link: ladders_to `hq.agents` (Guild) and `ns.w2f`
Status: P0 protocol from ORCHESTRATION-SPEC.html. The router as a checklist — no infrastructure required.

## When to use
Every non-trivial request in any session. This IS the Layer-3 router until P1+ automates it.

## The loop
1. **INTAKE** — one line: request + deliverable + domain.
2. **LADDER** — name the graph node this serves (`node_get` to confirm state). No node → `_INBOX/capture.md` or decline as busywork. Reservoir/external work ladders to `50-PROFESSIONAL` instead. RETAIN-verdict nodes only get protection work, never "improvements".
3. **SCORE** — run effort-scorer. Output: model + scaffolding + escalate-if.
4. **ROUTE** — pick the office path (spec §02). Note goal-office vs execution-path if they differ.
5. **LOAD** — pull node state + the path's skills + only the vault files that bear on this task.
6. **REACH** — use only the path's allowed connectors.
7. **RUN** — reversible: proceed. Irreversible (migrations, deletions, money, publishing): stop and flag.
8. **VERIFY** — adversarial pass sized by stakes. Proof of done = fresh `office_report` shows the node moved, or written acceptance criteria met. "Code exists" is not proof.
9. **HARVEST** — append one row to `vault/40-ROADMAP/router-log.md`; write session summary to `vault/10-PROJECTS` if anything shipped; propose/resolve the verdict.

## Run-log row format
`| run_id | date | request | node | goal_office | exec_path | A_H_S_C_V=total | model | outcome | verify | graph_moved? | cost_est |`

## Fast path
Score total ≤3: steps 4–6 collapse to defaults (current model, no extra skills, no connectors). The log row is still mandatory — calibration needs the easy runs too.

## Hard gates (never prompt-only once P3 automates)
- Legal: open hold on target node blocks monetize/publish runs.
- Treasury: no real spend without human.
- Two failed verifies at one tier → escalate, never a third attempt.
- Frame-guessing detected → escalate one tier immediately.

## Calibration duty
After ~20 rows, review the log Guild-style: where over-/under-provisioned? Update effort-scorer thresholds and remove its DRAFT flag.
