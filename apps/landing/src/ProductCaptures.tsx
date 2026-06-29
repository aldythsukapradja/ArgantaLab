import { useEffect } from 'react'
import PlayHome from '@/pages/PlayHome'
import LearnHub from '@/pages/LearnHub'
import { CONTENT_PACK_2 } from '@/data/contentPack2'
import { WORLDS, type Item } from '@/data/learn'
import { useAppStore } from '@store/appStore'
import { renderItem } from '@components/learn2/interactions'
import Argantaland from '@components/openworld/Argantaland'
import CheerSquad from '@components/openworld/CheerSquad'

const outfit = {
  skin: 'skin:ice',
  hat: 'hat:chef',
  face: 'face:cyber',
  back: 'back:cape',
  hand: '',
  bg: 'bg:space',
}

const ownedCosmetics = [
  'skin:default',
  'skin:blue',
  'skin:mint',
  'skin:ice',
  'hat:chef',
  'face:cyber',
  'back:cape',
  'bg:studio',
  'bg:sky',
  'bg:space',
]

function useProductSeed() {
  useEffect(() => {
    useAppStore.setState({
      learnerName: 'Aldyth',
      avatar: 'A',
      xp: 4280,
      level: 7,
      diamonds: 47016,
      stageKey: 'builder',
      role: 'kid',
      outfit,
      ownedCosmetics,
      activeCircleId: 'landing-family',
      activeTab: 'arganta',
      lastTab: 'arganta',
    })
  }, [])
}

export function OrbitCapture() {
  useProductSeed()
  return (
    <div className="product-capture orbit-capture" aria-label="ArgantaLab daily rings and avatar">
      <PlayHome />
    </div>
  )
}

export function WorldMapCapture() {
  useProductSeed()
  return (
    <div className="product-capture map-capture" aria-label="ArgantaLab six world map">
      <LearnHub />
    </div>
  )
}

export function QACapture() {
  useProductSeed()
  const item = CONTENT_PACK_2.find(x => x.prompt === 'Round 4,762 to the nearest thousand.') as unknown as Item
  const world = WORLDS.find(w => w.key === item.world) ?? WORLDS[0]

  return (
    <div className="product-capture qa-capture" style={{ ['--accent' as string]: world.color }} aria-label="ArgantaLab question and answer">
      <div className="le-player">
        <div className="le-player-top">
          <button className="le-x" aria-label="Close preview">×</button>
          <div className="le-progress"><i style={{ width: '25%', background: world.color }} /></div>
          <div className="le-count">1/4</div>
        </div>
        <CheerSquad />
        <div className="le-stage">
          <div className="le-prompt">{item.prompt}</div>
          <div className="le-render">{renderItem(item, () => undefined)}</div>
        </div>
      </div>
    </div>
  )
}

export function ArgantaLandCapture() {
  useProductSeed()
  const world = WORLDS[0]
  return (
    <div className="product-capture land-capture" aria-label="ArgantaLand 2D overworld">
      <Argantaland world={world} onExit={() => undefined} />
    </div>
  )
}
