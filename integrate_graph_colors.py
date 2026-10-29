from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parent
p=root/'relationship-graphs.js';s=p.read_text(encoding='utf-8')
s=s.replace("attribute:typeof g.attribute==='string'?g.attribute:g.x}","attribute:typeof g.attribute==='string'?g.attribute:g.x,colorEnabled:!!g.colorEnabled,colorStyle:g.colorStyle==='categories'?'categories':'gradient',colorAxis:g.colorAxis==='y'?'y':'x'}")
s=s.replace("fill=\"#002FA7\" fill-opacity=\".8\"", "fill=\"${graph.colorEnabled?graphColorFor(graph,group[0][graph.colorAxis==='y'?'y':'x'].label):'#002FA7'}\" fill-opacity=\"${graph.colorEnabled?1:.8}\"")
s=s.replace("</div>${isDistribution?'':'<p class=\"hint\">", "</div>${graphColorControls(graph)}${isDistribution?'':'<p class=\"hint\">")
s=s.replace("  }).join('');\n}\n\ndocument.addEventListener", "  }).join('');refreshMapColors();\n}\n\ndocument.addEventListener",1)
s=s.replace('height="26" fill="#002FA7"','height="26" fill="${graph.colorEnabled?graphColorFor(graph,b.label):\'#002FA7\'}"')
s=s.replace("color=colors[i%colors.length],opacity=[1,1,.65,.65,.35,.35][i%6]", "color=graph.colorEnabled?graphColorFor(graph,b.label):colors[i%colors.length],opacity=graph.colorEnabled?1:[1,1,.65,.65,.35,.35][i%6]")
s=s.replace('background:${colors[i%6]};opacity:${[1,1,.65,.65,.35,.35][i%6]}', "background:${graph.colorEnabled?graphColorFor(graph,b.label):colors[i%6]};opacity:${graph.colorEnabled?1:[1,1,.65,.65,.35,.35][i%6]}")
p.write_text(s,encoding='utf-8')
p=root/'map-picker.js';s=p.read_text(encoding='utf-8')
s=s.replace("element.type='button';element.className='overview-marker';", "element.type='button';element.dataset.colorPhotoIds=JSON.stringify(group.map(p=>p.id));element.className='overview-marker';")
s=s.replace('    fitOverviewPhotos();', '    fitOverviewPhotos();refreshMapColors();')
p.write_text(s,encoding='utf-8')
modules=[('relationship-graphs.js',r'Multiple independent attribute comparisons, using the same filtered collection\.'),('map-picker.js',r'OpenFreeMap \+ MapLibre location picker\. Application records stay local\.')]
for p in [root/'index.html',root/'Facade-ID_BU.html']:
    original=p.read_text(encoding='utf-8');s=original
    if p.name=='index.html':
        s=s.replace('<script data-relationship-graphs','<script data-graph-colors src="graph-colors.js"></script>\n<script data-relationship-graphs')
        s=s.replace('</head>','<link data-graph-colors-style rel="stylesheet" href="graph-colors.css">\n</head>')
    else:
        backup=p.with_suffix('.before-graph-colors.html.bak')
        if not backup.exists():shutil.copy2(p,backup)
        for filename,comment in modules:
            module=(root/filename).read_text(encoding='utf-8')
            pattern=r'<script>\s*/\* '+comment+r' \*/.*?</script>'
            s,count=re.subn(pattern,lambda m:'<script>\n'+module+'\n</script>',s,flags=re.S);assert count==1,filename
        module=(root/'graph-colors.js').read_text(encoding='utf-8')
        s=s.replace('<script id="collection-data"','<script>\n'+module+'\n</script>\n<script id="collection-data"')
        s=s.replace('</head>','<style>\n'+(root/'graph-colors.css').read_text(encoding='utf-8')+'\n</style>\n</head>')
    data=r'<script id="collection-data" type="application/json">(.*?)</script>'
    assert re.search(data,original,re.S)[1]==re.search(data,s,re.S)[1]
    p.write_text(s,encoding='utf-8');print('Updated',p.name,'with saved data unchanged')
