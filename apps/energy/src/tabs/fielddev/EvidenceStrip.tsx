// EvidenceStrip — bottom bar. Doubles as the basis-chip legend so the vocabulary
// (M/R/A/U/D) is learned before it ever appears live on the Plan Card.
import { BASIS_LABEL, type Basis } from './registry';

const ORDER: Basis[] = ['M', 'R', 'A', 'U', 'D'];

export function EvidenceStrip({ stageName }: { stageName: string }) {
  return (
    <div className="fds-evidence">
      <span className="fds-evidence-msg">
        No artifacts yet — start with <b style={{ color: 'var(--ink2)' }}>Asset</b> to establish the analog cohort, or open <b style={{ color: 'var(--ink2)' }}>{stageName}</b> directly once its inputs exist.
      </span>
      <div className="fds-evidence-legend">
        {ORDER.map((b) => (
          <span key={b} className="fds-evidence-legend-item">
            <span className="fds-chip pending">{b}</span> {BASIS_LABEL[b]}
          </span>
        ))}
      </div>
    </div>
  );
}
