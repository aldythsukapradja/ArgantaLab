// SpecCanvas — renders the founder's acceptance SPEC for a not-yet-built exploration
// tab, taken 1:1 from COSMO_Final.html (tabSpecMd) via tabspec-data.json. Same intent
// as the analog's Placeholder→MdCanvas: the acceptance criteria stay visible in-app
// until the live viewer replaces them. Uses the shared vault Markdown renderer.
import { CircleDot } from 'lucide-react';
import { Markdown } from '../../md';
import { explSpecMd } from './registry';

export function SpecCanvas({ tab }: { tab: string }) {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '22px 24px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span className="chip" style={{ color: 'var(--orange)', borderColor: 'var(--orange)' }}>
            <CircleDot size={11} /> FOUNDER SPEC · canvas not yet built
          </span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>rendered 1:1 from COSMO_Final.html</span>
        </div>
        <Markdown body={explSpecMd(tab)} />
      </div>
    </div>
  );
}
