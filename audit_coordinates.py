"""Audit extraction, embedded inventory, duplicate positions, and EXIF/XMP agreement."""
import collections
import json
import pathlib
import re
from extract_new_photo_locations import gps_from_exif, xmp_location
root=pathlib.Path(__file__).resolve().parent
report=json.loads((root/'new-photo-locations.json').read_text(encoding='utf-8'))
html=(root/'Facade-ID.html').read_text(encoding='utf-8')
embedded=json.loads(re.search(r'<script id="collection-data" type="application/json">(.*?)</script>',html,re.S)[1])
groups=collections.defaultdict(list)
for name,loc in report['locations'].items():groups[(loc['lat'],loc['lng'])].append(name)
conflicts=[]
for file in sorted((root/'images/images all/New Photos').glob('*.jpg')):
    locations=[]
    with file.open('rb') as stream:
        stream.read(2)
        while stream.read(1)==b'\xff':
            marker=stream.read(1)
            while marker==b'\xff':marker=stream.read(1)
            if marker in (b'',b'\xda',b'\xd9'):break
            length=int.from_bytes(stream.read(2),'big');segment=stream.read(length-2)
            if marker!=b'\xe1':continue
            if segment.startswith(b'Exif\0\0'):loc=gps_from_exif(b'\0'*4+segment[6:])
            elif segment.startswith(b'http://ns.adobe.com/xap/1.0/\0'):loc=xmp_location(segment)
            else:continue
            if loc:locations.append(loc)
    if locations and any(abs(loc['lat']-locations[0]['lat'])>1e-6 or abs(loc['lng']-locations[0]['lng'])>1e-6 for loc in locations):conflicts.append({'file':file.name,'locations':locations})
mismatches=[p['id'] for p in embedded['photos'] if p.get('location')!=report['locations'].get(p['name'])]
out={'photos':len(embedded['photos']),'withGps':len(report['locations']),'withoutGps':list(report['missing']),'uniqueLocations':len(groups),'embeddedMismatches':mismatches,'exifXmpConflicts':conflicts,'sharedLocations':[{'lat':loc[0],'lng':loc[1],'photos':names} for loc,names in sorted(groups.items(),key=lambda item:-len(item[1])) if len(names)>1]}
(root/'coordinate-audit.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in out.items() if k!='sharedLocations'},indent=2))
print('Largest shared-location groups:',json.dumps(out['sharedLocations'][:8],indent=2))
