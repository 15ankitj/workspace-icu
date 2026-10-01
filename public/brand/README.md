# WorkspaceICU logo

| File | Use |
| --- | --- |
| `logo-mark.svg`, `logo-mark-512.png` | The square mark: favicon, app icon, avatars. One version works on light and dark backgrounds. |
| `logo-wordmark-light.svg` / `.png` | Mark + "WorkspaceICU" on light backgrounds. |
| `logo-wordmark-dark.svg` / `.png` | Mark + "WorkspaceICU" on dark backgrounds. |

The PNG wordmarks are 160 px tall (4× a 40 px display height), for email
clients that don't render SVG. In the browser, prefer the SVGs.

The app's tab icons are exports of `logo-mark.svg`: `src/app/icon.svg`,
`src/app/favicon.ico` (16/32/48 px) and `src/app/apple-icon.png` (180 px,
full-bleed square — iOS rounds the corners itself).

## Spec

- **Mark:** teal tile `#0D9488`, radius 7.5/32, white heart-rate trace
  (stroke 3.25/32, round caps and joins). The tile has at least 3:1
  contrast against both the light and the dark theme backgrounds.
- **Wordmark:** Geist SemiBold, tracking −2 %, outlined. "Workspace" in
  the ink colour, "ICU" in teal.
  - Light: ink `#171717`, ICU `#0F766E`
  - Dark: ink `#FAFAFA`, ICU `#2DD4BF`
- **Clear space:** at least a quarter of the mark's height on every side.
- **Minimum size:** mark 16 px; wordmark 24 px tall.

Regenerate the SVGs with `scripts/build-logo.py` (instructions inside it).
