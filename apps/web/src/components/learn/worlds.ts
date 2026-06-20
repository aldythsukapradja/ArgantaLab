import type { WorldId } from '@/data/cinematic'
import { CinematicCity } from './CinematicCity'
import { CinematicSpace } from './CinematicSpace'
import { CinematicNeural } from './CinematicNeural'

// Common surface every cinematic world scene exposes, so the lesson player
// and world map can drive any world without knowing which one it is.
export interface CinematicWorld {
  goTo(preset: string, duration?: number): void
  spotlight(on: boolean): void
  setEffect(effect: 'normal' | 'xray' | 'paint'): void
  pulse(): void
  resize(): void
  dispose(): void
}

export function createWorld(world: WorldId, canvas: HTMLCanvasElement): CinematicWorld {
  if (world === 'space') return new CinematicSpace(canvas)
  if (world === 'neural') return new CinematicNeural(canvas)
  return new CinematicCity(canvas)
}
