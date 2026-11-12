#!/usr/bin/env python3
"""PAALAAN! 2.0: rakentaa valikoiden 8×8-verkkofontin (fonts/paalaan8.woff2) ajotilan merkistöstä.

Merkit on piirretty tiedostossa v2/gfx.js (F8SRC), joten valikoissa ja ajotilan paneeleissa on täsmälleen sama fontti.
Käyttö: pip install fonttools brotli && python3 tools/fontti8.py
"""
import re, pathlib
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / 'v2' / 'gfx.js').read_text(encoding='utf-8')
block = src[src.index('const F8SRC = {'):src.index('const A8 = ')]
glyphs = {}
for m in re.finditer(r"""(?:'(.)'|"(.)"|([A-Z0-9a-z]))\s*:\s*'([.X]{6}(?: [.X]{6}){6})'""", block):
    glyphs[m.group(1) or m.group(2) or m.group(3)] = m.group(4).split(' ')
alias = {m[0]: (m[1] or m[2]) for m in re.findall(r"'(.)':\s*(?:'(.)'|\"(.)\")", src[src.index('const A8 = '):src.index('const F8 = ')])}

PX, UPM = 100, 800
def draw(rows, full=False):
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        x = 0
        while x < 6:
            if row[x] == 'X':
                x1 = x
                while x1 < 6 and row[x1] == 'X': x1 += 1
                l, rr = (0 if full and x == 0 else (1 + x) * PX), (UPM if full and x1 == 6 else (1 + x1) * PX)
                t, b = UPM - r * PX, UPM - (r + 1) * PX
                pen.moveTo((l, b)); pen.lineTo((l, t)); pen.lineTo((rr, t)); pen.lineTo((rr, b)); pen.closePath()
                x = x1
            else: x += 1
    if full:  # täysi lohko täyttää myös ruudun alimman rivin
        pen.moveTo((0, 0)); pen.lineTo((0, PX)); pen.lineTo((UPM, PX)); pen.lineTo((UPM, 0)); pen.closePath()
    return pen.glyph()

names, glyf, cmap = ['.notdef', 'space'], {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}, {32: 'space', 0xA0: 'space'}
for ch, rows in glyphs.items():
    if ch == 'v': name, code = 'arrowdown', 0x2193   # sisäinen merkki alanuolelle
    else: name, code = 'u%04X' % ord(ch), ord(ch)
    names.append(name); glyf[name] = draw(rows, ch == '█'); cmap[code] = name
    if ch.isalpha() and ch.lower() != ch and ch != 'v': cmap[ord(ch.lower())] = name
for k, v in alias.items():
    if v == 'v': continue
    if ('u%04X' % ord(v)) in glyf: cmap.setdefault(ord(k), 'u%04X' % ord(v)); cmap.setdefault(ord(k.lower()), 'u%04X' % ord(v))
cmap.setdefault(ord('v'), cmap[ord('V')])

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(names); fb.setupCharacterMap(cmap); fb.setupGlyf(glyf)
fb.setupHorizontalMetrics({n: (UPM, 0) for n in names})
fb.setupHorizontalHeader(ascent=UPM, descent=0, lineGap=0)
fb.setupOS2(sTypoAscender=UPM, sTypoDescender=0, sTypoLineGap=0, usWinAscent=UPM, usWinDescent=0)
fb.setupNameTable({'familyName': 'Paalaan8', 'styleName': 'Regular'})
fb.setupPost(isFixedPitch=1)
fb.font.flavor = 'woff2'
out = ROOT / 'fonts' / 'paalaan8.woff2'
fb.save(out)
print(f'{out.relative_to(ROOT)}: {len(names) - 2} merkkiä, {out.stat().st_size} tavua')
