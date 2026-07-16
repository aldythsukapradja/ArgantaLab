# Brief — ad hero image (ArgantaLab)

**Read `../BRAND.md` first.** Style anchors: `../refs/cover-start-here.png`, `../refs/profile-dark.png`.

- **Sizes:** 1080×1350 (Meta feed, primary) · 1080×1080 (square) · 1080×1920 (story/reel)
- **Model hint:** photoreal-adjacent 3D render or cinematic CGI. Not illustration, not flat vector.
- **Text:** none baked in. Copy is composited later on a Quest Gold plate by postEngine.
- **Safe area:** keep the subject inside the centre 80%; platforms crop the edges.

## Prompt

> A single luminous geometric object floating in a vast, almost-black space —
> deep night-ink `#070A12` ground with a soft radial glow behind the subject.
> The object is a clean wireframe cube, lit from within by a bright white core,
> its edges catching a cyan-to-purple rim light (`#34E5FF` → `#4D9FFF` →
> `#8B5CF6` → `#FF5EA0`). A faint technical grid recedes far into the darkness
> behind it, barely visible. Calm, still, enormous negative space. The mood is
> wonder plus competence: something real was just built, and it is glowing in a
> dark workshop. Cinematic single-source lighting, deep falloff, matte surfaces
> with glassy highlights. No text, no people, no clutter.

## Negative prompt

> stock photo, classroom, smiling family, laptop, children's faces, cartoon
> mascot, clip art, crayon, comic sans, glowing brain, circuit board, robot
> hand, neon cyberpunk, lens flare, chrome, busy composition, purple-blue SaaS
> gradient background, watermark, text, logo

## Accept / reject

- ✅ One subject, dark ground, huge emptiness, one leading accent hue
- ❌ Anything that could illustrate a generic AI startup
- ❌ Gradient used as a full-bleed background wash rather than on the subject
- ❌ A child's face, in any style
