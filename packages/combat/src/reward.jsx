// Shared REWARD pill — the nice "you got something" toast, distinct from the
// plain hint/error pill. Icon disc + amount + label, color-coded by tone, with a
// spring pop + float-fade (CSS lives in each app, class names below). Both games
// can render it. `rewards` = [{ id, icon, amount, label, tone }].
import React from 'react';

export function RewardToasts({ rewards = [] }) {
  if (!rewards.length) return null;
  return (
    <div className="reward-stack" aria-live="polite">
      {rewards.map((r) => (
        <div key={r.id} className={'reward-pill rp-' + (r.tone || 'gold')}>
          <span className="reward-ico" aria-hidden="true">{r.icon}</span>
          <b className="reward-amt">{r.amount}</b>
          <span className="reward-label">{r.label}</span>
        </div>
      ))}
    </div>
  );
}
