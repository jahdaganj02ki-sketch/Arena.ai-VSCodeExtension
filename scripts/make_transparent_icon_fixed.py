import subprocess
from pathlib import Path

# Original-PNG aus Git-Historie holen (dunkel, weißes Logo)
data = subprocess.check_output(['git', 'show', 'HEAD:resources/arena-icon.png'])
Path('resources/arena-icon.png').write_bytes(data)
print('restored original from git:', len(data), 'bytes')

# Jetzt das Skript ausführen: dunkler Hintergrund -> transparent, helles Logo -> weiß
SRC = Path('resources/arena-icon.png')
from PIL import Image

BG_CUTOFF = 60
FG_FULL = 235
BG_TOLERANCE = 12
# Balken ist helles Grau (#FAFAFA), aber NICHT reines Weiß (das ist das Logo)
BG_TARGET = (250, 250, 250)
WHITE = (255, 255, 255)  # reines Weiß = Logoanteil, behalten

im = Image.open(SRC).convert('RGB')
w, h = im.size
src_px = im.load()
out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
dst_px = out.load()

bar = 0
for y in range(h):
    for x in range(w):
        r, g, b = src_px[x, y]
        bg_dist = max(abs(r - BG_TARGET[0]), abs(g - BG_TARGET[1]), abs(b - BG_TARGET[2]))
        m = r if r >= g and r >= b else (g if g >= b else b)
        if m <= BG_CUTOFF or (bg_dist <= BG_TOLERANCE and m < 250):
            a = 0
            if bg_dist <= BG_TOLERANCE and m > BG_CUTOFF:
                bar += 1
        elif m >= FG_FULL:
            a = 255
        else:
            a = int((m - BG_CUTOFF) * 255 / (FG_FULL - BG_CUTOFF))
        dst_px[x, y] = (255, 255, 255, a)

out.save(SRC)
print('saved:', w, h, out.mode)
print('bar pixels:', bar)
print('corners:', out.getpixel((0, 0)), out.getpixel((w - 1, h - 1)))
print('left-center:', out.getpixel((0, 256)))
print('center:', out.getpixel((256, 256)))
