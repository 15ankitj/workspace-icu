"""Regenerates the WorkspaceICU logo SVGs in public/brand/.

The wordmark text is converted to outlines so the SVGs render the same
everywhere, without the Geist font installed. Needs `pip install fonttools`
and Geist-SemiBold.ttf (npm package `geist`, dist/fonts/geist-sans/):

    python3 scripts/build-logo.py path/to/Geist-SemiBold.ttf public/brand

The PNGs, src/app/icon.svg, apple-icon.png and favicon.ico are exports of
these SVGs; re-export them after a change (see public/brand/README.md).
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
font = TTFont(FONT)
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
capH = font['OS/2'].sCapHeight

# Colours
TEAL = "#0D9488"        # tile — ≥3:1 against both white and the dark theme bg
TEAL_TEXT_L = "#0F766E" # "ICU" on light
TEAL_TEXT_D = "#2DD4BF" # "ICU" on dark
INK_L = "#171717"; INK_D = "#FAFAFA"

def text_path(s, size, x0, baseline, tracking=0.0):
    sc = size / upm; x = x0; out = []
    for ch in s:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, x, baseline)))
        out.append(pen.getCommands())
        x += gs[g].width * sc + tracking * size
    return " ".join(out), x - tracking * size

def r(v): return f"{v:.2f}".rstrip("0").rstrip(".")

TRACE = "M5 17H10.5L13.5 9.5L18.5 24L21.5 17H27"
def mark(x=0, y=0, s=32, sw=3.25):
    k = s / 32
    return (f'<g transform="translate({r(x)} {r(y)}) scale({r(k)})">'
            f'<rect width="32" height="32" rx="7.5" fill="{TEAL}"/>'
            f'<path d="{TRACE}" fill="none" stroke="#fff" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"/></g>')

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {r(w)} {r(h)}" '
            f'width="{r(w)}" height="{r(h)}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

# 1. Mark (also the favicon / app icon) — one asset for both themes.
open(f"{OUT}/logo-mark.svg", "w").write(svg(32, 32, mark(), "WorkspaceICU"))

# 2. Wordmarks — mark 40 high, cap height ≈ 45% of mark, optically centred.
M = 40; gap = 11; size = 27; track = -0.02
capPx = capH * size / upm
baseline = (M + capPx) / 2
def wordmark(ink, accent):
    p1, x = text_path("Workspace", size, M + gap, baseline, track)
    p2, x2 = text_path("ICU", size, x + 1, baseline, track)
    body = mark(0, 0, M) + f'<path fill="{ink}" d="{p1}"/><path fill="{accent}" d="{p2}"/>'
    return body, x2
for name, ink, acc in (("light", INK_L, TEAL_TEXT_L), ("dark", INK_D, TEAL_TEXT_D)):
    body, w = wordmark(ink, acc)
    open(f"{OUT}/logo-wordmark-{name}.svg", "w").write(svg(w + 1, M, body, "WorkspaceICU"))
print("ok")
