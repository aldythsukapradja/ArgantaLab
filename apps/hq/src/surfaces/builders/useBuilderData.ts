import { useState, useEffect, useCallback, useMemo } from 'react'
import { live, type Circle } from '../../data/live'
import { supabase } from '../../lib/supabase'
import {
  rankArtifacts, selectFeatured, generateRecommendations,
  type RankedArtifact, type FeaturedItem, type Recommendation,
} from '../../data/algorithm'
import { fromGame, fromApp, toSignals, type Artifact, type Kind } from './artifact'

export interface BuilderData {
  loading: boolean
  artifacts: Artifact[]
  byId: Map<string, Artifact>
  ranked: RankedArtifact[]
  featured: FeaturedItem[]
  recommendations: Recommendation[]
  circles: Circle[]
  user: { id: string; name: string; avatar?: string }
  reload: () => void
}

export function useBuilderData(kind: Kind): BuilderData {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [circles, setCircles] = useState<Circle[]>([])
  const [user, setUser] = useState<{ id: string; name: string; avatar?: string }>({ id: 'operator', name: 'Operator' })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    const fetcher = kind === 'game'
      ? live.listGames().then(rows => rows.map(fromGame))
      : live.listApps().then(rows => rows.map(fromApp))
    fetcher.then(items => { setArtifacts(items); setLoading(false) })
  }, [kind])

  useEffect(() => {
    reload()
    live.listUserCircles().then(setCircles)
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          id: data.user.id,
          name: (data.user.user_metadata?.name as string) || data.user.email?.split('@')[0] || 'Operator',
          avatar: data.user.user_metadata?.avatar_url as string | undefined,
        })
      }
    })
  }, [reload])

  const { byId, ranked, featured, recommendations } = useMemo(() => {
    const published = artifacts.filter(a => a.visibility === 'public')
    const ranked = rankArtifacts(published.map(toSignals))
    const featured = selectFeatured(ranked)
    const featuredIds = new Set(featured.map(f => f.id))
    const recommendations = generateRecommendations(ranked, featuredIds)
    const byId = new Map(artifacts.map(a => [a.id, a]))
    return { byId, ranked, featured, recommendations }
  }, [artifacts])

  return { loading, artifacts, byId, ranked, featured, recommendations, circles, user, reload }
}
