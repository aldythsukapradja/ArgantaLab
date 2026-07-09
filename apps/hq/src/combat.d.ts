// The combat package is plain JS (no .d.ts). Battle Builder imports it via a Vite
// alias; this keeps `tsc` happy without hand-writing types for every export.
declare module '@arganta/combat'
