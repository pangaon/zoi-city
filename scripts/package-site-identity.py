"""Deterministic raster packaging of the supplied Zoi logo; no tracing or redesign."""
from pathlib import Path
from PIL import Image
import hashlib, json
ROOT=Path(__file__).resolve().parents[1]
BRAND=ROOT/'assets/brand'; ICONS=ROOT/'assets/icons'
def source(kind):
    path=BRAND/f'zoi-blue-olive-{kind}-master.png'
    image=Image.open(path).convert('RGBA')
    # Ignore alpha=1 encoding noise only for bounds, preserving pixels within crop.
    box=image.getchannel('A').point(lambda a:255 if a>1 else 0).getbbox()
    box=(max(0,box[0]-8),max(0,box[1]-8),min(image.width,box[2]+8),min(image.height,box[3]+8))
    return image.crop(box), {'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'crop':box}
def square(image,size,coverage=.92,background=(0,0,0,0)):
    result=Image.new('RGBA',(size,size),background);mark=image.copy();mark.thumbnail((round(size*coverage),round(size*coverage)),Image.Resampling.LANCZOS)
    result.alpha_composite(mark,((size-mark.width)//2,(size-mark.height)//2));return result
gloss,g=source('gloss');flat,f=source('flat')
gloss.thumbnail((512,512),Image.Resampling.LANCZOS);gloss.save(BRAND/'zoi-logo.png',optimize=True)
for size in (16,32,64):square(flat,size).save(BRAND/f'favicon-{size}.png',optimize=True)
square(flat,256).save(ROOT/'favicon.ico',format='ICO',sizes=[(x,x)for x in(16,24,32,48,64,128,256)])
for size in(192,512):
    square(flat,size).save(ICONS/f'icon-{size}.png',optimize=True)
    square(flat,size,.68,(255,255,255,255)).save(ICONS/f'maskable-{size}.png',optimize=True)
square(flat,180,.86,(255,255,255,255)).save(ICONS/'apple-touch-icon.png',optimize=True)
(BRAND/'source-manifest.json').write_text(json.dumps({'format':'Raster PNG masters and deterministic resized PNG/ICO derivatives; not vector artwork.','gloss':g,'flat':f},indent=2)+'\n')
