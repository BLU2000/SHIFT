"""Download upstream notebook/license and its actual linked checkpoint; no ML install."""
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent
REPO = 'zoedesimone/wwr-semantic-segmentation'
FILE_ID = '1eVqbUzLsAbhkppAvV9KcQb_5sPQpRjMu'
REVISION = 'fba3dff1984c6f6eec3ffd685a2a85156b676e5c'
CONFIG_REVISION = '489d5cd81a0b59fab9b7ea758d3548ebe99677da'
CHECKPOINT_SHA256 = '39e7a8ac41f257bb795e51ea111d9ab1ce9c1569f02f0a8871919f6292968480'


def download(url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + '.part')
    request = urllib.request.Request(url, headers={'User-Agent': 'Facade-WWR-verification/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response, temporary.open('wb') as stream:
        while block := response.read(1024 * 1024):
            stream.write(block)
    temporary.replace(destination)
    return hashlib.sha256(destination.read_bytes()).hexdigest()


if __name__ == '__main__':
    revision = REVISION
    hashes = {}
    for name in ('README.md', 'LICENSE', 'SegFormer_Training.ipynb', 'SegformerDatasetGeneration_Visualization.ipynb'):
        print('Downloading ' + name, flush=True)
        hashes[name] = download(f'https://raw.githubusercontent.com/{REPO}/{revision}/{name}', ROOT / 'sources' / name)
    checkpoint = ROOT / 'models' / 'best_model.pt'
    print('Downloading linked checkpoint (15 MB)...', flush=True)
    hashes['best_model.pt'] = download(f'https://drive.usercontent.google.com/download?id={FILE_ID}&export=download&confirm=t', checkpoint)
    if not zipfile.is_zipfile(checkpoint):
        raise RuntimeError('The published download is not a PyTorch ZIP checkpoint. Check public access or download manually from the linked Drive folder.')
    if hashes['best_model.pt'] != CHECKPOINT_SHA256:
        raise RuntimeError('The public checkpoint changed. Verify its architecture, class mapping and license before using it.')
    model_repo = 'nvidia/segformer-b0-finetuned-ade-512-512'
    model_revision = CONFIG_REVISION
    for name in ('config.json', 'preprocessor_config.json'):
        hashes[name] = download(f'https://huggingface.co/{model_repo}/resolve/{model_revision}/{name}', ROOT / 'models' / name)
    manifest = {'repository': REPO, 'commit': revision, 'checkpoint_drive_id': FILE_ID,
                'config_repository': model_repo, 'config_revision': model_revision, 'sha256': hashes}
    (ROOT / 'source_manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(manifest, indent=2))
