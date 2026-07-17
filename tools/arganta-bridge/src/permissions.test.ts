import { classify } from './permissions.ts'
const cases: [string, Record<string,unknown>, 'auto'|'gate'][] = [
  ['Read', { file_path: 'x' }, 'auto'],
  ['Edit', { file_path: 'x' }, 'auto'],
  ['Bash', { command: 'npm test' }, 'auto'],
  ['Bash', { command: 'git status' }, 'auto'],
  ['Bash', { command: 'git push origin main' }, 'gate'],
  ['Bash', { command: 'rm -rf build' }, 'gate'],
  ['Bash', { command: 'supabase db push' }, 'gate'],
  ['Bash', { command: 'npx wrangler deploy' }, 'gate'],
  ['mcp__media-gen__generate_image', { prompt: 'x' }, 'auto'],
  ['mcp__arganta-core-content__buffer_publish', {}, 'gate'],
  ['mcp__e1a94d30-525c-43d8-bf89__generate_video', { prompt: 'x' }, 'gate'],
]
let pass = 0
for (const [tool, input, want] of cases) {
  const got = classify(tool, input)
  const ok = got === want
  if (ok) pass++; else console.log(`FAIL ${tool} "${input.command||''}" -> ${got}, want ${want}`)
}
console.log(`${pass}/${cases.length} classifier cases pass`)
process.exit(pass === cases.length ? 0 : 1)
