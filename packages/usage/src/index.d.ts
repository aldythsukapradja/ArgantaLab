export interface UsageTrackerOptions {
  /** The host app's Supabase client (null/undefined → tracker is a no-op). */
  supabase: unknown
  /** App key: 'arganta' | 'kinetik' | 'lashira' | 'hq' | 'landing' | future. */
  app: string
  /** Returns the current page/tab/scene key (defaults to 'home'). */
  getPage?: () => string
}

/** Start the shared time-on-page tracker. Returns a stop() function. */
export function startUsageTracker(opts: UsageTrackerOptions): () => void
