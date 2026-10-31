import sys
from pathlib import Path
import unittest
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from window_objects import window_rectangles


class WindowObjectTests(unittest.TestCase):
    def test_separate_windows_have_independent_bounding_boxes(self):
        mask = np.zeros((10, 20), dtype=bool)
        mask[1:4, 2:6] = True
        mask[5:9, 11:18] = True
        objects = window_rectangles(mask)
        self.assertEqual(len(objects), 2)
        self.assertEqual(objects[0]['box'], [.1, .1, .3, .4])
        self.assertEqual(objects[0]['mask_pixels'], 12)
        self.assertEqual(objects[1]['box'], [.55, .5, .9, .9])

    def test_diagonal_pixels_are_eight_connected(self):
        mask = np.eye(4, dtype=bool)
        objects = window_rectangles(mask)
        self.assertEqual(len(objects), 1)
        self.assertEqual(objects[0]['box'], [0, 0, 1, 1])
        self.assertEqual(objects[0]['mask_pixels'], 4)

    def test_one_pixel_gap_separates_objects(self):
        self.assertEqual(len(window_rectangles(np.array([[1, 0, 1]], dtype=bool))), 2)

    def test_irregular_window_uses_outer_bounding_rectangle(self):
        mask = np.zeros((10, 10), dtype=bool)
        mask[2:7, 3:5] = True
        mask[6:8, 4:8] = True
        objects = window_rectangles(mask)
        self.assertEqual(len(objects), 1)
        self.assertEqual(objects[0]['box'], [.3, .2, .8, .8])

    def test_empty_mask_has_no_objects(self):
        self.assertEqual(window_rectangles(np.zeros((10, 10), dtype=bool)), [])


if __name__ == '__main__':
    unittest.main()
