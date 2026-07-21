// V0 shell for the Library tab (V4 builds this out: immutable video_asset
// rows, publish marks, fan-out gate — Download / Send to Edit / Moment / Buffer).
import { LibraryBig } from 'lucide-react'

export function VideoLibrary() {
  return (
    <div className="vs-shell">
      <LibraryBig size={26} />
      <p>Video Library — kept renders and Edit exports land here (V4), with publish marks and the fan-out gate to Kinetik Moment / Buffer.</p>
    </div>
  )
}
