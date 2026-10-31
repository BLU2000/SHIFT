import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from bundles import bundle_path, write_bundle, read_files, update_geometry, svg_and_measurement


class BundleTests(unittest.TestCase):
    def test_replacement_keeps_one_file_and_all_assets(self):
        with tempfile.TemporaryDirectory() as folder:
            path=bundle_path(folder,'photo')
            assets={'labels.png':b'labels','mask.png':b'mask','crop-mask.png':b'crop-mask','overlay.jpg':b'overlay','crop.jpg':b'crop','windows.svg':b'<svg/>','state.json':b'{"run_id":"one","crop_size":[100,100]}','result.json':b'{"window_pixels":20,"wall_pixels":80,"wwr_percent":20}'}
            write_bundle(path,assets)
            assets['overlay.jpg']=b'latest overlay'
            write_bundle(path,assets)
            self.assertEqual(len(list(Path(folder).iterdir())),1)
            self.assertEqual(read_files(path)['overlay.jpg'],b'latest overlay')
            vector={'coordinate_system':'normalized-to-crop','facade':[0,0,1,1],'crop_size':[100,100],'windows':[{'box':[0,0,.5,.5]}]}
            result=update_geometry(path,'one',{'vector_measurement':vector,'verified':True})
            self.assertEqual(result['wwr_percent'],20)
            self.assertEqual(result['vector_measurement']['wwr_percent'],25)
            self.assertTrue(result['verified'])
            self.assertEqual(read_files(path)['labels.png'],b'labels')
            ET.fromstring(read_files(path)['windows.svg'])
            with self.assertRaisesRegex(ValueError,'newer run'):
                update_geometry(path,'outdated',{'vector_measurement':vector})
            self.assertEqual(len(list(Path(folder).iterdir())),1)

    def test_filename_cannot_escape_bundle_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(bundle_path(folder,'../../photo').parent,Path(folder).resolve())

    def test_resized_facade_clips_windows_and_changes_denominator(self):
        svg,vector=svg_and_measurement({'coordinate_system':'normalized-to-crop','facade':[.25,0,.75,1],'crop_size':[100,100],'windows':[{'box':[0,0,1,.5]}]})
        self.assertEqual(vector['window_area'],.25)
        self.assertEqual(vector['facade_area'],.5)
        self.assertEqual(vector['wwr_percent'],50)
        root=ET.fromstring(svg)
        self.assertEqual(root[1].attrib['x'],'25.0')
