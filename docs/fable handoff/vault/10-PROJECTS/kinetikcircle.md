# KinetikCircle

> Family coordination OS. Part of the [[mental-model|UI/UX layer]].

## What it is
- Family OS: Today, Calendar, Moments, mini-apps, Circles/Connections/Friends. #known
- For my family — Kinara, Abdil, Keyla. #known

## Current state (July 7 pull)
- Core is live/green and RETAIN-flagged: Today, Calendar, Moments, mini-apps hub,
  Circles/Connections/Friends. Protect, don't touch. #known
- Mini-app batch confirmed all live/green: Travel, Padel, Kitchen, Vault. #known
- Blind: `sig.calendar_open_no_add` (the parent-hook health signal — Calendar itself is live,
  but "opened without adding" is unmeasured). #known
- Amber: `sig.invite_never_accepted` (partial) — flagged FIX, not instrument: the invite flow
  itself needs fixing; k-factor rides on it. #known

## Links
- Measured by: [[sensor-plan]]
