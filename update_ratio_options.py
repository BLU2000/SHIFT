"""Update ratio choices, including the tagged BU copy, without changing saved data."""
from pathlib import Path
import re
import shutil

ROOT=Path(__file__).resolve().parent
changes=[
    ("['0','¼','⅓','½','1']", "['0','¼','⅓','½','⅔','¾','1']"),
    ("'⅓':1/3,'½':.5,'1':1", "'⅓':1/3,'½':.5,'⅔':2/3,'¾':.75,'1':1"),
    ("[0,.25,.5,.75,1].map(v=>({value:v,label:String(v)}))", "[{value:0,label:'0'},{value:.25,label:'¼'},{value:1/3,label:'⅓'},{value:.5,label:'½'},{value:2/3,label:'⅔'},{value:.75,label:'¾'},{value:1,label:'1'}]"),
]
for name in ['index.html','analysis-charts.js','Facade-ID_BU.html']:
    path=ROOT/name
    text=path.read_text(encoding='utf-8')
    updated=text
    for old,new in changes:updated=updated.replace(old,new)
    if name.endswith('_BU.html'):
        pattern=r'(<script id="collection-data" type="application/json">)(.*?)(</script>)'
        before=re.search(pattern,text,re.S);after=re.search(pattern,updated,re.S)
        assert before and after and before[2]==after[2], 'Saved BU collection must remain unchanged'
        backup=path.with_suffix('.html.bak')
        if not backup.exists():shutil.copy2(path,backup)
    path.write_text(updated,encoding='utf-8')
    print(name+': updated; saved collection preserved' if name.endswith('_BU.html') else name+': updated')
