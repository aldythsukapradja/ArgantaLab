// Slide-up panels: Shop, Barn, Kin helpers, Home. Data-driven from the catalogs.
import { CROPS } from '../data/crops.js';
import { SPECIES } from '../data/livestock.js';
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
          {item.icon}<b>×{fmt(item.count)}</b><em>💎{fmt(item.sell * item.count)}</em>
        </span>
      ))}
    </div>
  );
}

function Shop({ snap, game, onClose }) {
  const kid = snap.role === 'kid';
  const rows = produceRows(snap);
  const produceCount = rows.reduce((a, b) => a + b.count, 0);
  const total = produceTotal(rows);
  return (
    <>
      <Head title="🛒 Sprout's Shop" sub={`You have 💎 ${snap.diamonds} Diamonds`} onClose={onClose} />
      {Object.values(CROPS).map((c) => {
        const locked = c.ring && kid; // learning-gated seeds locked for kids offline
        return (
          <div className="row" key={c.id}>
          <div className="ico">{c.emoji}</div>
          <div className="grow">
            <div className="name">{c.name} seed</div>
            <div className="meta">
                Owned: {fmt(snap.seeds?.[c.id] || 0)} · {c.days} days · sells for 💎{c.sell}{kid ? ' (as XP for you)' : ''}
                {locked ? ' · 🔒 finish a learning ring to unlock' : ''}
              </div>
            </div>
            <button
              className="rbtn"
              disabled={locked || snap.diamonds < c.seedCost}
              onClick={() => game.buySeed(c.id, 1)}
            >
              Buy 💎{c.seedCost}
            </button>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 12, borderStyle: 'dashed' }}>
        <div className="ico">📦</div>
        <div className="grow">
          <div className="name">Sell all produce</div>
          <div className="meta">{produceCount} item(s) · total value 💎{fmt(total)}{kid ? ' · kid payout is +1 XP' : ' · pays out as Diamonds'}</div>
          <ProducePreview rows={rows} />
        </div>
        <button className="rbtn ghost" disabled={produceCount === 0} onClick={() => game.sellAll()}>{kid ? 'Sell +XP' : `Sell 💎${fmt(total)}`}</button>
      </div>
    </>
  );
}

function Barn({ snap, game, onClose }) {
  return (
    <>
      <Head title="🐄 Barn & Coop" sub="Feed daily → collect produce next morning" onClose={onClose} />
      <div style={{ marginBottom: 10 }}>
        <button className="rbtn" onClick={() => game.feedAll()}>🌾 Feed all animals</button>
      </div>
      {snap.livestock.map((a) => {
        const sp = SPECIES[a.species];
        const hearts = '❤'.repeat(Math.max(1, Math.round(a.affection / 20)));
        return (
          <div className="row" key={a.id}>
            <div className="ico">{sp.emoji}</div>
            <div className="grow">
              <div className="name">{a.name} <span className="meta">the {sp.name}</span></div>
              <div className="meta">
                <span className="hearts">{hearts}</span> · {a.fed ? 'fed ✓' : 'hungry'} ·{' '}
                {a.produce ? `${sp.produceName} ready ${sp.produceEmoji}` : 'no produce yet'}
              </div>
            </div>
            {a.produce
              ? <button className="rbtn" onClick={() => game.collectProduce(a.id)}>Collect</button>
              : <button className="rbtn ghost" onClick={() => game.petAnimal(a.id)}>Pet ❤</button>}
          </div>
        );
      })}
    </>
  );
}

function Kin({ snap, game, onClose }) {
  return (
    <>
      <Head title="🍃 Kin Helpers" sub="Assign a Kin a chore — it runs automatically each morning" onClose={onClose} />
      {snap.kins.map((k) => (
        <div className="row" key={k.id}>
          <div className="ico" style={{ background: '#eef7e9' }}>🍃</div>
          <div className="grow">
            <div className="name">{k.name} <span className="meta">· {k.element}</span></div>
            <div className="meta"><span className="hearts">{'❤'.repeat(Math.max(1, Math.round(k.happiness / 20)))}</span> · best at {k.aptitude}</div>
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
          </div>
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
                <div className="meta">Owned: {fmt(count)} · grows in {crop.days} days · harvest sells 💎{fmt(crop.sell)}</div>
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
              <div className="meta">Owned: {fmt(item.count)} · {fmt(item.count)} × 💎{fmt(item.sell)} = 💎{fmt(item.count * item.sell)}</div>
            </div>
          </div>
        ))}
        <div className="sell-total">
          <span>Total produce value</span>
          <b>💎{fmt(total)}</b>
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
        <div className="meta">Upgrades unlock with 💎 Diamonds + your circle's learning rings (coming soon)</div>
      </div></div>
      <div className="row"><div className="ico">⭐</div><div className="grow">
        <div className="name">Level {snap.level}</div>
        <div className="meta">{snap.role === 'kid' ? 'Learn the 6 Worlds or sell produce to gain XP and level up' : 'Play to gain diamonds and level up — faster tools, more energy'}</div>
      </div></div>
      <div className="row"><div className="ico">💎</div><div className="grow">
        <div className="name">{snap.diamonds} Diamonds</div>
        <div className="meta">The only currency · spend on seeds, earn by {snap.role === 'kid' ? 'learning' : 'selling produce'}{snap.guest ? ' (sign in to sync)' : ''}</div>
      </div></div>
      <div className="row" style={{ borderStyle: 'dashed' }}><div className="ico">🌙</div><div className="grow">
        <div className="name">End the day</div>
        <div className="meta">Crops grow, animals give produce, energy restores</div>
      </div><button className="rbtn" onClick={() => game.sleep()}>Sleep</button></div>
    </>
  );
}
