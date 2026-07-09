// Shared emote catalog + per-device favorites — ONE list both games draw their
// Settings picker and action-cluster orb from. Emote names are BARE (no facing
// suffix — Motion.tbl stores them without direction), matching the extractor's
// motion catalog exactly.
export const EMOTES = ['Victory', 'Smile', 'Cry', 'Blush', 'Wink', 'Yawn', 'Sleep',
  'Surprise', 'Angry', 'Merong', 'Kongi', 'Pish', 'Dance', 'Cold', 'HandToMouth'];

export const FAVORITES_MAX = 4;
export const DEFAULT_FAVORITE_EMOTES = ['Victory', 'Smile', 'Dance', 'Wink'];

// storageKey is app-specific ('kingdom_fav_emotes' / 'lashira_fav_emotes') so each
// app keeps its own device preference under its own existing localStorage namespace.
export function loadFavoriteEmotes(storageKey) {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(raw) && raw.length && raw.every((e) => EMOTES.includes(e))) {
      return raw.slice(0, FAVORITES_MAX);
    }
  } catch { /* ignore */ }
  return [...DEFAULT_FAVORITE_EMOTES];
}
export function saveFavoriteEmotes(storageKey, list) {
  try { localStorage.setItem(storageKey, JSON.stringify(list.slice(0, FAVORITES_MAX))); } catch { /* quota */ }
}
