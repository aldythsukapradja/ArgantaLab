import { createContext, useContext } from 'react'

// The id of the scene the camera has currently landed on. Interactive scene
// parts (rings filling, bars growing) watch this to play only when in view.
// The Editorial deck provides '__all__' so every reused panel animates on mount.
export const ActiveCtx = createContext<string>('')

export function useIsActive(id: string): boolean {
  const ctx = useContext(ActiveCtx)
  return ctx === id || ctx === '__all__'
}
