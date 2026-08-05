import { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, LockKeyhole,
  Plus, Trash2, X,
} from 'lucide-react';
import type { DeckDoc, SlideBlock } from './types';
import { commitRevision, currentRevision, diffDecks, getDeck, slideId, summarise } from './content-store';
import './fieldcraft.css';

/**
 * Web slide editor — add, remove, reorder and edit slides, then save a
 * revision. Structured slides are fully editable here; opaque (PowerPoint-only)
 * slides can be reordered, renamed and removed, but their content can only be
 * changed in PowerPoint, since that is the only place it was ever expressed.
 */

function emptySlide(dayNumber: number, existing: SlideBlock[]): SlideBlock {
  // Find a slide id that doesn't collide with anything already in the deck,
  // including ids left behind by deleted slides in earlier revisions.
  let n = existing.length + 1;
  let id = slideId(dayNumber, n - 1);
  const taken = new Set(existing.map((s) => s.id));
  while (taken.has(id)) { n += 1; id = slideId(dayNumber, n - 1); }
  return { id, kind: 'structured', title: 'New slide', body: '' };
}

export function DeckEditor({ materialId, dayNumber, onClose }: { materialId: string; dayNumber: number; onClose: () => void }) {
  const live = getDeck(materialId);
  const [slides, setSlides] = useState<SlideBlock[]>(() => (live ? structuredClone(live.slides) : []));
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saved) onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, saved]);

  if (!live) return null;
  const doc: DeckDoc = { materialId, dayId: live.dayId, slides };
  const summary = diffDecks(live, doc);
  const dirty = !!summary.details.length || summary.reordered;
  const current = slides[Math.min(index, slides.length - 1)];

  const update = (patch: Partial<SlideBlock>) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const move = (delta: number) => {
    setSlides((prev) => {
      const to = index + delta;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + delta)));
  };

  const addSlide = () => {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptySlide(dayNumber, prev));
      return next;
    });
    setIndex((i) => i + 1);
  };

  const duplicate = () => {
    setSlides((prev) => {
      const next = [...prev];
      const copy = { ...structuredClone(current), id: emptySlide(dayNumber, prev).id, title: `${current.title ?? current.opaqueLabel ?? ''} (copy)` };
      next.splice(index + 1, 0, copy);
      return next;
    });
    setIndex((i) => i + 1);
  };

  const removeSlide = () => {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setIndex((i) => Math.max(0, i - 1));
  };

  const save = () => {
    if (!dirty) { onClose(); return; }
    commitRevision(materialId, doc, { source: 'web', at: Date.now(), note: `Edited on the web · ${summarise(summary)}` });
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <div className="fc-editor" role="dialog" aria-modal="true" aria-label="Edit deck">
      <header>
        <div><small>DECK EDITOR</small><b>{slides.length} slide{slides.length === 1 ? '' : 's'} · rev {currentRevision(materialId)?.n ?? 1}</b></div>
        <span className="fc-editor-status">{saved ? <><Check size={13} />Saved</> : dirty ? summarise(summary) : 'No changes'}</span>
        <button onClick={onClose} aria-label="Close editor"><X size={16} /></button>
      </header>

      <div className="fc-editor-body">
        <nav className="fc-editor-list" aria-label="Slides">
          {slides.map((s, i) => (
            <button key={s.id} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}>
              <span className="fc-editor-list-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="fc-editor-list-title">
                {s.kind === 'opaque' && <LockKeyhole size={10} />}
                {s.title || s.opaqueLabel || 'Untitled slide'}
              </span>
            </button>
          ))}
          <button className="fc-editor-add" onClick={addSlide}><Plus size={14} />Add slide</button>
        </nav>

        <main className="fc-editor-canvas">
          <div className="fc-editor-toolbar">
            <button onClick={() => move(-1)} disabled={index === 0} aria-label="Move up"><ArrowUp size={14} /></button>
            <button onClick={() => move(1)} disabled={index === slides.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
            <button onClick={duplicate} aria-label="Duplicate slide"><Copy size={14} />Duplicate</button>
            <button onClick={removeSlide} disabled={slides.length <= 1} className="danger" aria-label="Delete slide"><Trash2 size={14} />Delete</button>
            <span className="fc-editor-nav">
              <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}><ChevronLeft size={14} /></button>
              {index + 1} / {slides.length}
              <button onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))} disabled={index === slides.length - 1}><ChevronRight size={14} /></button>
            </span>
          </div>

          {current.kind === 'opaque' ? (
            <div className="fc-editor-opaque">
              <LockKeyhole size={20} />
              <h3>PowerPoint-only slide</h3>
              <p>This slide uses content the web editor cannot represent — a picture, chart or diagram. It stays exactly as authored and will export unchanged. Open the exported .pptx in PowerPoint to edit its content; you can still rename, reorder or remove it here.</p>
              <label>
                <span>Slide label</span>
                <input value={current.opaqueLabel ?? ''} onChange={(e) => update({ opaqueLabel: e.target.value })} placeholder="A short label for the resources list" />
              </label>
              <label>
                <span>Speaker note</span>
                <textarea rows={4} value={current.note ?? ''} onChange={(e) => update({ note: e.target.value })} placeholder="Facilitator note for this slide…" />
              </label>
            </div>
          ) : (
            <div className="fc-editor-fields">
              <label>
                <span>Eyebrow</span>
                <input value={current.eyebrow ?? ''} onChange={(e) => update({ eyebrow: e.target.value || undefined })} placeholder="DAY 01 · DISCOVER" />
              </label>
              <label>
                <span>Title</span>
                <input value={current.title ?? ''} onChange={(e) => update({ title: e.target.value })} placeholder="Slide title" />
              </label>
              <label>
                <span>Body</span>
                <textarea rows={3} value={current.body ?? ''} onChange={(e) => update({ body: e.target.value || undefined })} placeholder="One or two sentences." />
              </label>
              <label>
                <span>Bullets — one per line</span>
                <textarea
                  rows={4}
                  value={(current.bullets ?? []).join('\n')}
                  onChange={(e) => {
                    const bullets = e.target.value.split('\n').map((b) => b.trim()).filter(Boolean);
                    update({ bullets: bullets.length ? bullets : undefined });
                  }}
                  placeholder={'One point per line'}
                />
              </label>
              <label>
                <span>Speaker note</span>
                <textarea rows={3} value={current.note ?? ''} onChange={(e) => update({ note: e.target.value || undefined })} placeholder="What to say, what to demonstrate…" />
              </label>
            </div>
          )}
        </main>
      </div>

      <footer>
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}><Check size={14} />{dirty ? 'Save revision' : 'Close'}</button>
      </footer>
    </div>
  );
}
