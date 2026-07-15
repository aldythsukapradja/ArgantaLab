// The one-line swap. Flip a value when a parallel workstream ships; the whole
// movie upgrades with zero WS1 changes.
//   core:  'legacy'      → 'ws2'   when WS2 reactor lands
//   nodes: 'placeholder' → 'ws3'   when WS3 knowledge nodes land
export const RENDERERS = {
  core: 'ws2' as 'legacy' | 'ws2' | 'media',
  nodes: 'ws3' as 'placeholder' | 'ws3',
}
