#!/usr/bin/env python3
"""PAALAAN! 1.0 – C64-kasettibudjetti.

Laskee 1.0:n (index.html) pelaajalle näkyvien tekstien koon ja arvioi, mahtuuko
peli yhdellä kasettilatauksella C64:n muistiin. Kasetilta tekstejä ei voi ladata
tarpeen mukaan, joten kaiken pitää mahtua muistiin kerralla.

Käyttö:
    python3 tools/c64budjetti.py            # raportti, ei koskaan virhekoodia
    python3 tools/c64budjetti.py --raja     # virhekoodi 1, jos tekstiraja ylittyy (portatessa)
    python3 tools/c64budjetti.py --tiukka   # kuten --raja, ja myös liian pitkät valinnat ja liukuluvut ovat virheitä
    python3 tools/c64budjetti.py --pitkat   # listaa pisimmät valintatekstit

Rajat (arvioita, ks. README):
  - pakkaamaton teksti enintään 40 000 merkkiä (yksi merkki = yksi tavu, myös ä, ö ja €)
  - lohkoittain pakattu teksti enintään 21 000 tavua (turvaraja 19 000)
  - valinnan teksti enintään 38 merkkiä (yksi C64-rivi), valintoja ruudussa enintään 9
  - ei uusia liukulukufunktioita (Math.pow, Math.log, Math.sqrt …)

Vain Pythonin vakiokirjasto.
"""
import re
import sys
import zlib
from collections import Counter
from pathlib import Path

TEXT_RAW_MAX = 40_000      # pakkaamaton teksti (tavua)
TEXT_PACKED_MAX = 21_000   # pakattu teksti (tavua): yläraja
TEXT_PACKED_SAFE = 19_000  # pakattu teksti (tavua): turvaraja, jolla jää varaa koodille
CHUNK = 2048               # pakkauslohko; C64 tarvitsee saman kokoisen purkupuskurin
CHOICE_MAX = 38            # valintarivin pituus (C64: 40 saraketta, numero ja väli vievät 2)
PLACEHOLDER = 6            # ${…}-lausekkeen arvioitu pituus ruudulla (esim. "12 345")
# muun kuin tekstin muistiarvio C64:llä (konekieli), ks. README
OTHER_KB = {'pelilogiikka (konekieli)': (12, 18), 'data, merkistö ja ruutu': (9, 11), 'purkupuskuri': (2, 2)}
RAM_KB = 52                # käytettävissä konekielellä, kun BASIC-ROM on pois päältä (varovainen arvio)

ROOT = Path(__file__).resolve().parent.parent


def fmt(n):
    return f'{n:,}'.replace(',', ' ')


def script_source(html):
    m = re.search(r'<script>(.*?)</script>', html, re.S)
    if not m:
        sys.exit('index.html: <script>-lohkoa ei löytynyt')
    return m.group(1)


def lex_strings(src):
    """Palauttaa merkkijonoliteraalit: (teksti, on_malli, rivi). Mallien ${…} korvataan merkillä \\x00."""
    out, i, n = [], 0, len(src)
    REGEX_PREV = set('(,=:[!&|?{};+-*%<>~^')

    def line_at(k):
        return src.count('\n', 0, k) + 1

    def read_quoted(k, q):
        buf, k = [], k + 1
        while k < n and src[k] != q:
            if src[k] == '\\':
                buf.append(src[k + 1]); k += 2; continue
            buf.append(src[k]); k += 1
        return ''.join(buf), k + 1

    def read_template(k):
        start, buf, k = k, [], k + 1
        while k < n and src[k] != '`':
            if src[k] == '\\':
                buf.append(src[k + 1]); k += 2; continue
            if src[k] == '$' and k + 1 < n and src[k + 1] == '{':
                k = read_code(k + 2, '}')
                buf.append('\x00'); continue
            buf.append(src[k]); k += 1
        out.append((''.join(buf), True, line_at(start)))
        return k + 1

    def read_code(k, end=None):
        depth, last = 0, ''
        while k < n:
            c = src[k]
            if end and c == end and depth == 0:
                return k + 1
            if c in '{([':
                depth += 1
            elif c in '})]':
                depth -= 1
            if c in '\'"':
                s, k2 = read_quoted(k, c)
                out.append((s, False, line_at(k))); k = k2; last = 'x'; continue
            if c == '`':
                k = read_template(k); last = 'x'; continue
            if c == '/' and k + 1 < n and src[k + 1] == '/':
                k = src.find('\n', k); k = n if k < 0 else k; continue
            if c == '/' and k + 1 < n and src[k + 1] == '*':
                k = src.find('*/', k) + 2; continue
            if c == '/' and (last == '' or last in REGEX_PREV):  # säännöllinen lauseke
                k += 1; cls = False
                while k < n and (src[k] != '/' or cls):
                    if src[k] == '\\': k += 1
                    elif src[k] == '[': cls = True
                    elif src[k] == ']': cls = False
                    k += 1
                k += 1; last = 'x'; continue
            if not c.isspace():
                last = c if not (c.isalnum() or c in '_$') else 'x'
                if c == ')' or c == ']': last = 'x'
            k += 1
        return k

    read_code(0)
    return out


def visible(s):
    """Pelaajalle näkyvä teksti: vähintään kaksi sanaa tai ruudun otsikko."""
    t = s.replace('\x00', 'X')
    return bool(re.search(r'[A-Za-zÅÄÖåäö]{3,}[^\n]*\s+\S', t)) or bool(re.fullmatch(r'[A-ZÅÄÖ0-9 !?.,:–-]{4,}', t))


def screen_len(s):
    return len(s.replace('\x00', 'X' * PLACEHOLDER))


def packed_bytes(texts, chunk=CHUNK):
    """Tekstit pakataan lohkoina: samat tekstit vain kerran, ja noin 2 kt:n lohko puretaan
    C64:llä puskuriin, kun lohkon tekstiä tarvitaan (LZ-purku, esim. Exomizer-tyyppinen).
    Arviona käytetään deflate-pakkausta lohkoittain ja kahden tavun osoitetta per teksti."""
    uniq = list(dict.fromkeys(texts))
    total, buf = 0, ''
    for t in uniq:
        buf += t + '\x01'
        if len(buf) >= chunk:
            total += len(zlib.compress(buf.encode('latin-1', 'replace'), 9)) - 6; buf = ''
    if buf:
        total += len(zlib.compress(buf.encode('latin-1', 'replace'), 9)) - 6
    return total + 2 * len(uniq), len(uniq)


def choices(src):
    """Valintatekstit: scr(...)-kutsujen valintataulukoiden ensimmäiset alkiot."""
    pat = re.compile(r"\[\s*(`(?:[^`\\]|\\.|\$\{[^}]*\})*`|'(?:[^'\\]|\\.)*')\s*,\s*(?:\(\)\s*=>|[A-Za-z_]\w*\s*[,\]])")
    out = []
    for m in pat.finditer(src):
        lit = m.group(1)
        body = re.sub(r'\$\{[^}]*\}', '\x00', lit[1:-1])
        out.append((body, src.count('\n', 0, m.start()) + 1))
    return out


def main():
    strict = '--tiukka' in sys.argv
    enforce = strict or '--raja' in sys.argv  # tekstejä ei lyhennetä ennen porttausta, joten oletuksena vain raportti
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    src = script_source(html)
    offset = html[:html.index('<script>')].count('\n')
    global TEXTS
    TEXTS = [s for s, _, _ in lex_strings(src) if visible(s)]
    raw = sum(screen_len(s) for s in TEXTS)
    packed, nuniq = packed_bytes([t.replace('\x00', '\x02') for t in TEXTS])

    errs, warns = [], []
    print('PAALAAN! 1.0 – C64-kasettibudjetti')
    print(f'  Tekstejä {len(TEXTS)} kpl, pakkaamatta {fmt(raw)} / {fmt(TEXT_RAW_MAX)} merkkiä')
    print(f'  Pakattuna ({nuniq} erilaista tekstiä, {CHUNK // 1024} kt:n lohkot) noin {fmt(packed)} / {fmt(TEXT_PACKED_MAX)} tavua (turvaraja {fmt(TEXT_PACKED_SAFE)})')
    if raw > TEXT_RAW_MAX: errs.append(f'pakkaamatonta tekstiä {fmt(raw - TEXT_RAW_MAX)} merkkiä liikaa')
    if packed > TEXT_PACKED_MAX: errs.append(f'pakattua tekstiä {fmt(packed - TEXT_PACKED_MAX)} tavua liikaa')
    elif packed > TEXT_PACKED_SAFE: warns.append(f'pakattu teksti ylittää turvarajan {fmt(packed - TEXT_PACKED_SAFE)} tavulla: tiivistettävä porttausvaiheessa')
    lo = packed / 1024 + sum(a for a, _ in OTHER_KB.values())
    hi = packed / 1024 + sum(b for _, b in OTHER_KB.values())
    print(f'  Koko peli muistissa arviolta {lo:.0f}–{hi:.0f} kt / noin {RAM_KB} kt '
          f'({", ".join(f"{k} {a}–{b} kt" if a != b else f"{k} {a} kt" for k, (a, b) in OTHER_KB.items())})')
    if hi > RAM_KB: warns.append(f'yläarvio {hi:.0f} kt ylittää {RAM_KB} kt: tiivistettävä porttausvaiheessa')
    print(f'  Tilaa uusille teksteille: noin {fmt(max(0, TEXT_RAW_MAX - raw))} merkkiä')

    ch = choices(src)
    long_ = sorted(((screen_len(b), b, ln + offset) for b, ln in ch if screen_len(b) > CHOICE_MAX), reverse=True)
    print(f'  Valintoja {len(ch)} kpl, yli {CHOICE_MAX} merkkiä: {len(long_)} kpl')
    if long_: (errs if strict else warns).append(f'{len(long_)} valintatekstiä ei mahdu yhdelle C64-riville (--pitkat listaa ne)')
    if '--pitkat' in sys.argv:
        for L, b, ln in long_[:40]:
            print(f'    rivi {ln}: {L} merkkiä: {b.replace(chr(0), "…")}')

    floats = Counter(re.findall(r'Math\.(pow|log2?|log10|sqrt|exp|sin|cos|atan2?)\b', src))
    if floats:
        msg = 'liukulukufunktioita: ' + ', '.join(f'Math.{k} ×{v}' for k, v in sorted(floats.items()))
        print('  ' + msg[0].upper() + msg[1:])
        (errs if strict else warns).append(msg + ' (C64: korvaa kokonaisluvuilla, silmukalla tai taulukolla)')

    for w in warns: print('  HUOM: ' + w)
    for e in errs: print('  YLITYS: ' + e)
    print('  OK: mahtuu budjettiin.' if not errs else '  EI MAHDU budjettiin.')
    if errs and not enforce: print('  (Vain raportti. Tekstit tiivistetään vasta porttausvaiheessa.)')
    sys.exit(1 if errs and enforce else 0)


TEXTS = []
if __name__ == '__main__':
    main()
