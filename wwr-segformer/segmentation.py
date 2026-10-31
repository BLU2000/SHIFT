"""Local, strict-checkpoint SegFormer inference; no fallback to unrelated pretrained weights."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


class Segmenter:
    def __init__(self, model_dir=ROOT / 'models', device='auto'):
        import torch
        from transformers import SegformerConfig, SegformerImageProcessor, SegformerForSemanticSegmentation
        model_dir = Path(model_dir)
        for name in ('best_model.pt', 'config.json', 'preprocessor_config.json'):
            if not (model_dir / name).is_file():
                raise FileNotFoundError(f'Missing {name}; run download_sources.py first.')
        self.revision = sha256(model_dir / 'best_model.pt')
        self.config = SegformerConfig.from_pretrained(model_dir, local_files_only=True)
        self.labels = {int(k): v for k, v in self.config.id2label.items()}
        by_name = {v.strip().lower(): k for k, v in self.labels.items()}
        self.window_id = by_name['windowpane']
        self.wall_ids = [by_name['wall'], by_name['building']]
        self.device = 'cuda' if device == 'auto' and torch.cuda.is_available() else ('cpu' if device == 'auto' else device)
        if self.device == 'cuda' and not torch.cuda.is_available():
            raise RuntimeError('CUDA is unavailable; choose --device cpu.')
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        self.processor = SegformerImageProcessor.from_pretrained(model_dir, local_files_only=True)
        self.model = SegformerForSemanticSegmentation(self.config)
        # Do not use weights_only=False and do not silently accept missing/unmatched layers.
        state = torch.load(model_dir / 'best_model.pt', map_location='cpu', weights_only=True)
        self.model.load_state_dict(state, strict=True)
        self.model.to(self.device).eval()

    def predict(self, image):
        import torch
        import numpy as np
        inputs = self.processor(images=image, return_tensors='pt').to(self.device)
        with torch.inference_mode():
            logits = self.model(**inputs).logits.cpu()
        # Resize logits BEFORE argmax. Stripes avoid allocating H*W*150 floats for iPhone photos.
        width, height = image.size
        labels = np.empty((height, width), dtype=np.uint8)
        stripe = max(1, min(128, 32_000_000 // (width * logits.shape[1] * 4)))
        xs = (torch.arange(width, dtype=torch.float32) + .5) * (2. / width) - 1
        for y in range(0, height, stripe):
            rows = min(stripe, height-y)
            ys = (torch.arange(y, y+rows, dtype=torch.float32) + .5) * (2. / height) - 1
            gy, gx = torch.meshgrid(ys, xs, indexing='ij')
            grid = torch.stack((gx, gy), dim=-1).unsqueeze(0)
            enlarged = torch.nn.functional.grid_sample(logits, grid, mode='bilinear', padding_mode='border', align_corners=False)
            labels[y:y+rows] = enlarged.argmax(1)[0].numpy().astype(np.uint8)
        return labels


def ratio_from_labels(mask, window_id, wall_ids):
    import numpy as np
    windows = int(np.count_nonzero(mask == window_id))
    walls = int(np.count_nonzero(np.isin(mask, wall_ids)))
    total = windows + walls
    return {'window_pixels': windows, 'wall_pixels': walls,
            'wwr_percent': 100. * windows / total if total else None}


def exif_metadata(image):
    exif = image.getexif()
    result = {'latitude': None, 'longitude': None, 'capture_date': exif.get(36867) or exif.get(306), 'orientation': exif.get(274)}
    try:
        capture = exif.get_ifd(34665).get(36867)
        if capture:
            result['capture_date'] = capture
        gps = exif.get_ifd(34853)
        def angle(value):
            return float(value[0]) + float(value[1])/60 + float(value[2])/3600
        if 2 in gps and 4 in gps:
            latitude, longitude = angle(gps[2]), angle(gps[4])
            if gps.get(1) in ('S', b'S'):
                latitude = -latitude
            if gps.get(3) in ('W', b'W'):
                longitude = -longitude
            if -90 <= latitude <= 90 and -180 <= longitude <= 180:
                result.update(latitude=latitude, longitude=longitude)
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        pass
    return result


def process_image(path, output_dir, segmenter, roi=None, single_facade=False):
    import numpy as np
    from PIL import Image, ImageOps
    path, output_dir = Path(path).resolve(), Path(output_dir).resolve()
    if roi is None and not single_facade:
        raise ValueError('Specify --roi x0 y0 x1 y1 (0..1) for the target facade, or explicitly assert --single-facade.')
    if roi is not None and (len(roi) != 4 or not all(np.isfinite(roi)) or not (0 <= roi[0] < roi[2] <= 1 and 0 <= roi[1] < roi[3] <= 1)):
        raise ValueError('ROI must be x0 y0 x1 y1 normalized to 0..1.')
    image_id = sha256(path)
    with Image.open(path) as original:
        metadata = exif_metadata(original)
        image = ImageOps.exif_transpose(original).convert('RGB')
    width, height = image.size
    box = tuple(round(v * (width if i % 2 == 0 else height)) for i, v in enumerate(roi or [0, 0, 1, 1]))
    if box[2]-box[0] < 2 or box[3]-box[1] < 2:
        raise ValueError('The facade region is too small.')
    selected = image.crop(box)
    detected = segmenter.predict(selected)
    mask = np.full((height, width), 255, dtype=np.uint8)
    mask[box[1]:box[3], box[0]:box[2]] = detected
    numerical = ratio_from_labels(mask, segmenter.window_id, segmenter.wall_ids)
    colors = np.zeros((height, width, 4), dtype=np.uint8)
    palette = {segmenter.window_id: [57, 87, 165, 150], segmenter.wall_ids[0]: [146, 138, 126, 110], segmenter.wall_ids[1]: [219, 176, 127, 110]}
    for key, color in palette.items():
        colors[mask == key] = color
    prefix = image_id[:20]
    output_dir.mkdir(parents=True, exist_ok=True)
    mask_path, color_path, overlay_path = (output_dir / (prefix + suffix) for suffix in ('-labels.png', '-mask.png', '-overlay.jpg'))
    Image.fromarray(mask).save(mask_path)
    colored = Image.fromarray(colors)
    colored.save(color_path)
    Image.alpha_composite(image.convert('RGBA'), colored).convert('RGB').save(overlay_path, quality=92)
    unique, counts = np.unique(detected, return_counts=True)
    result = {'image_id': image_id, 'filename': path.name, 'original_path': str(path), **metadata, **numerical,
              'model_name': 'zoedesimone/wwr-semantic-segmentation / supplied SegFormer-B0 checkpoint',
              'model_version': segmenter.revision, 'status': 'needs_review', 'verified': False,
              'estimate_type': 'estimated visible-pixel WWR',
              'denominator': 'windowpane + wall + building (opaque exterior proxy)',
              'window_class_id': segmenter.window_id, 'wall_class_ids': segmenter.wall_ids,
              'width': width, 'height': height, 'roi_pixels': box,
              'mask_path': str(mask_path), 'color_mask_path': str(color_path), 'overlay_path': str(overlay_path),
              'class_pixels': {segmenter.labels[int(k)]: int(n) for k, n in zip(unique, counts)},
              'warnings': ['Building is a coarse semantic class, not a guaranteed opaque wall mask. Doors and other classes are excluded.']}
    if numerical['wwr_percent'] is None:
        result['warnings'].append('No window or wall pixels found; WWR is undefined.')
    elif not numerical['window_pixels']:
        result['warnings'].append('No windows detected; manually check for missed openings.')
    elif numerical['wwr_percent'] > 80:
        result['warnings'].append('WWR above 80%; check boundaries and shopfront glazing.')
    result_path = output_dir / (prefix + '.json')
    result_path.write_text(json.dumps(result, indent=2), encoding='utf-8')
    legend = {'windowpane': '#3957a5', 'wall': '#928a7e', 'building': '#dbb07f', 'other/background': 'transparent',
              'numeric_mask_outside_roi': 255, 'labels': segmenter.labels}
    (output_dir / 'legend.json').write_text(json.dumps(legend, indent=2), encoding='utf-8')
    return result
