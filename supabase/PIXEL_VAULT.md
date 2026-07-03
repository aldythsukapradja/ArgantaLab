# Pixel Vault → Supabase (private store)

Your personal, login-walled pixel-art database. Binaries live in a **private**
Storage bucket; metadata lives in `pixel_asset`. Nothing is public — reads are
gated to signed-in users, so this is safe for a personal collection regardless of
each item's license tier.

## One-time setup

1. **Run the migration** — Supabase → SQL Editor → paste `migration_pixel_vault.sql` → Run.
   Creates `pixel_asset`, `pixel_palette`, the private `pixel-art` bucket, RLS, and the
   `pixel_manifest` view. Safe to re-run.

2. **Sync the art you already have** — uploads the repo's real pixels + upserts every
   catalogue row and palette:
   ```bash
   cd apps/mcp
   SUPABASE_URL=https://<project>.supabase.co \
   SUPABASE_SERVICE_KEY=<service-role-key> \
   npm run pixel-sync
   ```
   The **service-role** key (Supabase → Settings → API) bypasses RLS for the write.
   Keep it secret — never commit it. The command is idempotent; re-run any time.

   Today that uploads the 10 owned mounts + the two Kenney CC0 packs, and catalogues
   every reference row (art-less refs get `storage_path=null` until a fetcher downloads them).

## Growing it to the full libraries

Two ways, both wired:

**1. Drop-folder (reliable, any source).** Put art in `apps/hq/public/pixel/import/`:
- `import/sheets/<pack>/*.png` → each spritesheet is **sliced** into tiles.
- `import/sprites/<pack>/*.png` → each PNG uploaded **as one sprite**.
Download any Kenney/itch/CC0 pack (one-click zips), unzip into a pack folder, re-run
the sync. Fully offline, no scraping. It's your private store, so any source is fine.

**2. Lospec palettes (network, opt-in).** Add `FETCH_LOSPEC=1` to the sync command to
pull the full Lospec library (~4,300 palettes) into `pixel_palette`:
```bash
SUPABASE_URL=… SUPABASE_SERVICE_KEY=… FETCH_LOSPEC=1 npm run pixel-sync
```

Still to add as fetchers (the seam is in `pixel-sync.ts`): Kenney.nl pack auto-download,
the `nyuuzyou/OpenGameArt-OGA-BY-4.0` Hugging Face dump, PixelLab MCP output.

Because everything is private and behind your login, T1/T2 provenance is a **quality/traceability
signal**, not a shipping gate — you can store any of it. (Tiers still matter the day you'd
ever make something public: T0 ships freely, T1 needs credit, T2 is not yours to distribute.)

## What reads it

- **The app** — the Pixel Vault viewer renders the mount/CC0 art locally today; the next step
  points it at `pixel_manifest` (signed URLs) so it shows the full synced library.
- **Agents** — The Bridge's `pixel_*` tools query the same catalogue, so Claude Code can find a
  style reference before generating with PixelLab.
