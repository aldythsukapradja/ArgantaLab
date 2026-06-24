/**
 * Builder configuration — the ONLY thing that differs between the Game and
 * App studios. Pages and components are fully shared; they read this config.
 */
import { Gamepad2, Boxes, type LucideIcon } from 'lucide-react'
import { STARTER_PROMPT, PROMPT_CATEGORIES } from '../../data/starterPrompt'
import { APP_TEMPLATES } from '../../data/appTemplates'
import type { Kind } from './artifact'

export interface SourceOption {
  key: string
  label: string
  emoji: string
  hint: string
  /** Full prompt to copy for this source (base + specifics). */
  prompt: string
}

export interface BuilderConfig {
  kind: Kind
  noun: string                 // 'Game' | 'App'
  nounPlural: string           // 'Games' | 'Apps'
  Icon: LucideIcon
  accentEmoji: string
  sdkGlobal: string            // 'CircleGame' | 'CircleApp'
  sourceLabel: string          // 'Category' | 'Template'
  sources: SourceOption[]
  publishVerb: string          // 'Publish to ArgantaLab' | 'Register App'
}

const GAME_CONFIG: BuilderConfig = {
  kind: 'game',
  noun: 'Game',
  nounPlural: 'Games',
  Icon: Gamepad2,
  accentEmoji: '🎮',
  sdkGlobal: 'CircleGame',
  sourceLabel: 'Category',
  publishVerb: 'Publish to ArgantaLab',
  sources: [
    ...PROMPT_CATEGORIES.map(c => ({
      key: c.key, label: c.label, emoji: c.emoji, hint: c.hint,
      prompt: `${STARTER_PROMPT}\n\nGame type to build: ${c.label}\nKey elements: ${c.hint}\n`,
    })),
    {
      key: 'global', label: 'Global · Custom', emoji: '🌐',
      hint: 'Bring your own — paste any single-file HTML game on demand',
      prompt: `${STARTER_PROMPT}\n\nGame type to build: anything you want (custom / on-demand).\nMake it a single self-contained HTML file.\n`,
    },
  ],
}

const APP_CONFIG: BuilderConfig = {
  kind: 'app',
  noun: 'App',
  nounPlural: 'Apps',
  Icon: Boxes,
  accentEmoji: '🧩',
  sdkGlobal: 'CircleApp',
  sourceLabel: 'Template',
  publishVerb: 'Publish App',
  sources: [
    ...APP_TEMPLATES.map(t => ({
      key: t.id, label: t.name, emoji: t.emoji, hint: t.description,
      prompt: t.prompt,
    })),
    {
      key: 'global', label: 'Global · Custom', emoji: '🌐',
      hint: 'Bring your own — paste any single-file HTML app on demand',
      prompt: `Build a single self-contained HTML file (inline CSS + JS, no build step).\nIt can be any kind of app you want.\nConnect to the family circle via the global CircleApp SDK when relevant — CircleApp.ready(), CircleApp.save(), CircleApp.me().\nReturn ONLY the complete HTML document.`,
    },
  ],
}

export function builderConfig(kind: Kind): BuilderConfig {
  return kind === 'game' ? GAME_CONFIG : APP_CONFIG
}
