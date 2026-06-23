// A tiny honesty strip. It tells you, at all times, exactly where the
// data on screen comes from — so "is this real or local?" is never a
// question again. Silent in the normal case (live cloud data).
import { useDataStore } from '@store/dataStore'

export default function DataBanner() {
  const source = useDataStore(s => s.source)
  const status = useDataStore(s => s.status)

  if (status === 'error') {
    return <div className="data-banner err">Couldn’t reach the cloud and no offline copy yet. Check your Supabase keys.</div>
  }
  if (source === 'cache') {
    return <div className="data-banner warn">Offline — showing your last synced copy. Changes save locally and sync when you’re back.</div>
  }
  if (source === 'empty') {
    return <div className="data-banner warn">No data yet. Add your Supabase keys and run the seed to load your circle.</div>
  }
  return null // source === 'cloud' → live data, no noise
}
