// Local-first policy (Brain OS): classify every tool call into
//   auto  — runs without asking (read, edit, tests, local media, git status…)
//   gate  — pauses for an explicit HQ Approve/Deny (deploy, push main, migration,
//           premium spend, destructive fs, external send)
// The classifier is deliberately conservative: anything not clearly safe is gated.

export type Decision = 'auto' | 'gate';

// Bash command substrings that must always be gated even though the Bash tool
// itself is otherwise allowed for local work.
const GATED_BASH = [
  'git push', 'git reset --hard', 'rm -rf', 'supabase db push', 'supabase migration',
  'vercel deploy', 'vercel --prod', 'wrangler deploy', 'wrangler publish',
  'npm publish', 'modal deploy', 'gh release', 'gh pr merge', 'psql',
  'drop table', 'delete from',
];

// Tool names (exact or prefix) that are always gated.
const GATED_TOOLS = [
  'mcp__arganta-core-content__buffer_publish', // queues to a real external channel
];

// MCP tools that spend premium credits (Higgsfield / paid media).
function isPremiumSpend(tool: string, input: Record<string, unknown>): boolean {
  // The Higgsfield MCP server prefix (paid generation). Local media-gen +
  // media-core stage 0 are free and NOT gated.
  if (/generate_(image|video|audio)|upscale|explainer_video|generate_3d/.test(tool)
      && tool.includes('e1a94d30')) return true;
  return false;
}

export function classify(tool: string, input: Record<string, unknown>): Decision {
  if (GATED_TOOLS.some((t) => tool === t || tool.startsWith(t))) return 'gate';
  if (isPremiumSpend(tool, input)) return 'gate';

  if (tool === 'Bash') {
    const cmd = String(input.command || '').toLowerCase();
    if (GATED_BASH.some((g) => cmd.includes(g))) return 'gate';
    return 'auto';
  }

  // Everything else the agent does locally is auto: Read/Edit/Write/Glob/Grep,
  // test runs, local ComfyUI generation via media-gen, content drafts, etc.
  return 'auto';
}

/** Human label for the activity feed (operational, no reasoning). */
export function toolLabel(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'Read': return `Reading ${short(input.file_path)}`;
    case 'Edit': case 'Write': return `Editing ${short(input.file_path)}`;
    case 'Glob': case 'Grep': return `Searching the repo`;
    case 'Bash': return `Running: ${String(input.command || '').slice(0, 80)}`;
    default:
      if (tool.startsWith('mcp__')) return `Calling ${tool.split('__').slice(-1)[0]}`;
      return `Using ${tool}`;
  }
}

function short(p: unknown): string {
  const s = String(p || '');
  return s.split(/[\\/]/).slice(-2).join('/');
}
