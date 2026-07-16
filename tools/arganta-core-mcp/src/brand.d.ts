// @arganta/brand is plain JS (no .d.ts). The MCP consumes it through a file:
// dependency (npm symlinks it into node_modules), and this shim keeps TypeScript
// quiet without restating the contract — packages/brand/src/schema.js is the one
// definition of a BrandDoc.
declare module '@arganta/brand'
