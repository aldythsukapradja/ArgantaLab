// Mission persistence (Brain OS: "missions are persistent"). Writes each Bridge
// mission to the Supabase `mission` table (schema: supabase/migration_missions.sql)
// via the service role. Fully optional — without SUPABASE_URL + SUPABASE_SERVICE_KEY
// the Bridge runs exactly as before (in-memory only). Never throws into the
// mission loop: failures are logged and swallowed.

const URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ENABLED = Boolean(URL && KEY);

const headers = { Authorization: `Bearer ${KEY}`, apikey: KEY, 'Content-Type': 'application/json' };

type ActivityEvent = { type: string; label?: string; text?: string; at: string };

async function req(method: string, path: string, body?: unknown) {
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      method, headers: { ...headers, Prefer: 'return=minimal' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) console.warn(`bridge persist ${method} ${path}: HTTP ${r.status}`);
  } catch (e) {
    console.warn('bridge persist error:', (e as Error).message);
  }
}

export const persistEnabled = ENABLED;

/** Create the mission row at start. */
export async function missionStart(id: string, goal: string, cwd: string) {
  if (!ENABLED) return;
  await req('POST', 'mission', { id, goal, cwd, status: 'running' });
}

/** Finalize the mission: write the full buffered activity trail in one PATCH. */
export async function missionDone(
  id: string, status: 'done' | 'failed', activity: ActivityEvent[], result?: string, costUsd = 0,
) {
  if (!ENABLED) return;
  await req('PATCH', `mission?id=eq.${id}`, {
    status, result, cost_usd: costUsd, activity: activity.slice(-500),
    updated_at: new Date().toISOString(),
  });
}

export type { ActivityEvent };
