// The usage package is plain JS. Imported via a Vite alias; typed here so tsc
// checks call sites without a build step in the package.
declare module '@arganta/usage' {
  export interface UsageTrackerOptions {
    supabase: unknown
    app: string
    getPage?: () => string
  }
  export function startUsageTracker(opts: UsageTrackerOptions): () => void
}
