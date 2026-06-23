-- ============================================================
--  ARGANTALAB · WALLET CLEANUP  (one-time, run AFTER migration_spine.sql)
--  Fixes the legacy diamond LEAK: the pre-spine client wrote whichever
--  session was active (often the parent's 50,000) into kids' cached
--  profiles.diamonds. The ledger is the truth, so we reset every kid to
--  their real ledger balance (parent grants they actually received; 0 if
--  none). Adults are left untouched — their balance is correctly ledgered.
--
--  Safe & idempotent: re-running only corrects rows that still disagree.
-- ============================================================
begin;

update public.profiles p
  set diamonds = public.wallet_ledger_balance(p.id)
  where p.role = 'kid'
    and coalesce(p.diamonds, 0) <> public.wallet_ledger_balance(p.id);

commit;

-- VERIFY (every kid now equals their ledger; most will be 0 until granted):
--   select id, display_name, diamonds, public.wallet_ledger_balance(id) as ledger
--   from public.profiles where role = 'kid' order by display_name;
-- Grown-ups can then hand out diamonds from their own balance via grant_diamonds.
-- ============================================================
