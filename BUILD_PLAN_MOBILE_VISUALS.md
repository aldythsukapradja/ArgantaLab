# Mobile-First Visual Build Plan
**Date**: 2026-06-23  
**Model Status**: Haiku 4.5 (planning phase). Will flag if upgrading to Opus 4.8 for complex visual implementation.

---

## Overview
Convert the Game Builder's desktop-optimized catalog UI into a mobile-first responsive experience where every component pulls live data from Supabase (no mocked/static data). The catalog, featured strip, user filter, and game previews must work seamlessly on iPhone/tablet screens with proper touch interactions.

---

## Current State Audit

### What Works ✓
- **Featured games**: Dynamic ranking via `hq_featured` table (live.ts)
- **Data layer**: `listGames()`, `listFeatured()`, `setFeatured()`, `reorderFeatured()`
- **Device preview modes**: DEVICES object with desktop/tablet/phone AR presets
- **Game sources**: Builtin (static HTML) + community (Supabase games table)
- **User filter**: Creator filter across all games (already implemented)

### What Needs Mobile Optimization
1. **CatalogView** (line 164): Desktop grid (200px min) → mobile stack
2. **FeaturedStrip** (line 306): Ranked list UI → horizontal swiper/carousel for mobile
3. **GameGrid** (line 465): CSS grid → single column on mobile, 2-col on tablet
4. **GameCard** (line 486): Fixed 200px card size → responsive scaling
5. **BuildView preview panel** (line 542): Side-by-side layout → stacked on mobile
6. **UserFilter pills** (line 429): Wrap behavior inconsistent on narrow screens
7. **Touch interactions**: Tap targets <44px, drag-to-reorder for featured list
8. **Data fetching**: Optimize for mobile bandwidth (lazy load game previews)

---

## Phase 1: Foundation (Haiku 4.5) — *No code changes yet*

### 1.1 Define Mobile Breakpoints
- **Mobile**: < 640px (iPhone SE to iPhone 14 Max in portrait)
- **Tablet**: 640px–1024px (iPad mini in portrait, iPad in landscape)
- **Desktop**: > 1024px

### 1.2 Identify Supabase Data Queries Needed
| Component | Query | Load Strategy | Cache |
|-----------|-------|---|---|
| **CatalogView** | `listGames()` (games table) | On mount, refresh via button | 5 min |
| **FeaturedStrip** | `listFeatured()` (hq_featured + joins) | On mount, update on rank change | 1 min |
| **GameCard preview** | None yet — show thumbnail only (new field?) | On-demand in BuildView | — |
| **UserFilter** | Extract creators from games array (no extra query) | Computed from listGames | — |

### 1.3 Identify Missing Supabase Columns
- **games table**: Add `thumbnail` column (URL to 200x112 preview image)? Already exists in schema.
- **hq_featured**: Already has `game_ref`, `rank`, `created_at` — sufficient.

---

## Phase 2: Component Refactor (Haiku or Opus) — *Start implementation*

### 2.1 Create Mobile Layout Wrapper
**File**: `apps/hq/src/components/ResponsiveContainer.tsx` (NEW)

```
Props:
  - mobile: boolean (< 640px)
  - tablet: boolean (640-1024px)
  - children: React.ReactNode

Logic:
  - useMediaQuery hook to detect breakpoint
  - Pass breakpoint props down to children
  - Define margin/padding strategy:
    * Mobile: 12px sides, 16px top/bottom
    * Tablet: 20px sides, 20px top/bottom
    * Desktop: 24px sides, 24px top/bottom
```

### 2.2 Refactor GameGrid for Responsive Layout
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY GameGrid function, line 465)

**Desktop** (> 1024px):
```
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))
gap: 10px
```

**Tablet** (640–1024px):
```
grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))
gap: 10px
```

**Mobile** (< 640px):
```
grid-template-columns: repeat(2, 1fr)  // 2-column on portrait
gap: 10px
// OR single column (1fr) if grid feels cramped
```

### 2.3 Refactor FeaturedStrip for Mobile
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY FeaturedStrip function, line 306)

**Current** (line 311): Vertical card list with border separators

**Mobile New** (< 640px):
- Horizontal scrollable carousel (snap-scroll)
- Card height: 100px (from current 44px row)
- Emoji: 28px (from 18px)
- Card width: 160px (fit 2.25 cards per viewport)
- Reorder via up/down chevrons below each card (buttons stack vertically)

**Tablet/Desktop** (≥ 640px):
- Keep current vertical list layout
- Card height: 52px (from 44px for better touch)

**Touch Interactions**:
- Swipe left/right to scroll (built-in with overflow-x: auto)
- Long-press to show reorder menu (or keep chevrons visible)
- Tap to open game

### 2.4 Refactor GameCard for Mobile
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY GameCard function, line 486)

**Current**: Fixed 200px × ~240px card

**Mobile Responsive**:
```
CardContainer {
  padding: 0
  border-radius: var(--r-md)
  overflow: hidden
}

CardImage {
  height: 100px (from 76px)
  width: 100%
  display: flex
  align-items: center
  justify-content: center
}

CardContent {
  padding: 12px (from 10px 12px 12px)
  font-sizes:
    - Title: 14px (from 13px)
    - Category: 12px (from 11px)
    - Creator: 11px (unchanged)
    - Plays: 11px (unchanged)
}

StarBtn {
  width: 32px (from 26px) — easier to tap on mobile
  height: 32px
  top: 8px, right: 8px
}
```

### 2.5 Refactor UserFilter Pills for Mobile
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY UserFilter function, line 429)

**Current** (line 442): Horizontal pill row, flexWrap: wrap

**Mobile New** (< 640px):
- Make pills scrollable horizontally on small screens (snap-scroll)
- Increase pill padding: `8px 14px` (from `5px 11px`) for larger touch targets
- Font size: `12px` (from `11.5px`)

**Tablet/Desktop** (≥ 640px):
- Keep current wrap behavior
- Font size: `11.5px`

### 2.6 Refactor BuildView Preview Panel for Mobile
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY BuildView function, line 533)

**Current** (line 617):
```
grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))
```
→ Works but left panel grows too wide on mobile

**Mobile New** (< 640px):
- **Single column stack**:
  1. Left panel (workflow: step 1–3, publish button)
  2. Right panel (device preview, open-in-new-tab)
  3. Both full width

**Tablet/Desktop** (≥ 640px):
- **Two-column layout** (keep current):
  1. Left: 45% (workflow)
  2. Right: 55% (preview)

**Preview Panel Touch Interaction**:
- Device selector: Segmented control (desktop/tablet/phone buttons)
- Swipe between devices (gesture → setDevice)
- Landscape preview on tablet in landscape orientation

---

## Phase 3: Data Fetching & Performance (Opus 4.8) — *Implementation*

### 3.1 Add Skeleton Loaders
**File**: `apps/hq/src/components/Skeleton.tsx` (NEW)

```typescript
export function GameCardSkeleton() {}
export function FeaturedStripSkeleton() {}
```

Show skeletons while `games === undefined` instead of generic <Loading> component.

### 3.2 Lazy Load Game Thumbnails
**File**: `apps/hq/src/data/live.ts` (MODIFY)

Add helper to compute thumbnail URL from game:
```typescript
export function getThumbnailUrl(game: PublishedGame): string {
  return game.thumbnail || '/placeholder-game.png'
}
```

Load images with `loading="lazy"` attribute in GameCard.

### 3.3 Prefetch Featured Games on Mount
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY GameBuilder, line 54)

When featured list loads, batch-fetch the games it references:
```typescript
useEffect(() => {
  load()  // listGames()
  loadFeatured()  // listFeatured()
  // Auto-prefetch featured game details for faster rendering
}, [])
```

No extra query needed — `listGames()` already returns all games, featured refs are just IDs.

### 3.4 Debounce Reorder on Mobile
**File**: `apps/hq/src/surfaces/GameBuilder.tsx` (MODIFY reorderFeatured, line 81)

Add 300ms debounce on drag-reorder to avoid firing too many RPCs:
```typescript
const debouncedReorder = useCallback(
  debounce((orderedRefs: string[]) => live.reorderFeatured(orderedRefs), 300),
  []
)
```

---

## Phase 4: Touch & Accessibility (Haiku or Opus)

### 4.1 Increase Touch Target Sizes
- Buttons: 44×44px minimum (currently 26–32px)
- Pills (filter, category): 36px height (currently ~20px)
- chevron up/down in FeaturedStrip: Already 32px ✓

### 4.2 Add Swipe Gestures
- FeaturedStrip: Horizontal swipe → scroll carousel
- GameCard: Long-press or swipe → context menu (optional for Phase 2)

### 4.3 Haptic Feedback (iOS)
- On featured toggle (star button): `navigator.vibrate([10])`
- On drag reorder: `navigator.vibrate([50, 30, 50])`

---

## Phase 5: Testing & Polish

### 5.1 Device Testing Checklist
- [ ] iPhone SE (375px) in portrait
- [ ] iPhone 14 Pro (393px) in portrait
- [ ] iPhone 14 Pro in landscape (852px)
- [ ] iPad Mini (768px) in portrait
- [ ] iPad (1024px) in landscape
- [ ] Chrome DevTools mobile emulation

### 5.2 Interaction Testing
- [ ] Tap featured star → optimistic update + server sync
- [ ] Reorder featured (up/down chevrons) → smooth UI update
- [ ] Scroll FeaturedStrip on mobile (carousel snap)
- [ ] Filter by creator → card grid updates
- [ ] Refresh button → games + featured reload without flicker
- [ ] All API calls use live Supabase data (verify network tab)

### 5.3 Performance Targets
- **CatalogView mount**: < 1s (with skeleton loaders)
- **Featured reorder**: < 200ms optimistic, < 2s server ACK
- **Filter change**: < 100ms (local array filter)
- **Mobile load size**: < 150KB JS (lazy load device preview code)

---

## File Summary

### New Files (Phase 2–3)
1. **ResponsiveContainer.tsx** — Breakpoint detection wrapper
2. **Skeleton.tsx** — Skeleton loaders for cards and strips
3. (Optional) **useSwipeGesture.ts** — Swipe detection hook

### Modified Files
1. **GameBuilder.tsx**
   - CatalogView: Responsive grid + mobile sections
   - FeaturedStrip: Carousel on mobile, vertical on desktop
   - GameGrid: 2-col on mobile, 3-col tablet, auto-fill desktop
   - GameCard: Responsive sizing + larger star button
   - UserFilter: Scrollable pills on mobile
   - BuildView: Stacked on mobile, side-by-side on desktop
2. **live.ts**
   - Add `getThumbnailUrl()` helper
   - (Optional) Add batch-prefetch for featured games

### No Changes Needed
- schema.sql (all required columns exist)
- featuredGames.ts (static data)

---

## Implementation Roadmap

| Phase | Task | Est. Size | Model | Branch |
|-------|------|-----------|-------|--------|
| 2 | ResponsiveContainer + GameGrid mobile grid | Small | Haiku | `claude/mobile-grid` |
| 2 | FeaturedStrip carousel (desktop/mobile) | Medium | **Opus** | `claude/featured-carousel` |
| 2 | GameCard responsive sizing | Small | Haiku | (in mobile-grid) |
| 2 | UserFilter + BuildView responsive layout | Medium | Haiku | `claude/buildview-responsive` |
| 3 | Skeleton loaders | Small | Haiku | `claude/skeleton-loaders` |
| 3 | Thumbnail lazy loading | Small | Haiku | (in mobile-grid) |
| 4 | Touch targets + haptic feedback | Small | Haiku | `claude/touch-interactions` |
| 5 | Mobile device testing | N/A | N/A | (all branches) |

---

## Model Flagging Strategy

**Current**: Haiku 4.5 (lightweight tasks)

**When to upgrade to Opus 4.8**:
- [ ] Complex CSS/responsive layout logic (Phase 2)
- [ ] Gesture recognition & swipe handlers (Phase 4)
- [ ] Performance optimization & code splitting (Phase 3)
- [ ] Visual polish & animation timing (Phase 5)

**Flag before each change** with:
```
**Model Status**: [Haiku 4.5 | Opus 4.8 for <reason>]
```

---

## Success Criteria
1. ✅ All visuals render correctly on iPhone (375–430px width)
2. ✅ All Supabase queries fire correctly (check DevTools Network)
3. ✅ Featured games show in carousel on mobile, list on desktop
4. ✅ User can reorder featured with touch (up/down buttons)
5. ✅ Game cards display 2-column on mobile, scale responsively
6. ✅ Touch targets ≥ 44px for all interactive elements
7. ✅ No console errors on mobile devices
8. ✅ Load time < 1s with skeleton loaders
9. ✅ BuildView stacks single-column on mobile, expands on desktop
10. ✅ All data stays in sync with Supabase (no cached stale data)
