import { lazy, Suspense } from 'react'

const HubBg = lazy(() => import('./three/HubBg'))

// Lazy galaxy backdrop so three.js only downloads after first paint.
export default function HubBgLazy({ dark }: { dark: boolean }) {
  return <Suspense fallback={null}><HubBg dark={dark} /></Suspense>
}
