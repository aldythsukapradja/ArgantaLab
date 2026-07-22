---
title: Design Language
type: system
updated: 2026-07-22
tags: [tokens, palette, typography, motion]
---

# Design Language

The single source every surface inherits. Back to [[00-Home]]. Powers [[The-Reactor]], [[Cinematic-Launch]], the website, and all apps.

## 1. Palette — one canvas, one core, three lights

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B0D12` | Primary canvas (near-black) |
| `carbon` | `#14171F` | Panels / depth |
| `platinum` | `#E8EAED` | Primary text / precision lines |
| `mist` | `#9AA3B2` | Muted text |
| **`core`** | `#E8B64C` | **Reactor core — Arganta gold (master signature)** |

**The three company lights** (each tints the reactor's outer rings):
| Company | Light | Hex |
|---|---|---|
| ArgantaLife | Coral warmth | `#FF7A59` |
| ArgantaEnergy | Energy blue / teal | `#2E7CF6` → `#3FB6C9` |
| ArgantaStudio | Creative violet | `#A06CE8` |

Rule: **gold is the constant** (the core). Company color only ever appears as the *outer* reactor glow and accent — never replaces gold. This is what makes three very different worlds read as one family.

## 2. Typography
- **Display:** `Space Grotesk` (or Aeonik) — tight tracking, confident, geometric.
- **Text:** `Inter` — neutral, legible, everywhere.
- **Mono / data:** `JetBrains Mono` — subsurface readouts, energy telemetry, code (the "factual" voice).

## 3. Motion grammar (the feel)
The blend of the four references you named:
- **Apple** — weight & restraint: one hero move per shot, slow, deliberate.
- **SLB** — luminous data on dark: precise, engineered, scientific.
- **Google** — human warmth: real people cutaways, soft light.
- **Oasis** — type slam: bold statement cards that land hard.

Shared spec: 24fps cinematic · master easing `cubic-bezier(0.16, 1, 0.3, 1)` · reactor **ignition** 1200ms · **axial bloom** (layers separate) 1600ms · **settle** 800ms. Transitions between shots = a reactor pulse, never a hard cut on brand beats.

## 4. 3D & material language
- Volumetric, emissive, **fresnel rim** on the core; dark field; energy particles.
- Procedural Three.js/R3F for interactive surfaces; Higgsfield GLB meshes + cinematic films for polish (the asset↔code seam, see [[Cinematic-Launch#Production pipeline]]).

## 5. Build-once architecture (how "use everywhere" is real)
```
tokens (code: @arganta/design-tokens)  ──┐
reactor component (apps/hq/src/reactor) ──┼─→ website · 5 apps · HQ · films
Higgsfield presets/Elements (locked look)─┘   (all read the same tokens)
```
- Tokens live in ONE package → website + apps + HQ import them.
- Higgsfield generations are locked to these tokens via a **style Element/preset** so AI assets match code exactly.
- The reactor splash + outro are rendered ONCE and reused across all four films.
