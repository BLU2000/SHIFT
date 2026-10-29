"""Preserve v005 saved data while adding reusable building-type numbers."""
from pathlib import Path
import re
import shutil
root=Path(__file__).resolve().parent
target=root/'Facade-ID_BU_v005.html'
if not target.exists():shutil.copy2(Path.home()/'Downloads'/'Facade-ID_BU_v005.html',target)
module=(root/'building-types.js').read_text(encoding='utf-8')
for path in [root/'index.html',target]:
    source=path.read_text(encoding='utf-8');text=source
    if 'function buildingTypeMarkup()' in source or 'data-building-types' in source:continue
    if path.name=='index.html':text=text.replace('<script data-photo-upload','<script data-building-types src="building-types.js"></script>\n<script data-photo-upload')
    else:
        backup=path.with_suffix('.before-building-types.html.bak')
        if not backup.exists():shutil.copy2(path,backup)
        text=text.replace('<script id="collection-data"','<script>\n'+module+'\n</script>\n<script id="collection-data"')
    anchor='function formContent(r){if(step===0)return `'
    assert anchor in text,'Cannot find first form stage'
    text=text.replace(anchor,anchor+'${buildingTypeMarkup()}')
    # Show the assigned number in the final review too.
    anchor='${summaryRows(r.context,contextFields)}'
    assert anchor in text
    text=text.replace(anchor,'<div class="review-row"><b>Building type number</b><span>${r.buildingType?esc(r.buildingType):\'Not assigned\'}</span></div>'+anchor)
    if path.name!='index.html':
        pattern=r'<script id="collection-data" type="application/json">(.*?)</script>'
        assert re.search(pattern,source,re.S)[1]==re.search(pattern,text,re.S)[1],'Saved data changed'
    path.write_text(text,encoding='utf-8')
    print('Updated',path.name,'with existing saved tags unchanged')
