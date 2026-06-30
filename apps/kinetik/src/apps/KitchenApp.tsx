import { useEffect, useMemo, useState } from 'react'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { isoOf } from '@data/energy'
import { kitchen, grocery, type Recipe, type MealPlan, type ShopItem, type GroceryBasket, type GroceryRun } from '@repo/appsRepo'
import AppShell, { type AppTab } from './AppShell'
import { Ring, CountUp, Sheet } from './ui'
import { addCalendarEvent, shareToMoment, errMsg } from './integrations'

const ACCENT: [string, string] = ['#FF6A4D', '#FF9F4D']
const TABS: AppTab[] = [{ key: 'recipes', label: 'Recipes', icon: 'book' }, { key: 'plan', label: 'Plan', icon: 'calendar' }, { key: 'shop', label: 'Shop', icon: 'cart' }, { key: 'baskets', label: 'Baskets', icon: 'basket' }]
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
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]
  const cid = circle?.id ?? ''

  const [tab, setTab] = useState('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [plan, setPlan] = useState<MealPlan[]>([])
  const [shop, setShop] = useState<ShopItem[]>([])
  const [baskets, setBaskets] = useState<GroceryBasket[]>([])
  const [runs, setRuns] = useState<GroceryRun[]>([])
  const [cat, setCat] = useState('All')
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null)
  const [cookStep, setCookStep] = useState<number | null>(null)
  const [sheet, setSheet] = useState<null | 'recipe' | 'basket'>(null)
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800) }
  const days = useMemo(weekDays, [])

  const reloadR = () => kitchen.recipes(cid).then(setRecipes).catch(e => flash(errMsg(e)))
  const reloadP = () => kitchen.plan(cid).then(setPlan).catch(e => flash(errMsg(e)))
  const reloadS = () => kitchen.shop(cid).then(setShop).catch(e => flash(errMsg(e)))
  const reloadBk = () => grocery.baskets(cid).then(setBaskets).catch(e => flash(errMsg(e)))
  const reloadRun = () => grocery.runs(cid).then(setRuns).catch(() => {})
  useEffect(() => { if (cid) { reloadR(); reloadP(); reloadS(); reloadBk(); reloadRun() } }, [cid]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = cat === 'All' ? recipes : recipes.filter(r => r.category === cat)
  const recipeOf = (id: string | null) => recipes.find(r => r.id === id)
  const aisles = useMemo(() => {
    const m = new Map<string, ShopItem[]>()
    for (const it of shop) { if (!m.has(it.aisle)) m.set(it.aisle, []); m.get(it.aisle)!.push(it) }
    return [...m.entries()]
  }, [shop])

  const sendRecipeToShop = async (r: Recipe) => {
    if (!r.ingredients.length) { flash('No ingredients on this recipe'); return }
    try { await kitchen.addShop(cid, r.ingredients.map(i => ({ name: i.name, aisle: i.aisle || 'Other' }))); reloadS(); flash(`${r.ingredients.length} sent to Shop`) } catch (e) { flash(errMsg(e)) }
  }
  const sendWeekToShop = async () => {
    const items: { name: string; aisle: string }[] = []
    for (const d of days) { const r = recipeOf(plan.find(p => p.planDate === d.iso)?.recipeId ?? null); if (r) for (const ing of r.ingredients) items.push({ name: ing.name, aisle: ing.aisle || 'Other' }) }
    if (!items.length) { flash('Plan some dinners first'); return }
    try { await kitchen.addShop(cid, items); reloadS(); flash(`${items.length} added to Shop`) } catch (e) { flash(errMsg(e)) }
  }
  const syncDinners = async () => {
    const dated = days.map(d => ({ d, r: recipeOf(plan.find(p => p.planDate === d.iso)?.recipeId ?? null) })).filter(x => x.r)
    if (!dated.length) { flash('Plan dinners first'); return }
    try { for (const { d, r } of dated) await addCalendarEvent({ circleId: cid, title: `${r!.emoji} Dinner: ${r!.name}`, date: d.iso, start: '19:00', end: '20:00', who: [] }); flash(`${dated.length} dinners on Calendar`) } catch (e) { flash(errMsg(e)) }
  }
  const shareCooked = async (r: Recipe) => {
    try { await shareToMoment({ circleId: cid, body: `${r.emoji} We cooked ${r.name}!`, tags: ['kitchen'] }); flash('Shared to Moments') } catch (e) { flash(errMsg(e)) }
  }
  const finishRun = async () => {
    const got = shop.filter(i => i.done).length
    try { await grocery.logRun(cid, null, got); await kitchen.clearDone(cid); reloadS(); reloadRun(); flash(`Run logged · ${got} items`) } catch (e) { flash(errMsg(e)) }
  }

  // ── cook mode ──
  if (openRecipe) {
    const r = openRecipe
    return (
      <AppShell accent={ACCENT} emoji="🍳" title={r.name} subtitle={`${r.minutes}m · ${r.servings} servings`} onBack={() => { setOpenRecipe(null); setCookStep(null) }} toast={toast}>
        {cookStep == null ? (
          <>
            <div className="kap-hero">
              <span className="kap-orb" style={{ width: 56, height: 56 }}><span style={{ fontSize: 30 }}>{r.emoji}</span></span>
              <div className="kap-hero-main"><div className="kap-hero-ey">{r.category}</div><div className="kap-hero-big">{r.name}</div><div className="kap-hero-sub">{r.minutes} min · {r.servings} servings · {r.ingredients.length} items</div></div>
            </div>
            <div className="kap-sec"><h2>Ingredients</h2></div>
            {r.ingredients.map((i, k) => <div key={k} className="kap-row"><span className="kap-row-main"><b>{i.name}</b><small>{i.aisle || 'Other'}</small></span></div>)}
            {r.steps.length > 0 && (<>
              <div className="kap-sec"><h2>Steps</h2><span className="kap-sec-sub">{r.steps.length}</span></div>
              {r.steps.map((s, k) => <div key={k} className="kap-row"><span className="kap-av" style={{ background: ACCENT[0], width: 28, height: 28 }}>{k + 1}</span><span className="kap-row-main"><b style={{ whiteSpace: 'normal' }}>{s}</b></span></div>)}
            </>)}
            <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!r.steps.length} onClick={() => setCookStep(0)}>👨‍🍳 Start cook mode</button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <button className="kap-btn" onClick={() => sendRecipeToShop(r)}>Send to Shop</button>
              <button className="kap-btn ghost" onClick={() => shareCooked(r)}>We cooked it</button>
            </div>
          </>
        ) : (
          <>
            <div className="kap-sec"><h2>Step {cookStep + 1} of {r.steps.length}</h2></div>
            <div className="kap-card" style={{ minHeight: 200, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 19, fontWeight: 700, lineHeight: 1.5 }}>{r.steps[cookStep]}</div>
            <div className="kap-bar" style={{ margin: '14px 0' }}><i style={{ width: `${Math.round((cookStep + 1) / r.steps.length * 100)}%` }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="kap-btn" disabled={cookStep === 0} onClick={() => setCookStep(s => Math.max(0, (s ?? 0) - 1))}>← Back</button>
              {cookStep < r.steps.length - 1
                ? <button className="kap-btn primary" onClick={() => setCookStep(s => (s ?? 0) + 1)}>Next →</button>
                : <button className="kap-btn primary" onClick={() => { setCookStep(null); shareCooked(r) }}>Done ✓</button>}
            </div>
          </>
        )}
      </AppShell>
    )
  }

  return (
    <AppShell accent={ACCENT} emoji="🍳" title="Kitchen" onBack={onClose} tabs={TABS} tab={tab} onTab={setTab} toast={toast}>
      {tab === 'recipes' && (() => {
        const planned = days.filter(d => plan.find(p => p.planDate === d.iso)?.recipeId).length
        const onShop = shop.filter(i => !i.done).length
        return (
        <>
          <div className="kap-apphero">
            <span className="kap-apphero-emoji">🍳</span>
            <div className="kap-apphero-ey">This week</div>
            <div className="kap-apphero-title">What's cooking?</div>
            <div className="kap-apphero-sub">Plan dinners, cook step-by-step, shop together.</div>
            <div className="kap-apphero-chips">
              <span className="kap-apphero-chip">{recipes.length} recipe{recipes.length === 1 ? '' : 's'}</span>
              <span className="kap-apphero-chip">{planned} dinner{planned === 1 ? '' : 's'} planned</span>
              <span className="kap-apphero-chip">{onShop} on the list</span>
            </div>
          </div>
          <div className="kap-chips" style={{ marginTop: 4 }}>{['All', ...CATS].map(c => <button key={c} className={`kap-chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="kap-sec"><h2>{cat === 'All' ? 'All recipes' : cat}</h2><span className="kap-sec-sub">{shown.length}</span></div>
          {shown.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🍽️</span><b>No recipes yet</b><p>Add your family's favourites.</p></div>}
          {shown.map(r => (
            <button key={r.id} className="kap-row" onClick={() => setOpenRecipe(r)}>
              <span className="kap-row-em">{r.emoji}</span>
              <span className="kap-row-main"><b>{r.name}</b><small>{r.minutes}m · {r.servings} servings · {r.ingredients.length} items{r.steps.length ? ` · ${r.steps.length} steps` : ''}</small></span>
              <button onClick={async e => { e.stopPropagation(); try { await kitchen.deleteRecipe(r.id); reloadR() } catch (er) { flash(errMsg(er)) } }} style={{ color: 'var(--faint)', fontSize: 16 }}>×</button>
            </button>
          ))}
          <button className="kap-add-big" style={{ marginTop: 12 }} onClick={() => setSheet('recipe')}>＋ New recipe</button>
        </>
        )
      })()}

      {tab === 'plan' && (
        <>
          <div className="kap-sec"><h2>This week</h2><button className="kap-sec-sub" onClick={syncDinners}>→ Calendar</button></div>
          {days.map(d => {
            const r = recipeOf(plan.find(p => p.planDate === d.iso)?.recipeId ?? null)
            return (
              <button key={d.iso} className="kap-row" onClick={() => setPickFor(d.iso)}>
                <span className="kap-row-em" style={{ display: 'grid', flexDirection: 'column', fontSize: 12, fontWeight: 800, color: 'var(--faint)', lineHeight: 1.1 }}>{d.dn}<span style={{ fontSize: 15, color: 'var(--ink)' }}>{d.dd}</span></span>
                <span className="kap-row-main">{r ? <><b>{r.emoji} {r.name}</b><small>{r.minutes}m · {r.servings} servings</small></> : <small style={{ color: 'var(--faint)' }}>Tap to plan dinner</small>}</span>
              </button>
            )
          })}
          <button className="kap-btn primary block" style={{ marginTop: 14 }} onClick={sendWeekToShop}>🧺 Send week's ingredients to Shop</button>
        </>
      )}

      {tab === 'shop' && (
        <>
          {shop.length > 0 && (
            <div className="kap-hero" style={{ marginBottom: 12 }}>
              <Ring pct={shop.length ? Math.round(shop.filter(i => i.done).length / shop.length * 100) : 0} value={<CountUp to={shop.filter(i => i.done).length} />} label={`of ${shop.length}`} />
              <div className="kap-hero-main"><div className="kap-hero-ey">Shopping run</div><div className="kap-hero-big">{shop.filter(i => !i.done).length} to get</div><div className="kap-hero-sub">{aisles.length} aisle{aisles.length === 1 ? '' : 's'}</div></div>
            </div>
          )}
          <div className="kap-chips" style={{ marginTop: 4 }}>{QUICK.map(([e, n, a]) => <button key={n} className="kap-chip" onClick={async () => { try { await kitchen.addShop(cid, [{ name: n, aisle: a }]); reloadS() } catch (er) { flash(errMsg(er)) } }}>{e} {n}</button>)}</div>
          <div className="kap-sec"><h2>Shopping list</h2>{shop.length > 0 && <button className="kap-sec-sub" onClick={() => setSheet('basket')}>Save as basket</button>}</div>
          {shop.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🧺</span><b>Your list is clear</b><p>Tap a quick item, load a basket, or send a recipe from Plan.</p></div>}
          {aisles.map(([aisle, items]) => (
            <div key={aisle} style={{ marginBottom: 12 }}>
              <div className="kap-section-lbl">{aisle} · {items.length}</div>
              {items.map(it => (
                <button key={it.id} className={`kap-check${it.done ? ' on' : ''}`} onClick={() => kitchen.toggleShop(it.id, !it.done).then(reloadS).catch(e => flash(errMsg(e)))}>
                  <span className="kap-check-box">{it.done ? '✓' : ''}</span>
                  <span className="kap-check-main"><b>{it.name}</b>{it.qty && <small>{it.qty}</small>}</span>
                </button>
              ))}
            </div>
          ))}
          {shop.some(i => i.done) && <button className="kap-btn primary block" style={{ marginTop: 6 }} onClick={finishRun}>Finish run ✓</button>}
        </>
      )}

      {tab === 'baskets' && (
        <>
          <div className="kap-sec"><h2>Reusable baskets</h2><span className="kap-sec-sub">{baskets.length}</span></div>
          {baskets.length === 0 && <div className="kap-empty"><span className="kap-empty-ic">🧺</span><b>No baskets yet</b><p>Save a shopping list as a basket to reuse it any week.</p></div>}
          {baskets.map(b => (
            <div key={b.id} className="kap-row">
              <span className="kap-row-em">🧺</span>
              <button className="kap-row-main" style={{ textAlign: 'left' }} onClick={async () => { try { await kitchen.addShop(cid, b.items); reloadS(); setTab('shop'); flash(`${b.items.length} added`) } catch (e) { flash(errMsg(e)) } }}><b>{b.title}</b><small>{b.items.length} items · tap to load</small></button>
              <button onClick={async () => { try { await grocery.delBasket(b.id); reloadBk() } catch (e) { flash(errMsg(e)) } }} style={{ color: 'var(--faint)', fontSize: 16 }}>×</button>
            </div>
          ))}
          <div className="kap-sec"><h2>Shopping history</h2></div>
          {runs.length === 0 && <p style={{ fontSize: 13, color: 'var(--faint)', padding: '4px 2px' }}>Finished runs will appear here.</p>}
          {runs.slice(0, 10).map(r => (
            <div key={r.id} className="kap-row"><span className="kap-row-em">✅</span><span className="kap-row-main"><b>{r.itemCount} items</b><small>{new Date(r.createdAt).toLocaleDateString()}</small></span></div>
          ))}
        </>
      )}

      {sheet === 'recipe' && <RecipeSheet onClose={() => setSheet(null)} onSave={async r => { try { await kitchen.createRecipe(cid, r); setSheet(null); reloadR(); flash('Recipe saved') } catch (e) { flash(errMsg(e)) } }} />}
      {sheet === 'basket' && <BasketSheet onClose={() => setSheet(null)} onSave={async title => { try { await grocery.addBasket(cid, title, shop.map(i => ({ name: i.name, aisle: i.aisle }))); setSheet(null); reloadBk(); flash('Basket saved') } catch (e) { flash(errMsg(e)) } }} />}
      {pickFor && <PickRecipe recipes={recipes} onClose={() => setPickFor(null)} onPick={async id => { try { await kitchen.setPlan(cid, pickFor, id); setPickFor(null); reloadP() } catch (e) { flash(errMsg(e)) } }} />}
    </AppShell>
  )
}

function RecipeSheet({ onClose, onSave }: { onClose: () => void; onSave: (r: Partial<Recipe>) => void }) {
  const [emoji, setEmoji] = useState('🍝'); const [name, setName] = useState(''); const [cat, setCat] = useState('Mains'); const [min, setMin] = useState('30'); const [serv, setServ] = useState('4'); const [ing, setIng] = useState(''); const [steps, setSteps] = useState('')
  const EMO = ['🍝', '🍗', '🥗', '🍳', '🍛', '🥘', '🍜', '🍰']
  const ingredients = ing.split(/\n+/).map(s => s.trim()).filter(Boolean).map(line => { const [n, a] = line.split('|').map(x => x.trim()); return { name: n, aisle: a || 'Other' } })
  const stepList = steps.split(/\n+/).map(s => s.trim()).filter(Boolean)
  return (
    <Sheet title="New recipe" onClose={onClose}>
      <div className="kap-choices" style={{ marginBottom: 12 }}>{EMO.map(x => <button key={x} className={`kap-choice${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>)}</div>
      <input className="kap-field" placeholder="Recipe name" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <div className="kap-lbl">Category</div>
      <div className="kap-choices">{CATS.map(c => <button key={c} className={`kap-choice${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><input className="kap-field" inputMode="numeric" placeholder="Minutes" value={min} onChange={e => setMin(e.target.value)} /><input className="kap-field" inputMode="numeric" placeholder="Servings" value={serv} onChange={e => setServ(e.target.value)} /></div>
      <div className="kap-lbl">Ingredients (one per line, “name | aisle”)</div>
      <textarea className="kap-field" rows={3} placeholder={'Tomato | Produce\nPasta | Pantry'} value={ing} onChange={e => setIng(e.target.value)} />
      <div className="kap-lbl">Steps (one per line — powers cook mode)</div>
      <textarea className="kap-field" rows={3} placeholder={'Boil water\nCook pasta 9 min\nAdd sauce'} value={steps} onChange={e => setSteps(e.target.value)} />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!name.trim()} onClick={() => onSave({ emoji, name: name.trim(), category: cat, minutes: Number(min) || 30, servings: Number(serv) || 4, ingredients, steps: stepList })}>Save recipe</button>
    </Sheet>
  )
}

function BasketSheet({ onClose, onSave }: { onClose: () => void; onSave: (title: string) => void }) {
  const [v, setV] = useState('')
  return (
    <Sheet title="Save as basket" sub="Reuse this list any week with one tap." onClose={onClose}>
      <input className="kap-field" placeholder="e.g. Weekly staples" value={v} onChange={e => setV(e.target.value)} autoFocus />
      <button className="kap-btn primary block" style={{ marginTop: 16 }} disabled={!v.trim()} onClick={() => onSave(v.trim())}>Save basket</button>
    </Sheet>
  )
}

function PickRecipe({ recipes, onClose, onPick }: { recipes: Recipe[]; onClose: () => void; onPick: (id: string | null) => void }) {
  return (
    <Sheet title="Plan dinner" onClose={onClose}>
      {recipes.length === 0 && <p style={{ fontSize: 13, color: 'var(--faint)', padding: '8px 0' }}>Add recipes first from the Recipes tab.</p>}
      {recipes.map(r => (
        <button key={r.id} className="kap-row" onClick={() => onPick(r.id)}><span className="kap-row-em">{r.emoji}</span><span className="kap-row-main"><b>{r.name}</b><small>{r.minutes}m · {r.servings} servings</small></span></button>
      ))}
      <button className="kap-btn block" style={{ marginTop: 10 }} onClick={() => onPick(null)}>Clear this day</button>
    </Sheet>
  )
}
