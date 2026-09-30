"""Render native launcher assets from the existing Zoi emblem. No design changes."""
from pathlib import Path
import cairosvg

ASSETS = Path(__file__).resolve().parents[1] / "assets"
mark = (ASSETS / "zoi-emblem.svg").read_text().split('<path', 1)[1].split('/>', 1)[0]
mark = '<path' + mark + '/>'
navy = '#0D1B2A'

def render(name, size, background=None, monochrome=False):
    shape = mark.replace('#D9B26A', '#FFFFFF') if monochrome else mark
    bg = f'<rect width="512" height="512" fill="{background}"/>' if background else ''
    if name == 'android-icon-background.png':
        shape = ''
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg}{shape}</svg>'
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(ASSETS / name), output_width=size, output_height=size)

render('icon.png', 1024, navy)
render('android-icon-foreground.png', 1024)
render('android-icon-background.png', 1024, navy)
render('android-icon-monochrome.png', 1024, monochrome=True)
render('favicon.png', 64, navy)
render('splash-icon.png', 512)
