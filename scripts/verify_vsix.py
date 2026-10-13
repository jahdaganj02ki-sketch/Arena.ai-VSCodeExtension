import zipfile
from PIL import Image
import io

z = zipfile.ZipFile('arena-ai-vscode-0.1.0.vsix')

# PNG transparent?
png = z.read('extension/resources/arena-icon.png')
im = Image.open(io.BytesIO(png))
print('PNG mode:', im.mode, 'size:', im.size)
print('corners:', im.getpixel((0,0)), im.getpixel((511,511)))
print('center:', im.getpixel((256,256)))

print()
print('=== activitybar-dark ===')
print(z.read('extension/resources/arena-activitybar-dark.svg').decode()[:300])

print()
print('=== chatProvider new code ===')
pv = z.read('extension/out/chat/arenaChatViewProvider.js').decode('utf-8', errors='replace')
for kw in ['agentFrame', 'loading', 'allow-popups-to-escape-sandbox', 'Falls die Seite nicht eingebettet', 'openAgent']:
    print(f'  {kw:40s} ->', 'YES' if kw in pv else 'NO')
