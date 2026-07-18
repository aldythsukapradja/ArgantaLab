# Founder Questions Before Content Production

The archaeology can establish what Git contains. These questions cover the points Git cannot safely answer. They should be resolved before `docs/content/` or the 30 episode scripts are created.

## Blocking questions

### 1. Why did the Kinetik repository begin as an RMO World Cup predictor?

- **Git fact:** `fbe65ef` is a World Cup forecast arena; `5f77dd3` replaces it with Kinetik on the same day.
- **Need from founder:** Was this a deliberate pivot, a reused repository, a temporary upload target, or unrelated work?
- **Why it matters:** This could be the opening episode, but the motive cannot be inferred.

### 2. Where is Kinetik’s pre-import history?

- **Git fact:** The first Kinetik family shell arrives in `5f77dd3` already broad: calendar, people, Ask, apps, storage adapters, and circle concepts.
- **Need from founder:** Did that code come from another private repository, a local archive, an earlier no-code prototype, or a single offline build?
- **Why it matters:** The public repository does not prove those features were invented on June 12.

### 3. Which commits correspond to actual public deployments?

- **Git fact:** deployment configuration exists, but most commits have no tag or release object. Neither repository has Git tags.
- **Need from founder:** A list of known launch/deploy dates, even if the audience was only the founder or family.
- **Why it matters:** “Committed,” “deployed,” “used,” and “released” are different claims.

### 4. May unmerged branches appear in the documentary?

- **Git fact:** three remote branches contain work absent from `main`, including Vault HQ, a Circle HQ handoff, and a Lashira basemap.
- **Need from founder:** Whether these are abandoned, private, pending, or safe to discuss.
- **Default if unanswered:** Label them as unmerged experiments and exclude their visuals from public content.

### 5. Are repository seed names and family records fictional?

- **Git fact:** historical UI and seed files may render names, circle records, email-like values, and service endpoints.
- **Need from founder:** Which values are fictional and which require redaction.
- **Default if unanswered:** Redact all personal-looking data and all endpoints.

### 6. Is the repository statement “0 external users” approved for publication?

- **Repository evidence:** July knowledge-base material records a zero-external-user state at the time it was written.
- **Need from founder:** Whether that statement was accurate, what date it describes, and whether it can be quoted publicly.
- **Why it matters:** It supports an honest pre-launch narrative but should not be generalized beyond its documented date.

### 7. What is the canonical public naming?

- **Git fact:** names include ArgantaLab, ArgantaLabs, Arganta, Kinetik, KinetikCircle, Family Pulse, KinQuest, Lashira, and Kingdom.
- **Need from founder:** Which names are current brands, product modules, internal codenames, or retired.
- **Why it matters:** The documentary can show naming evolution without accidentally reviving a retired brand.

### 8. How should AI-authored commits be credited?

- **Git fact:** ArgantaLab history attributes 133 commits to `Claude` and 547 to Aldyth Sukapradja, with five under another Aldyth identity.
- **Need from founder:** The working model: pair-programming tool, autonomous agent, implementation assistant, or another description.
- **Why it matters:** Commit author fields show attribution, not the human/AI decision-making process.

## Narrative questions

### 9. When did the two projects become one vision in your mind?

- **Git boundaries to react to:** `5ba1158` brings Kinetik/HQ structures into the ArgantaLab monorepo; `952676e` creates a shared identity/family/wallet spine; later shared packages make convergence explicit.
- **Need from founder:** The human decision may predate or follow the code.

### 10. Why did Moments repeatedly become central?

- **Git fact:** Moments displaces Ask in Kinetik navigation, gains real media and reactions, enters the monorepo Kinetik app, and is later reframed as Broadcast in HQ.
- **Need from founder:** Was the primary motivation memory-keeping, family connection, creation, distribution, or something else?

### 11. Why was authentication removed and then rebuilt?

- **Git sequence:** Supabase login (`0cd980e`) → guest-first/AuthWall (`4055682`) → player and parent gates → cloud auth/circles (`5ba1158`).
- **Need from founder:** What user experience or development problem drove each turn?

### 12. What caused the June 23 concentration of work?

- **Git fact:** June 23 is the busiest day in the collected ArgantaLab history, with 84 commits and several foundational changes.
- **Need from founder:** Sprint, deadline, architectural breakthrough, agent workflow, migration, or another cause.

### 13. Why did Kinetik become KinetikCircle?

- **Git fact:** `e6713c9` records the rename.
- **Need from founder:** Was “Circle” meant to emphasize family membership, privacy, multiple groups, or brand distinction?

### 14. What did “Family Pulse” mean that “Parent Analytics” did not?

- **Git sequence:** per-kid grown-up analytics (`1264f61`) → Family Pulse rename/redesign (`fdccc1b`).
- **Need from founder:** The intended emotional or product distinction.

### 15. Which deleted experiment taught the most?

- **Candidates from Git:** static Strike Zone, dedicated Login, standalone concept worlds, first App Builder, HQ Moments, Agent OS UI, landing/Nexus experiments, and Legacy Content Builder.
- **Need from founder:** A concrete lesson, not a retrospective success claim.

### 16. Was KinQuest always intended as the flagship?

- **Git fact:** `05793862` calls it the flagship “Star by ArgantaLab” RPG.
- **Need from founder:** Whether that status was decided before development or assigned in the commit narrative.

### 17. Why did creator tools recur under new names?

- **Git sequence:** Studio → Game Wizard → Builder Lab → App Builder → Studio v2 → Forge.
- **Need from founder:** What each rebuild fixed that the previous one could not.

### 18. What does “sovereign” mean in the late media commits?

- **Git fact:** repository language uses “sovereign audio” and “sovereign video.”
- **Need from founder:** The precise intended meaning—ownership, hosting, model independence, data control, or something else.

## Evidence and permission questions

### 19. Which visual assets are owned or licensed for public reuse?

- Brand reference images, sprite sheets, fonts, game art, and generated art should each be cleared.

### 20. Can historical commits containing configuration or endpoints be shown on screen?

- Default: show only redacted diffs and file names, never secrets or full endpoint values.

### 21. Are private repositories or local archives available for gaps?

- The largest gaps are pre-`5f77dd3` Kinetik and the human story around rapid June development.

### 22. Are Git timestamps in Asia/Qatar founder-local time?

- The archaeology currently uses commit dates as recorded by Git. Confirm the timezone convention before publishing “late night” or “after work” claims.

### 23. Were any commits backdated, imported, squashed, or authored offline?

- A commit date proves repository chronology, not necessarily the exact moment the idea originated.

### 24. May the documentary identify family members or workplace context?

- Founder context supplied in the brief is background, not repository evidence. Specific personal details require explicit approval and should never be inferred from seed data.

### 25. Which product surfaces were used by anyone besides the founder?

- Do not provide counts unless documented. A simple classification—founder-only, family test, invited test, public—would enable accurate language.

## Proposed confirmation record

For every answer used in content, record:

- question number;
- founder’s exact answer;
- date confirmed;
- whether the answer is public, paraphrase-only, or private background;
- related commits/files;
- any visual or privacy restrictions.

Founder testimony should be labeled **FOUNDER RECOLLECTION**, distinct from **GIT FACT** and **INFERENCE**.
