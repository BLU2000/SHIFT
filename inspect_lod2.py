"""Inspect local CityGML content and coverage of photo GPS positions."""
import collections
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
def utm32(lat,lng):
    a=6378137.;e2=.0066943800229;k=.9996
    phi=math.radians(lat);lam=math.radians(lng-9);ep=e2/(1-e2)
    n=a/math.sqrt(1-e2*math.sin(phi)**2);t=math.tan(phi)**2;c=ep*math.cos(phi)**2;aa=math.cos(phi)*lam
    m=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*phi-(3*e2/8+3*e2**2/32+45*e2**3/1024)*math.sin(2*phi)+(15*e2**2/256+45*e2**3/1024)*math.sin(4*phi)-(35*e2**3/3072)*math.sin(6*phi))
    x=k*n*(aa+(1-t+c)*aa**3/6+(5-18*t+t*t+72*c-58*ep)*aa**5/120)+500000
    y=k*(m+n*math.tan(phi)*(aa*aa/2+(5-t+9*c+4*c*c)*aa**4/24+(61-58*t+t*t+600*c-330*ep)*aa**6/720))
    return x,y
locations=json.loads((ROOT/'new-photo-locations.json').read_text())['locations']
report=[]
for path in sorted((ROOT/'LOD2').glob('*.gml')):
    counts=collections.Counter();envelope=None;codes=set();cities=set();streets=set()
    for event,element in ET.iterparse(path,events=['end']):
        tag=element.tag.rsplit('}',1)[-1];counts[tag]+=1
        if tag=='Envelope' and envelope is None:
            children=list(element);envelope={'srs':element.get('srsName'),'lower':[float(v) for v in children[0].text.split()],'upper':[float(v) for v in children[1].text.split()]}
        if tag=='stringAttribute' and element.get('name')=='Gemeindeschluessel':codes.add(next(iter(element)).text)
        if tag=='LocalityName' and element.text:cities.add(element.text)
        if tag=='ThoroughfareName' and element.text:streets.add(element.text)
        if tag=='cityObjectMember':element.clear()
    covered=[]
    for name,loc in locations.items():
        x,y=utm32(loc['lat'],loc['lng']);lo,hi=envelope['lower'],envelope['upper']
        if lo[0]<=x<=hi[0] and lo[1]<=y<=hi[1]:covered.append(name)
    result={'file':path.name,'bytes':path.stat().st_size,'envelope':envelope,'buildings':counts['Building'],'buildingParts':counts['BuildingPart'],'wallSurfaces':counts['WallSurface'],'roofSurfaces':counts['RoofSurface'],'groundSurfaces':counts['GroundSurface'],'lod2Solid':counts['lod2Solid'],'lod2MultiSurface':counts['lod2MultiSurface'],'municipalityCodes':sorted(codes),'cities':sorted(cities),'streetExamples':sorted(streets)[:12],'photoGpsWithinEnvelope':len(covered),'coveredPhotoIds':covered}
    report.append(result);print(json.dumps({k:v for k,v in result.items() if k!='coveredPhotoIds'},ensure_ascii=False,indent=2))
(ROOT/'LOD2'/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
