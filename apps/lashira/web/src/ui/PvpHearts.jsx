// Chunky hearts HP — shown only while inside the PvP arena, per the concept
// doc's kid-safety note ("HP shown as hearts rather than a thin bar — clearer,
// gentler"). Sits alongside the normal UnitCard (which still carries name/level/
// the detailed bar); this is the big at-a-glance "am I about to lose" read.
export function PvpHearts({ hp, maxHp }) {
  const total = 5;
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const filled = Math.round(frac * total);
  return (
    <div className="pvp-hearts" title={`${Math.max(0, Math.round(hp))}/${Math.round(maxHp)} HP`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={'pvp-heart' + (i < filled ? ' full' : '')}>❤</span>
      ))}
    </div>
  );
}
