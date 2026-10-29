"""Extract EXIF GPS from the replacement JPEG batch locally."""
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from extract_locations import gps_from_exif

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT/'images'/'images all'/'New Photos'

def xmp_location(segment):
    root=ET.fromstring(segment.split(b'\0',1)[1].strip(b'\0 \r\n'))
    tags={}
    for element in root.iter():
        tags[element.tag.rsplit('}',1)[-1]]=element.text
        tags.update({k.rsplit('}',1)[-1]:v for k,v in element.attrib.items()})
    if not tags.get('GPSLatitude') or not tags.get('GPSLongitude'):return None
    def coordinate(raw,limit):
        numbers=[float(v) for v in re.findall(r'[-+]?\d+(?:\.\d+)?',raw)]
        if not 1<=len(numbers)<=3:raise ValueError('Invalid XMP GPS')
        result=abs(numbers[0])+sum(value/(60**i) for i,value in enumerate(numbers[1:],1))
        if numbers[0]<0 or raw.strip().upper().endswith(('S','W')):result=-result
        if not abs(result)<=limit:raise ValueError('Invalid XMP GPS bounds')
        return round(result,7)
    return {'lat':coordinate(tags['GPSLatitude'],90),'lng':coordinate(tags['GPSLongitude'],180),'source':'Photo GPS metadata (XMP)'}

def jpeg_location(path):
    with path.open('rb') as stream:
        if stream.read(2)!=b'\xff\xd8':raise ValueError('Not a JPEG')
        while True:
            if stream.read(1)!=b'\xff':return None
            marker=stream.read(1)
            while marker==b'\xff':marker=stream.read(1)
            if marker in (b'',b'\xda',b'\xd9'):return None
            if marker in (b'\x01',)+tuple(bytes([i]) for i in range(0xd0,0xd8)):continue
            size=int.from_bytes(stream.read(2),'big')
            if size<2:raise ValueError('Invalid JPEG segment')
            segment=stream.read(size-2)
            if marker==b'\xe1' and segment.startswith(b'Exif\0\0'):
                location=gps_from_exif(b'\0\0\0\0'+segment[6:])
                if location:return location
            if marker==b'\xe1' and segment.startswith(b'http://ns.adobe.com/xap/1.0/\0'):
                location=xmp_location(segment)
                if location:return location

def main():
    found,missing,errors={},{},{}
    files=sorted(SOURCE.glob('*.jpg'))
    if not files:raise RuntimeError('No new photos found')
    for path in files:
        try:
            location=jpeg_location(path)
            if location:found[path.stem]=location
            else:missing[path.name]='No EXIF GPS coordinates'
        except Exception as error:errors[path.name]=str(error)
    report={'source':'images/images all/New Photos','total':len(files),'locations':found,'missing':missing,'errors':errors}
    (ROOT/'new-photo-locations.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f'New photos: {len(files)}; GPS: {len(found)}; missing: {len(missing)}; errors: {len(errors)}')
    if missing:print('Missing:',', '.join(missing))
    if errors:print('Errors:',errors)

if __name__=='__main__':main()
