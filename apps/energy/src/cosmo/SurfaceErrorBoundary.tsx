// SurfaceErrorBoundary — catches errors from the lazily-loaded workspace surfaces so a single
// surface failing (most commonly a dynamic-import chunk failing to load — e.g. Vite's dev-time
// "504 Outdated Optimize Dep" after a dependency change) shows a recoverable message instead of
// white-screening the whole app. Reset by remounting via a `key` tied to the active nav id, so
// navigating to a different surface always gets a fresh boundary.
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

const isChunkError = (e: Error) =>
  /dynamically imported module|Importing a module script failed|Outdated Optimize Dep|Failed to fetch/i.test(e.message);

export class SurfaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // A stale dev chunk usually clears on a hard reload — surfaced as a button below, not auto,
    // to avoid reload loops. Logged for visibility.
    // eslint-disable-next-line no-console
    console.error('[surface] failed to render:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    return (
      <div className="surface-error" role="alert">
        <span className="surface-error-ic"><AlertTriangle size={22} /></span>
        <b>{chunk ? 'This workspace could not load' : 'This workspace hit an error'}</b>
        <small>
          {chunk
            ? 'A code module failed to load — this usually happens right after a dependency update while the dev server is still re-optimizing. Reload to fetch the fresh build.'
            : error.message}
        </small>
        <button className="surface-error-btn" onClick={() => window.location.reload()}>
          <RotateCw size={14} /> Reload
        </button>
      </div>
    );
  }
}
