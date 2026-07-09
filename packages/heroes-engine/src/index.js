// @arganta/heroes-engine — the shared paper-doll compositor for the ArgantaLab
// universe. Kingdom Heroes, LashiraBloom and Circle HQ's Character Forge all
// render characters through THIS one engine (canvas 2D, DSC part sheets from the
// Kingdom host, palette-index re-dye). Extracted verbatim from Kingdom Heroes so
// every app animates a character identically.
//
// Art root is resolved by the CONSUMING app's build via
// import.meta.env.VITE_KINGDOM_DATA_BASE (see data.js DATA_ROOT).
export * from './compositor.js';
export * from './palettes.js';
export * as data from './data.js';
export { default as CompositeStage } from './CompositeStage.jsx';
