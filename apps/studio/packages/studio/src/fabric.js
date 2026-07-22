"use client";

// ─── ArgantaStudio provider fabric ──────────────────────────────────────────
//
// The single generation entry point for studio surfaces. Routes each request
// to the cheapest capable provider tier (four-tier router alignment):
//
//   costClass 0  Sovereign  → local ComfyUI via /api/fabric/generate
//                             (@arganta/media-core adapter, server-side)
//   costClass 3  BYOK       → Muapi.ai gateway (upstream client, untouched)
//
// Studios import { generateImage, generateI2I, uploadFile } from here instead
// of muapi.js — same signatures, same result shape ({ url, ... }). Non-image
// kinds pass straight through to muapi until their sovereign adapters exist.

import {
    generateImage as muapiGenerateImage,
    generateVideo as muapiGenerateVideo,
    generateAudio as muapiGenerateAudio,
    generateI2V as muapiGenerateI2V,
    generateI2I,
    processV2V,
    uploadFile,
} from './muapi.js';
import { t2iModels, t2vModels, i2vModels, audioModels } from './models.js';
import { createRun, updateRun, attachAsset } from './store.js';
import { deriveRunMetadata, derivePalette, deriveOrientation } from './extract.js';
import { getActiveCharacter } from './characters.js';

// ─── Sovereign model registration ───────────────────────────────────────────
// Registered directly into the shared t2iModels array so every catalog helper
// (getModelById, getAspectRatiosForModel, …) and the model picker see it with
// no special-casing. Unshifted to index 0: the cheapest tier is the default.

export const SOVEREIGN_T2I_ID = 'arganta-sovereign';

const sovereignT2IModel = {
    id: SOVEREIGN_T2I_ID,
    name: 'Arganta Sovereign (Local)',
    endpoint: 'sovereign',
    inputs: {
        prompt: {
            type: 'string',
            title: 'Prompt',
            name: 'prompt',
            description: 'Text prompt rendered on your own GPU via ComfyUI. Zero cost.',
        },
        aspect_ratio: {
            enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
            title: 'Aspect Ratio',
            name: 'aspect_ratio',
            type: 'string',
            default: '1:1',
        },
    },
    provider: 'arganta',
    provider_name: 'Arganta',
    costClass: 0,
};

if (!t2iModels.some((m) => m.id === SOVEREIGN_T2I_ID)) {
    t2iModels.unshift(sovereignT2IModel);
}

// ─── Sovereign VIDEO model (Wan 2.2 5B via ComfyUI) ──────────────────────────
export const SOVEREIGN_T2V_ID = 'arganta-sovereign-video';

const sovereignT2VModel = {
    id: SOVEREIGN_T2V_ID,
    name: 'Arganta Sovereign Video (Local)',
    endpoint: 'sovereign-video',
    inputs: {
        prompt: { type: 'string', title: 'Prompt', name: 'prompt', description: 'Text→video on your own GPU via ComfyUI (Wan 2.2).' },
        aspect_ratio: { enum: ['16:9', '9:16', '1:1'], title: 'Aspect Ratio', name: 'aspect_ratio', type: 'string', default: '16:9' },
        duration: { title: 'Duration', name: 'duration', type: 'int', description: 'Seconds (up to 5 = Wan max).', default: 3, minValue: 1, maxValue: 5, step: 1 },
        quality: { enum: ['draft', 'hd'], title: 'Quality', name: 'quality', type: 'string', description: 'draft = 480p (faster) · hd = 720p (slow on 8GB).', default: 'draft' },
    },
    provider: 'arganta',
    provider_name: 'Arganta',
    costClass: 0,
};

if (!t2vModels.some((m) => m.id === SOVEREIGN_T2V_ID)) {
    t2vModels.unshift(sovereignT2VModel);
}

// ─── Sovereign IMAGE→VIDEO model (Wan 2.2 5B, start-frame) ───────────────────
export const SOVEREIGN_I2V_ID = 'arganta-sovereign-i2v';

const sovereignI2VModel = {
    id: SOVEREIGN_I2V_ID,
    name: 'Arganta Sovereign (Local)',
    endpoint: 'sovereign-i2v',
    imageField: 'image_url',
    inputs: {
        prompt: { type: 'string', title: 'Motion Prompt', name: 'prompt', description: 'Describe the motion to animate your image on your own GPU (Wan 2.2). Optional.' },
        aspect_ratio: { enum: ['16:9', '9:16', '1:1'], title: 'Aspect Ratio', name: 'aspect_ratio', type: 'string', default: '16:9' },
        duration: { title: 'Duration', name: 'duration', type: 'int', description: 'Seconds (up to 5 = Wan max).', default: 3, minValue: 1, maxValue: 5, step: 1 },
        quality: { enum: ['draft', 'hd'], title: 'Quality', name: 'quality', type: 'string', default: 'draft' },
    },
    provider: 'arganta',
    provider_name: 'Arganta',
    costClass: 0,
};

if (!i2vModels.some((m) => m.id === SOVEREIGN_I2V_ID)) {
    i2vModels.unshift(sovereignI2VModel);
}

// ─── Sovereign AUDIO/music model (ACE-Step 1.5 via ComfyUI) ──────────────────
export const SOVEREIGN_AUDIO_ID = 'arganta-sovereign-music';

const sovereignAudioModel = {
    id: SOVEREIGN_AUDIO_ID,
    name: 'Arganta Sovereign Music (Local)',
    endpoint: 'sovereign-music',
    family: 'arganta',
    description: 'Text→music on your own GPU via ComfyUI (ACE-Step 1.5). Zero cost.',
    inputs: {
        prompt: { type: 'string', title: 'Prompt', name: 'prompt', description: 'Style tags or a description of the track.' },
        duration: { title: 'Duration', name: 'duration', type: 'int', description: 'Seconds.', default: 30, minValue: 4, maxValue: 120, step: 1 },
    },
    provider: 'arganta',
    provider_name: 'Arganta',
    costClass: 0,
};

if (!audioModels.some((m) => m.id === SOVEREIGN_AUDIO_ID)) {
    audioModels.unshift(sovereignAudioModel);
}

// ─── Sovereign path ─────────────────────────────────────────────────────────

const AR_DIMENSIONS = {
    '1:1': [1024, 1024],
    '16:9': [1216, 684],
    '9:16': [684, 1216],
    '4:3': [1024, 768],
    '3:4': [768, 1024],
    '3:2': [1152, 768],
    '2:3': [768, 1152],
};

async function sovereignGenerateImage(params) {
    const [width, height] = AR_DIMENSIONS[params.aspect_ratio] || AR_DIMENSIONS['1:1'];
    const body = {
        prompt: params.prompt,
        width,
        height,
    };
    if (params.seed && params.seed !== -1) body.seed = params.seed;

    const response = await fetch('/api/fabric/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Sovereign generation failed: HTTP ${response.status}`);
    }
    // Mirror the muapi submitAndPoll result shape — studios read `.url`.
    return {
        url: data.dataUrl,
        outputs: [data.dataUrl],
        status: 'completed',
        provider: 'arganta',
        engine: data.engine,
        seed: data.seed,
        width,
        height,
        fallback: data.fallback || null,
    };
}

// Wan 2.2 TI2V-5B is trained on 480p–720p; anything smaller collapses into
// noise. These are the model's SUPPORTED sizes. 'draft' = 480p (coherent, fast
// enough on 8GB); 'hd' = native 720p (best, but slow — heavy offload on 8GB).
const VIDEO_DIMENSIONS = {
    draft: { '16:9': [832, 480], '9:16': [480, 832], '1:1': [640, 640] },
    hd:    { '16:9': [1280, 704], '9:16': [704, 1280], '1:1': [960, 960] },
};

/** Sovereign video (Wan 2.2) — posts to the shared fabric route with kind=video. */
async function sovereignGenerateVideo(params) {
    const tier = params.quality === 'hd' ? 'hd' : 'draft';
    const ar = VIDEO_DIMENSIONS[tier][params.aspect_ratio] ? params.aspect_ratio : '16:9';
    const [width, height] = VIDEO_DIMENSIONS[tier][ar];
    // Up to 5s (121 frames @ 24fps) — Wan's max. Default 3s reads as real motion.
    const seconds = Math.max(1, Math.min(5, Number(params.duration) || 3));
    const frames = Math.max(25, Math.min(121, Math.round(seconds * 24) + 1));
    const body = { kind: 'video', prompt: params.prompt || '', width, height, frames, fps: 24 };
    if (params.seed && params.seed !== -1) body.seed = params.seed;
    // image→video: a start-frame data URL turns this into I2V.
    if (params.image) body.image = params.image;
    // Face-restore post-pass (FaceDetailer) — un-melts Wan 5B faces. Default ON
    // when animating an image (people), opt-out via enhanceFaces===false.
    if (params.enhanceFaces ?? !!params.image) body.enhanceFaces = true;

    const response = await fetch('/api/fabric/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Sovereign video failed: HTTP ${response.status}`);
    }
    return { url: data.dataUrl, outputs: [data.dataUrl], status: 'completed', provider: 'arganta', engine: data.engine, seed: data.seed, width, height };
}

/** Sovereign music (ACE-Step) — posts to the shared fabric route with kind=music. */
async function sovereignGenerateAudio(params) {
    const seconds = Math.max(4, Math.min(120, Number(params.duration) || 30));
    const body = { kind: 'music', prompt: params.prompt, seconds, tags: params.style || params.tags || params.prompt };
    if (params.lyrics) body.lyrics = params.lyrics;
    if (params.seed && params.seed !== -1) body.seed = params.seed;

    const response = await fetch('/api/fabric/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Sovereign music failed: HTTP ${response.status}`);
    }
    return { url: data.dataUrl, outputs: [data.dataUrl], status: 'completed', provider: 'arganta', engine: data.engine, seed: data.seed };
}

/** True when the model id routes to the local sovereign tier. */
export function isSovereignModel(modelId) {
    return modelId === SOVEREIGN_T2I_ID;
}
export function isSovereignVideoModel(modelId) {
    return modelId === SOVEREIGN_T2V_ID;
}
export function isSovereignI2VModel(modelId) {
    return modelId === SOVEREIGN_I2V_ID;
}
export function isSovereignAudioModel(modelId) {
    return modelId === SOVEREIGN_AUDIO_ID;
}

/** Reachability probe for the local engine — { comfy, url }. */
export async function getFabricStatus() {
    try {
        const r = await fetch('/api/fabric/status');
        return await r.json();
    } catch {
        return { comfy: false, url: null };
    }
}

// ─── Dispatch ───────────────────────────────────────────────────────────────

export async function generateImage(apiKey, params) {
    // Every image generation is recorded as a run in the durable ledger
    // (job model: pending → complete/failed). Recording lives here so all
    // studios log automatically with no change to their internals.
    const sovereign = isSovereignModel(params.model);
    const provider = sovereign ? 'arganta' : 'muapi';

    // Soul injection: if a character is active, prepend its trigger token so the
    // identity carries into the generation, and link the run to the character.
    const character = await getActiveCharacter().catch(() => null);
    const effectivePrompt = character?.trigger_token
        ? `${character.trigger_token}, ${params.prompt}`
        : params.prompt;
    const genParams = { ...params, prompt: effectivePrompt };

    // Deterministic-first: derive tags/orientation/checksum with zero LLM,
    // BEFORE the bytes exist. Same shape an AI captioner would later fill.
    const meta = deriveRunMetadata({
        prompt: params.prompt,
        model: params.model,
        seed: params.seed,
        surface: params.surface || 'image',
        provider,
    });
    const tags = character ? [...meta.tags, 'soul'] : [...meta.tags];
    if (params.polishOf) tags.push('polished');

    const run = await createRun({
        kind: 'image',
        surface: params.surface || 'image',
        prompt: params.prompt,
        model: params.model,
        provider,
        cost_class: sovereign ? 0 : 3,
        cost: sovereign ? 0 : (params.cost || 0),
        estimated: !sovereign,                 // paid tiers = guessed cost, never shown as measured
        checksum: meta.checksum,
        tags,
        character_id: character?.id || null,
        correlation_id: params.correlationId || params.polishOf || null,
        params: { aspect_ratio: params.aspect_ratio, seed: params.seed, character: character?.name || null, polishOf: params.polishOf || null },
    });

    try {
        const result = sovereign
            ? await sovereignGenerateImage(genParams)
            : await muapiGenerateImage(apiKey, genParams);

        const url = result?.url || result?.outputs?.[0];
        if (url && typeof url === 'string' && url.startsWith('data:')) {
            // Deterministic palette extraction from the actual bytes.
            const palette = await derivePalette(url).catch(() => []);
            await attachAsset(run.id, { dataUrl: url, palette, width: result?.width, height: result?.height });
        } else if (url) {
            // Hosted URL (muapi) — record the reference, no byte upload/decode.
            await attachAsset(run.id, { dataUrl: url }).catch(() => {});
        }
        await updateRun(run.id, {
            status: 'complete',
            engine: result?.engine || null,
            seed: result?.seed ?? params.seed ?? null,
            completed_at: new Date().toISOString(),
        });
        return { ...result, runId: run.id };
    } catch (e) {
        await updateRun(run.id, { status: 'failed', error: String(e?.message || e) });
        throw e;
    }
}

// ─── Video dispatch (sovereign Wan 2.2 or muapi), with run recording ────────
export async function generateVideo(apiKey, params) {
    const sovereign = isSovereignVideoModel(params.model);
    const provider = sovereign ? 'arganta' : 'muapi';
    const meta = deriveRunMetadata({ prompt: params.prompt, model: params.model, seed: params.seed, surface: params.surface || 'video', provider });
    const run = await createRun({
        kind: 'video', surface: params.surface || 'video', prompt: params.prompt, model: params.model, provider,
        cost_class: sovereign ? 0 : 3, cost: sovereign ? 0 : (params.cost || 0), estimated: !sovereign,
        checksum: meta.checksum, tags: meta.tags,
        params: { aspect_ratio: params.aspect_ratio, duration: params.duration },
    });
    try {
        const result = sovereign ? await sovereignGenerateVideo(params) : await muapiGenerateVideo(apiKey, params);
        const url = result?.url || result?.outputs?.[0];
        if (url) await attachAsset(run.id, { dataUrl: url }).catch(() => {});
        await updateRun(run.id, { status: 'complete', engine: result?.engine || null, seed: result?.seed ?? params.seed ?? null, completed_at: new Date().toISOString() });
        return { ...result, runId: run.id };
    } catch (e) {
        await updateRun(run.id, { status: 'failed', error: String(e?.message || e) });
        throw e;
    }
}

// ─── Audio dispatch (sovereign ACE-Step or muapi), with run recording ───────
export async function generateAudio(apiKey, params) {
    // AudioStudio passes the model as `_modelId` (muapi convention); accept both.
    const modelId = params._modelId || params.model;
    const sovereign = isSovereignAudioModel(modelId);
    const provider = sovereign ? 'arganta' : 'muapi';
    const meta = deriveRunMetadata({ prompt: params.prompt, model: modelId, seed: params.seed, surface: params.surface || 'audio', provider });
    const run = await createRun({
        kind: 'music', surface: params.surface || 'audio', prompt: params.prompt, model: modelId, provider,
        cost_class: sovereign ? 0 : 3, cost: sovereign ? 0 : (params.cost || 0), estimated: !sovereign,
        checksum: meta.checksum, tags: meta.tags, params: { duration: params.duration, style: params.style },
    });
    try {
        const result = sovereign ? await sovereignGenerateAudio(params) : await muapiGenerateAudio(apiKey, params);
        const url = result?.url || result?.outputs?.[0];
        if (url) await attachAsset(run.id, { dataUrl: url }).catch(() => {});
        await updateRun(run.id, { status: 'complete', engine: result?.engine || null, seed: result?.seed ?? params.seed ?? null, completed_at: new Date().toISOString() });
        return { ...result, runId: run.id };
    } catch (e) {
        await updateRun(run.id, { status: 'failed', error: String(e?.message || e) });
        throw e;
    }
}

// ─── Image→Video dispatch (sovereign Wan 2.2 I2V or muapi) ──────────────────
// The sovereign path animates a dropped image on the local GPU. The start frame
// arrives as `params.image` (a data URL) — VideoStudio provides it directly for
// the sovereign model (no muapi upload needed).
export async function generateI2V(apiKey, params) {
    const sovereign = isSovereignI2VModel(params.model);
    if (!sovereign) return muapiGenerateI2V(apiKey, params);

    const meta = deriveRunMetadata({ prompt: params.prompt, model: params.model, seed: params.seed, surface: 'video', provider: 'arganta' });
    const run = await createRun({
        kind: 'video', surface: 'video', prompt: params.prompt || '(image→video)', model: params.model, provider: 'arganta',
        cost_class: 0, cost: 0, estimated: false, checksum: meta.checksum, tags: [...meta.tags, 'i2v'],
        params: { aspect_ratio: params.aspect_ratio, duration: params.duration },
    });
    try {
        // Accept the start frame from either field VideoStudio might use.
        const image = params.image || params.image_url || params.images_list?.[0];
        const result = await sovereignGenerateVideo({ ...params, image });
        const url = result?.url || result?.outputs?.[0];
        if (url) await attachAsset(run.id, { dataUrl: url }).catch(() => {});
        await updateRun(run.id, { status: 'complete', engine: result?.engine || null, seed: result?.seed ?? null, completed_at: new Date().toISOString() });
        return { ...result, runId: run.id };
    } catch (e) {
        await updateRun(run.id, { status: 'failed', error: String(e?.message || e) });
        throw e;
    }
}

// Pass-throughs so studios need exactly one import site.
export { generateI2I, processV2V, uploadFile };

// ─── Quality ladder: draft (sovereign, free) → explicit Polish (paid) ───────
// Default generation is always the cheapest capable tier (sovereign runs first
// in the catalog). Polish is the explicit escalation: re-run the same prompt
// on a paid muapi model. Requires a real API key — connecting one IS the
// approval gate, mirroring media-core's `approved:true` requirement at the
// premium boundary. The new run links back via correlation_id/polishOf so the
// draft and its polish are traceable as one lineage.

/** True when a paid escalation is possible (a real key is connected). */
export function canPolish(apiKey) {
    return !!apiKey && apiKey !== 'local';
}

/** The default premium model to polish onto — first non-sovereign t2i entry. */
export function getPolishModelId() {
    const m = t2iModels.find((x) => x.id !== SOVEREIGN_T2I_ID);
    return m?.id || null;
}

/**
 * Re-run a completed run's prompt on the paid tier. `run` is a row from
 * listRuns()/the Library. Returns the new (polished) generation result.
 */
export async function polishRun(apiKey, run, overrides = {}) {
    if (!canPolish(apiKey)) {
        throw new Error('Connect an API key in Settings to enable Polish.');
    }
    const model = overrides.model || getPolishModelId();
    if (!model) throw new Error('No paid model available to polish onto.');
    return generateImage(apiKey, {
        model,
        prompt: run.prompt,
        aspect_ratio: run.params?.aspect_ratio || overrides.aspect_ratio || '1:1',
        surface: run.surface || 'image',
        polishOf: run.id,
    });
}
