// ============================================================
//  PROMPT BUILDER — turns a kid's answers into a structured
//  "master prompt" they take to Claude / ChatGPT.
//  Output is segmented by the 5 Prompt Powers so it can be read
//  creatively (the Spell Scroll), then copied as one block.
// ============================================================

export interface StyleOpt { key: string; label: string; emoji: string; desc: string }
export interface FeatureOpt { key: string; label: string; emoji: string; phrase: string }

export const STYLE_OPTS: StyleOpt[] = [
  { key: 'neon', label: 'Neon', emoji: '⚡', desc: 'glowing neon colours on a dark background, with soft glow around everything' },
  { key: 'kawaii', label: 'Kawaii', emoji: '🌸', desc: 'cute pastel colours, round shapes, and friendly happy faces' },
  { key: 'retro', label: 'Retro 8-bit', emoji: '👾', desc: 'a retro 8-bit pixel look with chunky pixels and a old-arcade feel' },
  { key: 'bright', label: 'Bright & Bold', emoji: '🎨', desc: 'bright bold primary colours with thick outlines, like a comic book' },
]

export const FEATURE_OPTS: FeatureOpt[] = [
  { key: 'score', label: 'Score', emoji: '⭐', phrase: 'a score that goes up' },
  { key: 'lives', label: 'Lives', emoji: '❤️', phrase: 'lives shown as hearts' },
  { key: 'levels', label: 'Levels', emoji: '🪜', phrase: 'levels that get harder' },
  { key: 'sound', label: 'Sound', emoji: '🔊', phrase: 'simple beep sound effects using the Web Audio API (no sound files)' },
  { key: 'powerups', label: 'Power-ups', emoji: '🛡️', phrase: 'power-ups you can grab' },
  { key: 'timer', label: 'Timer', emoji: '⏱️', phrase: 'a countdown timer' },
]

export interface PromptForm {
  idea: string
  audience: string
  action: string
  style: string
  features: string[]
  winText: string
}

export interface PromptSegment {
  power: string      // which Prompt Power this teaches
  emoji: string
  tag: string        // short pill label
  text: string       // the actual prompt line(s)
  note: string       // kid-friendly "what this does"
}

export function emptyForm(): PromptForm {
  return { idea: '', audience: '', action: '', style: 'neon', features: ['score', 'lives'], winText: '' }
}

export function buildPrompt(f: PromptForm): { segments: PromptSegment[]; full: string } {
  const style = STYLE_OPTS.find(s => s.key === f.style) ?? STYLE_OPTS[0]
  const feats = f.features.map(k => FEATURE_OPTS.find(x => x.key === k)?.phrase).filter(Boolean)
  const idea = f.idea.trim() || 'a fun arcade game'
  const audience = f.audience.trim() || 'kids'
  const action = f.action.trim() || 'move and collect points'
  const win = f.winText.trim() || 'you reach a high score'

  const segments: PromptSegment[] = [
    {
      power: 'Mission', emoji: '🎯', tag: 'THE MISSION',
      text: `Build ONE self-contained HTML file: a game where ${idea}. It is made for ${audience}.`,
      note: 'This tells the AI WHAT you are building and WHO it is for.',
    },
    {
      power: 'One Brick', emoji: '🧱', tag: 'ONE FILE',
      text: `Put everything (HTML, CSS, and JavaScript) inside a single .html file. No external links, libraries, fonts, images, or internet — it must run by itself.`,
      note: 'One file means it is easy to save, host, and share.',
    },
    {
      power: 'The Game', emoji: '🎮', tag: 'WHAT YOU DO',
      text: `The player can: ${action}. The game is won when ${win}.`,
      note: 'The main thing the player actually does — the heart of the game.',
    },
    {
      power: 'Guardrails', emoji: '🛟', tag: 'MUST HAVE',
      text: `It must include: ${feats.join(', ')}. Always show a start screen, the current score, and a Restart button. Make it forgiving and fun for a beginner.`,
      note: 'The things your game must never skip.',
    },
    {
      power: 'Right Tool', emoji: '🚪', tag: 'CONTROLS',
      text: `It must work on BOTH a computer (arrow keys / WASD / spacebar) AND a phone or tablet (big on-screen touch buttons). Read window.ARGANTA_DEVICE — it will be 'desktop', 'ipad', or 'iphone'. Show keyboard hints on desktop and large touch buttons on ipad/iphone. If it is not set, detect touch automatically.`,
      note: 'The same game, with the right controller for each screen.',
    },
    {
      power: 'Style', emoji: '🎨', tag: 'THE LOOK',
      text: `Make it look like ${style.desc}. Use a canvas, smooth animation, and make it feel polished.`,
      note: 'The costume — how your game looks and feels.',
    },
    {
      power: 'Loop', emoji: '🔁', tag: 'GIVE IT BACK',
      text: `Return ONLY the complete code inside a single \`\`\`html code block. No explanation before or after — just the code I can copy.`,
      note: 'So you can copy the whole thing in one clean piece.',
    },
  ]

  const full =
    'You are an expert kids-game developer. ' +
    segments.map(s => s.text).join('\n\n') +
    '\n\nKeep all the code in one file. Make it run with no errors.'

  return { segments, full }
}
