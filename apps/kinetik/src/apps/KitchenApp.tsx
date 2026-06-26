import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { isoOf } from '@data/energy'
import { kitchen, type Recipe, type MealPlan, type ShopItem } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'

const ACCENT: [string, string] = ['#FF6A4D', '#FF9F4D']
const TABS: AppTab[] = [{ key: 'recipes', label: 'Recipes' }, { key: 'plan', label: 'Plan' }, { key: 'shop', label: 'Shop' }, { key: 'circle', label: 'Circle' }]
const CATS = ['Mains', 'Breakfast', 'Sides', 'Dessert', 'Drinks']
const QUICK: [string, string, string][] = [['🥛', 'Milk', 'Dairy'], ['🥚', 'Eggs', 'Dairy'], ['🍞', 'Bread', 'Bakery'], ['🍌', 'Bananas', 'Produce'], ['🍗', 'Chicken', 'Meat'], ['🍚', 'Rice', 'Pantry'], ['🧻', 'Tissue', 'Household']]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function weekDays(): { iso: string; dn: string; dd: number }[] {
  const base = new Date(); base.setHours(0, 0, 0, 0)
  const day = (base.getDay() + 6) % 7
  base.setDate(base.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return { iso: isoOf(d), dn: DOW[i], dd: d.getDate() } })
}

export default function KitchenApp({ onClose }: { onClose: () => void }) {
  const circles = useDataStore(s => s.circles)
  const me = useDataStore(s => s.me)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''

  const [tab, setTab] = useState('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [plan, setPlan] = useState<MealPlan[]>([])
  const [shop, setShop] = useState<ShopItem[]>([])
  const [cat, setCat] = useState('All')
  const [sheet, setSheet] = useState<null | 'recipe'>(null)
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1700) }
  const days = useMemo(weekDays, [])

  const reloadR = () => kitchen.recipes(cid).then(setRecipes).catch(() => {})
  const reloadP = () => kitchen.plan(cid).then(setPlan).catch(() => {})
  const reloadS = () => kitchen.shop(cid).then(setShop).catch(() => {})
  useEffect(() => { if (cid) { reloadR(); reloadP(); reloadS() } }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = cat === 'All' ? recipes : recipes.filter(r => r.category === cat)
  const recipeOf = (id: string | null) => recipes.find(r => r.id === id)
  const aisles = useMemo(() => {
    const m = new Map<string, ShopItem[]>()
    for (const it of shop) { if (!m.has(it.aisle)) m.set(it.aisle, []); m.get(it.aisle)!.push(it) }
    return [...m.entries()]
  }, [shop])

  const sendToShop = async () => {
    const items: { name: string; aisle: string }[] = []
    for (const d of days) { const r = recipeOf(plan.find(p => p.planDate === d.iso)?.recipeId ?? null); if (r) for (const ing of r.ingredients) items.push({ name: ing.name, aisle: ing.aisle || 'Other' }) }
    if (!items.length) { flash('Plan some dinners first'); return }
    await kitchen.addShop(cid, items).catch(() => {}); reloadS(); flash(`${items.length} added to Shop`)
  }

  return (
    <AppShell accent={ACCENT} emoji="🍳" title="Kitchen" onBack={onClose} tabs={TABS} tab={tab} onTab={setTab} toast={toast}>
      {tab === 'recipes' && (
        <>
          <div className="kap-chips" style={{ marginTop: 4 }}>{['All', ...CATS].map(c => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="kap-sec"><h2>{cat === 'All' ? 'All recipes' : cat}</h2><span className="kap-sec-sub">{shown.length}</span></div>
          {shown.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🍽️</span><b>No recipes yet</b><p>Add your family's favourites.</p></div>}
          {shown.map(r => (
            <div key={r.id} className="kap-row" style={{ marginBottom: 8 }}>
              <span className="kap-row-em">{r.emoji}</span>
              <span className="kap-row-main"><b>{r.name}</b><small>{r.minutes}m · {r.servings} servings · {r.ingredients.length} items</small></span>
              <button onClick={async () => { await kitchen.deleteRecipe(r.id).catch(() => {}); reloadR() }} style={{ color: 'var(--faint)' }}>×</button>
            </div>
          ))}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('recipe')}>＋ New recipe</button>
        </>
      )}

      {tab === 'plan' && (
        <>
          <div className="kap-sec"><h2>This week</h2></div>
          {days.map(d => {
            const r = recipeOf(plan.find(p => p.planDate === d.iso)?.recipeId ?? null)
            return (
              <button key={d.iso} className="kap-row" style={{ marginBottom: 8 }} onClick={() => setPickFor(d.iso)}>
                <span className="kap-row-em" style={{ flexDirection: 'column', fontSize: 12, fontWeight: 800, color: 'var(--faint)', lineHeight: 1.1, display: 'grid' }}>{d.dn}<span style={{ fontSize: 15, color: 'var(--ink)' }}>{d.dd}</span></span>
                <span className="kap-row-main">{r ? <><b>{r.emoji} {r.name}</b><small>{r.minutes}m · {r.servings} servings</small></> : <small style={{ color: 'var(--faint)' }}>Tap to plan dinner</small>}</span>
              </button>
            )
          })}
          <button className="kap-btn primary block" style={{ marginTop: 14 }} onClick={sendToShop}>🧺 Send week's ingredients to Shop</button>
        </>
      )}

      {tab === 'shop' && (
        <>
          <div className="kap-chips" style={{ marginTop: 4 }}>{QUICK.map(([e, n, a]) => <button key={n} className="kap-chip" onClick={async () => { await kitchen.addShop(cid, [{ name: n, aisle: a }]).catch(() => {}); reloadS() }}>{e} {n}</button>)}</div>
          <div className="kap-sec"><h2>Shopping list</h2><span className="kap-sec-sub">{shop.filter(i => !i.done).length} to get</span></div>
          {shop.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🧺</span><b>Your list is clear</b><p>Tap a quick item above or send a recipe from Plan.</p></div>}
          {aisles.map(([aisle, items]) => (
            <div key={aisle} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '4px 2px 6px' }}>{aisle} · {items.length}</div>
              {items.map(it => (
                <button key={it.id} className="kap-row" style={{ marginBottom: 6, opacity: it.done ? 0.5 : 1 }} onClick={() => kitchen.toggleShop(it.id, !it.done).then(reloadS).catch(() => {})}>
                  <span className="kap-av" style={{ background: it.done ? ACCENT[0] : 'var(--bg2)', color: it.done ? '#fff' : 'var(--faint)', width: 26, height: 26 }}>{it.done ? '✓' : ''}</span>
                  <span className="kap-row-main"><b style={{ textDecoration: it.done ? 'line-through' : 'none' }}>{it.name}</b></span>
                  {it.qty && <small style={{ color: 'var(--faint)' }}>{it.qty}</small>}
                </button>
              ))}
            </div>
          ))}
          {shop.some(i => i.done) && <button className="kap-btn block" style={{ marginTop: 6 }} onClick={async () => { await kitchen.clearDone(cid).catch(() => {}); reloadS(); flash('Run finished') }}>Finish run ✓</button>}
        </>
      )}

      {tab === 'circle' && (
        <>
          <div className="kap-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>💎</div>
            <b style={{ fontSize: 16 }}>Diamonds</b>
            <p style={{ fontSize: 13, color: 'var(--faint)', marginTop: 4 }}>A circle-wide reward currency — arriving soon.</p>
          </div>
          <div className="kap-sec"><h2>Circle standings</h2><span className="kap-sec-sub">This week · {circle?.name}</span></div>
          <div className="kap-card"><p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', padding: '8px 0' }}>Cook & plan together to climb the board — {me?.name?.split(' ')[0] ?? 'you'} is just getting started.</p></div>
        </>
      )}

      {sheet === 'recipe' && <RecipeSheet onClose={() => setSheet(null)} onSave={async r => { await kitchen.createRecipe(cid, r).catch(() => {}); setSheet(null); reloadR() }} />}
      {pickFor && <PickRecipe recipes={recipes} onClose={() => setPickFor(null)} onPick={async id => { await kitchen.setPlan(cid, pickFor, id).catch(() => {}); setPickFor(null); reloadP() }} />}
    </AppShell>
  )
}

function RecipeSheet({ onClose, onSave }: { onClose: () => void; onSave: (r: Partial<Recipe>) => void }) {
  const [emoji, setEmoji] = useState('🍝'); const [name, setName] = useState(''); const [cat, setCat] = useState('Mains'); const [min, setMin] = useState('30'); const [serv, setServ] = useState('4'); const [ing, setIng] = useState('')
  const EMO = ['🍝', '🍗', '🥗', '🍳', '🍛', '🥘', '🍜', '🍰']
  const ingredients = ing.split(/\n+/).map(s => s.trim()).filter(Boolean).map(line => { const [n, a] = line.split('|').map(x => x.trim()); return { name: n, aisle: a || 'Other' } })
  return (
    <div className="kap-scrim" onClick={onClose}>
      <div className="kap-sheet" onClick={e => e.stopPropagation()}>
        <div className="kap-grip" /><h3>New recipe</h3>
        <div className="kap-chips" style={{ margin: '8px 0 12px' }}>{EMO.map(x => <button key={x} className={`kap-chip${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}</div>
        <input className="kap-field" placeholder="Recipe name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <div className="kap-lbl">Category</div>
        <div className="kap-chips" style={{ flexWrap: 'wrap' }}>{CATS.map(c => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><input className="kap-field" inputMode="numeric" placeholder="Minutes" value={min} onChange={e => setMin(e.target.value)} /><input className="kap-field" inputMode="numeric" placeholder="Servings" value={serv} onChange={e => setServ(e.target.value)} /></div>
        <div className="kap-lbl">Ingredients (one per line, “name | aisle”)</div>
        <textarea className="kap-field" rows={4} placeholder={'Tomato | Produce\nPasta | Pantry'} value={ing} onChange={e => setIng(e.target.value)} />
        <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!name.trim()} onClick={() => onSave({ emoji, name: name.trim(), category: cat, minutes: Number(min) || 30, servings: Number(serv) || 4, ingredients })}>Save recipe</button>
      </div>
    </div>
  )
}

function PickRecipe({ recipes, onClose, onPick }: { recipes: Recipe[]; onClose: () => void; onPick: (id: string | null) => void }) {
  return (
    <div className="kap-scrim" onClick={onClose}>
      <div className="kap-sheet" onClick={e => e.stopPropagation()}>
        <div className="kap-grip" /><h3>Plan dinner</h3>
        {recipes.length === 0 && <p style={{ fontSize: 13, color: 'var(--faint)', padding: '8px 0' }}>Add recipes first from the Recipes tab.</p>}
        {recipes.map(r => (
          <button key={r.id} className="kap-row" style={{ marginBottom: 8 }} onClick={() => onPick(r.id)}>
            <span className="kap-row-em">{r.emoji}</span><span className="kap-row-main"><b>{r.name}</b><small>{r.minutes}m · {r.servings} servings</small></span>
          </button>
        ))}
        <button className="kap-btn block" style={{ marginTop: 10 }} onClick={() => onPick(null)}>Clear this day</button>
      </div>
    </div>
  )
}
