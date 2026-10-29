"""Refresh the BU analysis module without changing saved photographs or answers."""
from pathlib import Path
import re
import shutil
root=Path(__file__).resolve().parent
path=root/'Facade-ID_BU.html'
source=path.read_text(encoding='utf-8');text=source
backup=path.with_suffix('.before-gallery.html.bak')
if not backup.exists():shutil.copy2(path,backup)
module=(root/'analysis-filters.js').read_text(encoding='utf-8')
pattern=r'<script>\s*/\* Attribute filtering of photographs, including same-type matching for heterogeneous facades\. \*/.*?</script>'
text,count=re.subn(pattern,lambda match:'<script>\n'+module+'\n</script>',text,flags=re.S)
assert count==1,'Cannot locate BU filter module'
css=(root/'analysis-filters.css').read_text(encoding='utf-8')
text=text.replace('</head>','<style>\n'+css+'\n</style>\n</head>')
for p in [root/'index.html',path]:
    current=p.read_text(encoding='utf-8') if p.name=='index.html' else text
    anchor="clone.querySelector('#main').innerHTML='';"
    assert anchor in current
    current=current.replace(anchor,anchor+"clone.querySelector('#galleryPreview')?.remove();")
    if p==path:
        data=r'<script id="collection-data" type="application/json">(.*?)</script>'
        assert re.search(data,source,re.S)[1]==re.search(data,current,re.S)[1],'BU saved data must remain unchanged'
    p.write_text(current,encoding='utf-8')
print('Updated BU gallery and export cleanup; saved collection unchanged')
