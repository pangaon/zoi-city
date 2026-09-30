"""Deterministic native exports of the approved raster Zoi logo; no redesign."""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'mobile/assets'
records = {}


def mark(kind):
    path = ROOT / f'assets/brand/zoi-blue-olive-{kind}-master.png'
    image = Image.open(path).convert('RGBA')
    bounds = image.getchannel('A').point(lambda a: 255 if a > 1 else 0).getbbox()
    bounds = (bounds[0]-8, bounds[1]-8, bounds[2]+8, bounds[3]+8)
    records[kind] = {'source': str(path.relative_to(ROOT)),
                     'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'crop': bounds}
    return image.crop(bounds)


def square(image, size, coverage, background=(0, 0, 0, 0)):
    out = Image.new('RGBA', (size, size), background)
    artwork = image.copy()
    artwork.thumbnail((round(size*coverage), round(size*coverage)), Image.Resampling.LANCZOS)
    out.alpha_composite(artwork, ((size-artwork.width)//2, (size-artwork.height)//2))
    return out


gloss, flat = mark('gloss'), mark('flat')
square(gloss, 1024, .84, (255, 255, 255, 255)).convert('RGB').save(ASSETS/'icon.png', optimize=True)
foreground = square(flat, 1024, 66/108)
foreground.save(ASSETS/'android-icon-foreground.png', optimize=True)
Image.new('RGB', (1024, 1024), 'white').save(ASSETS/'android-icon-background.png', optimize=True)
monochrome = Image.new('RGBA', foreground.size, 'white')
monochrome.putalpha(foreground.getchannel('A'))
monochrome.save(ASSETS/'android-icon-monochrome.png', optimize=True)
square(flat, 64, .92).save(ASSETS/'favicon.png', optimize=True)
square(gloss, 512, .84).save(ASSETS/'splash-icon.png', optimize=True)
records['notes'] = [
    'Raster sources; no vector recreation.',
    'Adaptive foreground/monochrome bounded to centered 66/108 safe area.',
    'Opaque white iOS/standard icon and Android background.',
    'Monochrome RGB is white; only source alpha silhouette retained for OS tint.',
    'Splash file exported but currently not configured as an Expo splash plugin.',
    'Native build/install/device checks not performed.',
]
(ASSETS/'brand-source-manifest.json').write_text(json.dumps(records, indent=2)+'\n')
