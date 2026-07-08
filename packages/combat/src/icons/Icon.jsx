// GameIcon — renders a vendored game-icons.net glyph (CC BY 3.0) as inline SVG
// with fill="currentColor", so each skin tints it by setting the orb's color.
// Names are the vendored keys "<author>__<slug>" (see ./svg + ../skins.js).
import React from 'react';
import { ICON_PATHS } from './paths.js';

export function GameIcon({ name, size = 28, className }) {
  const ds = ICON_PATHS[name];
  if (!ds) return null;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={className} fill="currentColor" aria-hidden="true">
      {ds.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

export { ICON_PATHS };
