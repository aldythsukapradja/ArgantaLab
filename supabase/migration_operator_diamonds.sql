-- ============================================================
--  ARGANTALAB · LASHIRABLOOM OPERATOR · DIAMOND TOP-UP  (additive, idempotent)
--  "Operator gets everything free" already exists client-side for Bloom (a pure
--  local/farm-state number — apps/lashira/web/src/game/farm-logic.js: seedCost
--  becomes 0, stamina reads Infinity). Diamonds can't use that trick: they're a
--  REAL server-authoritative column (profiles.diamonds) that buy_cosmetic_item()
--  checks for real — a client-side fake number would just make a real purchase
--  fail with "insufficient funds" against the true balance.
--
--  So this is the diamonds equivalent: a SECURITY DEFINER RPC that tops the
--  CALLING account up to (at least) 1,000,000 diamonds, gated on the exact same
--  operator identity apps/lashira/web/src/net/account.js already uses
--  (OPERATOR_EMAILS allowlist) — re-checked SERVER-SIDE from the JWT, not a
--  client-passed flag. Self-service, no target param: an account can only ever
--  top up itself. Never lowers an existing higher balance.
--
--  Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ============================================================
begin;

create or replace function public.grant_operator_diamonds()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  -- Mirrors OPERATOR_EMAILS in apps/lashira/web/src/net/account.js exactly — keep
  -- both lists in sync if the operator roster ever changes.
  if em <> 'aldhyt.sukapradja@gmail.com' then
    return jsonb_build_object('ok', false, 'error', 'not_operator');
  end if;
  update public.profiles set diamonds = greatest(coalesce(diamonds, 0), 1000000) where id = uid;
  return jsonb_build_object('ok', true, 'balance', (select diamonds from public.profiles where id = uid));
end; $$;
grant execute on function public.grant_operator_diamonds() to authenticated;

commit;
