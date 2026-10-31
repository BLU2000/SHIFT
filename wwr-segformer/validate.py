"""Summarize a pilot and optionally compare to independently annotated reference WWRs."""
import argparse
import csv
import json
from pathlib import Path
import statistics

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('results', type=Path)
    parser.add_argument('--references', type=Path, help='CSV: image_id,wwr_percent (manual measurements on the same ROI).')
    args = parser.parse_args()
    rows = json.loads(args.results.read_text(encoding='utf-8'))['results']
    valid = [r for r in rows if isinstance(r.get('wwr_percent'), (float, int))]
    report = {'total': len(rows), 'failed': sum(r.get('status') == 'failed' for r in rows),
              'undefined': sum(r.get('wwr_percent') is None and r.get('status') != 'failed' for r in rows),
              'verified': sum(r.get('verified') is True for r in rows),
              'flagged': [{'filename': r['filename'], 'warnings': r.get('warnings'), 'error': r.get('error')} for r in rows if r.get('warnings') or r.get('error')]}
    if args.references:
        with args.references.open(encoding='utf-8-sig', newline='') as stream:
            references = {r['image_id']: float(r['wwr_percent']) for r in csv.DictReader(stream)}
        differences = [r['wwr_percent'] - references[r['image_id']] for r in valid if r['image_id'] in references]
        report['comparison'] = {'matched_images': len(differences),
                                'mae_percentage_points': statistics.mean(map(abs, differences)) if differences else None,
                                'bias_percentage_points': statistics.mean(differences) if differences else None}
    print(json.dumps(report, indent=2))
