"""Read GPS EXIF from original HEICs without sending photographs to a service."""
import ctypes as c
import json
import math
import os
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parent
os.add_dll_directory(r'C:\Program Files\GIMP 3\bin')
lib = c.CDLL(r'C:\Program Files\GIMP 3\bin\libheif.dll')
class Error(c.Structure):
    _fields_ = [('code', c.c_int), ('subcode', c.c_int), ('message', c.c_char_p)]
def api(name, result, args):
    fn = getattr(lib, name); fn.restype = result; fn.argtypes = args
    return fn
ptr = c.c_void_p
alloc = api('heif_context_alloc', ptr, [])
read = api('heif_context_read_from_file', Error, [ptr, c.c_char_p, ptr])
primary = api('heif_context_get_primary_image_handle', Error, [ptr, c.POINTER(ptr)])
count = api('heif_image_handle_get_number_of_metadata_blocks', c.c_int, [ptr, c.c_char_p])
ids = api('heif_image_handle_get_list_of_metadata_block_IDs', c.c_int, [ptr, c.c_char_p, c.POINTER(c.c_uint32), c.c_int])
size = api('heif_image_handle_get_metadata_size', c.c_size_t, [ptr, c.c_uint32])
metadata = api('heif_image_handle_get_metadata', Error, [ptr, c.c_uint32, ptr])
release_handle = api('heif_image_handle_release', None, [ptr])
release_context = api('heif_context_free', None, [ptr])
def check(err):
    if err.code: raise ValueError(err.message.decode())
def gps_from_exif(raw):
    # HEIF Exif items prefix TIFF with a 4-byte big-endian relative offset.
    start = 4 + int.from_bytes(raw[:4], 'big')
    data = raw[start:]
    if data[:4] not in (b'II*\0', b'MM\0*'): raise ValueError('Invalid TIFF header')
    endian = '<' if data[:2] == b'II' else '>'
    def unpack(fmt, offset): return struct.unpack_from(endian + fmt, data, offset)
    def directory(offset):
        result = {}
        for i in range(unpack('H', offset)[0]):
            pos = offset + 2 + i * 12
            tag, kind, n = unpack('HHI', pos)
            length = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}.get(kind, 0) * n
            loc = pos + 8 if length <= 4 else unpack('I', pos + 8)[0]
            result[tag] = (kind, n, loc)
        return result
    first = directory(unpack('I', 4)[0])
    if 0x8825 not in first: return None
    gps = directory(unpack('I', first[0x8825][2])[0])
    def coordinate(value_tag, ref_tag, positive, negative):
        kind, n, loc = gps[value_tag]
        if kind != 5 or n != 3: raise ValueError('Invalid GPS coordinate')
        values = []
        for i in range(3):
            a, b = unpack('II', loc + i*8)
            values.append(a/b)
        value = values[0] + values[1]/60 + values[2]/3600
        kind, n, loc = gps[ref_tag]
        ref = data[loc:loc+n].rstrip(b'\0').decode('ascii')
        if ref not in (positive, negative): raise ValueError('Invalid GPS reference')
        return -value if ref == negative else value
    if not all(k in gps for k in (1, 2, 3, 4)): return None
    lat, lng = coordinate(2, 1, 'N', 'S'), coordinate(4, 3, 'E', 'W')
    if not math.isfinite(lat) or not math.isfinite(lng) or abs(lat)>90 or abs(lng)>180:
        raise ValueError('GPS outside valid bounds')
    return {'lat': round(lat, 7), 'lng': round(lng, 7), 'source': 'Photo GPS metadata'}

def main():
    found, missing, errors = {}, [], {}
    for source in sorted((ROOT/'images'/'Sorted Images').glob('*.HEIC')):
        ctx = alloc(); handle = ptr()
        try:
            check(read(ctx, os.fsencode(source), None)); check(primary(ctx, c.byref(handle)))
            n = count(handle, b'Exif'); blocks = (c.c_uint32 * n)()
            actual = ids(handle, b'Exif', blocks, n)
            location = None
            for block in list(blocks)[:actual]:
                buf = c.create_string_buffer(size(handle, block))
                check(metadata(handle, block, buf))
                location = gps_from_exif(buf.raw)
                if location: break
            if location: found[source.stem] = location
            else: missing.append(source.name)
        except Exception as error: errors[source.name] = str(error)
        finally:
            if handle: release_handle(handle)
            release_context(ctx)
    report = {'locations': found, 'missing': missing, 'errors': errors}
    (ROOT/'photo-locations.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'GPS found: {len(found)}; missing: {len(missing)}; errors: {len(errors)}')
    if found: print('Example:', next(iter(found.items())))
    if errors: print(json.dumps(errors, indent=2))
if __name__ == '__main__': main()
