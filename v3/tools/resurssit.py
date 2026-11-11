#!/usr/bin/env python3
"""PAALAAN! 3.0 – resurssien haku ja pakkaus (kehitystyökalu, peli ei aja tätä).

Hakee Poly Havenin CC0-tekstuurit ja taivaat API:n kautta, pienentää ne ja tallentaa WebP-muotoon
kansioon v3/assets/. Kirjoittaa samalla assets/manifest.json ja assets/LISENSSIT.md.

    python3 v3/tools/resurssit.py [välimuistikansio]

Vaatii: curl, numpy, Pillow (WebP-tuki).
"""
import json, os, subprocess, sys, datetime
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hdr import read_hdr, write_hdr

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.cache')
API = 'https://api.polyhaven.com'

# nimi pelissä: (Poly Havenin tunnus, kartat, käyttö)
TEX = {
    'asfaltti':  ('asphalt_pit_lane',      ['diff', 'nor', 'rough'], 'tien pinta'),
    'lumi':      ('snow_02',           ['diff', 'nor'],          'lumi maassa, tiellä ja penkoissa'),
    'sora':      ('gravel_floor_02',   ['diff', 'nor'],          'piennar ja pihat'),
    'nurmi':     ('sparse_grass',      ['diff', 'nor'],          'pellot ja pientareet'),
    'kulo':      ('withered_grass',    ['diff'],                 'syksyn ja marraskuun pellot'),
    'metsa':     ('forest_ground_04',  ['diff', 'nor'],          'metsän pohja'),
    'multa':     ('farm_soil',         ['diff'],                 'kynnetty pelto'),
    'kaarna':    ('pine_bark',         ['diff', 'nor'],          'kuusen ja männyn runko'),
    'lauta':     ('white_planks_clean', ['diff', 'nor'],         'mökkien lautaseinä (sävytetään punamullaksi)'),
    'hirsi':     ('wood_plank_wall',   ['diff'],                 'latojen harmaantunut seinä'),
    'pelti':     ('corrugated_iron_02', ['diff', 'nor'],         'peltikatot'),
    'betoni':    ('brushed_concrete',  ['diff', 'nor'],          'asemat, liikkeet ja sokkelit'),
    'kivi':      ('mossy_rock',        ['diff', 'nor'],          'kivet ja kalliot'),
}
# nimi pelissä: (tunnus, käyttö)
SKY = {
    'kesa':    ('kloofendal_48d_partly_cloudy_puresky', 'aurinkoinen päivä'),
    'pilvi':   ('kloofendal_overcast_puresky',          'pilvinen päivä, sade ja sumu'),
    'hamara':  ('qwantani_dusk_2_puresky',              'hämärä (helmi- ja lokakuu)'),
    'yo':      ('kloppenheim_02_puresky',               'kaamos ja yö'),
    'talvi':   ('snow_field_puresky',                   'talvipäivä'),
}
MAPKEY = {'diff': 'Diffuse', 'nor': 'nor_gl', 'rough': 'Rough'}

def curl(url, dst):
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    subprocess.run(['curl', '-sS', '-f', '-m', '180', '-o', dst + '.osa', url], check=True)
    os.replace(dst + '.osa', dst)

def api(path):
    dst = os.path.join(CACHE, 'api', path.replace('/', '_') + '.json')
    curl(f'{API}/{path}', dst)
    with open(dst) as f:
        return json.load(f)

def save_webp(img, path, q):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)

def textures(man, lic):
    for name, (pid, maps, use) in TEX.items():
        info, files = api(f'info/{pid}'), api(f'files/{pid}')
        entry = {}
        for m in maps:
            f = files[MAPKEY[m]]['1k']['jpg']
            src = os.path.join(CACHE, 'tex', os.path.basename(f['url']))
            curl(f['url'], src)
            im = Image.open(src).convert('L' if m == 'rough' else 'RGB')
            for size, suf in ((1024, ''), (512, '_s')):
                out = im if im.size[0] == size else im.resize((size, size), Image.LANCZOS)
                q = 82 if m == 'nor' else 76
                save_webp(out, os.path.join(OUT, 'tex', f'{name}_{m}{suf}.webp'), q)
            entry[m] = f'tex/{name}_{m}'
            lic.append((f'tex/{name}_{m}.webp, tex/{name}_{m}_s.webp', info['name'], pid, ', '.join(info['authors']), f['url'], use))
        # keskiväri: kaukana maasto piirretään tasaisella värillä
        d = np.asarray(Image.open(os.path.join(OUT, 'tex', f'{name}_diff_s.webp')).convert('RGB'), dtype=np.float32) / 255
        entry['avg'] = [round(float(x), 4) for x in (d ** 2.2).mean(axis=(0, 1))]
        man['tex'][name] = entry

def skies(man, lic):
    for name, (pid, use) in SKY.items():
        info, files = api(f'info/{pid}'), api(f'files/{pid}')
        f = files['hdri']['4k']['hdr']
        src = os.path.join(CACHE, 'hdr', os.path.basename(f['url']))
        curl(f['url'], src)
        a = read_hdr(src)                     # (2048, 4096, 3), lineaarinen
        h, w, _ = a.shape
        lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        # aurinko tai kuu: kirkkaimman alueen painopiste
        thr = np.quantile(lum, 0.9995)
        ys, xs = np.nonzero(lum >= thr)
        wgt = lum[ys, xs]
        sy, sx = float((ys * wgt).sum() / wgt.sum()), float((xs * wgt).sum() / wgt.sum())
        el, az = (0.5 - (sy + 0.5) / h) * np.pi, ((sx + 0.5) / w - 0.5) * 2 * np.pi
        sun_col = a[ys, xs].mean(axis=0)
        peak = float(lum.max())
        # ympäristövalo: 256×128, aurinko leikataan pois (aurinko tulee pelissä omasta valostaan)
        cap = float(np.quantile(lum, 0.995)) * 1.5
        k = np.minimum(1.0, cap / np.maximum(lum, 1e-6))[..., None]
        env = (a * k).reshape(128, h // 128, 256, w // 256, 3).mean(axis=(1, 3))
        os.makedirs(os.path.join(OUT, 'sky'), exist_ok=True)
        write_hdr(os.path.join(OUT, 'sky', f'{name}_env.hdr'), env)
        # taustakuva: horisontin yläpuoli ja 11,25° sen alta, 8-bittisenä gammalla ja alueella 0..M
        rows = int(h * (90 + 11.25) / 180)
        top = a[:rows]
        M = float(min(max(np.quantile(lum[:rows], 0.99) * 1.3, 1.0), 8.0))  # aurinko piirretään pelissä erikseen
        enc = np.clip(top / M, 0, 1) ** (1 / 2.2)
        img = Image.fromarray((enc * 255 + 0.5).astype(np.uint8))
        save_webp(img, os.path.join(OUT, 'sky', f'{name}.webp'), 86)
        save_webp(img.resize((2048, rows // 2), Image.LANCZOS), os.path.join(OUT, 'sky', f'{name}_s.webp'), 84)
        hor = a[h // 2 - 40:h // 2 - 4].mean(axis=(0, 1))
        zen = a[:h // 8].mean(axis=(0, 1))
        man['sky'][name] = {
            'img': f'sky/{name}', 'env': f'sky/{name}_env.hdr', 'M': round(M, 4), 'rows': rows / h,
            'sunEl': round(float(el), 4), 'sunAz': round(float(az), 4), 'sunPeak': round(peak, 1),
            'sunCol': [round(float(x), 3) for x in sun_col / max(float(sun_col.max()), 1e-6)],
            'horizon': [round(float(x), 4) for x in hor], 'zenith': [round(float(x), 4) for x in zen],
            'mean': round(float(lum[:h // 2].mean() if peak < 100 else np.minimum(lum[:h // 2], cap).mean()), 4),
        }
        lic.append((f'sky/{name}.webp, sky/{name}_s.webp, sky/{name}_env.hdr', info['name'], pid, ', '.join(info['authors']), f['url'], use))

def main():
    man, lic = {'tex': {}, 'sky': {}}, []
    textures(man, lic)
    skies(man, lic)
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(man, f, indent=1)
    total = sum(os.path.getsize(os.path.join(d, x)) for d, _, fs in os.walk(OUT) for x in fs)
    with open(os.path.join(OUT, 'LISENSSIT.md'), 'w') as f:
        f.write('# PAALAAN! 3.0 – resurssien lähteet ja lisenssit\n\n')
        f.write('Kaikki tämän kansion tekstuurit ja taivaskuvat ovat [Poly Havenista](https://polyhaven.com) ja niiden lisenssi on '
                '**CC0 1.0** (public domain, https://polyhaven.com/license: "All assets on Poly Haven are CC0"). '
                'Poly Havenin API ei palauta lisenssikenttää resurssikohtaisesti, koska sama CC0 koskee sivuston kaikkia resursseja; '
                'lisenssi on tarkistettu lisenssisivulta ' + datetime.date.today().strftime('%-d.%-m.%Y') + '.\n\n')
        f.write('Tiedostot on haettu kehityksen aikana API:n kautta (`api.polyhaven.com` → `dl.polyhaven.org`), pienennetty ja pakattu '
                'WebP-muotoon skriptillä `v3/tools/resurssit.py`. Peli lataa ne vain tästä kansiosta, ei koskaan Poly Havenista.\n\n')
        f.write('| Tiedosto | Resurssi | Tekijä | Lähde | Käyttö |\n|---|---|---|---|---|\n')
        for files, nm, pid, auth, url, use in lic:
            f.write(f'| `{files}` | [{nm}](https://polyhaven.com/a/{pid}) | {auth} | `{url}` | {use} |\n')
        f.write('\n## Muut\n\n'
                '- `v3/lib/`: [three.js](https://threejs.org) 0.160.0, MIT-lisenssi (ks. `v3/lib/LICENSE`). Haettu npm-rekisteristä (`npm pack three@0.160.0`).\n'
                '- Fontti VT323: SIL OFL, ks. `/fonts/OFL.txt`.\n'
                '- Autot, puut, rakennukset, eläimet, kyltit ja muut mallit syntyvät koodissa (`v3/gfx/`). Niissä ei ole automerkkien logoja eikä muuta brändigrafiikkaa.\n'
                '- Koivun tuohi, neulas- ja lehtitekstuurit, renkaan kuvio ja pisarat piirretään koodissa canvasille.\n')
    print(f'valmis: {total / 1e6:.2f} Mt, {len(lic)} tiedostoryhmää')

if __name__ == '__main__':
    main()
