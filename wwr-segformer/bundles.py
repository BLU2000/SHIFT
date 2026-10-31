"""One replaceable ZIP per photo containing masks, latest result, crop and SVG."""
import io
import json
import math
from pathlib import Path
import uuid
import zipfile
from urllib.parse import quote


def bundle_path(directory, photo_id):
    directory = Path(directory).resolve()
    path = directory / (quote(photo_id, safe='') + '.wwr.zip')
    if path.parent != directory:
        raise ValueError('Invalid photo identifier.')
    return path


def svg_and_measurement(vector):
    facade = vector.get('facade')
    if vector.get('coordinate_system') != 'normalized-to-crop' or not isinstance(facade,list) or len(facade)!=4 or any(type(v) not in (float,int) or not math.isfinite(v) for v in facade) or not (0<=facade[0]<facade[2]<=1 and 0<=facade[1]<facade[3]<=1):
        raise ValueError('Invalid facade boundary inside the crop.')
    windows = vector['windows']
    if not isinstance(windows, list) or len(windows) > 10000:
        raise ValueError('Invalid window rectangles.')
    for item in windows:
        box = item.get('box')
        if not isinstance(box, list) or len(box) != 4 or any(type(v) not in (float, int) or not math.isfinite(v) for v in box) or not (0 <= box[0] < box[2] <= 1 and 0 <= box[1] < box[3] <= 1):
            raise ValueError('Invalid window rectangle.')
    boxes = [[max(facade[0],b[0]),max(facade[1],b[1]),min(facade[2],b[2]),min(facade[3],b[3])] for item in windows for b in [item['box']]]
    boxes = [b for b in boxes if b[2]>b[0] and b[3]>b[1]]
    xs = sorted({x for box in boxes for x in (box[0], box[2])})
    area = 0.
    for left, right in zip(xs, xs[1:]):
        intervals = sorted((box[1], box[3]) for box in boxes if box[0] < right and box[2] > left)
        length, end = 0., -math.inf
        for bottom, top in intervals:
            length += max(0., top-max(bottom, end))
            end = max(end, top)
        area += (right-left)*length
    facade_area=(facade[2]-facade[0])*(facade[3]-facade[1])
    vector = {**vector, 'window_area': area, 'facade_area': facade_area, 'wwr_percent': min(100., 100*area/facade_area)}
    width, height = vector['crop_size']
    if not all(type(v) is int and 1 <= v <= 100000 for v in (width, height)):
        raise ValueError('Invalid crop dimensions.')
    rectangles = ''.join(f'<rect x="{b[0]*width}" y="{b[1]*height}" width="{(b[2]-b[0])*width}" height="{(b[3]-b[1])*height}"/>' for b in boxes)
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}"><title>Facade and latest window rectangles</title><rect x="{facade[0]*width}" y="{facade[1]*height}" width="{(facade[2]-facade[0])*width}" height="{(facade[3]-facade[1])*height}" fill="#dbb07f" fill-opacity=".2" stroke="#ac443a"/><g fill="#3957a5" fill-opacity=".25" stroke="#3957a5">{rectangles}</g></svg>'
    return svg.encode(), vector


def write_bundle(path, files):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in files.items():
                archive.writestr(name, data)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def read_files(path):
    with zipfile.ZipFile(path) as archive:
        return {name: archive.read(name) for name in archive.namelist()}


def update_geometry(path, run_id, incoming):
    files = read_files(path)
    state = json.loads(files['state.json'])
    if state['run_id'] != run_id:
        raise ValueError('This detection was replaced by a newer run. Reload the photo before editing.')
    result = json.loads(files['result.json'])
    vector = incoming['vector_measurement']
    if vector.get('crop_size') != state['crop_size']:
        raise ValueError('Crop dimensions do not match this detection.')
    svg, vector = svg_and_measurement(vector)
    result['verified'] = incoming.get('verified') is True
    result['status'] = 'verified' if result['verified'] else 'needs_review'
    result['verified_at'] = incoming.get('verified_at')
    result['vector_measurement'] = {**vector, 'verified': result['verified']}
    files['result.json'] = json.dumps(result).encode()
    files['windows.svg'] = svg
    write_bundle(path, files)
    return result
