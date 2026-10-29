from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parent
path=root/'Facade-ID_BU.html';source=path.read_text(encoding='utf-8')
backup=path.with_suffix('.before-distribution-charts.html.bak')
if not backup.exists():shutil.copy2(path,backup)
module=(root/'relationship-graphs.js').read_text(encoding='utf-8')
pattern=r'<script>\s*/\* Multiple independent attribute comparisons, using the same filtered collection\. \*/.*?</script>'
text,count=re.subn(pattern,lambda m:'<script>\n'+module+'\n</script>',source,flags=re.S);assert count==1
css=(root/'relationship-graphs.css').read_text(encoding='utf-8')
text=text.replace('</head>','<style>\n'+css+'\n</style>\n</head>')
data=r'<script id="collection-data" type="application/json">(.*?)</script>'
assert re.search(data,source,re.S)[1]==re.search(data,text,re.S)[1]
path.write_text(text,encoding='utf-8');print('Updated BU chart types; saved photos and tags unchanged')
