# Brand

The WorkspaceICU logo is the **cross-weave** mark: two vertical and two
horizontal strands woven over and under each other (from Ankit's concept,
redrawn as clean vectors). No ECG lines, crosses or diaries.

## Where it is used

| Place                    | File                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Browser tab (modern)     | `src/app/icon.svg` — 16 px pixel-fitted, switches tile for dark browser UI                            |
| Browser tab (fallback)   | `src/app/favicon.ico` — 16, 32, 48 px                                                                 |
| iOS home screen          | `src/app/apple-icon.png` — 180 px, no transparency                                                    |
| Sign-in, sign-in confirm | `<Wordmark />` from `src/components/brand/logo.tsx`                                                   |
| Anywhere else in the app | `<BrandMark />` (symbol only) or `<Wordmark />`                                                       |
| Email, other apps        | `public/brand/` — SVG mark, symbol and wordmark (light and dark), wordmark PNG @2x, PNG icons 192/512 |

The React components are inline SVG and follow the `.dark` theme class.

## Colours

| Token            | Light     | Dark      |
| ---------------- | --------- | --------- |
| Strand A (V1/H2) | `#0E76D3` | `#2186E0` |
| Strand B (V2/H1) | `#0064B7` | `#0F6FC4` |
| Tile             | `#EFF4FA` | `#102030` |
| "Workspace"      | `#0F1E30` | `#F3F7FB` |
| "ICU"            | `#0B6CC9` | `#3D96EA` |

Wordmark lettering is Manrope Bold, outlined, so no font is needed.

## Email

The sign-in email (`docs/email/sign-in-template.html`) deliberately carries
**no image** — NHS mail filters score content, and deliverability was hard
won (runbook, "Sign-in"). Leave it image-free. If a logo is ever wanted in
the invitation or digest emails, use the PNG served from our own domain
(`/brand/workspaceicu-wordmark-light@2x.png`, shown at 266×40), never SVG
(Gmail and Outlook do not render it) and never a third-party host — and
watch deliverability after the change.
