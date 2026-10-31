"""Embed latest per-photo measurements in HTML 17 without replacing manual records."""
import hashlib
import json
from pathlib import Path
import re
import zipfile
from datetime import datetime, timezone
from bundles import svg_and_measurement

ROOT=Path(__file__).resolve().parent


if __name__=='__main__':
    path=ROOT.parent/'Facade-ID_BU_v017.html'
    text=path.read_text(encoding='utf-8')
    match=re.search(r'(<script[^>]*id="collection-data"[^>]*>)([\s\S]*?)(</script>)',text)
    data=json.loads(match[2])
    ids={p['id'] for p in data['photos']}
    rows=[]
    for file in sorted((ROOT/'results'/'interactive').glob('*.wwr.zip')):
        raw=file.read_bytes()
        with zipfile.ZipFile(file) as archive:row=json.loads(archive.read('result.json'))
        if row.get('photo_id') not in ids:raise ValueError('Unmatched photo '+str(row.get('photo_id')))
        _,computed=svg_and_measurement(row['vector_measurement'])
        if abs(computed['wwr_percent']-row['vector_measurement']['wwr_percent'])>1e-6:raise ValueError('Invalid rectangle ratio: '+row['photo_id'])
        row['source_bundle_revision']=hashlib.sha256(raw).hexdigest()
        row['source_bundle_modified_at']=datetime.fromtimestamp(file.stat().st_mtime,timezone.utc).isoformat()
        rows.append(row)
    if len(rows)!=len(ids) or len({r['photo_id'] for r in rows})!=len(ids):raise ValueError('Missing or duplicate saved results.')
    payload={'format':'facade-segformer-results','version':1,'dataset':data['dataset'],'results':rows}
    (ROOT/'results'/'completed-wwr.json').write_text(json.dumps(payload),encoding='utf-8')
    # Only measurement fields are embedded. Runtime merges them after browser answers restore.
    data['segformerResults']={**payload,'results':[{k:v for k,v in row.items() if k!='mask_preview'} for row in rows]}
    before_records=json.dumps(data.get('records',{}),sort_keys=True)
    packed=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    updated=text[:match.start(2)]+packed+text[match.end(2):]
    check=json.loads(re.search(r'<script[^>]*id="collection-data"[^>]*>([\s\S]*?)</script>',updated)[1])
    assert json.dumps(check.get('records',{}),sort_keys=True)==before_records
    path.write_text(updated,encoding='utf-8')
    print(f'Embedded {len(rows)} ratios; manual record data unchanged. Verified: {sum(r.get("verified") is True for r in rows)}.')
