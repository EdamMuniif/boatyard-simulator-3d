#!/usr/bin/env python3
"""Build the skin/fabric relief normal map for the textured character.

Reads the colour atlas embedded in assets/characters/boatyard-worker.glb and
writes assets/characters/boatyard-worker-relief.jpg. Run it again whenever
that model's texture changes:

    python3 tools/build-relief-map.py

Height = high-pass luminance (creases, stubble, fabric weave; never the large
painted shading) plus light pore noise on skin. Normals from central
differences. Matches the game's UV convention (v down, flipY = false).
Needs numpy and Pillow.
"""
import io, json, struct, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
GLB = ROOT / 'assets/characters/boatyard-worker.glb'
OUT = ROOT / 'assets/characters/boatyard-worker-relief.jpg'
STRENGTH, PORE, RADIUS = 2.2, 0.035, 5

def atlas_from_glb(path):
    b = path.read_bytes()
    jlen = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jlen])
    binstart = 20 + jlen + 8
    view = j['bufferViews'][j['images'][0]['bufferView']]
    start = binstart + view.get('byteOffset', 0)
    return Image.open(io.BytesIO(b[start:start + view['byteLength']])).convert('RGB')

def box_blur(a, r):
    pad = np.pad(a, r, mode='edge')
    s = pad.cumsum(0).cumsum(1)
    s = np.pad(s, ((1, 0), (1, 0)))
    k = 2 * r + 1
    h, w = a.shape
    return (s[k:k + h, k:k + w] - s[0:h, k:k + w] - s[k:k + h, 0:w] + s[0:h, 0:w]) / (k * k)

def main():
    rgb = np.asarray(atlas_from_glb(GLB), dtype=np.float64) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    skin = ((r - b > 0.12) & (r > g) & (lum > 0.18)).astype(np.float64)
    rng = np.random.default_rng(1337)
    height = (lum - box_blur(lum, RADIUS)) + (rng.random(lum.shape) - 0.5) * PORE * skin
    hp = np.pad(height, 1, mode='edge')
    dx = (hp[1:-1, 2:] - hp[1:-1, :-2]) * STRENGTH
    dy = (hp[2:, 1:-1] - hp[:-2, 1:-1]) * STRENGTH
    length = np.sqrt(dx * dx + dy * dy + 1)
    n = np.stack([-dx / length, dy / length, 1 / length], -1) * 0.5 + 0.5
    Image.fromarray((n * 255).round().astype(np.uint8)).save(OUT, quality=90, optimize=True, subsampling=0)
    print(f'wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)')

if __name__ == '__main__':
    main()
