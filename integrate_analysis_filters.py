from pathlib import Path
import re
import shutil
root=Path(__file__).resolve().parent
module=(root/'analysis-filters.js').read_text(encoding='utf-8');css=(root/'analysis-filters.css').read_text(encoding='utf-8')
for path in [root/'index.html',root/'Facade-ID_BU.html']:
    original=path.read_text(encoding='utf-8');text=original
    if path.name=='index.html':
        text=text.replace('<script data-analysis-charts','<script data-analysis-filters src="analysis-filters.js"></script>\n<script data-analysis-charts')
        text=text.replace('</head>','<link data-analysis-filters-style rel="stylesheet" href="analysis-filters.css">\n</head>')
    else:
        backup=path.with_suffix('.before-analysis-filters.html.bak')
        if not backup.exists():shutil.copy2(path,backup)
        text=text.replace('<script id="collection-data"','<script>\n'+module+'\n</script>\n<script id="collection-data"')
        text=text.replace('</head>','<style>\n'+css+'\n</style>\n</head>')
    text,count=re.subn(r'^function renderInsights\(\).*$', 'function renderInsights(){renderFilterAnalysis();}',text,flags=re.M)
    assert count==1
    text=text.replace('saveMeta,analysisSettings,uploadedPhotos:','saveMeta,analysisSettings,analysisFilters,uploadedPhotos:')
    text=text.replace('analysisSettings:{...analysisSettings},dataset:', 'analysisSettings:{...analysisSettings},analysisFilters:structuredClone(analysisFilters),dataset:')
    text=text.replace('restoreAnalysisSettings(embedded.analysisSettings);','restoreAnalysisSettings(embedded.analysisSettings);restoreAnalysisFilters(embedded.analysisFilters);')
    text=text.replace('restoreAnalysisSettings(s.analysisSettings);','restoreAnalysisSettings(s.analysisSettings);restoreAnalysisFilters(s.analysisFilters);')
    pattern=r'<script id="collection-data" type="application/json">(.*?)</script>'
    assert re.search(pattern,original,re.S)[1]==re.search(pattern,text,re.S)[1]
    path.write_text(text,encoding='utf-8');print('Updated',path.name,'with all saved data preserved')
