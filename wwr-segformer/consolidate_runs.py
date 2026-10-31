"""Keep only the newest successful old run per photo, bundled into one replaceable ZIP."""
import json
from pathlib import Path
import shutil

from batch import collection_index, match_photo
import interactive_server as server
from bundles import bundle_path

if __name__ == '__main__':
    server.DATASET,index=collection_index(server.ROOT.parent/'Facade-ID_BU_v017.html')
    for p in (server.ROOT.parent/'images'/'browser-new-photos').glob('*.jpg'):
        photo_id=match_photo(p,index)
        if photo_id: server.PHOTOS[photo_id]={'path':p.resolve(),'name':p.name}
    root=server.LATEST.resolve()
    for photo_id in server.PHOTOS:
        old=(root/photo_id).resolve()
        if old.parent!=root or not old.is_dir():continue
        destination=bundle_path(root,photo_id)
        if not destination.exists():
            candidates=sorted(old.glob('*/*.json'),key=lambda p:p.stat().st_mtime,reverse=True)
            for candidate in candidates:
                row=json.loads(candidate.read_text(encoding='utf-8'))
                if 'roi_pixels' not in row:continue
                files={name:Path(row[key]).read_bytes() for name,key in [('labels.png','mask_path'),('mask.png','color_mask_path'),('overlay.jpg','overlay_path')]}
                server.package_detection(photo_id,row,files)
                break
        if destination.is_file():
            shutil.rmtree(old)
            print(f'Consolidated {photo_id}: {destination.name}')
