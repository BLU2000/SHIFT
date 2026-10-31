"""Embed the small, standalone results importer into HTML 17; preserve embedded photos."""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
target = root.parent / 'Facade-ID_BU_v017.html'
text = target.read_text(encoding='utf-8')
for tag, file, marker, end in [('script', 'integration-v017.js', 'segformer-integration', '</body>'), ('style', 'integration-v017.css', 'segformer-integration-style', '</head>')]:
    block = f'<{tag} id="{marker}">' + (root / file).read_text(encoding='utf-8') + f'</{tag}>'
    pattern = rf'<{tag} id="{marker}">[\s\S]*?</{tag}>'
    if re.search(pattern, text):
        text = re.sub(pattern, lambda _: block, text)
    else:
        text = text.replace(end, block + end)
geometry = '<script id="segformer-rect-geometry">' + (root / 'rect_geometry.js').read_text(encoding='utf-8') + '</script>'
text = re.sub(r'<script id="segformer-rect-geometry">[\s\S]*?</script>', '', text)
text = text.replace('<script id="segformer-integration">', geometry + '<script id="segformer-integration">')
target.write_text(text, encoding='utf-8')
