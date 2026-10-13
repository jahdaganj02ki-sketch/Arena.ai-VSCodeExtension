from PIL import Image
import os, glob

im = Image.open('resources/arena-icon.png').convert('RGBA')
w, h = im.size
opaque = [(x, y) for y in range(h) for x in range(w) if im.getpixel((x, y))[3] > 0]
if opaque:
    xs = [p[0] for p in opaque]
    ys = [p[1] for p in opaque]
    print(f'opaque bbox: x=[{min(xs)},{max(xs)}] y=[{min(ys)},{max(ys)}] size={im.size}')
    print(f'opaque pixel count: {len(opaque)}')
    semi = [(x, y) for (x, y) in opaque if 0 < im.getpixel((x, y))[3] < 255]
    print(f'semi-transparent: {len(semi)}')
else:
    print('No opaque pixels!')

paths = glob.glob(os.path.expandvars(r'%USERPROFILE%\.vscode\extensions\arena-ai.arena-ai-vscode-0.1.0\resources\arena-activitybar*.svg'))
print('installed activitybar icons:', paths)
for p in paths:
    print(f'  {os.path.basename(p)}: len={os.path.getsize(p)} bytes')
