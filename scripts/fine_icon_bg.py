from PIL import Image, ImageDraw
import os

# Load current transparent PNG
im = Image.open('resources/arena-icon.png').convert('RGBA')
w, h = im.size

# Create new image with semi-transparent light gray background (very light)
# This prevents the "white bar" artifact in marketplace rendering
bg_color = (250, 250, 250, 20)  # nearly transparent light gray
out = Image.new('RGBA', (w, h), bg_color)
# Composite the transparent icon on top
out = Image.alpha_composite(out, im)
out.save('resources/arena-icon.png', 'PNG')
print(f'Saved: resources/arena-icon.png ({w}x{h}, RGBA)')
print(f'corners: {out.getpixel((0,0))}, {out.getpixel((w-1,h-1))}')
print(f'center: {out.getpixel((w//2,h//2))}')
