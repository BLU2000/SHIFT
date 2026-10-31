"""Sequential offline batch processing. The model loads once; each failure is isolated."""
import argparse
import base64
import csv
import html
import io
import json
from pathlib import Path
import re
import time

from segmentation import ROOT, Segmenter, process_image, sha256

FIELDS = ['image_id', 'photo_id', 'filename', 'latitude', 'longitude', 'capture_date', 'orientation',
          'window_pixels', 'wall_pixels', 'wwr_percent', 'model_name', 'model_version', 'status', 'verified',
          'mask_path', 'overlay_path', 'error']


def collection_index(path):
    if not path:
        return None, {}
    text = Path(path).read_text(encoding='utf-8')
    match = re.search(r'<script[^>]*id=["\']collection-data["\'][^>]*>([\s\S]*?)</script>', text)
    data = json.loads(match[1]) if match else json.loads(text)
    index = {}
    for photo in data['photos']:
        for name in {photo['name'].casefold(), Path(photo['name']).stem.casefold()}:
            index.setdefault(name, set()).add(photo['id'])
    return data['dataset'], index


def match_photo(path, index):
    ids = set(index.get(path.name.casefold(), set())) | set(index.get(path.stem.casefold(), set()))
    return next(iter(ids)) if len(ids) == 1 else None


def mask_preview(path):
    from PIL import Image
    with Image.open(path) as source:
        source.thumbnail((1000, 1000), Image.Resampling.NEAREST)
        stream = io.BytesIO()
        source.save(stream, format='PNG')
        return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


def export_files(output, dataset, results):
    payload = {'format': 'facade-segformer-results', 'version': 1, 'dataset': dataset,
               'estimate_type': 'estimated visible-pixel WWR', 'results': results}
    (output / 'results.json').write_text(json.dumps(payload, indent=2), encoding='utf-8')
    with (output / 'results.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(results)
    features = []
    for row in results:
        if row.get('latitude') is None or row.get('longitude') is None:
            continue
        properties = {key: row.get(key) for key in FIELDS if key not in ('latitude', 'longitude')}
        features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [row['longitude'], row['latitude']]}, 'properties': properties})
    (output / 'results.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features}), encoding='utf-8')
    template = (ROOT / 'review-template.html').read_text(encoding='utf-8')
    (output / 'review.html').write_text(template.replace('/*RESULTS*/null', json.dumps(payload).replace('<', '\\u003c')), encoding='utf-8')


def run(args):
    directory = args.images.resolve()
    if not directory.is_dir():
        raise ValueError('Image directory does not exist.')
    if not args.single_facade and not args.rois:
        raise ValueError('Supply --rois regions.json, or --single-facade to explicitly assert that each image shows only one target facade.')
    rois = json.loads(args.rois.read_text(encoding='utf-8')) if args.rois else {}
    dataset, index = collection_index(args.collection)
    paths = sorted(p for p in directory.rglob('*') if p.suffix.lower() in ('.jpg', '.jpeg', '.png') and p.is_file() and not p.resolve().is_relative_to(args.output.resolve()))
    if args.only:
        paths = [path for path in paths if path.name in args.only]
    if args.limit:
        paths = paths[:args.limit]
    if not paths:
        raise ValueError('No matching JPG/JPEG/PNG images.')
    args.output.mkdir(parents=True, exist_ok=True)
    model = Segmenter(device=args.device)
    results = []
    started = time.monotonic()
    for i, path in enumerate(paths, 1):
        print(f'[{i}/{len(paths)}] {path.name}', flush=True)
        try:
            image_id = sha256(path)
            record_path = args.output / (image_id[:20] + '.json')
            region = rois.get(path.relative_to(directory).as_posix(), rois.get(path.name))
            if region is None and not args.single_facade:
                raise ValueError('No ROI supplied for this image; target facade is ambiguous.')
            row = None
            if record_path.exists() and not args.force:
                previous = json.loads(record_path.read_text(encoding='utf-8'))
                expected_roi = region or [0, 0, 1, 1]
                if previous.get('model_version') == model.revision and previous.get('requested_roi') == expected_roi and all(Path(previous.get(k, '')).is_file() for k in ('mask_path', 'color_mask_path', 'overlay_path')):
                    row = previous
                    print('  already processed; using saved AI result', flush=True)
            if row is None:
                row = process_image(path, args.output, model, region, args.single_facade)
                row['requested_roi'] = region or [0, 0, 1, 1]
                record_path.write_text(json.dumps(row, indent=2), encoding='utf-8')
            row = {**row, 'filename': path.name, 'original_path': str(path.resolve()),
                   'photo_id': match_photo(path, index) if index else None,
                   'original_preview': path.resolve().as_uri(), 'overlay_preview': Path(row['overlay_path']).as_uri(),
                   'mask_preview': mask_preview(row['color_mask_path'])}
            if index and not row['photo_id']:
                row['warnings'] = row.get('warnings', []) + ['No unique matching photograph in the collection; will not import.']
            print('  WWR: ' + (f"{row['wwr_percent']:.2f}%" if row['wwr_percent'] is not None else 'undefined'), flush=True)
        except Exception as error:
            row = {'filename': path.name, 'original_path': str(path.resolve()), 'status': 'failed', 'verified': False, 'error': str(error)}
            print('  FAILED: ' + str(error), flush=True)
        results.append(row)
        # Append a small progress record; avoid rewriting every embedded preview N times.
        with (args.output / 'progress.jsonl').open('a', encoding='utf-8') as progress:
            progress.write(json.dumps({k: v for k, v in row.items() if k != 'mask_preview'}) + '\n')
    export_files(args.output, dataset, results)
    print(f'Finished {len(results)} images in {time.monotonic()-started:.1f}s. Review: {args.output / "review.html"}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('images', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'results' / 'batch')
    parser.add_argument('--collection', type=Path, help='Saved survey HTML for stable photo IDs and dataset matching.')
    parser.add_argument('--rois', type=Path, help='JSON mapping filenames to [left,top,right,bottom] in 0..1.')
    parser.add_argument('--single-facade', action='store_true')
    parser.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--only', nargs='+', help='Process only these filenames.')
    parser.add_argument('--force', action='store_true', help='Reprocess even when a compatible result exists.')
    args = parser.parse_args()
    run(args)
