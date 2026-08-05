import { Crown, Flag, Target, Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';
import { VOLVE_DAYS } from './catalog';
import { MISSIONS } from './missions';
import { DAY_MAX, RUBRIC_MAX } from './types';
import { isMissionComplete, leaderboard, pointsPossible, useSession } from './session';
import './fieldcraft.css';

/**
 * Live competition board for the cohort.
 *
 * Deliberately shows the rubric breakdown per day rather than only a total:
 * teams argue with a single number, but they learn from seeing that they lost
 * points on evidence rather than on workflow. The board is a teaching device -
 * it never contributes to individual certification.
 */
export function Leaderboard() {
  const session = useSession();
  const board = leaderboard(session);
  const possible = pointsPossible(session);
  const scoredDays = VOLVE_DAYS.filter((d) => session.teams.some((t) => t.scores[d.id]));
  const missionsDone = MISSIONS.filter((m) => isMissionComplete(session, m.id)).length;
  const leader = board[0];
  const gap = board.length > 1 ? leader.total - board[1].total : 0;

  const criteria: Array<{ key: keyof typeof RUBRIC_MAX; label: string }> = [
    { key: 'workflow', label: 'WORKFLOW' }, { key: 'evidence', label: 'EVIDENCE' },
    { key: 'decision', label: 'DECISION' }, { key: 'quiz', label: 'QUIZ + TEAM' },
  ];

  return (
    <div className="fc-page fc-leaderboard">
      <section className="fc-page-title">
        <div>
          <span>LIVE COMPETITION</span>
          <h1>The Volve Mission leaderboard.</h1>
          <p>Scored on the published rubric - technical workflow, evidence quality, decision rationale and team contribution. The board never determines individual certification.</p>
        </div>
        <span className="fc-lb-possible">{possible} PTS AVAILABLE</span>
      </section>

      {!board.length ? (
        <div className="fc-lb-empty"><Trophy size={22} /><b>No teams yet</b><span>Add teams from the trainer console to start scoring.</span></div>
      ) : (
        <>
          <section className="fc-lb-podium">
            {board.slice(0, 3).map((team, i) => (
              <article key={team.id} className={`fc-lb-pod p${i + 1}`} style={{ '--team': team.color } as CSSProperties}>
                <span className="fc-lb-rank">{i === 0 ? <Crown size={16} /> : i + 1}</span>
                <b>{team.name}</b>
                <em>{team.total}</em>
                <small>{possible ? Math.round((team.total / possible) * 100) : 0}% of available</small>
              </article>
            ))}
          </section>

          <section className="fc-lb-stats">
            <div><b>{board.length}</b><span>TEAMS</span></div>
            <div><b>{scoredDays.length}</b><span>DAYS SCORED</span></div>
            <div><b>{missionsDone}</b><span>MISSIONS COMPLETE</span><small>of {MISSIONS.length}</small></div>
            <div><b>{gap}</b><span>LEAD MARGIN</span><small>{gap === 0 ? 'level at the top' : `${leader.name} ahead`}</small></div>
          </section>

          <section className="fc-lb-table">
            <header>
              <span>TEAM</span>
              {scoredDays.map((d) => <span key={d.id}>DAY {d.number}</span>)}
              <span>TOTAL</span>
            </header>
            {board.map((team, i) => (
              <div className="fc-lb-row" key={team.id}>
                <span className="fc-lb-team"><i>{i + 1}</i><b style={{ background: team.color }} />{team.name}</span>
                {scoredDays.map((d) => {
                  const s = team.scores[d.id];
                  const total = s ? s.workflow + s.evidence + s.decision + s.quiz : null;
                  return (
                    <span key={d.id} className="fc-lb-day" title={s ? criteria.map((c) => `${c.label} ${s[c.key]}/${RUBRIC_MAX[c.key]}`).join('  ') : 'not scored'}>
                      {total === null ? <em>-</em> : <><b>{total}</b><i style={{ width: `${(total / DAY_MAX) * 100}%`, background: d.color }} /></>}
                    </span>
                  );
                })}
                <span className="fc-lb-total">{team.total}</span>
              </div>
            ))}
          </section>

          <section className="fc-lb-rubric">
            <h3><Target size={13} />How points are earned each day</h3>
            <div>
              {criteria.map((c) => (
                <div key={c.key}><b>{RUBRIC_MAX[c.key]}</b><span>{c.label}</span></div>
              ))}
            </div>
            <p><Flag size={11} />Each day is scored out of {DAY_MAX}. Mission evidence and the daily knowledge check feed the score, but the individual Fieldcraft Passport rests on the individual exam alone.</p>
          </section>
        </>
      )}
    </div>
  );
}
