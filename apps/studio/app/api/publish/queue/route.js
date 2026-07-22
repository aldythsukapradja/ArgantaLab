import { NextResponse } from 'next/server';

// Queues a post to Buffer via the GraphQL API. IMPORTANT (per research): this
// only ADDS TO QUEUE for the operator to review/approve inside Buffer — it does
// NOT publish live. We never claim otherwise. Media must be a public URL.

export const runtime = 'nodejs';

const BUFFER_GQL = 'https://graph.buffer.com';

// createPost mutation shape follows Buffer's documented GraphQL API. Kept in one
// place so a Buffer schema change is a one-file fix. Not executed against a live
// account in this environment — validated by the token gate + error surfacing.
const CREATE_POST = `
  mutation CreatePost($input: PostCreateInput!) {
    postCreate(input: $input) { id status }
  }
`;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const { token, channelId, text, mediaUrl } = body || {};
  if (!token) return NextResponse.json({ ok: false, error: 'token required' }, { status: 400 });
  if (!channelId) return NextResponse.json({ ok: false, error: 'channelId required' }, { status: 400 });

  const input = {
    channelIds: [channelId],
    text: text || '',
    ...(mediaUrl ? { media: [{ url: mediaUrl }] } : {}),
    schedulingType: 'ADD_TO_QUEUE', // review-in-Buffer, never immediate publish
  };

  try {
    const res = await fetch(BUFFER_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: CREATE_POST, variables: { input } }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.errors) {
      const msg = data?.errors?.[0]?.message || `Buffer HTTP ${res.status}`;
      return NextResponse.json({ ok: false, error: msg }, { status: res.ok ? 400 : res.status });
    }
    return NextResponse.json({ ok: true, updateId: data?.data?.postCreate?.id || null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
