// FigureStrip.tsx — published figures, wherever the reader is already looking.
//
// The registry holds 557 governed figures, but until now they surfaced in exactly one
// place: the picture card on the title bar. Someone clicking a formation in the
// petroleum-system chart, or opening the stratigraphy popup, saw only text — while a
// published stratigraphic chart for that very basin sat one table away.
//
// This is the shared surface for showing them in context. It renders ONLY figures the
// registry says we may show; `figuresForEntity` already drops anything that is not
// `local-copy-permitted`, so a restricted plate cannot appear here by accident.
import { BookImage } from 'lucide-react';
import {
  figureAttribution, figureSrc, figureTypeLabel, type RegistryFigure,
} from './basin-figure-library';

export function FigureStrip({ figures, title, note, onOpen, limit = 6 }: {
  figures: RegistryFigure[];
  title?: string;
  /** Why these figures are here — matters when they are basin-level context rather
   *  than figures OF the thing the reader clicked. */
  note?: string;
  onOpen?: (f: RegistryFigure) => void;
  limit?: number;
}) {
  if (!figures.length) return null;
  const shown = figures.slice(0, limit);
  return (
    <div className="exs-figstrip">
      {title && (
        <h4 className="exs-modal-h4">
          <BookImage size={12} /> {title}
          <em>{figures.length > limit ? `${limit} of ${figures.length}` : `${figures.length}`}</em>
        </h4>
      )}
      {note && <p className="exs-kb-note">{note}</p>}
      <div className="exs-figstrip-row">
        {shown.map((f) => (
          <button key={f.figure_id} className="exs-figstrip-item"
            onClick={() => onOpen?.(f)}
            title={`${f.caption ?? ''} — ${figureAttribution(f)}`}>
            <img src={figureSrc(f)} alt={f.caption ?? ''} loading="lazy" />
            <span className="exs-figstrip-type">{figureTypeLabel(f.figure_type)}</span>
            <small>{f.caption ?? f.title ?? ''}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
