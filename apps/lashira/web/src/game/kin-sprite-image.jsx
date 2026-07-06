import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import KinSprite from '@components/openworld/KinSprite';

const imageCache = new Map();

function renderKey(kin) {
  return kin?.render || kin?.assetKey?.replace(/^kin\./, '') || String(kin?.kinKey || '').replace(/^kin:/, '');
}

function colorFor(kin) {
  if (typeof kin?.color === 'string' && kin.color.startsWith('#')) return kin.color;
  if (kin?.color != null) return '#' + Number(kin.color).toString(16).padStart(6, '0');
  return '#f59e0b';
}

export function hasActualKinArt(kin) {
  return !!renderKey(kin);
}

function getKinImage(kin) {
  const key = renderKey(kin);
  if (!key) return null;
  const color = colorFor(kin);
  const cacheKey = `${key}:${color}`;
  let img = imageCache.get(cacheKey);
  if (img) return img;

  const markup = renderToStaticMarkup(<KinSprite render={key} color={color} size={100} />);
  img = new Image();
  img.decoding = 'async';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  imageCache.set(cacheKey, img);
  return img;
}

export function drawActualKinSprite(ctx, kin, footX, footY, frame = 0) {
  const img = getKinImage(kin);
  if (!img || !img.complete || !img.naturalWidth) return false;
  const size = 52;
  const bob = frame % 2 ? -2 : 0;
  ctx.drawImage(img, footX - size / 2, footY - size + 5 + bob, size, size);
  return true;
}
