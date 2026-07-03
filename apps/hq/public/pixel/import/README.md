# Import folder — drop art here, the sync ingests it

Anything you drop here is uploaded to your private Supabase `pixel-art` bucket on
the next `npm run pixel-sync` (from apps/mcp). Two conventions:

- `sheets/<pack>/*.png`  — each spritesheet/tilemap is **sliced** into individual
  16×16 tiles (blank/flat tiles skipped) and each tile uploaded.
- `sprites/<pack>/*.png` — each PNG is uploaded **as one sprite** (filename = name).

`<pack>` is any folder name — it becomes the group + a tag. Example:
  import/sheets/kenney-platformer/tilemap.png
  import/sprites/my-icons/sword.png

This is the reliable way to grow the vault: download any Kenney/itch/CC0 pack
(one-click zips), unzip into a pack folder here, and re-run the sync. It's your
private, login-walled store, so any source is fine.
