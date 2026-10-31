"""Run the supplied checkpoint on one photograph for visual verification."""
import argparse
import json
from pathlib import Path
from segmentation import ROOT, Segmenter, process_image

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'results' / 'single')
    parser.add_argument('--roi', type=float, nargs=4, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'))
    parser.add_argument('--single-facade', action='store_true')
    parser.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    args = parser.parse_args()
    result = process_image(args.image, args.output, Segmenter(device=args.device), args.roi, args.single_facade)
    print(json.dumps(result, indent=2))
