// Slide-up panels: Shop, Barn, Kin helpers, Home. Data-driven from the catalogs.
import { CROPS, STARTER_SEEDS } from '../data/crops.js';
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

function Shop({ snap, game, onClose }) {
  const kid = snap.role === 'kid';
  const produceCount = Object.values(snap.produce).reduce((a, b) => a + b, 0);
  return (
    <>
      <Head title="🛒 Sprout's Shop" sub={`You have 🌸 ${snap.bloom} Bloom`} onClose={onClose} />
      {Object.values(CROPS).map((c) => {
        const locked = c.ring && kid; // learning-gated seeds locked for kids offline
        return (
          <div className="row" key={c.id}>
            <div className="ico">{c.emoji}</div>
            <div className="grow">
              <div className="name">{c.name} seed</div>
              <div className="meta">
                {c.days} days · sells 🌸{c.sell}
                {locked ? ' · 🔒 finish a learning ring to unlock' : ''}
              </div>
            </div>
            <button
              className="rbtn"
              disabled={locked || snap.bloom < c.seedCost}
              onClick={() => game.buySeed(c.id, 1)}
            >
              Buy 🌸{c.seedCost}
            </button>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 12, borderStyle: 'dashed' }}>
        <div className="ico">📦</div>
        <div className="grow">
          <div className="name">Sell all produce</div>
          <div className="meta">{produceCount} item(s) in your bin</div>
        </div>
        <button className="rbtn ghost" disabled={produceCount === 0} onClick={() => game.sellAll()}>Sell all</button>
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

function Home({ snap, game, onClose }) {
  return (
    <>
      <Head title="🏡 Farmhouse" sub={`${snap.name}'s home`} onClose={onClose} />
      <div className="row"><div className="ico">🏠</div><div className="grow">
        <div className="name">Stage: Cottage</div>
        <div className="meta">Upgrades unlock with 🌸 Bloom + your circle's learning rings (coming soon)</div>
      </div></div>
      <div className="row"><div className="ico">⭐</div><div className="grow">
        <div className="name">Level {snap.level}</div>
        <div className="meta">{snap.role === 'kid' ? 'Learn the 6 Worlds to level up and move faster' : 'Play to gain XP and level up — faster tools, more energy'}</div>
      </div></div>
      <div className="row"><div className="ico">💎</div><div className="grow">
        <div className="name">{snap.diamonds} Diamonds</div>
        <div className="meta">Cosmetics only · earned by learning{snap.guest ? ' (sign in to sync)' : ''}</div>
      </div></div>
      <div className="row" style={{ borderStyle: 'dashed' }}><div className="ico">🌙</div><div className="grow">
        <div className="name">End the day</div>
        <div className="meta">Crops grow, animals give produce, energy restores</div>
      </div><button className="rbtn" onClick={() => game.sleep()}>Sleep</button></div>
    </>
  );
}

