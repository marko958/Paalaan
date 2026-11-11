"""Radiance .hdr (RGBE) -lukija ja -kirjoittaja numpylla. Kehitystyökalu, peli ei käytä tätä."""
import numpy as np

def read_hdr(path):
    with open(path, 'rb') as f:
        data = f.read()
    pos = 0
    while True:
        end = data.index(b'\n', pos)
        line = data[pos:end]
        pos = end + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            parts = line.split()
            h, w = int(parts[1]), int(parts[3])
            break
    buf = np.frombuffer(data, dtype=np.uint8, offset=pos)
    out = np.empty((h, w, 4), dtype=np.uint8)
    p = 0
    for y in range(h):
        if buf[p] == 2 and buf[p + 1] == 2 and ((int(buf[p + 2]) << 8) | int(buf[p + 3])) == w:
            p += 4
            for c in range(4):
                x = 0
                row = out[y, :, c]
                while x < w:
                    n = int(buf[p]); p += 1
                    if n > 128:
                        n -= 128
                        row[x:x + n] = buf[p]; p += 1
                    else:
                        row[x:x + n] = buf[p:p + n]; p += n
                    x += n
        else:
            out[y] = buf[p:p + w * 4].reshape(w, 4); p += w * 4
    e = out[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return out[..., :3].astype(np.float32) * scale[..., None].astype(np.float32)

def write_hdr(path, img):
    """Kirjoittaa pakkaamattoman RGBE-tiedoston (three.js:n RGBELoader lukee sen)."""
    img = np.maximum(img.astype(np.float64), 0)
    h, w, _ = img.shape
    m = img.max(axis=2)
    e = np.where(m > 1e-32, np.floor(np.log2(np.maximum(m, 1e-32))) + 1, 0)
    scale = np.where(m > 1e-32, np.ldexp(1.0, (8 - e).astype(np.int32)), 0.0)
    rgbe = np.zeros((h, w, 4), dtype=np.uint8)
    rgbe[..., :3] = np.clip(img * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(m > 1e-32, e + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n')
        f.write(('-Y %d +X %d\n' % (h, w)).encode())
        f.write(rgbe.tobytes())
