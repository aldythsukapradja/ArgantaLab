import esbuild from 'esbuild'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const res = await esbuild.build({ entryPoints:['src/data/learn.ts'], bundle:true, format:'esm', write:false, platform:'node', logLevel:'silent' })
const tmp = join(mkdtempSync(join(tmpdir(),'alab-')),'learn.mjs')
writeFileSync(tmp, res.outputFiles[0].text)
const { WORLDS, LOCAL_ITEMS, STAGES } = await import(pathToFileURL(tmp).href)
const stages = STAGES.map(s=>s.key) // tiny..legend
console.log('STAGES:', stages.join(' '))
console.log('TOTAL ITEMS:', LOCAL_ITEMS.length, '\n')
for (const w of WORLDS) {
  console.log(`\n=== ${w.name} (${w.key}) — skills: ${w.skills.map(s=>s.key).join(', ')} ===`)
  // per stage totals
  const perStage = {}
  for (const st of stages) perStage[st] = LOCAL_ITEMS.filter(i=>i.world===w.key && i.stage===st).length
  console.log('  by stage:', stages.map(st=>`${st}:${perStage[st]}`).join('  '))
  // per skill x stage
  for (const sk of w.skills) {
    const row = stages.map(st => {
      const n = LOCAL_ITEMS.filter(i=>i.world===w.key && i.skill===sk.key && i.stage===st).length
      return n ? `${st.slice(0,3)}:${n}` : `${st.slice(0,3)}:·`
    })
    console.log(`    ${sk.key.padEnd(12)} ${row.join('  ')}`)
  }
}
