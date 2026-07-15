// C4b Step 1 skeleton — filled in at Step 3 (loadMessages/sendMessage wiring),
// Step 4 (CoreOrb), Step 5 (artifact cards), Step 6 (composer), Step 7 (empty
// states + microcopy).
export function Conversation({ threadId, onThreadCreated, maxCostClass, onArtifact, compact }: {
  threadId: string | null
  onThreadCreated: (id: string) => void
  maxCostClass: number
  onArtifact?: (a: { assetId: string; kind: string }) => void
  compact?: boolean
}) {
  return (
    <div className="core-convo">
      <div className="core-convo-scroll">
        <div className="core-convo-empty">
          <div className="core-hero-orb-slot" aria-hidden="true" />
          <p className="core-empty-copy">
            I'm Arganta Core. I can make images, voice, websites, decks, brand kits and charts — for real, on your own infrastructure.
          </p>
        </div>
      </div>
      <div className="core-composer">
        <div className="core-composer-field">
          <input className="core-composer-input" placeholder="Message Arganta Core…" disabled />
        </div>
      </div>
    </div>
  )
}
