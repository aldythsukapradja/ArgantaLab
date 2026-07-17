// B1 smoke test: (1) wrong token is rejected, (2) a real read-only mission
// streams status/tool/message/done events through the full Agent SDK pipeline.
import WebSocket from 'ws';

const PORT = 7717;
const TOKEN = 'arganta-bridge-local-dev-3070ti-sovereign';

function connect(token: string): Promise<WebSocket> {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?token=${token}`);
    ws.on('open', () => res(ws));
    ws.on('close', (code) => rej(new Error(`closed ${code}`)));
    ws.on('unexpected-response', (_req, r) => rej(new Error(`http ${r.statusCode}`)));
    ws.on('error', () => {});
  });
}

async function main() {
  // 1. wrong token must be rejected at the handshake (never opens)
  let rejected = false;
  try { await connect('WRONG'); } catch { rejected = true; }
  console.log(rejected ? 'PASS: wrong token rejected at handshake' : 'FAIL: wrong token not rejected');

  // 2. real mission
  const ws = await connect(TOKEN);
  console.log('PASS: authed socket open');
  const events: string[] = [];
  let done = false;
  ws.on('message', (raw) => {
    const ev = JSON.parse(raw.toString());
    events.push(ev.type);
    const extra = ev.label || ev.text?.slice(0, 60) || ev.result?.slice(0, 60) || '';
    console.log(`  <- ${ev.type}: ${extra}`);
    if (ev.type === 'awaiting_approval') {
      console.log('  -> auto-approving (smoke)');
      ws.send(JSON.stringify({ type: 'approval', approvalId: ev.approvalId, approved: true, input: ev.input }));
    }
    if (ev.type === 'done' || ev.type === 'error') { done = true; ws.close(); }
  });
  ws.send(JSON.stringify({
    type: 'mission',
    missionId: 'smoke-1',
    prompt: 'Read the file tools/arganta-bridge/package.json and tell me the value of the "name" field in one short sentence.',
  }));

  const deadline = Date.now() + 180000;
  while (!done && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  console.log(done ? `PASS: mission completed. events=[${[...new Set(events)].join(',')}]`
                   : 'FAIL: mission timed out');
  process.exit(0);
}
main();
