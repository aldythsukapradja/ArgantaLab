// The Arena is ported from the standalone Kingdom Character Lab as untyped
// .jsx (with .js engine/net helpers). It stays OUTSIDE apps/web's strict tsc
// program; the typed Arena.tsx wrapper bridges in through this single
// wildcard declaration so the production `tsc` build stays green.
declare module '*.jsx';
