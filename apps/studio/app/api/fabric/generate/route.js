import { NextResponse } from 'next/server';
import {
    comfySovereignImageAdapter,
    comfySovereignVideoAdapter,
    comfySovereignMusicAdapter,
} from '@arganta/media-core';

// Sovereign-tier generation: runs the @arganta/media-core ComfyUI adapters
// server-side (Node), so the browser never talks to ComfyUI directly (no CORS,
// endpoint stays private). Dispatches on `kind` (image | video | music);
// defaults to image so the original verified path is untouched. The adapters
// never hard-fail — a downed/incapable ComfyUI falls back (image → deterministic
// bytes; video/music → a browser-defer descriptor with no bytes, surfaced as a
// clear error since ArgantaStudio can't run browser engines server-side).
// Configure via COMFY_URL / COMFY_*_TIMEOUT_MS.

export const runtime = 'nodejs';
export const maxDuration = 800; // video (Wan 2.2) can be slow on 8GB

const ADAPTERS = {
    image: comfySovereignImageAdapter,
    video: comfySovereignVideoAdapter,
    music: comfySovereignMusicAdapter,
};

export async function POST(request) {
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const kind = body?.kind === 'video' || body?.kind === 'music' ? body.kind : 'image';
    const adapter = ADAPTERS[kind];

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
        return NextResponse.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    // Build a kind-appropriate spec; the adapters ignore fields they don't use.
    const spec = { prompt };
    if (body.seed != null) spec.seed = Number(body.seed);
    if (kind === 'image') {
        spec.width = Number(body.width) || 1024;
        spec.height = Number(body.height) || 1024;
    } else if (kind === 'video') {
        spec.width = Number(body.width) || 832;
        spec.height = Number(body.height) || 480;
        if (body.frames) spec.frames = Number(body.frames);
        if (body.fps) spec.fps = Number(body.fps);
        if (body.negative) spec.negative = body.negative;
        if (body.image) spec.image = body.image; // data URL start frame → image→video
        if (body.enhanceFaces) spec.enhanceFaces = true; // FaceDetailer post-pass
    } else if (kind === 'music') {
        if (body.seconds) spec.seconds = Number(body.seconds);
        if (body.tags) spec.tags = body.tags;
        if (body.lyrics) spec.lyrics = body.lyrics;
    }

    try {
        const out = await adapter.run(spec);

        // Non-image sovereign adapters defer to browser engines on failure —
        // that path yields no bytes here, so report it as a clear error.
        if (out?.deferred || !out?.bytes) {
            return NextResponse.json({
                ok: false,
                error: out?.extra?.comfyError || out?.reason || `sovereign ${kind} produced no bytes (ComfyUI unavailable or model missing)`,
            }, { status: 502 });
        }

        const b64 = Buffer.from(out.bytes).toString('base64');
        return NextResponse.json({
            ok: true,
            dataUrl: `data:${out.mime};base64,${b64}`,
            mime: out.mime,
            seed: out.seed,
            engine: out.extra?.engine || 'deterministic',
            fallback: out.extra?.fallback || null,
            comfyError: out.extra?.comfyError || null,
        });
    } catch (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
}
