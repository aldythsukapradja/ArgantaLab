// vite-plugin-agent-cockpit.ts — lets a LOCAL agent see the app, and drive it.
//
// Two halves, both dev-only:
//
//   see    the running app POSTs its current state; the plugin writes it to
//          .agent/live-state.json, which Claude or Codex can simply Read. They
//          get {nav, field, well, basin} — the app's ACTUAL state — instead of
//          squinting at a screenshot and inferring it.
//
//   steer  the agent writes .agent/commands.json; the app polls, and every
//          command is dispatched through the SAME AgentCommand bus the
//          deterministic agent has always used.
//
// THAT LAST POINT IS THE WHOLE SAFETY ARGUMENT. There is no synthetic clicking,
// no DOM injection, no new privilege surface. The bus accepts four operations —
// scope, view, map, clear — so an agent driving this app can do exactly what a
// user could do through the UI, and nothing else. Anything outside that union
// is rejected here, before it reaches the browser.
//
// DEV ONLY, and enforced in three places rather than trusted once: apply:'serve'
// means it is never part of a build, the routes refuse non-loopback callers, and
// the client half is behind import.meta.env.DEV. A production bundle contains
// none of it.

import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const DIR = '.agent';
const STATE = 'live-state.json';
const COMMANDS = 'commands.json';

/** The only operations that can cross this boundary. Kept in sync with
 *  AgentCommand by the truth-lock, not by memory. */
const ALLOWED_OPS = new Set(['scope', 'view', 'map', 'clear']);

/** Loopback only. This binds a route that can navigate the operator's app; it
 *  has no business answering anything that arrived over a network interface. */
function isLocal(remote?: string): boolean {
  if (!remote) return false;
  const a = remote.replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1' || a === 'localhost';
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      // A state blob is a few hundred bytes. Anything approaching a megabyte is
      // a bug or an attempt, and either way should not be buffered.
      if (size > 256_000) { reject(new Error('payload too large')); req.destroy(); return; }
      out += c;
    });
    req.on('end', () => resolve(out));
    req.on('error', reject);
  });
}

export function agentCockpit(): Plugin {
  return {
    name: 'arganta-agent-cockpit',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const root = server.config.root;
      const dir = path.join(root, DIR);
      fs.mkdirSync(dir, { recursive: true });

      const statePath = path.join(dir, STATE);
      const commandsPath = path.join(dir, COMMANDS);

      // A README beside the files, because a bare JSON blob in a dot-directory
      // is a mystery to whoever finds it next.
      fs.writeFileSync(path.join(dir, 'README.md'), [
        '# .agent — the local agent cockpit (dev only)',
        '',
        '`live-state.json` is written by the running app whenever its state changes.',
        'Read it to know exactly what the operator is looking at.',
        '',
        '`commands.json` is read AND CLEARED by the app roughly once a second.',
        'Write an array of AgentCommand objects to drive the app:',
        '',
        '```json',
        '[{ "op": "view", "view": { "nav": "exploration", "mode": "knowledge" } },',
        ' { "op": "scope", "patch": { "field": { "id": "...", "name": "VOLVE" } }, "autofill": true }]',
        '```',
        '',
        'Only op values scope | view | map | clear are accepted; anything else is',
        'dropped by the dev server before it reaches the browser. This is the same',
        'command bus the in-app agent uses, so nothing here can do more than a',
        'user could do by clicking.',
        '',
        'Neither file is served in a production build.',
      ].join('\n'));

      server.middlewares.use('/__agent/state', async (req, res) => {
        if (!isLocal(req.socket.remoteAddress)) { res.statusCode = 403; res.end('local only'); return; }
        if (req.method === 'POST') {
          try {
            const body = await readBody(req);
            JSON.parse(body);                       // reject malformed before it lands on disk
            fs.writeFileSync(statePath, body);
            res.statusCode = 204; res.end();
          } catch {
            res.statusCode = 400; res.end('bad json');
          }
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : '{}');
      });

      // Read-and-clear: a command must run once. Leaving the file in place would
      // make the app re-execute it every poll, which turns one mistaken write
      // into an unstoppable loop.
      server.middlewares.use('/__agent/commands', (req, res) => {
        if (!isLocal(req.socket.remoteAddress)) { res.statusCode = 403; res.end('local only'); return; }
        let queued: unknown[] = [];
        try {
          if (fs.existsSync(commandsPath)) {
            const raw = fs.readFileSync(commandsPath, 'utf8').trim();
            if (raw) queued = JSON.parse(raw);
            fs.writeFileSync(commandsPath, '[]');
          }
        } catch { queued = []; }

        const safe = (Array.isArray(queued) ? queued : [])
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .filter((c) => ALLOWED_OPS.has(String(c.op)));

        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(safe));
      });

      server.config.logger.info('  ➜  agent cockpit:  .agent/live-state.json  ·  .agent/commands.json');
    },
  };
}
