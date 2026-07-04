// audit.mjs — Phase A3 scoreboard (docs/BUILD-PLAN.md, concept §4 of
// CLIENT-ASSETS-AND-CHARACTER-LAB.md).
//
// Reads core + client + links and writes derived/audit.{json,md}:
// orphans, gaps, link coverage. Pure JSON; run after build-client/match.
//
// Usage: node scripts/audit.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KINGDOM = path.resolve(__dirname, '..');
const j = (...p) => JSON.parse(fs.readFileSync(path.join(KINGDOM, ...p), 'utf8'));
const maybe = (...p) => {
  try { return j(...p); } catch { return null; }
};

const core = {
  monsters: j('data', 'core', 'monsters.json'),
  items: j('data', 'core', 'items.json'),
  skills: j('data', 'core', 'skills.json'),
  maps: j('data', 'core', 'maps.json'),
  gaps: j('data', 'core', 'data-gaps.json'),
};
const client = j('data', 'client', 'manifest.json');
const links = {
  monsters: maybe('data', 'links', 'monster-links.json') || [],
  items: maybe('data', 'links', 'item-links.json') || [],
  skills: maybe('data', 'links', 'skill-links.json') || [],
};

const linkedMonsterIds = new Set(links.monsters.map((l) => l.monsterId));
const linkedMobIds = new Set(links.monsters.map((l) => l.mobId));
const linkedItemIds = new Set(links.items.map((l) => l.itemId));
const linkedIconIdx = new Set(links.items.map((l) => l.iconIndex));
const linkedSkillIds = new Set(links.skills.map((l) => l.skillId));

const audit = {
  generated: new Date().toISOString(),
  clientCounts: client.counts,
  monsters: {
    scraped: core.monsters.length,
    linked: linkedMonsterIds.size,
    scrapedWithoutClientSprite: core.monsters
      .filter((m) => !linkedMonsterIds.has(m.id)).map((m) => m.id),
    clientMobOrphans: (client.counts?.monsters ?? 0) - linkedMobIds.size,
    withoutXp: core.monsters.filter((m) => !m.defaultExperience).map((m) => m.id),
    withoutDrops: core.monsters.filter((m) => !(m.dropIds || []).length).length,
  },
  items: {
    scraped: core.items.length,
    linked: linkedItemIds.size,
    palettesRecovered: links.items.filter((l) => l.paletteRecovered).length,
    scrapedWithoutIcon: core.items
      .filter((i) => !linkedItemIds.has(i.id)).map((i) => i.id),
    clientIconOrphans: (client.counts?.itemIcons ?? 0) - linkedIconIdx.size,
    combatStats: 'MISSING EVERYWHERE — design decision pending (overrides layer)',
  },
  skills: {
    scraped: core.skills.length,
    linkedToEffects: linkedSkillIds.size,
    unlinked: core.skills.length - linkedSkillIds.size,
    clientEffectOrphans: (client.counts?.effects ?? 0) - links.skills.length,
  },
  maps: {
    scraped: core.maps.length,
    withoutImage: core.maps.filter((m) => !m.mapImage?.localPath).length,
    tileMapsBuilt: 0,
  },
  charParts: {
    total: client.counts?.charParts ?? 0,
    byCategory: client.counts?.charByCategory ?? {},
    verifiedByEyeball: 'coverage counter arrives with the Character Lab (C-phase)',
  },
  trackedRequirementGaps: core.gaps.length,
};

fs.mkdirSync(path.join(KINGDOM, 'data', 'derived'), { recursive: true });
fs.writeFileSync(
  path.join(KINGDOM, 'data', 'derived', 'audit.json'),
  JSON.stringify(audit, null, 1)
);

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—');
const md = `# Kingdom data audit

Generated: ${audit.generated}

| Area | Metric | Value |
|---|---|---|
| Monsters | scraped → client sprite linked | ${audit.monsters.linked}/${audit.monsters.scraped} (${pct(audit.monsters.linked, audit.monsters.scraped)}) |
| Monsters | client mobs with no name yet (casting pool) | ${audit.monsters.clientMobOrphans} |
| Monsters | without XP | ${audit.monsters.withoutXp.length} |
| Monsters | without drops | ${audit.monsters.withoutDrops} |
| Items | scraped → icon linked | ${audit.items.linked}/${audit.items.scraped} (${pct(audit.items.linked, audit.items.scraped)}) |
| Items | true palettes recovered (ex-purple) | ${audit.items.palettesRecovered} |
| Items | orphan icons (casting pool) | ${audit.items.clientIconOrphans} |
| Items | combat stats | missing everywhere (design pending) |
| Skills | linked to client effect | ${audit.skills.linkedToEffects}/${audit.skills.scraped} |
| Skills | orphan client effects | ${audit.skills.clientEffectOrphans} |
| Maps | without image | ${audit.maps.withoutImage}/${audit.maps.scraped} |
| Char parts | in library | ${audit.charParts.total} |
| Requirements | tracked gaps | ${audit.trackedRequirementGaps} |

Unlinked scraped monsters (${audit.monsters.scrapedWithoutClientSprite.length}): ${audit.monsters.scrapedWithoutClientSprite.slice(0, 30).join(', ')}${audit.monsters.scrapedWithoutClientSprite.length > 30 ? ' …' : ''}

Unlinked scraped items (${audit.items.scrapedWithoutIcon.length}): ${audit.items.scrapedWithoutIcon.slice(0, 30).join(', ')}${audit.items.scrapedWithoutIcon.length > 30 ? ' …' : ''}
`;
fs.writeFileSync(path.join(KINGDOM, 'data', 'derived', 'audit.md'), md);
console.log(md);
