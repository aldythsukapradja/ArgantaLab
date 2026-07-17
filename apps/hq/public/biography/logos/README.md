# Company logos

**Status 2026-07-17: 6 of 7 are REAL logos** (Wikimedia Commons, normalized 512px RGBA PNG):
totalenergies · pertamina · emp · ifp · itb · qatarenergy. Only `noc.png` is still the monogram —
North Oil Company is a private JV with no Commons file and its website is unreachable from the
build environment. Drop a real `noc.png` here and every surface upgrades on reload.


Biography Studio renders a brand-tinted **monogram chip** for every company until
a real logo file exists at the exact filename below. Drop the file in and every
surface (Master Profile, CV Maker, Intro Deck, Journey Timeline) upgrades on the
next reload — no code change.

| Filename | Company |
|---|---|
| `noc.png` | North Oil Company |
| `totalenergies.png` | TotalEnergies / Total E&P Indonésie |
| `pertamina.png` | Pertamina Hulu Mahakam |
| `emp.png` | Energi Mega Persada |
| `itb.png` | Institut Teknologi Bandung (LAPI-ITB) |
| `ifp.png` | IFP School |

**Format:** PNG with transparency, square-ish, ~256px. They render at 20–44px on
ivory paper, so a dark or full-colour mark reads best; a white knockout logo will
disappear on the CV page.

**Why they're not already here:** the build environment has no network access, so
they could not be fetched. The monogram is a designed fallback, not a broken
state — shipping a wrong-looking traced logo would be worse than a clean chip.

**Note on the twin:** the `arganta` profile deliberately renders monograms even
when real logos exist — the public persona uses employer *aliases*, so showing a
real logo there would break the alias.

`LogoChip` probes each file's content-type before rendering an `<img>`, because a
dev server answers a missing PNG with `index.html` and a 200 — `onError` alone
would leave a permanently broken image.
