// viewers/WellSchematic.tsx — the industry-standard well schematic.
//
// Not a trajectory and not a log: the schematic answers "what steel is in this hole,
// how deep does each string go, and which formation does each section land in". It is
// the drawing an ops geologist keeps open beside the mud log.
//
// Conventions followed deliberately, because a schematic that invents its own visual
// language is useless to someone who reads them daily:
//   · TVD down the page; strings drawn as nested pairs of vertical lines about a
//     centreline, WIDER = shallower/bigger, exactly as on a real schematic
//   · a casing SHOE is the flared triangle pair at the base of its string
//   · open hole below the last shoe is drawn as a thinner, dashed pair
//   · formation tops tie across from the left; casing annotations sit right
//
// Depths are MD from the mud log's bit-diameter steps (measured). The string SIZE
// paired with each hole size is the conventional programme and is labelled as such —
// see build-workbench-data.mjs. Nothing here is fitted or assumed beyond that.
import { useMemo } from 'react';

import { sectionLabel, type HoleSection } from './casing.ts';
export type SchematicSection = HoleSection;
export interface SchematicPick { surface: string; md: number }

const CASING = '#7c3aed';
const OPEN_HOLE = '#94a3b8';
const PICK = '#e11d74';


export function WellSchematic({ well, sections, picks, tdMd, depthUnit = 'm' }: {
  well: string;
  sections: SchematicSection[];
  picks?: SchematicPick[];
  /** total depth of the wellbore, when known — the schematic ends here, not at the
   *  last logged sample, so a mud log that stopped early doesn't shorten the well */
  tdMd?: number | null;
  depthUnit?: string;
}) {
  const W = 460, H = 620;
  const padT = 34, padB = 26, padL = 150, padR = 120;
  const cx = padL + (W - padL - padR) / 2;
  const plotH = H - padT - padB;

  const maxMd = useMemo(() => {
    const s = sections.length ? Math.max(...sections.map((x) => x.baseMd)) : 0;
    const p = picks?.length ? Math.max(...picks.map((x) => x.md)) : 0;
    return Math.max(s, p, tdMd ?? 0) || 1;
  }, [sections, picks, tdMd]);

  const yOf = (md: number) => padT + (md / maxMd) * plotH;
  // widest hole drawn at a fixed half-width; everything else scales off it so the
  // nesting reads correctly (a 26" string must visibly contain a 12¼" one)
  const maxBit = sections.length ? Math.max(...sections.map((s) => s.bitSizeIn)) : 1;
  const halfOf = (inches: number) => 8 + (inches / maxBit) * 52;

  if (!sections.length) {
    return <div className="dqv-empty">No hole sections for this wellbore — a mud log with bit diameter is required to draw a schematic.</div>;
  }

  const lastShoe = sections[sections.length - 1];

  // de-collided formation labels down the left margin
  const placed = (picks ?? [])
    .map((p) => ({ p, y: yOf(p.md) }))
    .filter((x) => x.y >= padT && x.y <= padT + plotH)
    .sort((a, b) => a.y - b.y)
    .map((x) => ({ ...x, ly: x.y }));
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].ly - placed[i - 1].ly < 11) placed[i].ly = placed[i - 1].ly + 11;
  }

  return (
    <div className="dqv-schematic">
      <div className="dqv-bar">
        <span className="dqv-chip on">{well}</span>
        <span className="dqv-chip">{sections.length} hole section{sections.length === 1 ? '' : 's'}</span>
        <span className="dqv-chip" title="Casing sizes are the conventional programme for each hole size — not measured in this well">
          casing size conventional
        </span>
        <span className="dqv-meta">depths are MD ({depthUnit}), measured from bit diameter</span>
      </div>

      <div className="dqv-schematic-stage">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* depth ruler */}
          {Array.from({ length: 7 }, (_, i) => {
            const md = (i / 6) * maxMd, y = yOf(md);
            return (
              <g key={i}>
                <line x1={padL - 10} y1={y} x2={W - padR + 10} y2={y} stroke="var(--line)" opacity="0.35" />
                <text x={padL - 14} y={y + 3} textAnchor="end" fontSize="8.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">
                  {md.toFixed(0)}
                </text>
              </g>
            );
          })}
          <text x={padL - 14} y={padT - 12} textAnchor="end" fontSize="8" fill="var(--ink3)" fontFamily="ui-monospace,monospace">
            MD {depthUnit}
          </text>

          {/* formation tops tie across from the left */}
          {placed.map(({ p, y, ly }, i) => (
            <g key={`${p.surface}-${i}`}>
              <line x1={padL - 10} y1={y} x2={cx + halfOf(maxBit) + 6} y2={y} stroke={PICK} strokeWidth="1" strokeDasharray="3 3" opacity="0.75" />
              {Math.abs(ly - y) > 1.5 && (
                <line x1={padL - 12} y1={y} x2={padL - 12} y2={ly - 3} stroke={PICK} strokeWidth="0.8" opacity="0.5" />
              )}
              <text x={padL - 16} y={ly - 2} textAnchor="end" fontSize="8.5" fill={PICK} fontFamily="ui-monospace,monospace" fontWeight="600">
                {p.surface}
              </text>
            </g>
          ))}

          {/* ── the strings. Drawn deepest-first so shallower (wider) strings overlay
              correctly, which is how the nesting reads on a real schematic. ── */}
          {sections.map((s, i) => {
            const half = halfOf(s.bitSizeIn);
            const yTop = yOf(s.topMd), yBase = yOf(s.baseMd);
            const isLast = i === sections.length - 1;
            return (
              <g key={`${s.bitSizeIn}-${s.topMd}`}>
                {/* hole walls: a cased section is solid, the final open hole is dashed */}
                <line x1={cx - half} y1={yTop} x2={cx - half} y2={yBase}
                  stroke={isLast ? OPEN_HOLE : CASING} strokeWidth={isLast ? 1.4 : 2.4}
                  strokeDasharray={isLast ? '5 4' : undefined} />
                <line x1={cx + half} y1={yTop} x2={cx + half} y2={yBase}
                  stroke={isLast ? OPEN_HOLE : CASING} strokeWidth={isLast ? 1.4 : 2.4}
                  strokeDasharray={isLast ? '5 4' : undefined} />

                {/* CASING SHOE — the flared pair at the base of a cased string */}
                {!isLast && (
                  <>
                    <polygon points={`${cx - half},${yBase} ${cx - half - 6},${yBase} ${cx - half},${yBase - 11}`} fill={CASING} />
                    <polygon points={`${cx + half},${yBase} ${cx + half + 6},${yBase} ${cx + half},${yBase - 11}`} fill={CASING} />
                  </>
                )}

                {/* annotation right of the hole */}
                <text x={W - padR + 14} y={yBase - 2} fontSize="9" fill={CASING} fontFamily="ui-monospace,monospace" fontWeight="600">
                  {sectionLabel(s, isLast)}
                </text>
                <text x={W - padR + 14} y={yBase + 9} fontSize="7.5" fill="var(--ink3)" fontFamily="ui-monospace,monospace">
                  {s.bitSizeIn}&quot; hole · {s.topMd.toFixed(0)}–{s.baseMd.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* wellhead at surface */}
          <rect x={cx - halfOf(maxBit) - 10} y={padT - 9} width={(halfOf(maxBit) + 10) * 2} height={9} fill={CASING} opacity="0.85" />
          <text x={cx} y={padT - 13} textAnchor="middle" fontSize="8" fill="var(--ink3)" fontFamily="ui-monospace,monospace">wellhead</text>

          {/* TD */}
          {(() => {
            const td = tdMd ?? lastShoe.baseMd;
            const y = yOf(td);
            return (
              <g>
                <line x1={cx - 22} y1={y} x2={cx + 22} y2={y} stroke="var(--ink)" strokeWidth="2" />
                <text x={cx} y={y + 13} textAnchor="middle" fontSize="8.5" fill="var(--ink)" fontFamily="ui-monospace,monospace" fontWeight="700">
                  TD {td.toFixed(0)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      <div className="dqv-drill-foot">
        <span>
          Hole size and depth are measured from the mud log&apos;s bit-diameter steps. Casing sizes are the
          conventional programme for each hole size — not measured in this well.
        </span>
      </div>
    </div>
  );
}
