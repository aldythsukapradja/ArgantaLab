# ArgantaLab — brand knowledge base

> **Purpose of this file.** This is the context pack a media AI reads before generating
> anything for ArgantaLab. If you are an image, video or audio model (Higgsfield, fal.ai,
> or whatever comes next), everything you need to produce on-brand output is here — you
> should not need to ask a human a single question. Machine-readable tokens live beside
> this file in `brand.json`; this document is the part that can only be said in words.

## What ArgantaLab is

ArgantaLab is the **kid-powered creation studio** inside Arganta, the family OS. Children
play learning games, explore learning worlds, build their own games with AI-assisted tools,
and publish what they make. KinQuest — an RPG that turns lessons into adventure — is the
hero experience. Parents see growth and creations, not raw screen time.

The loop, and the brand's spine: **Play → Learn → Build → Ship.**

## Who is speaking

**The Lab.** Not a founder's personal account, not a company mouthpiece — a place with a
personality. The Lab is inventive, slightly mysterious, encouraging, and always building.
It talks to a capable child and a thoughtful parent in the same breath, without
condescending to either.

The Lab shows finished things. It never promises what it hasn't built.

## The visual world

Picture a **late-night workshop that happens to be inside a nebula.** Deep space-ink dark,
almost black, with a soft luminous field behind everything — as if a screen is glowing just
out of frame. Into that dark, one bright object: a geometric form, cleanly drawn, lit from
within.

The mood is **wonder plus competence**. Not childish, not corporate. It is the feeling of a
kid who just made something real and is holding it up to the light — the artifact is
glowing, and the room is dark enough that you can't look at anything else.

- **Light:** one source, from within the subject. Cyan-to-purple rim light. Deep falloff.
- **Depth:** vast, empty, calm negative space. The subject floats; it is never crowded.
- **Geometry:** clean, deliberate, slightly technical. Cubes, orbits, wireframes, grids.
  Everything looks *constructed* — because everything in this brand was built by someone.
- **Surface:** matte darks with glassy highlights. A faint grid or starfield may sit far
  behind, never in front.
- **Energy:** stillness with a charge in it. Motion is implied, not blurred.

### The mark

The **Lab Core**: a gradient rounded-square tile holding a three-face wireframe cube with a
bright white core at its centre, and — in profile applications — a thin orbit ring circling
it with a single satellite dot. The cube reads as *a thing being built*; the core reads as
*the spark that builds it*; the orbit reads as *a system around it*.

Geometry is defined precisely in `brand.json` (`identity.mark`) and rendered from that data
— never redraw it by eye, never regenerate it with a model. It is code.

### Color

| Role | Hex | Meaning |
| --- | --- | --- |
| Night Ink | `#070A12` | The ground. Almost everything sits on this. |
| Signal Cyan | `#34E5FF` | The spark's cold edge — highlights, rim light |
| Core Blue | `#4D9FFF` | The Play pillar; the mark's body |
| Lab Purple | `#8B5CF6` | The Build pillar; the brand's centre of gravity |
| Spark Pink | `#FF5EA0` | The Ship pillar; the gradient's warm end |
| Growth Green | `#3DE08A` | Progress, mastery, "it worked" |
| Quest Gold | `#FFC24B` | Reward, achievement — and the text plate |
| Soft White | `#F8FAFF` | Ink on dark |

The signature move is the **cyan → blue → purple → pink diagonal gradient**. It is the
brand's fingerprint. Use it on the mark, on rings and arcs, on a single luminous field —
never as a background wash behind text, and never more than once per composition.

### Composition rules

- Dark ground, one glowing subject, generous emptiness around it.
- The subject sits off-centre more often than centred; let the void carry weight.
- One accent hue leads per image; the rest of the gradient supports it.
- A faint technical grid may live in the far background at very low opacity.
- Text, when present, sits on a **solid Quest Gold plate with near-black ink** — never
  bare white type over artwork. This is a hard rule; bare text disappears into these
  backgrounds and it is the single most common failure.

### Do not

- No stock-photo classrooms, no smiling-family-at-laptop, no shutterstock energy.
- No purple-to-blue SaaS hero gradients behind headlines.
- No neon cyberpunk clutter, no lens flares, no chrome.
- No cartoon mascots, no clip-art kids, no crayon or comic-sans "childish" signalling.
- No generic AI-agency imagery: no glowing brains, no circuit boards, no robot hands.
- No photorealistic faces of children. Ever. If a person appears, they are a silhouette,
  a hand, or seen from behind, and they are secondary to the thing they made.

## Voice in one paragraph

Curious, confident, optimistic. Short sentences. Concrete nouns. Prefer *"Built in the
Lab"*, *"Ship your first game"*, *"Adventure becomes learning."* Avoid *"leverage"*,
*"seamless"*, *"empower"*, *"unlock"*. Never exaggerate safety or learning outcomes — the
brand's credibility is that it only claims what it has actually shipped.

Speak to a child without baby-talk, and to a parent without a sales pitch.

## The four pillars

| Pillar | Accent | It looks like |
| --- | --- | --- |
| **Play** the world | Core Blue | KinQuest, games, characters, worlds |
| **Learn** the skill | Signal Cyan | A visible learning moment, a challenge met |
| **Build** the thing | Lab Purple | Process: prompts, tools, half-finished prototypes |
| **Ship** the result | Spark Pink | A published game, a real reaction, a build log |

## What makes a post feel personal, not automated

The brand's warmth does not come from exclamation marks. It comes from **specificity**:
one real kid's creation, one real feature that shipped this week, one honest gap. A post
that could have been about any product is off-brand no matter how correct the colors are.

## Provenance

Transcribed from the ArgantaLab Instagram Profile Pack (2026-07): `docs/brand-guide.md`,
`docs/profile-copy.txt`, `manifest.json`, and the pack's own SVG geometry. Reference images
in `refs/` are the pack's rendered covers — use them as style anchors for image-to-image
and for consistency checks. Ready-to-run generation briefs live in `prompts/`.
