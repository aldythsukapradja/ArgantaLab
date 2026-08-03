import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const source = 'C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab/docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));

for (const [sheetId, range] of [
  ['Citations', 'A1:K43'],
  ['Stratigraphic Units', 'A1:J12'],
  ['Petroleum System', 'A64:I70'],
  ['PS x Cycle', 'A1:D4'],
]) {
  const out = await workbook.inspect({ kind: 'table', sheetId, range, include: 'values,formulas', tableMaxRows: 50, tableMaxCols: 15, maxChars: 30000 });
  console.log(`TABLE ${sheetId}!${range}`);
  console.log(out.ndjson);
}

const style = await workbook.inspect({ kind: 'computedStyle', sheetId: 'Petroleum System', range: 'A1:I3', maxChars: 8000 });
console.log('STYLE');
console.log(style.ndjson);

await fs.mkdir('C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab/.codex/tmp-petsys/renders', { recursive: true });
for (const [sheetName, range, name] of [
  ['Petroleum System', 'A1:I18', 'before-ps.png'],
  ['PS x Cycle', 'A1:D4', 'before-cycle.png'],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1.25, format: 'png' });
  await fs.writeFile(`C:/Users/aldhy/OneDrive/Documents/GitHub/ArgantaLab/.codex/tmp-petsys/renders/${name}`, new Uint8Array(await image.arrayBuffer()));
}
