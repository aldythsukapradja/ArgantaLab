// Minimal cosmetic types ported from apps/web so the real Buddy renders
// standalone on the landing page (no store / Supabase needed).
export interface CosmeticSlot { render: string; color: string }
export interface ResolvedOutfit {
  skin?: CosmeticSlot
  hat?: CosmeticSlot
  face?: CosmeticSlot
  back?: CosmeticSlot
  hand?: CosmeticSlot
  bg?: CosmeticSlot
}
