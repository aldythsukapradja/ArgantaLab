# Identity, EXP, Diamonds, And Ledgers

## Identity Model

There are four important account types:

| Account Type | Login Source | Purpose |
|---|---|---|
| Adult | Google OAuth | Normal game account |
| Kid | Kinetik Circle kids account | Education-led game account |
| Guardian | Google OAuth + Kinetik Circle | Parent/teacher/guardian controls |
| GM/Admin | Google OAuth + role | Admin and operations |

## Identity Graph

```mermaid
flowchart LR
  Google["Google OAuth"] --> Profile["Supabase profile"]
  Kinetik["Kinetik Circle"] --> Profile
  Arganta["ArgantaLabs identity"] --> Profile
  Profile --> Character["Game character"]
  Profile --> Circle["Circle membership"]
```

## EXP Model

There are two separate EXP lines.

| User Type | EXP Source | Ranking Source |
|---|---|---|
| Adult | Game server | Monster EXP only |
| Kid | ArgantaLabs education ledger | Education EXP only |

## Adult EXP Rules

Adults can receive:

- Monster EXP.
- Quest EXP.
- Milestone EXP.
- GM adjustment EXP.

Adult monster ranking only uses:

```text
monster_exp_ledger.amount
```

## Kid EXP Rules

Kids can receive:

- Education quest EXP from ArgantaLabs.
- Education milestone EXP from ArgantaLabs if approved.

Kids cannot receive:

- Monster EXP.
- Combat progression EXP.
- Local game-created education EXP.

Hard validation:

```text
if account_type = kid and exp_source = monster:
  reject

if account_type = kid and source is not ArgantaLabs education event:
  reject progression EXP
```

## Diamond Rules

Diamonds have one source of truth:

```text
ArgantaLabs Diamond Ledger
```

Supabase may store:

- Mirrored balance.
- Ledger references.
- Last synced event.
- Spend request status.

Supabase may not:

- Invent diamond balance.
- Locally adjust diamond balance without ArgantaLabs event.
- Let GM directly add diamonds.

## Diamond Spend Flow

```mermaid
sequenceDiagram
  participant Client
  participant API as Game API
  participant Arganta as ArgantaLabs Ledger
  participant DB as Supabase

  Client->>API: request diamond purchase
  API->>Arganta: create spend request
  Arganta->>Arganta: validate balance
  Arganta-->>API: approved or rejected
  API->>DB: write diamond_ledger_ref
  API->>DB: grant item only if approved
  API-->>Client: purchase result
```

## Milestones

Adult milestones:

- Reach level 99.
- Earn 1M monster EXP.
- Complete path quest.
- Kill boss.
- Obtain rare drop.
- Join clan.

Kid milestones:

- Complete first education quest.
- Complete 10 math quests.
- Complete reading streak.
- Reach education level 10.
- Finish circle assignment.
- Earn learning badge.

Shared milestones:

- Create first character.
- Customize avatar.
- Join circle or family.
- Attend event.
- Unlock cosmetic.

## Ledger Principle

Every progression event must be append-only.

```text
Do not mutate totals without ledger rows.
Totals are derived from ledger rows.
```

