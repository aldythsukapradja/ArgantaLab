// Arena page — embeds the Kingdom Buya Arena INSIDE ArgantaLab, FULL SCREEN.
// `arenaOnly` makes it land straight in Buya Arena with the character's saved
// build: no "Kingdom Character Lab" header, no Composer. Building the character
// stays in the Kingdom app, so kids here can play but not rebuild. The Kingdom
// deploy itself is unchanged (it renders <App/> with no props).
// The way back is TopBar's own pill, which turns into "Home" while this tab is
// active — no separate exit button needed here.
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@store/appStore'
import KingdomApp from './arena/App.jsx'
import './arena/arena.css'

export default function Arena() {
  const session = useAppStore((s) => s.session)
  const user = session && session !== 'loading' ? session.user : null
  return <KingdomApp hostSupabase={supabase} hostUser={user} embedded arenaOnly />
}
