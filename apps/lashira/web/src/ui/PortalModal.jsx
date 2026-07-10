// PortalModal — the confirm gate before leaving the Kingdom for a realm
// (IMPL §BT-2: "no instant teleport; always confirm"). Also renders the
// per-circle ACCESS LOCK when the player isn't in circle scope (IMPL §1.2).

const REWARD_PREVIEW = {
  lashira_keep: 'City prosperity · Bloom · Blueprints',
  bloomwall_pass: 'Bloom · Stone · Ore · Blueprints',
  hearthrush_kitchen: 'Meals · Bloom · City happiness',
  fountain_festival: 'Event tokens · cosmetics (event rules)',
  emberring_arena: 'Rank · score · cosmetic eligibility',
};

const SUBTITLE = {
  lashira_keep: 'City · build the circle kingdom',
  bloomwall_pass: 'Tower Defense · hold the south gate',
  hearthrush_kitchen: 'Kitchen Rush · serve the orders',
  fountain_festival: 'Festival · puzzle the fountain',
  emberring_arena: 'Arena · friendly duels',
};

export default function PortalModal({ portal, locked, accountType, onEnter, onClose }) {
  if (!portal) return null;
  const id = portal.id;
  return (
    <div className="portal-modal-scrim" onClick={onClose}>
      <div className="portal-modal" style={{ '--realm-color': portal.color }} onClick={(e) => e.stopPropagation()}>
        <div className="pm-head" style={{ background: portal.color }}>
          <b>{portal.name}</b>
          <span>{SUBTITLE[id] || portal.theme}</span>
        </div>
        {locked ? (
          <div className="pm-body">
            <p className="pm-lock">🔒 The realms belong to your <b>circle</b>.</p>
            <p className="pm-lock-sub">Switch to your circle farm (Travel → your circle) to enter this world. Personal farms and guests can't open the realms.</p>
            <div className="pm-actions">
              <button type="button" className="pm-btn ghost" onClick={onClose}>Got it</button>
            </div>
          </div>
        ) : (
          <div className="pm-body">
            <div className="pm-row"><span>Rewards</span><b>{REWARD_PREVIEW[id] || '—'}</b></div>
            <div className="pm-row">
              <span>Your account</span>
              <b>{accountType === 'kid' ? 'Kid — earns resources & score' : 'Adult'}</b>
            </div>
            {accountType === 'kid' && (
              <p className="pm-kidnote">Kids help the kingdom with resources and score. Character XP and Diamonds only come from learning — never from playing.</p>
            )}
            <div className="pm-actions">
              <button type="button" className="pm-btn ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="pm-btn go" style={{ background: portal.color }} onClick={onEnter}>Enter</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
