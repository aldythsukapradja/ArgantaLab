import { NextResponse } from 'next/server';

// Reachability probe for the local sovereign engine. Reports whether ComfyUI
// answers at COMFY_URL so the UI can badge Local as live vs deterministic-only.

export const runtime = 'nodejs';

export async function GET() {
    const url = (process.env.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const r = await fetch(`${url}/system_stats`, { signal: controller.signal });
        clearTimeout(timer);
        return NextResponse.json({ comfy: r.ok, url });
    } catch {
        return NextResponse.json({ comfy: false, url });
    }
}
