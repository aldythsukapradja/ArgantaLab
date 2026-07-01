// ============================================================
//  ARGANTALAB · KINQUEST · REGIONS
//  The 8 stops on the quest. Six academic regions each map to a learning
//  world (drives BOTH the wild-kin roster AND the quiz subject) and are
//  guarded by a Sanctuary Keeper (gym-leader). Beating a Keeper awards a
//  Seal, real ArgantaLab XP + diamonds, and unlocks the next region(s).
//  Seedling Cove is the tutorial start; The Apex is the final Council fight.
//
//  Difficulty ALWAYS follows the kid's own stage (year level) via the quiz
//  adapter — a Keeper is a wall of *their* schoolwork, not memorized trivia.
// ============================================================

import type { Element } from '@/data/openworld'

export interface Keeper {
  name: string
  title: string
  subject: string          // kid-facing subject label
  team: string[]           // kin render keys (last = ace)
  aceElement: Element      // the ace's element (for the crest)
  blurb: string
}

export interface Region {
  id: string
  name: string
  icon: string
  color: string
  kinWorld: string | 'mix' // catalog world for wild roster ('mix' = all)
  drillWorld: string | 'MIX' // drills world for quiz subject
  wildLevels: [number, number]
  keeper: Keeper | null
  unlocks: string[]        // regions opened when this one's Keeper falls
  seal: string             // emoji seal awarded
  intro: string            // one-line region flavor
}

export const REGIONS: Region[] = [
  {
    id: 'cove', name: 'Seedling Cove', icon: '🌱', color: '#3da840',
    kinWorld: 'num', drillWorld: 'NUM', wildLevels: [2, 3],
    keeper: null, unlocks: ['num', 'wrd'], seal: '🌿',
    intro: 'A gentle shore where every quest begins. Choose your first kin here.',
  },
  {
    id: 'num', name: 'Numeria', icon: '🔢', color: '#d4a83c',
    kinWorld: 'num', drillWorld: 'NUM', wildLevels: [3, 6],
    seal: '🔷', unlocks: ['lif'],
    keeper: {
      name: 'Mira', title: 'Keeper of Patterns', subject: 'Numbers & Patterns',
      team: ['countfox', 'tenturtle', 'primeroc'], aceElement: 'pattern',
      blurb: 'Her kin shield on the beat — only sharp arithmetic breaks through.',
    },
    intro: 'Golden dunes of numbers. Keeper Mira tests your math.',
  },
  {
    id: 'wrd', name: 'Wordveil', icon: '📖', color: '#2a7c34',
    kinWorld: 'wrd', drillWorld: 'WRD', wildLevels: [5, 8],
    seal: '📘', unlocks: ['won'],
    keeper: {
      name: 'Sol', title: 'Keeper of Words', subject: 'Reading & Language',
      team: ['letterowl', 'spellynx', 'grammargon'], aceElement: 'truth',
      blurb: 'A misspelled word mends his kin — spell true to win.',
    },
    intro: 'A whispering grove of words. Keeper Sol tests your language.',
  },
  {
    id: 'lif', name: 'Life Meadow', icon: '🌸', color: '#d46090',
    kinWorld: 'lif', drillWorld: 'LIF', wildLevels: [7, 10],
    seal: '💗', unlocks: ['wld'],
    keeper: {
      name: 'Kira', title: 'Keeper of Wellbeing', subject: 'Life & Body',
      team: ['moodlamb', 'pulsepup', 'auroracrane'], aceElement: 'wonder',
      blurb: 'Her kin race faster the longer you wait — answer with calm speed.',
    },
    intro: 'A meadow of feelings and health. Keeper Kira tests your life skills.',
  },
  {
    id: 'won', name: 'Wonder Sky', icon: '🌟', color: '#6840a8',
    kinWorld: 'won', drillWorld: 'WON', wildLevels: [9, 12],
    seal: '🔮', unlocks: ['log'],
    keeper: {
      name: 'Lyra', title: 'Keeper of Wonder', subject: 'Science & Nature',
      team: ['cloudcat', 'cometcolt', 'novabear'], aceElement: 'wonder',
      blurb: 'A cosmic team wrapped in stardust shields — science cuts through.',
    },
    intro: 'A skyfield of science and stars. Keeper Lyra tests your curiosity.',
  },
  {
    id: 'wld', name: 'World Lagoon', icon: '🌍', color: '#1868b8',
    kinWorld: 'wld', drillWorld: 'WLD', wildLevels: [11, 14],
    seal: '🧭', unlocks: ['apex'],
    keeper: {
      name: 'Rho', title: 'Keeper of the World', subject: 'Geography & History',
      team: ['mapturtle', 'dunecamel', 'globewhale'], aceElement: 'place',
      blurb: 'Continents ride on his whale — know the world to move it.',
    },
    intro: 'A tide lagoon of maps and history. Keeper Rho tests your world.',
  },
  {
    id: 'log', name: 'Logic Circuit', icon: '⚡', color: '#1a7838',
    kinWorld: 'log', drillWorld: 'LOG', wildLevels: [11, 14],
    seal: '🟢', unlocks: ['apex'],
    keeper: {
      name: 'Vex', title: 'Keeper of Logic', subject: 'Coding & Logic',
      team: ['pixelslime', 'mechmouse', 'datadragon'], aceElement: 'logic',
      blurb: 'A firewall rises every third beat — pure logic tears it down.',
    },
    intro: 'A neon circuit of code and reason. Keeper Vex tests your logic.',
  },
  {
    id: 'apex', name: 'The Apex', icon: '⭐', color: '#a83060',
    kinWorld: 'mix', drillWorld: 'MIX', wildLevels: [15, 18],
    seal: '👑', unlocks: [],
    keeper: {
      name: 'The Sage', title: 'Council of Elders', subject: 'Everything you learned',
      team: ['primeroc', 'grammargon', 'datadragon', 'auroracrane'], aceElement: 'wonder',
      blurb: 'The final trial. Mixed subjects, legendary kin. Prove your whole quest.',
    },
    intro: 'The summit of KinQuest. Face the Council of Elders for the crown.',
  },
]

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map(r => [r.id, r]))
export const region = (id: string): Region | undefined => REGION_BY_ID[id]
