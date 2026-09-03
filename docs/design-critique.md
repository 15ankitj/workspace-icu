# Design critique — WorkspaceICU UI

_Structured review of the shipped interface for usability, visual hierarchy,
consistency and accessibility. Reviewed on 2026-09-03 against `main` at
`69e6a05`. Every finding cites the source it was read from; nothing was
rendered in a browser (there is no local dev environment), so contrast
figures are computed from the token values in `src/app/globals.css`._

## Status

The ten prioritised fixes below have been implemented on the
`claude/design-critique-we93pn` branch (see the commit that follows the
critique). Findings not in the top ten remain open, notably A2 (keyboard
model for the page tree and a "Move to…" alternative to drag-and-drop),
U10's per-hit workspace name, the callout emoji picker, and the dark-mode
palette decision in C5.

## Overall assessment

The brief asks for a workspace that is "deliberately bare at baseline", and the
UI honours that: an achromatic shadcn neutral palette, one type family, no
decoration, no marketing chrome. Copy is plain, British, and unusually honest
for a product of this kind. The information-governance flow (AUP gate, upload
reminder, PHI scan) is the most carefully thought-through part of the product.

The problem is that bareness has slid into absence. The UI has almost no
typographic hierarchy (page title, then everything else 12–14px grey), no
feedback layer (no save indicator, no toasts, no loading or error states), no
mobile layout at all, and a set of hand-rolled controls that drift from each
other because the design system stops at six primitives. Most seriously, the
moments where the product's safety story depends on the UI are visually
inverted: the two most irreversible actions in the app are its quietest
buttons, the PHI dialog styles the safe choice as dangerous and the risky one
as neutral, and the compliance copy is always the smallest, greyest text on its
screen.

None of this needs a redesign. It needs a type scale, four or five missing
primitives, one feedback pattern, a mobile shell, and a rule for destructive
actions.

## What works

- **Sign-in** is the best-built screen: a real `<label htmlFor>`, pending
  labels on both buttons, an error with `role="alert"`, an `outline` variant
  for the secondary provider. It is the reference the rest should match.
- **Copy tone** is consistent and human: British spelling throughout,
  `en-GB` dates, hedged PHI labels ("Possible NHS number"), and honest
  framing ("It is not a clinical record").
- **Settings and trash** share one row pattern
  (`rounded-md border px-3 py-2 text-sm`) and one dashed-card empty state.
  This is the consistency the rest of the app should copy.
- **Landmarks** exist where they matter: a skip link, a labelled table of
  contents `<nav>`, `aria-label`s on the sidebar icon buttons and page menu.
- **The IG flow's content** (AUP statement, guidance link, per-finding
  labels, "first five uploads" checkbox rule) maps closely to brief §9.

## Findings

Severity: **Critical** blocks a core task or undermines the safety story;
**High** affects most sessions; **Medium** is a recurring paper cut;
**Low** is polish.

### Usability

**U1 · Critical · There is no mobile layout.**
The sidebar is `w-64 shrink-0` with no breakpoint, no drawer and no collapse
(`src/components/sidebar/sidebar.tsx:52`). The whole app contains 17
responsive utilities. On a 375px phone the sidebar takes 256px and the page
column gets ~119px, then the editor's negative margin (U4) overflows it. The
brief's principle 8 is "mobile-first reading … pleasant to read on a phone in
a corridor". The `<aside>` also has no `h-screen`/`sticky`, so on a long page
the tree and Sign out scroll away with the document.
_Recommend:_ hide the sidebar below `md`, add a top bar with a menu button
that opens it as a sheet; make the aside `sticky top-0 h-screen` with its own
scroll.

**U2 · Critical · Irreversible actions have no confirmation and the weakest styling.**
Seven destructive actions, none confirmed: delete account
(`settings/page.tsx:285`, `ghost` + `text-destructive`), delete permanently
(`trash/page.tsx:105`, same), delete page (`page-tree.tsx:265`, menu item),
delete template (`gallery/[templateId]/page.tsx:210`, plain `ghost`), delete
comment (`comments-panel.tsx:105`, 12px text link), remove member and revoke
invite (`settings/page.tsx:170, 244`, plain `ghost`). Account deletion is
gated only by a phrase that lives in a placeholder
(`placeholder="Type: delete my account"`) and disappears as the user types it;
the `aria-label` spells the phrase differently.
_Recommend:_ one rule: irreversible → `AlertDialog` confirm; destructive →
`variant="destructive"` on buttons, `text-destructive` on menu items, nothing
else. Show the confirmation phrase as a visible label and disable the button
until it matches.

**U3 · Critical · The PHI dialog inverts its emphasis, and the AUP gate fails silently.**
In `src/components/page/file-upload.tsx:184-208` "Remove file" (the safe
action) is `variant="destructive"` and "I confirm this is anonymised" (the
override the DPIA is meant to discourage) is `variant="secondary"`. The
brief's third option, "Anonymise and re-upload", is missing. In the gate
dialog (143-154) the Upload button reads the checkbox with
`document.getElementById` and, if unchecked, returns without any feedback.
Both server calls are `.catch(() => {})`, so a failed delete closes the
dialog as if it worked.
_Recommend:_ "Remove file" becomes the default action; the override becomes
`outline` with a one-line consequence under it; disable Upload until the
checkbox is ticked and drive it from React state; surface failures.

**U4 · High · The editor body is offset 54px from everything above it.**
`page-editor.tsx:192` applies `-mx-[54px]` to cancel BlockNote's gutter. The
title, breadcrumbs, backlinks and comments sit in `max-w-3xl`; the body text
hangs outside it on both sides. The same wrapper is reused in the gallery
preview, where content escapes its bordered box.
_Recommend:_ zero BlockNote's inline padding with a CSS override on
`.bn-editor` instead of a negative margin, so body and title share a left
edge.

**U5 · High · The selected page looks identical to a hovered page.**
`page-tree.tsx:174-175` uses `bg-accent` for both hover and active. With the
pointer in the tree there is no way to tell which page is open.
_Recommend:_ give selected its own signal (foreground text + `font-medium` +
`aria-current="page"`, or a 2px left rule) and make hover lighter than it.

**U6 · High · Row actions and cover controls exist only on hover.**
`page-tree.tsx:233` (`hidden group-hover:flex`) hides favourite, privacy,
delete and add-sub-page; `page-cover.tsx:127` does the same for Change and
Remove. No `focus-within`, so keyboard users cannot reach them and touch
users cannot see them.
_Recommend:_ add `focus-within:flex`, show always under `@media (hover: none)`,
and put a scrim behind the cover buttons so they read on light photos.

**U7 · High · Saving is invisible and failures are silent.**
Title saves on a 600ms debounce (`page-header.tsx:28-31`), body on 1500ms
(`page-editor.tsx:36`), neither shows state; a failed body save only logs
(`page-editor.tsx:162`). Comment text is cleared before the action resolves
(`comments-panel.tsx:131-133`), so a failure loses the draft.
_Recommend:_ a small status in the breadcrumb bar ("Saved", "Saving…",
"Couldn't save · Retry") and a toast system for errors.

**U8 · High · No loading, error or not-found surfaces; the privacy notice is broken and unreachable.**
There is no `loading.tsx`, `error.tsx`, `not-found.tsx` or
`global-error.tsx` under `src/app`; every route is `force-dynamic` and the
page view issues 11 parallel plus up to 10 sequential queries with a blank
screen meanwhile. `privacy/page.tsx:13` uses `prose prose-neutral` but
`@tailwindcss/typography` is not installed, so with Preflight the notice
renders as one block of 16px text with no headings, bullets or paragraph
spacing. `/privacy` is not in `PUBLIC_PATHS` (`src/proxy.ts:4`) and nothing
links to it; `/aup` is allow-listed but does not exist.
_Recommend:_ route-group `loading.tsx` skeletons and an `error.tsx`; either
install typography or hand-style the notice like the guidance page; make
`/privacy` public and link it from sign-in and settings.

**U9 · Medium · The empty workspace is a dead end.**
`w/[workspaceId]/page.tsx:32-37` shows one sentence telling the user to look
at the sidebar. No button, no gallery link, no "Getting started" page, which
brief §2 principle 1 promises.
_Recommend:_ two actions ("Create a page", "Browse the gallery") and seed the
Getting-started page.

**U10 · Medium · The search palette has no keyboard model or states.**
`search-dialog.tsx`: results are plain links (Tab only, no ↑/↓/Enter), the
`searching` flag is never rendered, an error is indistinguishable from zero
results (line 43), hits don't say which workspace they are in despite the
search being cross-workspace, and the hint is hard-coded `⌘K` while the
handler accepts Ctrl.
_Recommend:_ a listbox with roving focus, a loading row, an explicit error
row, workspace name per hit, platform-aware shortcut hint.

**U11 · Medium · Sharing, export and print hide behind a 24px `⋯`.**
`page-menu.tsx:82` is the only route to Share, four export items, layout
toggles and Report. Four export items differ only by a parenthetical.
_Recommend:_ a visible "Share" button in the top bar; group exports under a
submenu with two labels and a sub-page toggle.

**U12 · Low · Smaller frictions.**
Callout emoji is a button that cycles colour and cannot be changed
(`callout.tsx:29-52`); breadcrumbs have `min-w-0` but no `truncate`
(`p/[pageId]/page.tsx:198-211`); Recents fetches 8 and renders 5
(`layout.tsx:60`, `sidebar.tsx:109`); the share URL "Copy" button changes
width when its label changes (`page-menu.tsx:185`).

### Visual hierarchy

**H1 · High · Section headings are weaker than the body text they introduce.**
Every `h2` in settings (`79, 101, 117, 190, 266`), gallery (`75, 126`),
comments (`48`), backlinks (`21`) and the sidebar (`90, 106, 122`) is
`text-sm font-medium text-muted-foreground` (or `text-xs`), which is smaller
and lighter than the 14px foreground body beneath it and pixel-identical to a
field label. Only the guidance page sets `h2` at full size.
_Recommend:_ a heading scale and stick to it: page title `text-2xl
font-semibold`; section `text-base font-semibold text-foreground`; group
label `text-xs font-medium uppercase tracking-wide text-muted-foreground`.

**H2 · High · Compliance copy is always the smallest, greyest text on its screen.**
The AUP statement is 12px muted inside a bordered card (`sign-in:200`) and a
muted `DialogDescription` in the upload gate (`file-upload:108-114`); the
share view's "Not a clinical record" is 12px muted on `bg-muted/40`
(`share/[token]/page.tsx:46`, a ~1.04:1 fill); the Caldicott caveat is the
smallest text on the guidance page (`guidance/anonymisation/page.tsx:55`);
the page editor carries no disclaimer at all. The template-update banner uses
the same near-invisible wash (`template-update-banner.tsx:77`).
_Recommend:_ one `Notice` component (left rule, foreground text, an icon
with meaning) used for AUP, disclaimers, update banners and PHI results.

**H3 · High · Red "no PHI" callouts print grey.**
The static renderer ignores `props.colour`
(`src/components/render/blocks-renderer.tsx:122-131`), so the 🚫 warning that
opens every CESR page exports as a neutral box. In the editor the tints are
`bg-red-500/10` etc. with no border (`callout.tsx:9-14`), so red and blue are
hard to tell apart even on screen.
_Recommend:_ read the colour in the renderer; give callouts a 3px left border
in the colour plus a stronger tint; keep it in print.

**H4 · Medium · The type scale is bimodal and page titles have five sizes.**
Across `src`: `text-sm` ×73, `text-xs` ×49, no `text-base` at all, then a
jump to `text-2xl`/`text-4xl`. `h1` is `text-4xl font-bold` on pages,
`text-3xl` in print, `text-2xl font-semibold` on six screens, `text-xl` on the
invite and empty-workspace screens, and unstyled on privacy. Three
`text-[10px]` badges exist.
_Recommend:_ define the scale as tokens (xs 12 / sm 14 / base 16 / lg 18 /
xl 20 / 2xl 24 / 4xl 36) and assign roles once.

**H5 · Medium · Primary calls to action have no more weight than management buttons.**
"Start with this template" (`gallery/[templateId]/page.tsx:113`) is a default
button of default size, 70 lines above `secondary` "Republish" and `ghost`
"Delete template"; "Send invitation" is the only primary on settings while
"Download workspace export" is `secondary`.
_Recommend:_ one primary per screen, placed with the header; everything else
secondary or ghost.

**H6 · Low · Vertical rhythm is ad hoc.**
Down the page column: `mb-4` (top bar), `mb-4` (banner), `mb-6`/`mb-2`
(cover), `space-y-2` (header), `mt-6` (editor), `mt-8` (backlinks), `mt-10`
(comments). Adding a cover shifts the title ~170px.
_Recommend:_ one flex column with `gap`, and reserve the cover's height.

### Consistency

**C1 · High · Missing primitives are hand-rolled repeatedly, and drift.**
Only `button`, `input`, `dialog`, `dropdown-menu`, `separator` and
`skeleton` exist. Consequently: the same textarea class string is pasted in
`page-menu.tsx:250`, `comments-panel.tsx:142` and
`save-template-dialog.tsx:83` (with `p-2`, unlike Input's `px-3 py-1`);
raw `<select>`s appear four times at two heights (`settings:149` `h-8`,
`settings:205` `h-9`) with no focus styling; badges five times in three
recipes (`text-xs capitalize` vs `text-[10px] uppercase tracking-wide`); two
toasts share one class string but one auto-dismisses and one needs a button
(`file-upload:213, 225`); small icon buttons use `hover:bg-accent` in the
sidebar and `hover:bg-background` in the tree (`page-tree.tsx:208`), which is
invisible on `bg-sidebar`.
_Recommend:_ add `Textarea`, `Select`, `Label`, `Badge`, `Card`, `Tooltip`,
`AlertDialog` and `Sonner`; replace every hand-rolled instance.

**C2 · Medium · `size="sm"` silently changes the type size.**
`button.tsx:23` bundles `text-xs` into the small size, so sidebar actions,
comment, restore, delete-permanently, update, remove, revoke and the banner
buttons all render at 12px while dialog buttons are 14px.
_Recommend:_ keep `text-sm` on `sm`; add an explicit `xs` size if 12px is
wanted anywhere.

**C3 · Medium · Container widths follow no rule.**
`max-w-sm` (sign-in), `max-w-md` (invite), `max-w-2xl` (settings, trash,
privacy, guidance), `max-w-3xl` (gallery, page, share, print). Trash (rows)
is narrower than gallery (cards). `p-6 md:p-12` is repeated in seven files.
_Recommend:_ a `PageShell` with `narrow | reading | wide` widths.

**C4 · Medium · Nine empty states in four registers; one section just vanishes.**
Dashed cards on gallery and trash; bare 12px lines in the tree, comments,
search and page picker; a centred sentence on workspace home; `return null`
for backlinks (`backlinks-panel.tsx:18`). Gallery's explains an action with
`→ ⋯ →` glyphs.
_Recommend:_ one `EmptyState` (dashed card, one sentence, one action) and
never hide a section a user might look for.

**C5 · Low · Small tokens drift.**
Radii: bare `rounded` on rows and badges, `rounded-md` on cards, `rounded-lg`
on gallery cards and covers. Four dialog footer layouts. Two text-link
underline offsets (`underline-offset-2` vs `-4`). Icon sizes 12/14/16/20 with
no scale. The `.dark` palette (`globals.css:30-52`) is 23 lines of tokens
with zero `dark:` utilities and no toggle.
_Recommend:_ pick one radius per role; add `DialogFooter`; delete or wire the
dark palette.

### Accessibility

Brief §12 commits to WCAG AA, a keyboard-navigable editor and labelled block
controls.

**A1 · High · Focus indicators fail contrast or are missing.**
`--ring: oklch(0.708 0 0)` is ~2.6:1 on white, under the 3:1 minimum for
focus indicators; Button uses `ring-2`, Input `ring-1`, neither offset. The
title and icon inputs use `focus:outline-none` with no replacement
(`page-header.tsx:47, 69`). Every raw `<button>` in the sidebar, tree,
comments and TOC, every `<select>`, and the gradient swatches have no
focus-visible style at all.
_Recommend:_ darken `--ring` to ≥3:1 (around `oklch(0.55)`), add
`ring-offset-2`, and put a base-layer `:focus-visible` rule on all
interactive elements.

**A2 · High · `role="tree"` is declared without a keyboard model; reorder is pointer-only.**
`page-tree.tsx:107-170` sets tree/treeitem/aria-expanded but no roving
`tabIndex` or arrow keys; drag-and-drop (158-203) has no keyboard or menu
equivalent; drop indicators use the 2.6:1 ring colour.
_Recommend:_ implement arrow-key navigation or drop the role; add "Move
to…" to the page menu.

**A3 · Medium · The skip link points at nothing on most routes.**
`layout.tsx:28-33` targets `#main`, which exists only in the workspace layout
and on privacy. Sign-in, invite, guidance, share and print have the link but
no target.
_Recommend:_ give every route's `<main>` the id, or put it on the root
wrapper.

**A4 · Medium · Inputs without labels.**
Save-template has four unlabelled text fields relying on placeholders
(`save-template-dialog.tsx:70-84`) beside two selects that do have
`aria-label`s; bookmark, embed and page-link inputs have only placeholders;
the sign-in email has an `aria-label` but no visible label while the OTP
field has one.
_Recommend:_ a `Label` component and visible labels; mark the one required
field.

**A5 · Medium · Status changes are not announced.**
Both upload toasts (`file-upload:213, 225`), "Copied", search result counts
and the import status line have no `role="status"`/`aria-live`. Import
errors render in `text-muted-foreground` (`import-dialog.tsx:178`), so a
failure is styled as helper text.
_Recommend:_ the toast system from U7 with a live region; error text in
`text-destructive` with `role="alert"`.

**A6 · Medium · Contrast is marginal where it matters.**
`--muted-foreground` is ~4.7:1 and is used at 12px throughout; resolved
comments add `opacity-60` (`comments-panel.tsx:69`) which drops metadata to
~2.9:1; the title placeholder is `text-muted-foreground/50`
(`page-header.tsx:69`), about 1.6:1, so "Untitled" is nearly invisible.
_Recommend:_ never stack opacity on muted text; show resolved with a label
or check; placeholder at full muted.

**A7 · Low · Semantics.**
Decorative `<Separator>`s expose `role="separator"`; the Layout toggles are
menu items with a manual tick and no `menuitemcheckbox`/`aria-checked`
(`page-menu.tsx:127-144`); the breadcrumb `<nav>` has no `aria-label` or
`aria-current`. Not a design issue but noted: the Google sign-in path never
records `accepted_aup_version` (`sign-in/page.tsx:93-98`).

## Prioritised fixes

Ordered by user impact against effort; each maps to the findings above.

1. **Destructive-action rule + confirmations** (U2, C2). Small, contained,
   removes the worst trust problem.
2. **PHI dialog emphasis and AUP gate** (U3). A few lines in one file; it is
   the product's safety story.
3. **Privacy page rendering and reachability; route error/not-found/loading
   files** (U8).
4. **Mobile shell** (U1) and **editor alignment** (U4).
5. **Selected state in the tree + keyboard-reachable row actions** (U5, U6).
6. **Heading scale and a `Notice` component** for compliance copy (H1, H2,
   H4).
7. **Focus tokens and base-layer focus-visible** (A1).
8. **Add the missing primitives and replace hand-rolled controls** (C1, C3).
9. **Save status and toast system** (U7, A5).
10. **Empty-workspace actions and an `EmptyState` component** (U9, C4).

## Method

Two full read-throughs of every file under `src/app`, `src/components`,
`content` and the two brief documents, cross-checked against each other, then
the top findings re-verified line by line. Contrast ratios come from the
achromatic OKLCH tokens: for `oklch(L 0 0)`, relative luminance is L³, and
contrast is (Y₁ + 0.05)/(Y₂ + 0.05). Nothing was screenshot; anything that
depends on BlockNote's own stylesheet is stated as inferred.
