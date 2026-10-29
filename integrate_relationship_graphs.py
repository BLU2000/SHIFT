from pathlib import Path
import re,shutil
root=Path(__file__).resolve().parent
filterpath=root/'analysis-filters.js';filters=filterpath.read_text(encoding='utf-8')
filters=filters.replace("mode:'both'},filterSearchTimer", "mode:'both',graphs:[]},filterSearchTimer")
filters=filters.replace("analysisFilters.search=typeof value.search", "analysisFilters.graphs=restoreRelationshipGraphs(value.graphs);\n  analysisFilters.search=typeof value.search")
filters=filters.replace('</nav><section id="analysisMapSection"', '</nav><div class="comparison-toolbar"><button id="addRelationshipGraph">+ Add graph</button></div><div id="relationshipGraphs"></div><section id="analysisMapSection"')
filters=filters.replace('  applyAnalysisView();','  applyAnalysisView();renderComparisonGraphs();')
filters=filters.replace("mode:analysisFilters.mode||'both'}", "mode:analysisFilters.mode||'both',graphs:analysisFilters.graphs||[]}")
filterpath.write_text(filters,encoding='utf-8')
module=(root/'relationship-graphs.js').read_text(encoding='utf-8');css=(root/'relationship-graphs.css').read_text(encoding='utf-8')
for path in [root/'index.html',root/'Facade-ID_BU.html']:
    source=path.read_text(encoding='utf-8');text=source
    if path.name=='index.html':
        text=text.replace('<script data-analysis-filters','<script data-relationship-graphs src="relationship-graphs.js"></script>\n<script data-analysis-filters')
        text=text.replace('</head>','<link data-relationship-style rel="stylesheet" href="relationship-graphs.css">\n</head>')
    else:
        backup=path.with_suffix('.before-relationship-graphs.html.bak')
        if not backup.exists():shutil.copy2(path,backup)
        pattern=r'<script>\s*/\* Attribute filtering of photographs, including same-type matching for heterogeneous facades\. \*/.*?</script>'
        text,count=re.subn(pattern,lambda m:'<script>\n'+filters+'\n</script>',text,flags=re.S);assert count==1
        text=text.replace('<script id="collection-data"','<script>\n'+module+'\n</script>\n<script id="collection-data"')
        text=text.replace('</head>','<style>\n'+css+'\n</style>\n</head>')
    data=r'<script id="collection-data" type="application/json">(.*?)</script>'
    assert re.search(data,source,re.S)[1]==re.search(data,text,re.S)[1]
    path.write_text(text,encoding='utf-8');print('Updated',path.name,'without changing saved tags')
