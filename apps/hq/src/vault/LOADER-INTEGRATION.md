# Vault Loader — integration + local verification

`vaultLoader.ts` lets the HQ Vault app boot from the **`vault-hq/` markdown files**
(the single source of truth) instead of the hardcoded `seed.ts`. It is additive —
nothing imports it until you make the two changes below.

> ⚠️ Not runtime-verified from CI: `import.meta.glob` only resolves under a real
> Vite build. Apply these changes locally and run `npm run dev` to verify.

## Step 1 — let Vite reach the repo-root vault folder (dev server)

`vault-hq/` sits above `apps/hq/`, so allow it in `apps/hq/vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5273,
    fs: { allow: ['..', '../../vault-hq'] },   // <-- add
  },
})
```
(`import.meta.glob` bundles file contents at build time, so production `vite build`
usually needs no change; this line is for the dev server + HMR.)

## Step 2 — boot notes from the vault (store.ts)

In `apps/hq/src/vault/store.ts`, near the top imports add:
```ts
import { loadVaultNotes, hasVaultNotes } from './vaultLoader'
```
Then change the hydrate line (~L72):
```ts
// before:
const initialNotes = snap?.notes && Object.keys(snap.notes).length ? snap.notes : seedNotes()
// after — vault files win as the source of truth; seed is the last resort:
const vaultNotes = hasVaultNotes() ? loadVaultNotes() : null
const initialNotes = snap?.notes && Object.keys(snap.notes).length
  ? snap.notes
  : (vaultNotes ?? seedNotes())
```

### Precedence note (important)
A saved localStorage snapshot still wins over the vault, so **existing users won't see
vault changes until they reset**. Because the vault is the source of truth and edits happen
in Obsidian/git (not in-app), you likely want a **"Reload from vault"** command that calls
`replaceVault(Object.values(loadVaultNotes()))` (that action already exists in the store).
Add it to the command palette when you want live re-sync; for a first test, `resetVault()`
then reload is enough to see the vault load.

## Step 3 — verify locally (the honest check)

```bash
cd apps/hq && npm install && npm run dev
```
Open the Vault → Graph view. Expect ~32 nodes (the knowledge notes + MOCs + the
`Paid vs Free AI Tools` capture), colored by product. Confirm:
- the capture node appears (product: Research) linked to `mcp-connectors` + `circle-hq`;
- filtering `class: operational` hides the brainstorm capture;
- no console errors from the glob path (if the path is wrong, fix the `../` depth).

If the graph renders with the vault notes, the "single source of truth → HQ webapp"
leg is proven end to end.
