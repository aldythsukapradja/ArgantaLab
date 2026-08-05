import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The shared Arganta runtime contracts — the SAME ones apps/hq builds its
  // agent on: @arganta/agent's pure loop + tool registry, @arganta/ai's provider
  // adapter and model router. apps/energy is not an npm workspace member (the
  // root `workspaces` list is packages/* plus the two game apps), so they are
  // aliased by path rather than installed: no duplicate copy, no version drift,
  // and CI already runs their unit tests.
  resolve: {
    alias: {
      '@arganta/ai': fileURLToPath(new URL('../../packages/ai/src/index.js', import.meta.url)),
      '@arganta/agent': fileURLToPath(new URL('../../packages/agent/src/index.js', import.meta.url)),
    },
  },
  // Host is deliberately LEFT AT THE DEFAULT.
  //
  // `localhost` on Windows resolves to both ::1 (AAAA, tried first) and 127.0.0.1 (A).
  // Pinning host:'127.0.0.1' was tried and made things worse: every client then hit ::1
  // first and got connection-refused, relying on a Happy-Eyeballs fallback that Chrome
  // does and many other clients do not. The default binds whatever localhost resolves
  // to, which is the address the launcher and the browser both ask for.
  //
  // If an explicit-IPv4 client ever needs to connect, the fix is `--host` at the call
  // site for that session — NOT a config change that silently exposes the dev server to
  // the local network for everyone.
  server: { port: 5279, strictPort: true },
  preview: { port: 5279 },
});
