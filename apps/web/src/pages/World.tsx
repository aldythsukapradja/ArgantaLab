import { WORLD_BY_KEY } from '@/data/learn'
import WorldHub from '@components/learn2/WorldHub'

// Tab key (lowercase) → world key (uppercase): 'num' → 'NUM'
export default function World({ tab }: { tab: string }) {
  const world = WORLD_BY_KEY[tab.toUpperCase()]
  if (!world) return <div className="le-empty"><p>World not found.</p></div>
  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: 4, gap: 0 }}>
      <WorldHub world={world} />
    </div>
  )
}
