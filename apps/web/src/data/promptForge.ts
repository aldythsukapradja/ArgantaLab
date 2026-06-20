// ============================================================
//  PROMPT FORGE — the 5 Prompt Powers (rich lesson for ai/prompt-power)
// ============================================================

export type PFChallenge =
  | { kind: 'write'; prompt: string; placeholder: string; keywords: string[]; minHits: number; success: string }
  | { kind: 'choice'; prompt: string; options: string[]; correct: number; explain: string }
  | { kind: 'order'; prompt: string; items: string[]; correct: number[] }

export interface PFGate {
  num: number
  title: string
  short: string
  emoji: string
  lesson: string[]
  example: { weak: string; strong: string }
  challenge: PFChallenge
  badge: string
}

export const PF_GATES: PFGate[] = [
  {
    num: 1,
    title: 'Know What You Are Building',
    short: 'Know the Mission',
    emoji: '🎯',
    lesson: [
      'Before asking AI to build, answer four quick questions:',
      'What are you building? — a game, a website, a study app?',
      'Who is it for? — kids, parents, students, your team?',
      'Why will they use it? — to learn, play, save time, organise?',
      'What is the ONE main action? — play, sign up, track, create.',
    ],
    example: {
      weak: 'Build me an app.',
      strong: 'Build a single-page learning app for 5th graders that teaches prompt engineering using colourful cards, mini quizzes, and a final challenge.',
    },
    challenge: {
      kind: 'write',
      prompt: 'Rewrite this weak prompt: “Make a racing game.”',
      placeholder: 'My better prompt is…',
      keywords: ['for', 'age', 'kid', 'keyboard', 'control', 'style', 'neon', 'win', 'score', 'finish', 'lap', 'colour', 'color'],
      minHits: 2,
      success: 'Great! Your idea is becoming a blueprint.',
    },
    badge: 'Blueprint Builder',
  },
  {
    num: 2,
    title: 'One Piece, One Prompt',
    short: 'Build One Brick at a Time',
    emoji: '🧱',
    lesson: [
      'Do not ask AI to build everything at once.',
      'Big prompts confuse the AI. Small prompts give you control.',
      'Build in order: hero section → feature cards → quiz → score → polish.',
      'One prompt should usually change one important thing.',
    ],
    example: {
      weak: 'Build the full game with shop, bosses, levels, leaderboard, login, multiplayer, and animation.',
      strong: 'First build the playable core loop: player moves, enemy appears, player can shoot, enemy loses health, score increases.',
    },
    challenge: {
      kind: 'choice',
      prompt: 'Which is the better prompt?',
      options: [
        'Make everything better.',
        'Improve only the start screen: add a title, subtitle, and one Play button. Do not change the game logic.',
      ],
      correct: 1,
      explain: 'It changes ONE thing and protects the rest. That is brick-by-brick building.',
    },
    badge: 'Brick-by-Brick Builder',
  },
  {
    num: 3,
    title: 'Give Guardrails',
    short: 'Say What to Touch',
    emoji: '🛟',
    lesson: [
      'AI can accidentally change things you did not want changed.',
      'Always say three things: WHERE the change happens, WHAT to change, and what must STAY THE SAME.',
      'The formula: Location + Action + Guardrail.',
    ],
    example: {
      weak: 'Add a button.',
      strong: 'On the home screen, add a large rounded Start button below the title. Do not change the background, character, or navigation.',
    },
    challenge: {
      kind: 'write',
      prompt: 'Fill the formula: “On the ___ screen, add ___. Do not change ___.”',
      placeholder: 'On the home screen, add… Do not change…',
      keywords: ['do not', "don't", 'not change', 'keep', 'screen', 'add'],
      minHits: 2,
      success: 'Perfect guardrails — the AI knows exactly where to stay.',
    },
    badge: 'Guardrail Guardian',
  },
  {
    num: 4,
    title: 'Choose the Right Tool',
    short: 'Use the Right Mode',
    emoji: '🚪',
    lesson: [
      'Different jobs need different AI modes.',
      'Plan Mode — to think first: ideas, strategy, bugs, structure.',
      'Agent Mode — to build: code, features, pages, fixes.',
      'Visual Edit — small design tweaks: colours, text, spacing, button size.',
      'Think first. Build second. Tweak last.',
    ],
    example: {
      weak: 'Just fix my game.',
      strong: 'Plan Mode: “Ask me questions before building so you fully understand the game.”',
    },
    challenge: {
      kind: 'choice',
      prompt: 'Which mode? “I have a bug but I do not know why it happens.”',
      options: ['Plan Mode', 'Agent Mode', 'Visual Edit'],
      correct: 0,
      explain: 'You need to THINK and investigate first — that is Plan Mode.',
    },
    badge: 'Tool Chooser',
  },
  {
    num: 5,
    title: 'Prompt, Test, Improve',
    short: 'Improve in Loops',
    emoji: '🔁',
    lesson: [
      'Great builders do not expect the first version to be perfect.',
      'They work in loops: Prompt → Review → Test → Improve.',
      'Do not keep saying “fix it.” Instead: paste the error, ask AI to find the root cause first, and explain the safest fix before changing code.',
    ],
    example: {
      weak: 'Fix it. Still broken. Fix it again.',
      strong: 'This error appears: [paste error]. Investigate the root cause first. Do not change code yet — explain the likely cause and the safest fix.',
    },
    challenge: {
      kind: 'order',
      prompt: 'Put the loop in the right order.',
      items: ['Test', 'Prompt', 'Improve', 'Review'],
      correct: [1, 3, 0, 2], // Prompt → Review → Test → Improve
    },
    badge: 'Iteration Hero',
  },
]

export const PF_FINAL = {
  prompt: 'Write one powerful build prompt. Include: what you are building, who it is for, the main action, the first feature, the style, and what NOT to change.',
  placeholder: 'Build a ___ for ___. The main goal is ___. The first feature is ___. The style should feel ___. Do not ___.',
  keywords: ['build', 'for', 'goal', 'feature', 'first', 'style', 'feel', 'do not', "don't", 'avoid', 'not change'],
  minHits: 4,
  reward: 'Prompt Forge Apprentice',
  example: 'Build a single HTML quiz game for 5th graders learning prompt engineering. The main goal is to help them give clear instructions to AI. The first feature is a 5-question quiz with instant feedback. The style should feel colourful, cinematic, and futuristic. Do not add login, database, or complicated menus yet.',
}

export const PF_SUMMARY: [string, string][] = [
  ['Know the Mission', 'Be clear before you build.'],
  ['Build One Brick at a Time', 'Small prompts work better.'],
  ['Give Guardrails', 'Say what to change and what to leave.'],
  ['Use the Right Tool', 'Plan, build, or tweak.'],
  ['Improve in Loops', 'Prompt, test, fix, upgrade.'],
]
