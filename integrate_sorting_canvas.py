"""Replace manual number selection with the visual sorting canvas, preserving saved data."""
from pathlib import Path
import re
import shutil
root=Path(__file__).resolve().parent
old_module=(root/'building-types.js').read_text(encoding='utf-8')
# Keep grouping helpers but remove the manual field and its handlers.
new_module=old_module.split('function buildingTypeMarkup(){')[0]
sort_module=(root/'sorting-canvas.js').read_text(encoding='utf-8')
css=(root/'sorting-canvas.css').read_text(encoding='utf-8')
for path in [root/'index.html',root/'Facade-ID_BU.html']:
    original=path.read_text(encoding='utf-8');text=original
    if 'data-sorting-canvas' in text or 'function renderSortingCanvas()' in text:continue
    if path.name=='index.html':
        text=text.replace('<script data-building-types', '<script data-sorting-canvas src="sorting-canvas.js"></script>\n<script data-building-types')
        text=text.replace('</head>','<link data-sorting-style rel="stylesheet" href="sorting-canvas.css">\n</head>')
    else:
        backup=path.with_suffix('.before-sorting-canvas.html.bak')
        if not backup.exists():shutil.copy2(path,backup)
        assert old_module in text
        text=text.replace(old_module,new_module)
        text=text.replace('<script id="collection-data"','<script>\n'+sort_module+'\n</script>\n<script id="collection-data"')
        text=text.replace('</head>','<style>\n'+css+'\n</style>\n</head>')
    assert '${buildingTypeMarkup()}' in text
    text=text.replace('${buildingTypeMarkup()}','')
    assert "if(view==='insights'){" in text
    text=text.replace("if(view==='insights'){", "if(view==='sorting'){renderSortingCanvas();return;}if(view==='insights'){")
    text=text.replace('<button id="addPhotos"','<button id="sortPhotos" class="full" style="margin:6px 0 8px">Sort into categories</button><button id="addPhotos"')
    pattern=r'<script id="collection-data" type="application/json">(.*?)</script>'
    assert re.search(pattern,original,re.S)[1]==re.search(pattern,text,re.S)[1]
    path.write_text(text,encoding='utf-8');print('Updated',path.name,'with saved data preserved')
(root/'building-types.js').write_text(new_module,encoding='utf-8')
