# Local SegFormer window-to-wall estimates

## Interactive crop → detect

Double-click **`start-interactive.cmd`**, keep its terminal open, and open **http://127.0.0.1:8765**. The interface loads the 202 matching photographs from the current HTML 17 collection.

1. Choose a photo: a red facade frame is already provided (or restored from the saved result). Drag its corners or edge handles to resize it, or drag inside it to move it. No initial drawing is needed.
2. Press **Detect**. This runs the installed local SegFormer model on that crop.
3. Check the cropped preview: **ochre = facade proxy, blue = windows**. Toggle the overlay or adjust opacity to inspect boundaries. Other classes remain transparent.
4. Mark a crop checked, then **Export reviewed JSON** and import it using HTML 17's **Import SegFormer WWR**.

### Window rectangle corrections

After detection, blue mask islands are fitted automatically with bounding rectangles. The red vector facade frame can be moved or resized inside the detection crop. Click its red outline to select it, then drag the frame or its corner handles. The ratio, autosave, Save button and SVG use this edited frame, clipping window area to its boundary. This does not rerun segmentation. To change the crop, adjust the red frame directly in **Define facade area**, then press **Detect** again. **Reset frame** restores the default inset frame. The new detection replaces that image?s saved result and regenerates its window rectangles. The previous saved ZIP remains until the new detection succeeds.

Only two editing buttons are shown:

- **Add window**: press the button, then drag a rectangle over a missed window.
- **Remove window**: press the button, then click a window rectangle to remove it.

Move an existing window by dragging it. Resize it with its corner handles. Adding or removing one window returns to normal move/resize interaction automatically. The red facade frame can also be moved/resized directly; no extra editing buttons are needed.

After correcting windows, press **Save** to explicitly update that image's ZIP, including `windows.svg` and its calculated ratio. After the ZIP is updated, Save automatically opens the next image in collection order. At the final image it stays there and confirms completion; a save failure never advances. Autosave remains active as a backup. Saving preserves the current review-checkbox state; use that checkbox when the result is ready for reviewed JSON export.

The ratio updates live using the union of window rectangles divided by the edited facade rectangle area; overlapping windows count once. The original AI mask ratio remains separate. Edits clear review approval. Check the result and use **Export reviewed JSON** to export the latest reviewed window geometry and ratios from disk for HTML 17, including images reviewed in previous sessions. Window edits and review decisions autosave to the image bundle. Wait for ?Saved to this image?s file? before closing.

Interactive results use one `<photo-id>.wwr.zip` per image under `results/interactive/`. A new detection atomically replaces that image?s ZIP. Window edits and verification status autosave into the same ZIP, and opening a photo restores the latest saved state. Original photographs are untouched. CPU inference is used and the model is reused after the first detection. Opening `interactive.html` directly is a preview only; detection requires the running local service.

For another source directory or saved collection:

```powershell
& '.\wwr-segformer\.runtime\python\python.exe' '.\wwr-segformer\interactive_server.py' --images 'images\browser-new-photos' --collection 'Facade-ID_BU_v017.html'
```

The requested research checkpoint is installed and tested. Start with the [20-image review](results/pilot/review.html), then import reviewed JSON into **HTML 17 → Import SegFormer WWR**. There is no detection server or paid inference API in this workflow.

Read [VERIFICATION.md](VERIFICATION.md) for the B5/B0 discrepancy, verified classes, weight-license uncertainty and actual test findings. Results are **estimated visible-pixel WWR**, not precise architectural measurements.

## One saved file per interactive image

Each ZIP contains `labels.png` (full-resolution class IDs), `mask.png` (full-resolution colour mask), `crop-mask.png` (two-colour crop preview), `overlay.jpg`, `crop.jpg`, `windows.svg` (latest editable rectangle geometry), `result.json` (raw AI counts plus edited vector ratio/review status), and `state.json` (crop and run metadata).

Rerunning detection overwrites the same ZIP, discarding the previous interactive run for that image. Temporary processing files are cleaned up after the ZIP is written. Manual window edits and review status update `windows.svg` and `result.json` in place, without changing the original AI masks. Autosave uses a short delay and displays save status. Stale saves from an older detection are rejected. **Export reviewed JSON** waits for saves and reads every latest reviewed image bundle, including previous sessions; unreviewed images are excluded.

The previous timestamped interactive folders have been consolidated to their latest saved AI detection. Pilot/batch outputs remain separate and are not deleted by interactive replacement.

## Use the installed environment

From `C:\Users\Toolbox\Documents\GitHub\SHIFT` in PowerShell:

```powershell
# Single photograph, with normalized target rectangle (left, top, right, bottom):
& '.\wwr-segformer\.runtime\python\python.exe' '.\wwr-segformer\test_image.py' '.\images\browser-new-photos\IMG_4443.jpg' --roi 0 0.13 1 0.75 --device cpu

# Reproduce the pilot, using stable photo IDs from your saved collection:
& '.\wwr-segformer\run.cmd' 'images\browser-new-photos' --rois 'wwr-segformer\pilot-rois.json' --limit 20 --collection 'Facade-ID_BU_v017.html' --output 'wwr-segformer\results\pilot' --device cpu

# Full directory once you have supplied a target rectangle for each photograph:
& '.\wwr-segformer\run.cmd' 'images\browser-new-photos' --rois 'your-regions.json' --collection 'Facade-ID_BU_v017.html' --output 'wwr-segformer\results\batch' --device cpu

# Reprocess selected filenames:
& '.\wwr-segformer\run.cmd' 'images\browser-new-photos' --rois 'your-regions.json' --only IMG_4443.jpg IMG_4444.jpg --force --output 'wwr-segformer\results\recheck' --device cpu
```

`--rois` is a JSON object mapping relative filenames to `[left,top,right,bottom]` normalized to 0..1 in the **EXIF-oriented** image. Pilot rectangles are approximate validation regions, not surveyed facade boundaries. If every input is already tightly cropped to a single facade, `--single-facade` is an explicit alternative. Multiple buildings must not be silently pooled; supply an ROI when the target is ambiguous. No rectification is applied, since the working collection is already straightened.

JPG/JPEG/PNG are supported, including iPhone JPEGs. Convert HEIC to JPEG first using your existing workflow. GPS is read only when present in the source EXIF. Browser JPEG copies often have no EXIF, so null coordinates are expected; survey map coordinates are preserved separately and never replaced.

## Outputs and review

Each source image is left untouched. Outputs include:

- Numeric class-ID mask at EXIF-oriented original dimensions (`*-labels.png`); outside the ROI is 255.
- Transparent colour mask (`*-mask.png`), overlay JPEG, legend, per-image AI JSON.
- `results.csv`, `results.json`, `results.geojson` (only actual GPS points), append-only `progress.jsonl`.
- `review.html`: original/overlay toggle, **Mark verified**, **Needs correction**, and **Export reviewed JSON**. Save this JSON to retain review decisions. AI per-image files remain unchanged.

The model is loaded once for a sequential batch. Corrupt/missing-ROI images produce failed rows and do not stop other images. Compatible per-image results are skipped unless `--force` is supplied. Missing artifacts cause reprocessing. A rerun's `results.json` contains that run's selected image set; use a separate output folder for a subset if you want to retain a full prior summary.

Open the review HTML locally on this computer so its local original/overlay paths remain accessible. When moving results to another computer, regenerate the review against that computer's source paths. Masks included in application-import JSON are bounded PNG previews; the full-resolution masks remain on disk.

In HTML 17, **Import SegFormer WWR** previews matches and skipped rows. Results are matched by collection dataset and unambiguous photo names/IDs. Verified results import by default; **Include results awaiting verification** is explicit. Existing AI estimates are preserved unless replacement is selected. Existing manual classifications and completion status are preserved in both cases.

Open a gallery profile to toggle its mask and mark the AI estimate verified or needing correction. The exact measurement is stored in `records[id].wwrSegmentation.measurement`, with review status kept separately. Analysis includes **Estimated WWR (visible pixels)** bands. Save HTML or export answers to keep these values with the collection. The existing manually tagged `types[].windows` field is never overwritten. Pixel-level editing is not included in this first implementation.

## Fresh installation / reproducibility

Use a standard Python 3.12 installation in a separate environment (not the Python bundled with another application):

```powershell
python -m venv 'wwr-segformer\.venv'
& '.\wwr-segformer\.venv\Scripts\python.exe' -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu
& '.\wwr-segformer\.venv\Scripts\python.exe' -m pip install -r 'wwr-segformer\requirements.txt'
& '.\wwr-segformer\.venv\Scripts\python.exe' 'wwr-segformer\download_sources.py'
& '.\wwr-segformer\.venv\Scripts\python.exe' 'wwr-segformer\inspect_checkpoint.py' 'wwr-segformer\models\best_model.pt' --report 'wwr-segformer\checkpoint_report.json'
```

`download_sources.py` pins the inspected source/config revisions and checks the actual checkpoint SHA-256. It refuses a changed checkpoint rather than silently selecting another model. Internet is needed for dependency/weight downloads only. Inference loads the checkpoint and JSON settings strictly from local files (`local_files_only=True`). `run.cmd` additionally sets offline flags. `requirements-tested.txt` records the actual installed environment.

For GPU inference, install a matching GPU-enabled torch build from [PyTorch](https://pytorch.org/get-started/locally/) into your own environment, then use `--device cuda` or `auto`. The included installation is deliberately CPU-only; GPU performance has not been tested.

Model weights, runtime, large upstream notebooks and generated results are ignored by Git. Do not redistribute checkpoint weights on the assumption that the repository's MIT software license explicitly covers them.

## Validation

```powershell
& '.\wwr-segformer\.runtime\python\python.exe' -m unittest discover -s 'wwr-segformer\tests' -v
& '.\wwr-segformer\.runtime\python\python.exe' 'wwr-segformer\validate.py' 'wwr-segformer\results\pilot\results.json'
& '.\wwr-segformer\.runtime\python\python.exe' 'wwr-segformer\validate.py' 'wwr-segformer\results\pilot\results.json' --references 'manual-reference.csv'
```

Reference CSV columns: `image_id,wwr_percent`. Annotate the **same selected region and denominator** before comparing. No accuracy score is claimed without independent reference annotations.

Known limitations: coarse building class, shutters/deep reveals, reflections, missed small windows, balconies/loggias, ground-floor shopfronts, vegetation, neighbouring buildings and occlusion. WWR uses windowpane / (windowpane + wall + building proxy), excluding other classes such as doors. Visible-pixel area from an oblique image is not true geometric facade area. Manual region selection and visual review remain necessary; a refined facade-specific label set and independent annotations would improve evaluation.

Files: `segmentation.py` is the shared model/measurement core; `test_image.py` runs one image; `batch.py` provides processing/exports; `review-template.html` provides local review; `integration-v017.js/css` and `embed_integration.py` maintain the small HTML 17 integration. Source provenance and architecture inspection are in `source_manifest.json` and `checkpoint_report.json`.
