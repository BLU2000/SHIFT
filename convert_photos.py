"""Convert source HEIC photos with the locally installed GIMP libheif. No packages needed."""
import ctypes as c
import os
import pathlib
import struct

ROOT = pathlib.Path(__file__).resolve().parent
os.add_dll_directory(r'C:\Program Files\GIMP 3\bin')
lib = c.CDLL(r'C:\Program Files\GIMP 3\bin\libheif.dll')
class Error(c.Structure):
    _fields_ = [('code', c.c_int), ('subcode', c.c_int), ('message', c.c_char_p)]
def setup(name, result, args):
    fn = getattr(lib, name); fn.restype = result; fn.argtypes = args
    return fn
ptr = c.c_void_p
alloc = setup('heif_context_alloc', ptr, [])
read = setup('heif_context_read_from_file', Error, [ptr, c.c_char_p, ptr])
primary = setup('heif_context_get_primary_image_handle', Error, [ptr, c.POINTER(ptr)])
decode = setup('heif_decode_image', Error, [ptr, c.POINTER(ptr), c.c_int, c.c_int, ptr])
width = setup('heif_image_get_width', c.c_int, [ptr, c.c_int])
height = setup('heif_image_get_height', c.c_int, [ptr, c.c_int])
plane = setup('heif_image_get_plane_readonly', ptr, [ptr, c.c_int, c.POINTER(c.c_int)])
release_image = setup('heif_image_release', None, [ptr])
release_handle = setup('heif_image_handle_release', None, [ptr])
release_context = setup('heif_context_free', None, [ptr])
def check(error):
    if error.code: raise RuntimeError(error.message.decode())
out = ROOT / 'images' / 'browser'; out.mkdir(exist_ok=True)
for source in sorted((ROOT / 'images' / 'Sorted Images').glob('*.HEIC')):
    target = out / (source.stem + '.bmp')
    if target.with_suffix('.jpg').exists(): continue
    ctx = alloc(); handle = ptr(); image = ptr()
    try:
        check(read(ctx, os.fsencode(source), None)); check(primary(ctx, c.byref(handle)))
        check(decode(handle, c.byref(image), 1, 10, None))
        w, h = width(image, 10), height(image, 10)
        stride = c.c_int(); data = plane(image, 10, c.byref(stride))
        row_size = (w * 3 + 3) & ~3
        with target.open('wb') as f:
            f.write(struct.pack('<2sIHHI', b'BM', 54 + row_size*h, 0, 0, 54))
            f.write(struct.pack('<IiiHHIIiiII', 40, w, -h, 1, 24, 0, row_size*h, 2835, 2835, 0, 0))
            for y in range(h):
                row = bytearray(c.string_at(data + y * stride.value, w*3))
                row[0::3], row[2::3] = row[2::3], row[0::3]
                f.write(row); f.write(b'\0'*(row_size-w*3))
        print(source.name, flush=True)
    finally:
        if image: release_image(image)
        if handle: release_handle(handle)
        release_context(ctx)
