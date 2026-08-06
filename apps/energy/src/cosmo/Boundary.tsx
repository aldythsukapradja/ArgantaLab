// One failing panel must not take the whole cockpit with it.
//
// React unmounts the entire tree from the nearest error boundary upward. With
// no boundary anywhere, a throw inside a single side panel — the chat, the
// command palette — blanks the app to a white screen, including the keynote,
// which is a separate surface that had nothing to do with the failure. That is
// merely annoying in development and unrecoverable mid-presentation.
//
// This is a boundary per independent surface, not one around everything: a
// wrapper at the root would still lose the deck when the chat throws.
//
// Sibling, not duplicate: SurfaceErrorBoundary guards the lazily-loaded
// workspace surfaces inside the content area, keyed by nav id, and specialises
// in stale dynamic-import chunks. This one guards the always-mounted overlays
// that live OUTSIDE that boundary — chat, settings, keynote, command palette —
// where there is no nav key to reset on and a full-bleed fallback card would
// cover the app.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Named in the fallback so a failure is attributable at a glance. */
  label: string;
  /** Surfaces with no visual footprint when idle (a closed drawer) should fail
   *  silently rather than paint a card over the app. */
  silent?: boolean;
}

export class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack reachable — the fallback deliberately shows only a line.
    console.error(`[${this.props.label}] crashed`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.silent) return null;
    return (
      <div role="alert" style={{
        position: 'fixed', right: 16, bottom: 16, zIndex: 8000, maxWidth: 340,
        padding: '12px 14px', borderRadius: 12, fontSize: 12, lineHeight: 1.5,
        border: '1px solid rgba(229,57,53,.5)', background: 'rgba(20,10,10,.92)',
        color: '#F3D6D5', backdropFilter: 'blur(12px)',
      }}>
        <b style={{ display: 'block', marginBottom: 4 }}>{this.props.label} stopped</b>
        {error.message}
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            display: 'block', marginTop: 9, padding: '4px 10px', borderRadius: 99,
            border: '1px solid rgba(255,255,255,.2)', background: 'transparent',
            color: 'inherit', font: 'inherit', cursor: 'pointer',
          }}>
          Retry
        </button>
      </div>
    );
  }
}
