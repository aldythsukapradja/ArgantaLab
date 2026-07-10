// Crisp HUD/control icons — copied verbatim from Kingdom Heroes'
// apps/kingdom/web/src/room/TestRoom.jsx (emoji renders inconsistently; SVG
// stays sharp). Re-run apps/lashira/web/scripts/sync-heroes.mjs after a Heroes
// icon update to keep this file in sync.
export const IconHeart = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-7.2-4.6-9.7-8.7C.6 9 2.6 5.4 6.2 5.4c2.1 0 3.6 1.2 4.6 2.6 1-1.4 2.5-2.6 4.6-2.6 3.6 0 5.6 3.6 3.9 6.9C19.2 16.4 12 21 12 21z" />
  </svg>
);
export const IconMana = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c0 0 7 7.6 7 12.2A7 7 0 0 1 5 14.7C5 10.1 12 2.5 12 2.5z" />
  </svg>
);
export const IconSwords = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6" /><path d="m16 16 4 4" /><path d="M19 21h2v-2" />
    <path d="M9.5 17.5 21 6V3h-3L6.5 14.5" /><path d="m11 19-6-6" /><path d="m8 16-4 4" /><path d="M5 21H3v-2" />
  </svg>
);
export const IconHand = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" /><path d="M11 11.5V4a1.5 1.5 0 0 1 3 0v8" />
    <path d="M14 12V6.5a1.5 1.5 0 0 1 3 0V13" /><path d="M17 12.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-2.3a5 5 0 0 1-3.5-1.5L5 15.5a1.6 1.6 0 0 1 2.3-2.3L9 15" />
  </svg>
);
export const IconMount = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
    <path d="M3 5c1.6.2 2.7 1 3.5 2.3L8 9l3.5-.4c2.6-.3 5 .8 6.6 2.9l1.9 2.5-2 .3-1.6-1.4-.6 3.9c-.1.9-.9 1.5-1.8 1.4-.8-.1-1.4-.9-1.3-1.7l.5-3.4-2.9.3-1.2 3.7c-.3.8-1.1 1.2-1.9 1-.8-.3-1.2-1.1-1-1.9l1.1-3.4c-1.3-.7-2.2-2-2.4-3.6L3 5z" />
  </svg>
);
export const IconSpark = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z" />
  </svg>
);
export const IconFriends = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19" />
  </svg>
);

// ---- Settings "Command Sheet" row icons (new, hand-authored in this same
// 24x24 minimal style — NOT from Kingdom Heroes) — see docs/lashirabloom/
// Openworld Bloom Concept/DESIGN-unified-settings-command-sheet.md. These
// replace colorful pictorial emoji (🔊🎵🏃🔍🛠📍🚪⚙) that render wildly
// differently per OS/browser, with crisp currentColor-tinted glyphs — same
// rationale as the block above. Default size 18; override via width/height.
export const IconGear = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 2.5v3.4M12 18.1v3.4M4.63 4.63l2.4 2.4M16.97 16.97l2.4 2.4M2.5 12h3.4M18.1 12h3.4M4.63 19.37l2.4-2.4M16.97 7.03l2.4-2.4" />
  </svg>
);
export const IconSpeaker = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M4 9.5v5h3.6l5.2 4V5.5l-5.2 4H4z" fill="currentColor" />
    <path d="M16.3 8.6a5.4 5.4 0 0 1 0 6.8M19 6a9 9 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);
export const IconMusic = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6.3" cy="18" r="2.7" fill="currentColor" stroke="none" />
    <circle cx="17.3" cy="16" r="2.7" fill="currentColor" stroke="none" />
    <path d="M9 18V5.3L20 3v12.7" />
  </svg>
);
export const IconSpeed = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 16a8 8 0 1 1 16 0" />
    <path d="M12 16l4.3-5" />
    <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);
export const IconZoom = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10.4" cy="10.4" r="6.4" />
    <path d="M15.1 15.1L20.5 20.5" />
    <path d="M7.6 10.4h5.6" />
  </svg>
);
export const IconWrench = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2.5-2.5z" fill="currentColor" />
  </svg>
);
export const IconPin = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="currentColor" />
  </svg>
);
export const IconDoor = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h9" />
    <path d="M10 12h11m0 0l-3.5-3.5M21 12l-3.5 3.5" />
  </svg>
);
