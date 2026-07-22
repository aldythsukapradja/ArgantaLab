// Minimal typing for the two pako functions GVSURF uses (avoids a heavy @types dep).
declare module 'pako' {
  export function gzip(data: Uint8Array, opts?: { level?: number }): Uint8Array;
  export function ungzip(data: Uint8Array): Uint8Array;
  const _default: { gzip: typeof gzip; ungzip: typeof ungzip };
  export default _default;
}
