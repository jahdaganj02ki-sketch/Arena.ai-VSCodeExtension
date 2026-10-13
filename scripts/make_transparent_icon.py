"""Macht den dunklen Hintergrund von resources/arena-icon.png transparent.

Das PNG enthaelt ein weisses Logo auf Slate-900 (#0F172A). Dunkle Pixel
werden transparent, helle bleiben deckend weiss, Kanten werden weich
ueberblendet (gegen Fransen). Ergebnis: RGBA-PNG mit Transparenz.
Verwendung:  python scripts/make_transparent_icon.py
"""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent.parent / "resources" / "arena-icon.png"

BG_CUTOFF = 60   # max(R,G,B) darunter -> voll transparent
FG_FULL = 235    # Helligkeit darueber -> voll deckend

# Heller Balken (z. B. #FAFAFA = (250,250,250)) wird ebenfalls transparent
BG_TOLERANCE = 15
BG_TARGET = (250, 250, 250)

im = Image.open(SRC).convert("RGB")
w, h = im.size
src_px = im.load()

out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
dst_px = out.load()

for y in range(h):
    for x in range(w):
        r, g, b = src_px[x, y]
        bg_dist = max(abs(r - BG_TARGET[0]), abs(g - BG_TARGET[1]), abs(b - BG_TARGET[2]))
        m = r if r >= g and r >= b else (g if g >= b else b)
        if m <= BG_CUTOFF or bg_dist <= BG_TOLERANCE:
            a = 0  # dunkler Hintergrund ODER heller Balken -> transparent
        elif m >= FG_FULL:
            a = 255
        else:
            a = int((m - BG_CUTOFF) * 255 / (FG_FULL - BG_CUTOFF))
        dst_px[x, y] = (255, 255, 255, a)

out.save(SRC)
print("saved:", SRC, out.size, out.mode)
print("corners:",
      out.getpixel((0, 0)),
      out.getpixel((w - 1, 0)),
      out.getpixel((0, h - 1)),
      out.getpixel((w - 1, h - 1)))
