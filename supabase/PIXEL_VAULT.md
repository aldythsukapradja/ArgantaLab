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

"Download everything" is per-source work; the sync script has an extension seam at the
bottom — add one fetcher per source and it uploads + upserts exactly like the local art:

- **Lospec** — JSON API (`/palette-list/<slug>.json`) → straight into `pixel_palette`.
- **Kenney** — pack zips → unzip → upload each sprite.
- **OpenGameArt** — the `nyuuzyou/OpenGameArt-OGA-BY-4.0` Hugging Face dump (JSONL + images).
- **PixelLab** — your own generations via the PixelLab MCP land in Ingest, then here.

Because everything is private and behind your login, T1/T2 provenance is a **quality/traceability
signal**, not a shipping gate — you can store any of it. (Tiers still matter the day you'd
ever make something public: T0 ships freely, T1 needs credit, T2 is not yours to distribute.)

## What reads it

- **The app** — the Pixel Vault viewer renders the mount/CC0 art locally today; the next step
  points it at `pixel_manifest` (signed URLs) so it shows the full synced library.
- **Agents** — The Bridge's `pixel_*` tools query the same catalogue, so Claude Code can find a
  style reference before generating with PixelLab.
