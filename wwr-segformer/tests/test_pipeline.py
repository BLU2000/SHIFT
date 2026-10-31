import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from segmentation import ratio_from_labels, process_image, exif_metadata, sha256
from batch import collection_index, match_photo


class SyntheticSegmenter:
    window_id = 8
    wall_ids = [0, 1]
    revision = 'test-only'
    labels = {0: 'wall', 1: 'building', 8: 'windowpane', 2: 'sky'}

    def predict(self, image):
        w, h = image.size
        labels = np.zeros((h, w), dtype=np.uint8)
        labels[:, :w//4] = 8
        return labels


class PipelineTests(unittest.TestCase):
    def test_background_and_doors_excluded(self):
        mask = np.array([[8, 8, 0, 1], [2, 4, 14, 255]], dtype=np.uint8)
        result = ratio_from_labels(mask, 8, [0, 1])
        self.assertEqual(result, {'window_pixels': 2, 'wall_pixels': 2, 'wwr_percent': 50.})

    def test_empty_denominator_is_undefined(self):
        self.assertIsNone(ratio_from_labels(np.array([[2, 4]], dtype=np.uint8), 8, [0, 1])['wwr_percent'])

    def test_roi_outputs_and_original_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'sample.jpg'
            Image.new('RGB', (40, 20), 'white').save(path)
            before = sha256(path)
            result = process_image(path, Path(folder) / 'out', SyntheticSegmenter(), [.1, .1, .9, .9])
            self.assertEqual(sha256(path), before)
            self.assertEqual(result['wwr_percent'], 25.)
            self.assertFalse(result['verified'])
            self.assertIsNone(result['latitude'])
            with Image.open(result['mask_path']) as mask:
                self.assertEqual(mask.size, (40, 20))
                self.assertEqual(mask.getpixel((0, 0)), 255)
            self.assertTrue(Path(result['overlay_path']).is_file())

    def test_exif_orientation_applied(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'rotated.jpg'
            exif = Image.Exif()
            exif[274] = 6
            Image.new('RGB', (40, 20), 'white').save(path, exif=exif)
            row = process_image(path, Path(folder) / 'out', SyntheticSegmenter(), single_facade=True)
            self.assertEqual((row['width'], row['height']), (20, 40))
            self.assertEqual(row['orientation'], 6)

    def test_missing_scope_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Specify --roi'):
            process_image('not-needed.jpg', '.', SyntheticSegmenter())

    def test_ambiguous_photo_names_are_not_guessed(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'collection.json'
            file.write_text(json.dumps({'dataset': 'test', 'photos': [{'id': 'a', 'name': 'photo'}, {'id': 'b', 'name': 'photo.jpg'}]}))
            dataset, index = collection_index(file)
            self.assertEqual(dataset, 'test')
            self.assertIsNone(match_photo(Path('photo.jpg'), index))

    def test_striped_resize_matches_interpolate(self):
        import torch
        from segmentation import Segmenter
        model = Segmenter()
        # Real model output shape and resize: compare a small image against direct interpolation.
        image = Image.new('RGB', (31, 23), 'grey')
        inputs = model.processor(images=image, return_tensors='pt')
        with torch.inference_mode():
            logits = model.model(**inputs).logits
        expected = torch.nn.functional.interpolate(logits, size=(23, 31), mode='bilinear', align_corners=False).argmax(1)[0].numpy()
        self.assertTrue(np.array_equal(model.predict(image), expected))

    def test_batch_continues_after_corrupt_image(self):
        from argparse import Namespace
        from batch import run
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            images = root / 'images'
            images.mkdir()
            (images / 'a-broken.jpg').write_bytes(b'not an image')
            Image.new('RGB', (40, 30), 'grey').save(images / 'b-valid.jpg')
            output = root / 'results'
            run(Namespace(images=images, output=output, single_facade=True, rois=None, collection=None,
                          only=None, limit=None, force=False, device='cpu'))
            rows = json.loads((output / 'results.json').read_text())['results']
            self.assertEqual([r['status'] for r in rows], ['failed', 'needs_review'])
            self.assertTrue((output / 'results.csv').is_file())
            self.assertTrue((output / 'results.geojson').is_file())
            self.assertTrue((output / 'review.html').is_file())


if __name__ == '__main__':
    unittest.main()
