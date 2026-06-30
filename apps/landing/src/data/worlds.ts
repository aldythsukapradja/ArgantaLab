export interface World {
  key: string
  name: string
  color: string
  icon: string
  foundation: string
  copy: string
  emoji: string
  habitat: string
  habitatEmoji: string
  vibe: string
}

export const WORLDS: World[] = [
  {
    key: 'NUM',
    name: 'NumberDash',
    color: '#f59e0b',
    icon: '#',
    foundation: 'Quantitative intelligence',
    copy: 'Math, patterns, money, measurement, time.',
    emoji: '🔢',
    habitat: 'Sunny Dunes',
    habitatEmoji: '🏜️',
    vibe: 'Arcade math racing',
  },
  {
    key: 'WRD',
    name: 'WordQuest',
    color: '#3b82f6',
    icon: 'A',
    foundation: 'Language intelligence',
    copy: 'Reading, writing, vocabulary, grammar, communication.',
    emoji: '📖',
    habitat: 'Whisper Grove',
    habitatEmoji: '🌳',
    vibe: 'Storybook adventure',
  },
  {
    key: 'WON',
    name: 'WonderLab',
    color: '#10b981',
    icon: '⚗',
    foundation: 'Scientific intelligence',
    copy: 'Biology, physics, chemistry, earth, space, curiosity.',
    emoji: '🔬',
    habitat: 'Cloud Skyfield',
    habitatEmoji: '☁️',
    vibe: 'Lab experiments',
  },
  {
    key: 'LOG',
    name: 'LogicLand',
    color: '#8b5cf6',
    icon: '{}',
    foundation: 'Computational intelligence',
    copy: 'Logic, code, data, AI thinking, problem solving.',
    emoji: '🤖',
    habitat: 'Neon Circuit',
    habitatEmoji: '🔌',
    vibe: 'Puzzle island',
  },
  {
    key: 'WLD',
    name: 'WorldTrail',
    color: '#ef4444',
    icon: '🗺',
    foundation: 'Global intelligence',
    copy: 'Geography, history, economics, culture, systems.',
    emoji: '🌍',
    habitat: 'Tide Lagoon',
    habitatEmoji: '🐚',
    vibe: 'Passport map',
  },
  {
    key: 'LIF',
    name: 'LifeQuest',
    color: '#f472b6',
    icon: '♥',
    foundation: 'Human intelligence',
    copy: 'Habits, kindness, movement, confidence, real-world behavior.',
    emoji: '🎈',
    habitat: 'Mood Meadow',
    habitatEmoji: '🌸',
    vibe: 'Cozy social world',
  },
]

export const RING_LABELS: Record<string, string> = {
  NUM: 'Number', WRD: 'Word', WON: 'Wonder', LOG: 'Logic', WLD: 'World', LIF: 'Life',
}

export type SceneMode =
  | 'problem' | 'market' | 'core' | 'sixWorlds' | 'buddyKin'
  | 'rings' | 'argons' | 'nexus' | 'circle' | 'analytics'
  | 'kinetik' | 'create' | 'agentic' | 'safety' | 'final' | 'cta'
