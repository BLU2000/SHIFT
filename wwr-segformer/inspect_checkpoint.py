"""Inspect tensor names/shapes without installing PyTorch or executing checkpoint code."""
import argparse
from collections import OrderedDict
import hashlib
import io
import json
from pathlib import Path
import pickle
import re
import zipfile


class TensorShape:
    def __init__(self, shape, storage):
        self.shape = list(shape)
        self.storage = storage


def tensor(storage, offset, size, stride, *unused):
    return TensorShape(size, storage)


class ShapeReader(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) == ('collections', 'OrderedDict'):
            return OrderedDict
        if module == 'torch._utils' and name in ('_rebuild_tensor', '_rebuild_tensor_v2'):
            return tensor
        if module == 'torch' and name.endswith('Storage'):
            return name
        raise ValueError(f'Unsupported checkpoint type {module}.{name}; refusing to execute it.')

    def persistent_load(self, identifier):
        if not isinstance(identifier, tuple) or identifier[0] != 'storage':
            raise ValueError('Unsupported persistent object.')
        return {'type': identifier[1], 'key': identifier[2], 'elements': identifier[4]}


def inspect(path):
    path = Path(path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
        name = next(name for name in archive.namelist() if name.endswith('/data.pkl'))
        entry = archive.getinfo(name)
        if entry.file_size > 20_000_000:
            raise ValueError('Unexpectedly large pickle metadata.')
        state = ShapeReader(io.BytesIO(archive.read(name))).load()
    if isinstance(state, dict) and 'state_dict' in state:
        state = state['state_dict']
    if not isinstance(state, dict):
        raise ValueError('Expected a state dictionary.')
    tensors = {key: value.shape for key, value in state.items() if isinstance(value, TensorShape)}
    depths = []
    for stage in range(4):
        blocks = [int(match.group(1)) for key in tensors
                  if (match := re.search(rf'encoder\.block\.{stage}\.(\d+)\.', key))]
        depths.append(max(blocks) + 1 if blocks else 0)
    classifier = next((shape for key, shape in tensors.items() if key.endswith('decode_head.classifier.weight')), None)
    compatible = depths == [3, 6, 40, 3] and classifier is not None and classifier[0] == 150
    return {'file': str(path), 'bytes': path.stat().st_size, 'sha256': digest,
            'tensor_count': len(tensors), 'segformer_depths': depths,
            'classifier_shape': classifier, 'matches_notebook_mit_b5_150_classes': compatible,
            'tensor_shapes': tensors}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkpoint')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = inspect(args.checkpoint)
    if args.report:
        args.report.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items() if key != 'tensor_shapes'}, indent=2))
