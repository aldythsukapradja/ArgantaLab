// Slide-up panels: Shop, Barn, Kin helpers, Home. Data-driven from the catalogs.
import { CROPS } from '../data/crops.js';
import { SPECIES, animalGoodReady, animalGoodFrac } from '../data/livestock.js';
import { KIN_TASKS } from '../data/kins.js';

export function Panels({ panel, snap, game, onClose }) {
  if (!panel) return null;
  return (
    <div className="panel-scrim" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        {panel === 'shop' && <Shop snap={snap} game={game} onClose={onClose} />}
        {panel === 'barn' && <Barn snap={snap} game={game} onClose={onClose} />}
        {panel === 'kin' && <Kin snap={snap} game={game} onClose={onClose} />}
        {panel === 'house' && <Home snap={snap} game={game} onClose={onClose} />}
        {panel === 'inventory' && <Inventory snap={snap} game={game} onClose={onClose} />}
      </div>
    </div>
  );
}

function Head({ title, sub, onClose }) {
  return (
    <div className="phead">
      <div>
        <h2>{title}</h2>
        <p className="psub">{sub}</p>
      </div>
      <button className="xbtn" onClick={onClose}>✕</button>
    </div>
  );
}

const fmt = (n) => Number(n || 0).toLocaleString();

function produceInfo(id) {
  const crop = CROPS[id];
  if (crop) return { id, name: crop.name, icon: crop.emoji, sell: crop.sell };
  for (const sp of Object.values(SPECIES)) {
    if (sp.produce === id) return { id, name: sp.produceName, icon: sp.produceEmoji, sell: sp.sell };
  }
  return { id, name: id, icon: '📦', sell: 10 };
}

function produceRows(snap) {
  return Object.entries(snap.produce || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([id, count]) => ({ ...produceInfo(id), count: Number(count) }));
}

function produceTotal(rows) {
  return rows.reduce((sum, item) => sum + item.sell * item.count, 0);
}

function ProducePreview({ rows }) {
  if (!rows.length) return <div className="empty-note">No produce in your bin yet.</div>;
  return (
    <div className="produce-preview">
      {rows.map((item) => (
        <span className="produce-chip" key={item.id} title={`${item.name}: ${item.count} x ${item.sell}`}>
          {item.icon}<b>×{fmt(item.count)}</b><em>🥇{fmt(item.sell * item.count)}</em>
        </span>
      ))}
    </div>
  );
}

function Shop({ snap, game, onClose }) {
  const op = snap.gold === Infinity;
  const gold = op ? Infinity : Number(snap.gold || 0);
  const rows = produceRows(snap);
  const produceCount = rows.reduce((a, b) => a + b.count, 0);
  const total = produceTotal(rows);
  return (
    <>
      <Head title="🛒 Sprout's Shop" sub={`You have 🥇 ${op ? '∞' : fmt(gold)} Gold`} onClose={onClose} />
      {Object.values(CROPS).map((c) => {
        const canAfford = op || gold >= c.seedCost;
        return (
          <div className="row" key={c.id}>
          <div className="ico">{c.emoji}</div>
          <div className="grow">
            <div className="name">{c.name} seed</div>
            <div className="meta">
                Owned: {fmt(snap.seeds?.[c.id] || 0)} · grows fast · sells for 🥇{c.sell}
              </div>
            </div>
            <button
              className="rbtn"
              disabled={!canAfford}
              onClick={() => game.buySeed(c.id, 1)}
            >
              Buy 🥇{c.seedCost}
            </button>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 12, borderStyle: 'dashed' }}>
        <div className="ico">📦</div>
        <div className="grow">
          <div className="name">Sell all produce</div>
          <div className="meta">{produceCount} item(s) · total value 🥇{fmt(total)}</div>
          <ProducePreview rows={rows} />
        </div>
        <button className="rbtn ghost" disabled={produceCount === 0} onClick={() => game.sellAll()}>{`Sell 🥇${fmt(total)}`}</button>
      </div>
    </>
  );
}

function Barn({ snap, game, onClose }) {
  const now = Date.now();
  return (
    <>
      <Head title="🐄 Barn & Coop" sub="Feed an animal → its good is ready a bit later (tap it on the farm too)" onClose={onClose} />
      {snap.livestock.map((a) => {
        const sp = SPECIES[a.species];
        const hearts = '❤'.repeat(Math.max(1, Math.round((a.affection || 0) / 20)));
        const ready = animalGoodReady(a, now);
        const frac = animalGoodFrac(a, now);
        const status = ready ? `${sp.produceName} ready ${sp.produceEmoji}` : a.fedAt ? `${Math.round(frac * 100)}% → ${sp.produceEmoji}` : 'hungry';
        return (
          <div className="row" key={a.id}>
            <div className="ico">{sp.emoji}</div>
            <div className="grow">
              <div className="name">{a.name} <span className="meta">the {sp.name}</span></div>
              <div className="meta"><span className="hearts">{hearts}</span> · {status}</div>
            </div>
            {ready
              ? <button className="rbtn" onClick={() => game.collectAnimal(a.id)}>Collect {sp.produceEmoji}</button>
              : a.fedAt
                ? <button className="rbtn ghost" onClick={() => game.petAnimal(a.id)}>Pet ❤</button>
                : <button className="rbtn" onClick={() => game.feedAnimal(a.id)}>🌾 Feed</button>}
          </div>
        );
      })}
    </>
  );
}

function Kin({ snap, game, onClose }) {
  const roster = snap.kinRoster || snap.kins || [];
  const maxKins = snap.maxKins || 6;
  const deployedCount = roster.filter((k) => k.deployed).length;
  return (
    <>
      <Head title="🍃 Kin Helpers" sub={`Deploy up to ${maxKins} Kin onto your farm — deployed ${deployedCount}/${maxKins}`} onClose={onClose} />
      {roster.map((k) => (
        <div className={'row' + (k.deployed ? '' : ' kin-benched')} key={k.id}>
          <div className="ico" style={{ background: '#eef7e9', opacity: k.deployed ? 1 : 0.5 }}>🍃</div>
          <div className="grow">
            <div className="name">{k.name} <span className="meta">· {k.element}</span></div>
            <div className="meta"><span className="hearts">{'❤'.repeat(Math.max(1, Math.round(k.happiness / 20)))}</span> · best at {k.aptitude}</div>
            {k.deployed && (
              <div className="assign" style={{ marginTop: 6 }}>
                {KIN_TASKS.map((t) => (
                  <button
                    key={String(t.id)}
                    className={'aopt' + (k.task === t.id ? ' on' : '')}
                    onClick={() => game.assignKin(k.id, t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={'rbtn' + (k.deployed ? '' : ' ghost')}
            disabled={!k.deployed && deployedCount >= maxKins}
            onClick={() => game.setKinDeployed(k.id, !k.deployed)}
          >
            {k.deployed ? 'Deployed ✓' : 'Deploy'}
          </button>
        </div>
      ))}
    </>
  );
}

function Inventory({ snap, game, onClose }) {
  const produce = produceRows(snap);
  const total = produceTotal(produce);
  const selected = snap.selectedSeed;
  return (
    <>
      <Head title="🎒 Farm Bag" sub="Seeds to plant and produce ready to sell" onClose={onClose} />
      <div className="bag-section">
        <div className="bag-title">Seeds</div>
        {Object.values(CROPS).map((crop) => {
          const count = Number(snap.seeds?.[crop.id] || 0);
          return (
            <div className={'row compact' + (selected === crop.id ? ' selected' : '')} key={crop.id}>
              <div className="ico">{crop.emoji}</div>
              <div className="grow">
                <div className="name">{crop.name} seeds</div>
                <div className="meta">Owned: {fmt(count)} · harvest sells 🥇{fmt(crop.sell)}</div>
              </div>
              <button className="rbtn ghost" disabled={count <= 0} onClick={() => game.setSeed(crop.id)}>
                {selected === crop.id ? 'Selected' : 'Plant'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="bag-section">
        <div className="bag-title">Produce</div>
        <ProducePreview rows={produce} />
        {produce.map((item) => (
          <div className="row compact" key={item.id}>
            <div className="ico">{item.icon}</div>
            <div className="grow">
              <div className="name">{item.name}</div>
              <div className="meta">Owned: {fmt(item.count)} · {fmt(item.count)} × 🥇{fmt(item.sell)} = 🥇{fmt(item.count * item.sell)}</div>
            </div>
          </div>
        ))}
        <div className="sell-total">
          <span>Total produce value</span>
          <b>🥇{fmt(total)}</b>
          <button className="rbtn" disabled={produce.length === 0} onClick={() => game.sellAll()}>Sell all</button>
        </div>
      </div>
    </>
  );
}

function Home({ snap, game, onClose }) {
  return (
    <>
      <Head title="🏡 Farmhouse" sub={`${snap.name}'s home`} onClose={onClose} />
      <div className="row"><div className="ico">🏠</div><div className="grow">
        <div className="name">Stage: Cottage</div>
        <div className="meta">Upgrade your home with 🥇 Gold + 🪵🪨 materials (coming soon)</div>
      </div></div>
      <div className="row"><div className="ico">⭐</div><div className="grow">
        <div className="name">Level {snap.level}</div>
        <div className="meta">{snap.role === 'kid' ? 'Learn the 6 Worlds to gain XP and level up' : 'Play + battle to gain XP and level up — stronger skills'}</div>
      </div></div>
      <div className="row"><div className="ico">🥇</div><div className="grow">
        <div className="name">{snap.gold === Infinity ? '∞' : fmt(snap.gold)} Gold</div>
        <div className="meta">The play currency · earn by selling produce + battling, spend on seeds{snap.guest ? ' (sign in to sync)' : ''}</div>
      </div></div>
      <div className="row"><div className="ico">💎</div><div className="grow">
        <div className="name">{fmt(snap.diamonds)} Diamonds</div>
        <div className="meta">Learning currency — for cosmetics only (a Diamond shop is coming)</div>
      </div></div>
      <div className="row" style={{ borderStyle: 'dashed' }}><div className="ico">🌙</div><div className="grow">
        <div className="name">End the day</div>
        <div className="meta">Crops grow, animals give produce, energy restores</div>
      </div><button className="rbtn" onClick={() => game.sleep()}>Sleep</button></div>
    </>
  );
}
