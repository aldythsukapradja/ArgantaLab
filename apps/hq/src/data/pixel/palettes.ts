// Palettes — canonical Arganta sets + a shortlist of public-domain Lospec
// palettes (Lospec shape: name, author, colors[]). These are the shared color
// systems the catalogue references; `usedBy` is computed in the engine.
import type { Palette } from './types'

export const PALETTES: Palette[] = [
  { id: 'pal.kid', name: 'Arganta Kid', author: 'Arganta', source: 'canonical', license: 'CC0', tags: ['canonical', 'bright', 'kid'], usedBy: 0,
    colors: ['#ff6b35', '#f7931e', '#ffcd75', '#63c74d', '#4cc9f0', '#4361ee', '#b55088', '#262b44', '#ffffff'] },
  { id: 'pal.kinetik', name: 'Kinetik', author: 'Arganta', source: 'canonical', license: 'CC0', tags: ['canonical', 'brand', 'family'], usedBy: 0,
    colors: ['#ff3d72', '#818cf8', '#6ee7f9', '#1a1a2e', '#f4f1ea'] },
  { id: 'pal.ui', name: 'Arganta UI', author: 'Arganta', source: 'canonical', license: 'CC0', tags: ['canonical', 'ui', 'neutral'], usedBy: 0,
    colors: ['#0d0f1a', '#1a1f36', '#2a3152', '#6b7aa8', '#c0cbdc', '#ffd27f'] },
  // ── Lospec · public domain ────────────────────────────────────────────────
  { id: 'pal.resurrect-64', name: 'Resurrect 64', author: 'Kerrie Lake', source: 'lospec', license: 'PublicDomain', tags: ['64', 'versatile', 'popular'], usedBy: 0,
    colors: ['#2e222f', '#3e3546', '#625565', '#966c6c', '#ab947a', '#694f62', '#7f708a', '#9babb2', '#c7dcd0', '#ffffff', '#6e2727', '#b33831', '#ea4f36', '#f57d4a', '#ae2334', '#e83b3b', '#fb6b1d', '#f79617', '#f9c22b', '#7a3045', '#9e4539', '#cd683d', '#e6904e', '#fbb954'] },
  { id: 'pal.endesga-32', name: 'Endesga 32', author: 'Endesga', source: 'lospec', license: 'PublicDomain', tags: ['32', 'game', 'popular'], usedBy: 0,
    colors: ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633', '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e', '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'] },
  { id: 'pal.pico-8', name: 'PICO-8', author: 'zep', source: 'lospec', license: 'PublicDomain', tags: ['16', 'fantasy-console', 'classic'], usedBy: 0,
    colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'] },
  { id: 'pal.gameboy', name: 'Game Boy (DMG)', author: 'Nintendo (shape, PD palette)', source: 'lospec', license: 'PublicDomain', tags: ['4', '1bit-ish', 'retro'], usedBy: 0,
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
]

export const paletteById = (id: string): Palette | undefined => PALETTES.find(p => p.id === id)
