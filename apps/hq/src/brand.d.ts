// @arganta/brand is plain JS (no .d.ts). HQ imports it via a Vite alias to the
// package source; this shim keeps TypeScript quiet without duplicating the
// contract — schema.js is the single definition of a BrandDoc.
declare module '@arganta/brand'
