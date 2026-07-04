# User Control Dashboard Design

## Purpose

The User Control Dashboard is for operations, analytics, user support, progression monitoring, ledger review, and safety. It is separate from the GM Dashboard, which controls game content and balance.

## Main Views

| View | Purpose |
|---|---|
| Overview | Active users, adults, kids, guardians, EXP, diamonds, quest completions |
| Active Users | Online, idle, current map, current action |
| Player Profiles | Account, characters, path, level, appearance, flags |
| Kids And Circles | Kids, guardians, circles, permissions |
| Adult Progression | Monster EXP, level, path, rankings |
| Kids Education Progress | Education quests, subjects, skills, ArgantaLabs EXP |
| EXP Bank | Adult EXP, monster EXP, quest EXP, kids education EXP |
| Diamond Ledger | ArgantaLabs mirror, last sync, mismatch warnings |
| Milestones | Level 99, quest completions, education badges |
| Rankings | Adult monster EXP ranking and kids education ranking |
| Moderation | Mute, ban, teleport, inspect inventory |
| Audit | Suspicious EXP, incorrect kids EXP source, diamond mismatch |

## Active User Metrics

```text
active users = sessions with last_seen_at within 60 seconds
idle users = sessions with last_seen_at between 60 seconds and 10 minutes
offline users = no recent heartbeat
```

Metrics:

- Active adults.
- Active kids.
- Active guardians.
- Active GMs.
- Top current maps.
- Sessions by device/client version.
- Last action by user.
- Error count.

## Profile Detail

Profile page should show:

- Account type.
- Linked Google/Kinetik/Arganta IDs.
- Character list.
- Current character.
- Path.
- Level.
- Appearance/loadout.
- Current map.
- Inventory summary.
- Quest progress.
- Milestones.
- EXP ledger rows.
- Diamond ledger references.
- GM action history.

## Ranking Rules

Adult ranking:

```text
Adult monster ranking = sum(monster_exp_ledger.amount)
```

Kids ranking:

```text
Kids education ranking = sum(kid_education_exp_ledger.amount)
```

Do not mix these leaderboards unless the UI clearly labels them.

## EXP Source Audit

The dashboard must flag:

- Kid received monster EXP.
- Adult monster ranking includes quest EXP.
- EXP ledger row has invalid source.
- Character level does not match progression EXP.
- Admin adjustment has no GM action.
- Duplicate ArgantaLabs education event.

## Diamond Monitor

The diamond dashboard is read-only from the game side.

Fields:

- Profile.
- ArgantaLabs user ID.
- Current mirrored balance.
- Last ledger event ID.
- Last synced time.
- Sync checksum.
- Spend requests.
- Mismatch warnings.

Rule:

```text
Supabase stores a mirror/reference only.
ArgantaLabs is the single point of truth for diamonds.
```

## Safety Controls For Kids

Kid accounts should support:

- Guardian link.
- Circle membership.
- Chat restrictions.
- Friend restrictions.
- Education-only progression.
- Guardian-visible activity.
- Content restrictions.
- No monster EXP progression.

