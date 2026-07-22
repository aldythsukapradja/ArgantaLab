# ArgantaStudio

AI media creation studio + multi-platform social command center for the Arganta ecosystem.

Adapted from [Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI) (MIT) — the UI shell and model-catalog architecture are reused; the engine room (generation providers, persistence, publishing) is being rebuilt on ArgantaLab's fabric. See [`docs/arganta-studio/`](../../docs/arganta-studio/) for the master plan and concept-hardening audit.

## Status

Batch A1 complete: booted, slimmed (Electron/Vite fork removed, empty submodule workspaces stripped), and rebranded. Web app only.

Active studios: Image · Video · Cinema · LipSync · Audio · Recast (Body Swap) · Clipping · Vibe Motion · Marketing · AI Influencer.

## Run

```bash
npm install
npm run dev          # http://localhost:3200/studio
```

Generation currently routes through the upstream Muapi.ai gateway (requires an API key). Batch A2 replaces this with the provider fabric (ComfyUI → Cloudflare Workers AI → fal.ai → Muapi BYOK).

## Roadmap (see docs/arganta-studio/master-plan.md)

- **A** — boot/rebrand ✓ · provider fabric · Supabase runs+assets
- **B** — Soul characters · camera grammar · draft→polish ladder · style recipes
- **C** — Buffer GraphQL publisher · YouTube longform · analytics loop
- **D** — hardening & battle tests

## License

MIT (inherits the base project's license; see [LICENSE](LICENSE)).
