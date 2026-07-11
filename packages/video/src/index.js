// @arganta/video — one deterministic, zero-asset video engine shared by Circle
// HQ's Video Builder. The sibling of @arganta/audio: audio synthesizes SOUND
// from recipes, this synthesizes VOICE (from pasted text) + VISUAL FRAMES (from
// a layer recipe) and muxes them into a real video file. Nothing is a binary
// asset; the same project + the same text always produce the same content.
export * from './voice.js';
export * from './layers.js';
export * from './render.js';
export * from './project.js';
export * from './cinematic.js';
export * from './assets.js';
export * from './director.js';
