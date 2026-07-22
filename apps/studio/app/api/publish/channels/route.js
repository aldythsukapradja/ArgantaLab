import { NextResponse } from 'next/server';

// Lists connected Buffer channels via the Buffer GraphQL API (api.buffer.com).
// The token comes from the client (stored locally) and is used only to call
// Buffer — never persisted server-side. Returns [{ id, service, name }].

export const runtime = 'nodejs';

const BUFFER_GQL = 'https://graph.buffer.com';

const CHANNELS_QUERY = `
  query Channels {
    account {
      currentOrganization {
        channels { id service name serviceType }
      }
    }
  }
`;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const token = body?.token;
  if (!token) return NextResponse.json({ ok: false, error: 'token required' }, { status: 400 });

  try {
    const res = await fetch(BUFFER_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: CHANNELS_QUERY }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.errors) {
      const msg = data?.errors?.[0]?.message || `Buffer HTTP ${res.status}`;
      return NextResponse.json({ ok: false, error: msg }, { status: res.ok ? 400 : res.status });
    }
    const channels = data?.data?.account?.currentOrganization?.channels || [];
    return NextResponse.json({ ok: true, channels });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
