import { createContext, useContext } from 'react'

// The id of the scene the camera has currently landed on. Interactive scene
// parts (rings filling, bars growing) watch this to play only when in view.
export const ActiveCtx = createContext<string>('')

export function useIsActive(id: string): boolean {
  return useContext(ActiveCtx) === id
}
