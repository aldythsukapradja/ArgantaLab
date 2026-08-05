// agent/CommandPalette.tsx — ⌘K over the agent (D9).
//
// One brain, two front doors. The palette does not have its own command list,
// its own matcher or its own vocabulary — it calls the same `useAgent().ask()`
// the chat does, so anything you can type in the chat you can type here and it
// behaves identically.
//
// It replaces components/CommandPalette.tsx, which was never mounted and whose
// DomainId vocabulary ('fielddev', 'resmgmt') did not match the shell's nav ids
// ('field-development', 'reservoir-management') anyway.

import { useCallback, useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import { useAgent } from './useAgent';
import type { AnswerCard } from './types.ts';
import './agent.css';
import './palette.css';

export function CommandPalette() {
  const agent = useAgent();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [answer, setAnswer] = useState<AnswerCard | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = agent.suggestions(query, 8);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    setAnswer(null);
    const id = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(id);
  }, [open]);

  const run = useCallback(async (text: string) => {
    const result = await agent.ask(text);
    if (!result) return;
    // A question stays open so it can be answered; a real answer has already
    // driven the app, so the palette gets out of the way.
    if (result.card.kind === 'clarify' || result.card.kind === 'error') {
      setAnswer(result.card);
      setQuery('');
    } else {
      setOpen(false);
    }
  }, [agent]);

  if (!open) return null;

  return (
    <div className="agp-scrim" onClick={() => setOpen(false)} role="presentation">
      <div className="agp" onClick={(e) => e.stopPropagation()}>
        <div className="agp-field">
          <Search size={15} />
          <input
            ref={inputRef}
            className="agp-input"
            placeholder={agent.ready ? 'Basin, country, field, well… or a question' : 'Loading the catalogue…'}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); setAnswer(null); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((i) => (i + 1) % Math.max(results.length, 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((i) => (i <= 0 ? results.length - 1 : i - 1)); }
              else if (e.key === 'Enter') {
                e.preventDefault();
                void run(results[cursor] ? results[cursor].node.name : query);
              }
            }}
          />
          <span className={'ag-tier ' + agent.tier}><b>{agent.tier === 'core' ? 'CORE' : 'LITE'}</b></span>
        </div>

        {answer && (
          <div className="agp-answer">
            <div className="agp-answer-h">{answer.headline}</div>
            {answer.body && <div className="agp-answer-b">{answer.body}</div>}
            <div className="agc-chips">
              {answer.chips.map((chip) => (
                <button type="button" className="agc-chip" key={chip.query} onClick={() => void run(chip.query)}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="agp-list">
            {results.map((candidate, i) => (
              <button
                type="button"
                key={candidate.node.id}
                className={'ag-sugg-row' + (i === cursor ? ' on' : '')}
                onMouseEnter={() => setCursor(i)}
                onClick={() => void run(candidate.node.name)}
              >
                <span className="nm">{candidate.node.displayName}</span>
                {(candidate.stage === 'fuzzy' || candidate.stage === 'phonetic') && <span className="fz" title="Closest match">≈</span>}
                <span className="kd">{candidate.node.kind.replace('-', ' ')}</span>
              </button>
            ))}
          </div>
        )}

        {!results.length && query.trim().length >= 2 && !answer && (
          <div className="agp-empty">
            Nothing called “{query.trim()}”. Press <CornerDownLeft size={11} /> to ask anyway.
          </div>
        )}

        <div className="agp-foot">
          <span><b>↑↓</b> navigate</span>
          <span><b>↵</b> run</span>
          <span><b>esc</b> close</span>
          <span className="sp" />
          {agent.breadcrumb && <span className="ag-crumb">{agent.breadcrumb}</span>}
        </div>
      </div>
    </div>
  );
}
