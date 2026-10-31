"""Loopback-only crop/segment service reusing the verified local SegFormer checkpoint."""
import argparse
import base64
import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import tempfile
import uuid
import zipfile
from urllib.parse import parse_qs, urlsplit

from batch import collection_index, match_photo
from segmentation import ROOT, Segmenter, process_image
from window_objects import window_rectangles
from bundles import bundle_path, write_bundle, read_files, update_geometry, svg_and_measurement

MODEL = None
LOCK = threading.Lock()
PHOTOS = {}
DATASET = None
STATIC = {'/': ('interactive.html', 'text/html; charset=utf-8'),
          '/interactive.html': ('interactive.html', 'text/html; charset=utf-8'),
          '/interactive.js': ('interactive.js', 'text/javascript; charset=utf-8'),
          '/rect_geometry.js': ('rect_geometry.js', 'text/javascript; charset=utf-8'),
          '/rectangle_editor.js': ('rectangle_editor.js', 'text/javascript; charset=utf-8'),
          '/storage.js': ('storage.js', 'text/javascript; charset=utf-8'),
          '/interactive.css': ('interactive.css', 'text/css; charset=utf-8'),
          '/tests/interactive-checks.html': ('tests/interactive-checks.html', 'text/html; charset=utf-8')}


def data_url(image, fmt='PNG'):
    stream = io.BytesIO()
    image.save(stream, format=fmt)
    mime = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


LATEST = ROOT / 'results' / 'interactive'


def package_detection(photo_id, row, files):
    import numpy as np
    from PIL import Image, ImageOps
    with Image.open(PHOTOS[photo_id]['path']) as original:
        upright = ImageOps.exif_transpose(original).convert('RGB')
    labels = np.array(Image.open(io.BytesIO(files['labels.png'])))
    colors = np.zeros((*labels.shape, 4), dtype=np.uint8)
    colors[np.isin(labels, row['wall_class_ids'])] = [219, 176, 127, 255]
    colors[labels == row['window_class_id']] = [57, 87, 165, 255]
    mask = Image.fromarray(colors)
    x0, y0, x1, y1 = row['roi_pixels']
    size = [x1-x0, y1-y0]
    components = window_rectangles(labels[y0:y1, x0:x1] == row['window_class_id'])
    crop = upright.crop(row['roi_pixels'])
    crop_mask = mask.crop(row['roi_pixels'])
    crop.thumbnail((1000, 1000))
    crop_mask = crop_mask.resize(crop.size, Image.Resampling.NEAREST)
    mask.putalpha(mask.getchannel('A').point(lambda alpha: round(alpha*.5)))
    mask.thumbnail((1000, 1000), Image.Resampling.NEAREST)
    row = {**row, 'photo_id': photo_id, 'mask_preview': data_url(mask), 'verified': False, 'status': 'needs_review'}
    for key, member in [('mask_path', 'labels.png'), ('color_mask_path', 'mask.png'), ('overlay_path', 'overlay.jpg')]:
        row[key] = str(bundle_path(LATEST, photo_id)) + '!/' + member
    vector = {'version': 1, 'method': 'edited-rectangles', 'coordinate_system': 'normalized-to-crop', 'crop_size': size, 'facade': [0,0,1,1], 'windows': [c for c in components if c['mask_pixels'] >= max(4,size[0]*size[1]*.0002)], 'verified': False}
    svg, vector = svg_and_measurement(vector)
    row['vector_measurement'] = vector
    state = {'run_id': uuid.uuid4().hex, 'roi': [x0/upright.width,y0/upright.height,x1/upright.width,y1/upright.height], 'crop_size': size, 'window_objects': components}
    for name, picture, fmt in [('crop.jpg',crop,'JPEG'),('crop-mask.png',crop_mask,'PNG')]:
        stream=io.BytesIO();picture.save(stream,format=fmt);files[name]=stream.getvalue()
    files.update({'result.json':json.dumps(row).encode(),'state.json':json.dumps(state).encode(),'windows.svg':svg})
    write_bundle(bundle_path(LATEST,photo_id),files)
    return restore_detection(photo_id)


def restore_detection(photo_id):
    path=bundle_path(LATEST,photo_id)
    if not path.is_file(): return None
    files=read_files(path);state=json.loads(files['state.json']);row=json.loads(files['result.json'])
    return {**state,'result':row,'crop':'data:image/jpeg;base64,'+base64.b64encode(files['crop.jpg']).decode(), 'mask':'data:image/png;base64,'+base64.b64encode(files['crop-mask.png']).decode(), 'vector':{'facade':row['vector_measurement']['facade'],'windows':row['vector_measurement']['windows']}}


def reviewed_results():
    rows=[]
    for path in LATEST.glob('*.wwr.zip'):
        with zipfile.ZipFile(path) as archive: row=json.loads(archive.read('result.json'))
        if row.get('verified') is True and row.get('photo_id') in PHOTOS: rows.append(row)
    return {'format':'facade-segformer-results','version':1,'dataset':DATASET,'estimate_type':'estimated visible-pixel WWR','results':rows}


def detect_crop(photo_id,roi):
    global MODEL
    import numpy as np
    if photo_id not in PHOTOS: raise ValueError('Choose a photograph from this collection.')
    if not isinstance(roi,list) or len(roi)!=4 or any(type(v) not in (int,float) for v in roi) or not all(np.isfinite(roi)) or not(0<=roi[0]<roi[2]<=1 and 0<=roi[1]<roi[3]<=1): raise ValueError('Draw a valid facade rectangle.')
    with LOCK:
        if MODEL is None: MODEL=Segmenter(device='cpu')
        with tempfile.TemporaryDirectory(prefix='wwr-') as work:
            row=process_image(PHOTOS[photo_id]['path'],work,MODEL,roi=roi)
            files={name:Path(row[key]).read_bytes() for name,key in [('labels.png','mask_path'),('mask.png','color_mask_path'),('overlay.jpg','overlay_path')]}
            return package_detection(photo_id,row,files)


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, value, mime='application/json'):
        raw = json.dumps(value, allow_nan=False).encode() if mime == 'application/json' else value
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def local_request(self):
        allowed = [f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}']
        return self.headers.get('Host') in allowed and self.headers.get('Origin') in [None] + ['http://' + host for host in allowed]

    def do_GET(self):
        if not self.local_request():
            self.respond(403, {'error': 'Use the local address.'})
            return
        url = urlsplit(self.path)
        if url.path in STATIC:
            name, mime = STATIC[url.path]
            self.respond(200, (ROOT / name).read_bytes(), mime)
        elif url.path == '/api/photos':
            self.respond(200, {'reviewed_count': len(reviewed_results()['results']), 'dataset': DATASET, 'photos': [{'id': key, 'name': value['name']} for key, value in PHOTOS.items()]})
        elif url.path == '/api/saved':
            photo_id=parse_qs(url.query).get('id',[''])[0]
            if photo_id not in PHOTOS: self.respond(404,{'error':'Photo not found.'});return
            with LOCK: saved=restore_detection(photo_id)
            self.respond(200,{'saved':saved})
        elif url.path == '/api/reviewed':
            with LOCK: payload=reviewed_results()
            self.respond(200,payload)
        elif url.path == '/api/image':
            photo_id = parse_qs(url.query).get('id', [''])[0]
            if photo_id not in PHOTOS:
                self.respond(404, {'error': 'Photo not found.'})
                return
            from PIL import Image, ImageOps
            with Image.open(PHOTOS[photo_id]['path']) as source:
                image = ImageOps.exif_transpose(source).convert('RGB')
                image.thumbnail((1800, 1800))
                stream = io.BytesIO()
                image.save(stream, 'JPEG', quality=94)
            self.respond(200, stream.getvalue(), 'image/jpeg')
        else:
            self.respond(404, {'error': 'Not found.'})

    def do_POST(self):
        if not self.local_request():
            self.respond(403, {'error': 'Use the local interface.'})
            return
        if self.path not in ('/api/detect','/api/save'):
            self.respond(404, {'error': 'Not found.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length < 2_000_000:
                raise ValueError('Invalid crop request.')
            data = json.loads(self.rfile.read(length))
            if self.path == '/api/save':
                if data['photo_id'] not in PHOTOS: raise ValueError('Unknown photograph.')
                with LOCK: update_geometry(bundle_path(LATEST,data['photo_id']),data['run_id'],data['result'])
                result={'saved':True}
            else: result = detect_crop(data['photo_id'], data['roi'])
            self.respond(200, result)
        except (ValueError, KeyError, TypeError) as error:
            self.respond(400, {'error': str(error)})
        except Exception as error:
            self.respond(500, {'error': 'Segmentation failed: ' + str(error)})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--images', type=Path, default=ROOT.parent / 'images' / 'browser-new-photos')
    parser.add_argument('--collection', type=Path, default=ROOT.parent / 'Facade-ID_BU_v017.html')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--results', type=Path, default=LATEST)
    args = parser.parse_args()
    LATEST = args.results.resolve()
    DATASET, index = collection_index(args.collection)
    for path in sorted(args.images.rglob('*')):
        if path.is_file() and path.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            photo_id = match_photo(path, index)
            if photo_id:
                if photo_id in PHOTOS:
                    raise ValueError(f'Multiple source files match photo {photo_id}; use a unique source directory.')
                PHOTOS[photo_id] = {'path': path.resolve(), 'name': path.name}
    if not PHOTOS:
        raise SystemExit('No matching photographs. Check --images and --collection.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Crop and detect: http://127.0.0.1:{args.port} ({len(PHOTOS)} photographs)', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
