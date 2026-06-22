// Seed = the contract made concrete. Manifests are REAL apps; metric numbers
// are placeholders until the live RPCs / event bridge fill them in (P1).
// This doubles as the MockDataSource payload and the hq_app seed.

import type { AppManifest, ProductNorthStar } from '../contract/manifest'
import type { Rollup, TreeNode, ScorecardTile, AppHealth, FeatureAdoption, EconomyFlow, AudienceData } from '../contract/metrics'
import type { Signal } from '../contract/signals'

export const PRODUCT_NORTH_STARS: ProductNorthStar[] = [
  { product: 'portfolio', label: 'Weekly engaged accounts', formula: 'sum of product north stars',
    inputMetricKeys: ['arganta_ns', 'kinetik_ns'] },
  { product: 'arganta', parent: 'portfolio', label: 'Weekly mastery-loop learners',
    formula: 'learners completing >=1 mastery loop / week',
    inputMetricKeys: ['lessons_done', 'ring_gain', 'streak_ret', 'games_built'] },
  { product: 'kinetik', parent: 'portfolio', label: 'Weekly core-loop circles',
    formula: 'circles completing plan->live->remember / week',
    inputMetricKeys: ['plans', 'moments', 'kin_assists', 'members_active', 'cross_app'] },
]

export const MANIFESTS: AppManifest[] = [
  {
    id: 'arganta', name: 'ArgantaLab', product: 'arganta', category: 'learning', status: 'live',
    owner: 'Aldyth', metrics: ['lessons_done', 'ring_gain', 'streak_ret', 'games_built'],
    economyHooks: { earn: ['lesson', 'streak', 'quest'], sink: ['cosmetics', 'featured', 'premium'] },
    agentSurfaces: ['buddy'],
    featureMap: [
      { id: 'play', label: 'Play', features: [{ id: 'home', label: 'Play home' }, { id: 'quests', label: 'Quests' }] },
      { id: 'learn', label: 'Learn', features: [{ id: 'worlds', label: 'Cinematic worlds' }, { id: 'journey', label: 'Journey' }] },
      { id: 'build', label: 'Build', features: [{ id: 'wizard', label: 'Game Wizard' }, { id: 'lab', label: 'Builder Lab' }, { id: 'pitch', label: 'Pitch Studio' }] },
      { id: 'ship', label: 'Ship', features: [{ id: 'discover', label: 'Discover' }, { id: 'store', label: 'My game store' }] },
      { id: 'you', label: 'You', features: [{ id: 'avatar', label: 'Avatar room' }, { id: 'fame', label: 'Hall of Fame' }, { id: 'parent', label: 'Grown-ups' }] },
    ],
  },
  { id: 'kinetik-calendar', name: 'Kinetik Family', product: 'kinetik', category: 'productivity', status: 'live',
    metrics: ['plans', 'moments'], economyHooks: {}, agentSurfaces: ['kin'] },
  { id: 'padel', name: 'Padel Americano', product: 'kinetik', category: 'sports', status: 'live' },
  { id: 'worldcup', name: 'World Cup 26', product: 'kinetik', category: 'social', status: 'live' },
  { id: 'vault', name: 'Family Vault', product: 'kinetik', category: 'productivity', status: 'live' },
  { id: 'chess', name: 'Circle Chess', product: 'kinetik', category: 'games', status: 'live' },
  { id: 'chorequest', name: 'Chore Quest', product: 'kinetik', category: 'games', status: 'beta',
    economyHooks: { earn: ['chore_done'] } },
  { id: 'grocery', name: 'Grocery', product: 'kinetik', category: 'productivity', status: 'live' },
  { id: 'cook', name: 'Cook', product: 'kinetik', category: 'productivity', status: 'live' },
  { id: 'travel', name: 'Travel Planner', product: 'kinetik', category: 'productivity', status: 'beta' },
]

const SCORECARD: ScorecardTile[] = [
  { key: 'rule40', label: 'Rule of 40', value: 47, unit: '%', benchmarkGreen: 40, benchmarkAmber: 30, higherBetter: true },
  { key: 'burn', label: 'Burn multiple', value: 1.4, unit: '×', benchmarkGreen: 1.5, benchmarkAmber: 2, higherBetter: false },
  { key: 'nrr', label: 'NRR (equiv)', value: 118, unit: '%', benchmarkGreen: 110, benchmarkAmber: 100, higherBetter: true },
  { key: 'daumau', label: 'DAU / MAU', value: 31, unit: '%', benchmarkGreen: 20, benchmarkAmber: 10, higherBetter: true },
  { key: 'kfactor', label: 'k-factor', value: 0.62, unit: '', benchmarkGreen: 1, benchmarkAmber: 0.5, higherBetter: true },
  { key: 'ltvcac', label: 'LTV / CAC', value: 2.1, unit: '×', benchmarkGreen: 3, benchmarkAmber: 1, higherBetter: true },
]

const PORTFOLIO_TREE: TreeNode = {
  key: 'portfolio', label: 'Weekly engaged accounts', sub: 'portfolio north star',
  value: 18600, deltaPct: 6,
  children: [
    { key: 'arganta', label: 'ArgantaLab · mastery-loop learners', sub: 'lessons · rings · streaks · builds', value: 3100, deltaPct: 9 },
    { key: 'kinetik', label: 'KinetikCircle · core-loop circles', sub: 'superapp — sum of mini-app loops', value: 1280, deltaPct: 4,
      children: [
        { key: 'calendar', label: 'Calendar / Plans', value: 0, adoptionPct: 64 },
        { key: 'moments', label: 'Moments', value: 0, adoptionPct: 52 },
        { key: 'padel', label: 'Padel Americano', value: 0, adoptionPct: 12 },
        { key: 'rest', label: '+ 36 mini-apps', value: 0, adoptionPct: 9 },
      ] },
  ],
}

const ARGANTA_TREE: TreeNode = {
  key: 'arganta', label: 'Weekly mastery-loop learners', sub: 'arganta north star', value: 3100, deltaPct: 9,
  children: [
    { key: 'lessons_done', label: 'Lessons completed', value: 21400, deltaPct: 12 },
    { key: 'ring_gain', label: 'Skill-ring gains', value: 5300, deltaPct: 7 },
    { key: 'streak_ret', label: 'Streak retention', value: 0, adoptionPct: 58 },
    { key: 'games_built', label: 'Games built', value: 420, deltaPct: 15 },
  ],
}

const KINETIK_TREE: TreeNode = {
  key: 'kinetik', label: 'Weekly core-loop circles', sub: 'kinetik north star', value: 1280, deltaPct: 4,
  children: [
    { key: 'calendar', label: 'Calendar / Plans', value: 0, adoptionPct: 64 },
    { key: 'moments', label: 'Moments', value: 0, adoptionPct: 52 },
    { key: 'padel', label: 'Padel Americano', value: 0, adoptionPct: 12 },
    { key: 'worldcup', label: 'World Cup 26', value: 0, adoptionPct: 9 },
    { key: 'vault', label: 'Family Vault', value: 0, adoptionPct: 7 },
    { key: 'rest', label: '+ 34 mini-apps', value: 0, adoptionPct: 6 },
  ],
}

export const ROLLUPS: Record<string, Rollup> = {
  portfolio: { product: 'portfolio', northStar: PORTFOLIO_TREE, scorecard: SCORECARD },
  arganta: { product: 'arganta', northStar: ARGANTA_TREE, scorecard: SCORECARD },
  kinetik: { product: 'kinetik', northStar: KINETIK_TREE, scorecard: SCORECARD },
}

export const APP_HEALTH: AppHealth[] = [
  { appId: 'kinetik-calendar', name: 'Kinetik Family', product: 'kinetik', category: 'productivity', wau: 5210, trend: [8, 12, 10, 16, 20], verdict: 'hero' },
  { appId: 'arganta', name: 'ArgantaLab', product: 'arganta', category: 'learning', wau: 3140, trend: [6, 10, 14, 13, 18], verdict: 'hero' },
  { appId: 'padel', name: 'Padel Americano', product: 'kinetik', category: 'sports', wau: 640, trend: [16, 14, 11, 9, 7], verdict: 'watch' },
  { appId: 'worldcup', name: 'World Cup 26', product: 'kinetik', category: 'social', wau: 410, trend: [9, 11, 10, 12, 13], verdict: 'niche' },
  { appId: 'vault', name: 'Family Vault', product: 'kinetik', category: 'productivity', wau: 220, trend: [10, 9, 8, 8, 7], verdict: 'watch' },
  { appId: 'chess', name: 'Circle Chess', product: 'kinetik', category: 'games', wau: 180, trend: [7, 9, 8, 10, 11], verdict: 'niche' },
  { appId: 'chorequest', name: 'Chore Quest', product: 'kinetik', category: 'games', wau: 90, trend: [12, 10, 9, 7, 6], verdict: 'watch' },
]

export const SIGNALS: Signal[] = [
  { id: 's1', severity: 'warn', headline: 'Padel D7 retention dropped to 31%', driver: 'anomaly', appId: 'padel' },
  { id: 's2', severity: 'info', headline: 'ArgantaLab diamond sink up 22%', driver: 'cosmetics', appId: 'arganta' },
  { id: 's3', severity: 'success', headline: '@kin resolved 142 clashes this week' },
  { id: 's4', severity: 'info', headline: '2 apps promoted to dedicated tables' },
]

// ── Feature adoption per app (keep/kill/propagate) ──
export const FEATURE_ADOPTION: Record<string, FeatureAdoption[]> = {
  arganta: [
    { appId: 'arganta', featureId: 'wizard', label: 'Game Wizard', adoptionPct: 71, trend: 'up', verdict: 'core' },
    { appId: 'arganta', featureId: 'lab', label: 'Builder Lab (pro-code)', adoptionPct: 58, trend: 'up', verdict: 'hero' },
    { appId: 'arganta', featureId: 'worlds', label: 'Cinematic Learn worlds', adoptionPct: 44, trend: 'flat', verdict: 'core' },
    { appId: 'arganta', featureId: 'avatar', label: 'Avatar dressing room', adoptionPct: 39, trend: 'up', verdict: 'niche' },
    { appId: 'arganta', featureId: 'pitch', label: 'Pitch Studio', adoptionPct: 8, trend: 'down', verdict: 'watch' },
    { appId: 'arganta', featureId: 'fame', label: 'Hall of Fame board', adoptionPct: 3, trend: 'down', verdict: 'dead' },
  ],
  'kinetik-calendar': [
    { appId: 'kinetik-calendar', featureId: 'board', label: 'Calendar board', adoptionPct: 68, trend: 'up', verdict: 'hero' },
    { appId: 'kinetik-calendar', featureId: 'today', label: 'Today triage', adoptionPct: 55, trend: 'flat', verdict: 'core' },
    { appId: 'kinetik-calendar', featureId: 'kin', label: '@kin assist', adoptionPct: 34, trend: 'up', verdict: 'niche' },
    { appId: 'kinetik-calendar', featureId: 'routines', label: 'Routines', adoptionPct: 11, trend: 'down', verdict: 'watch' },
  ],
}

// ── Diamond economy (cross-app) ──
export const ECONOMY: EconomyFlow = {
  sources: [
    { label: 'Lessons', amount: 48000 },
    { label: 'Streaks', amount: 22000 },
    { label: 'Plays / quests', amount: 19000 },
  ],
  sinks: [
    { label: 'Cosmetics', amount: 31000 },
    { label: 'Featured listing', amount: 12000 },
    { label: 'Premium unlocks', amount: 9000 },
  ],
  float: 214000,
  sinkCoverage: 0.61,
}

// ── Audience / retention cohorts ──
export const AUDIENCE: AudienceData = {
  dauMau: 31,
  cohorts: [
    { label: 'Wk 1', d1: 82, d7: 54, d14: 41, d30: 34 },
    { label: 'Wk 2', d1: 85, d7: 58, d14: 44, d30: 37 },
    { label: 'Wk 3', d1: 88, d7: 61, d14: 47, d30: 29 },
    { label: 'Wk 4', d1: 86, d7: 59, d14: null, d30: null },
  ],
}
