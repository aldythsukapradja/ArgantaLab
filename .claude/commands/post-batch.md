---
description: Batch-create social posts that reproduce a saved Post Studio style exactly — recipe + content table → drafts in HQ's inbox
---

# /post-batch — replicate a founder's design across many posts

The founder designed one post by hand in HQ → Post Studio, saved it as a **style
recipe**, and wants N more that look *identical* — only the words and images
change. Your job is to fill that recipe, once per content row, and deliver the
results to HQ's Drafts inbox **verbatim**.

The whole point is pixel fidelity. If you reach for `content_draft` here you have
already failed the task: that tool sends a plain-English brief, lets the model
pick a layout, and HQ re-templates it — the founder's positions, sizes and fonts
are gone. Use **`content_compose`**, which carries a finished PostDoc that HQ
loads untouched.

## What you need before starting

1. **A style recipe** (JSON). The founder gets it from HQ → Post Studio → **Style**
   tab → **Styles** panel → the copy button on a saved style. If they haven't
   given you one, ask — do not invent a design.
2. **A content table** — one row per *slide*, grouped into posts. Markdown, CSV,
   or just a list. Typical columns: `title`, `body`, `pills`, `source`, `image`.

If the founder gives you a topic instead of a table, write the table first and
show it to them before generating anything. A batch of 20 posts built on copy
they haven't read is 20 posts they have to delete.

## How a recipe works

A recipe is a `PostDoc` with the content lifted out and replaced by slots:

| Slot | Filled from | Bound layer |
|---|---|---|
| `{title}` | `row.title` | text layer named Headline / Title / Quote / Number |
| `{body}` | `row.body` | text layer named Body / Subline / Items |
| `{source}` | `row.source` | text layer named Source / Author |
| `{pill1}`, `{pill2}`… | `row.pills[i]` | badge layers, in order |
| `{image}` | `row.image` | the background image layer |

Everything else in the recipe — palette, per-slide template + background, every
layer's `xN/yN/size/weight/font/color/highlight/dim/radius`, and the literal
`@handle` text — is style and must survive untouched. **Never hand-edit those
numbers to "improve" the design.** The founder set them; reproducing them is the
entire job.

`recipe.slides.length` is the post's slide count. One content row per slide, in
order. Slides usually run hook → value → CTA, so the last row is typically the
end card and often needs only a `title`.

## The procedure

1. **Read the recipe.** Note `slides.length`, and which slots each slide actually
   has — that tells you exactly which columns a row needs.
2. **Build one `ContentRow[]` per post**, positionally matched to the recipe's
   slides. A slot with no value makes its layer **drop out** (by design — that is
   how a 2-pill design renders with one pill). Never write a literal `{title}`.
3. **Fill it** with `fillStyle(recipe, rows, meta)` from
   `apps/hq/src/surfaces/broadcast/postStyle.ts` — the same pure function HQ's
   "Apply style" button uses, so batch and manual can't drift apart. Run it with
   `npx tsx`; do not reimplement the substitution by hand.
4. **Deliver each doc** with `content_compose({ brief, doc, brand, imagePrompts?, publishTo? })`.
   One call per post. `brief` is just the inbox label — make it scannable
   ("Ocean facts #3 — octopus"), not a prompt.
5. **Report** the draft ids and tell the founder to open HQ → Content Builder →
   Drafts. Composed drafts are badged **"styled"** and load with the design intact.

## Images

Two ways, and they are not interchangeable:

- **`row.image` = a URL** you already have → it lands in the doc directly.
- **`imagePrompts: [...]`** → Arganta Core generates a background per slide,
  uploads it, and patches it in. Positionally zipped onto `doc.slides`; leave an
  entry empty to keep that slide's existing background.

**Gotcha:** an image only lands if the recipe *has* an image layer on that slide.
A style saved from a slide with no background has no `{image}` slot, so image
data for it is silently ignored — the design wins. If the founder wants photos in
a batch, they must save the style from a slide that has one. Say so rather than
letting them wonder where the pictures went.

## Rules

- **Verbatim or nothing.** `content_compose` only. Never `content_draft` for a
  styled batch.
- **No unfilled slots.** `content_compose` rejects a doc still containing
  `{title}` etc. Treat that error as your bug, not a tool quirk.
- **≤10 slides per post** — Instagram rejects more, and so does the tool.
- **Drafts only.** `publishTo` records *intent*; the founder approves the real
  publish in HQ with "Approve & publish everywhere". Never claim a post is live.
- **Brand voice:** pass `brand` so the right mark and palette compose in, and call
  `brand_get` first if you're writing copy in a brand's voice.
- **Show the table before the batch.** Cheap to fix a row, tedious to delete 20 drafts.

## Example

```ts
// scratch/batch.ts — run with: npx tsx scratch/batch.ts
import { fillStyle } from './apps/hq/src/surfaces/broadcast/postStyle'
import recipe from './recipe.json'

const posts = [
  { brief: 'Ocean facts #1 — octopus', rows: [
    { title: 'Octopuses have three hearts', pills: ['FACT'] },      // hook
    { title: 'Two pump the gills', body: 'The third pumps everything else.' },
    { title: 'Follow for more' },                                    // CTA
  ]},
]

for (const p of posts) {
  const doc = fillStyle(recipe as any, p.rows, { caption: '…', hashtags: '#ocean' })
  console.log(JSON.stringify({ brief: p.brief, doc }))  // → content_compose
}
```

Then one `content_compose` call per post, and report the ids.
