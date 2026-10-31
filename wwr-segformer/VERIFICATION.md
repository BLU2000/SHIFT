# Verification findings — 30 October 2026

## Existing application

`Facade-ID_BU_v017.html` is a self-contained browser application. Its `collection-data` script contains `dataset`, photos with stable IDs and embedded JPEGs, and per-photo `records`. Survey fractions are in `records[id].types[].windows`. Browser persistence uses IndexedDB and HTML/JSON exports. The smallest integration is an additional result-file importer and per-photo metadata; Python inference remains separate. Manual survey fields are not overwritten.

## Upstream and checkpoint

- Research source: https://github.com/zoedesimone/wwr-semantic-segmentation
- Inspected commit: `fba3dff1984c6f6eec3ffd685a2a85156b676e5c`.
- README checkpoint folder: https://drive.google.com/drive/folders/1PqjyLutdoXSaGhUr3kYJDzBu12rurLwh
- Actual file: `best_model.pt`, Drive ID `1eVqbUzLsAbhkppAvV9KcQb_5sPQpRjMu`, 15,096,919 bytes.
- SHA-256: `39e7a8ac41f257bb795e51ea111d9ab1ce9c1569f02f0a8871919f6292968480`.

**Mismatch:** the notebook loads `nvidia/mit-b5` with 150 classes, but the linked checkpoint has encoder depths `[2,2,2,2]`, hidden sizes matching MiT-B0, and classifier shape `[150,256,1,1]`. This is the actual published B0 checkpoint, not a substituted detector. It loads strictly into Hugging Face `SegformerForSemanticSegmentation` using the B0 configuration. No base-model weights are substituted and no layers are left uninitialized after checkpoint loading. Static tensor inspection is recorded in `checkpoint_report.json`.

The architecture/class configuration and processor come from `nvidia/segformer-b0-finetuned-ade-512-512` at revision `489d5cd81a0b59fab9b7ea758d3548ebe99677da`. Only JSON files are used from this model; its weights are not used. Preprocessing matches the research notebook's B0 feature extractor: 512×512 resize, ImageNet normalization with mean `[0.485,0.456,0.406]` and standard deviation `[0.229,0.224,0.225]`. Label reduction applies during training-label processing, not to inference predictions. Transformers 4.51.3 reports the legacy `feature_extractor_type` metadata key as ignored; normalization and resize settings are loaded correctly.

## Classes and denominator

The verified ADE20K mapping is **0 = wall, 1 = building, 8 = windowpane**, not an assumed binary window/background model. The source dataset overlays annotated windows on scene-segmentation labels, retaining other ADE classes. It does not establish a precise, instance-specific opaque-facade boundary.

This implementation reports `windowpane / (windowpane + wall + building)`. `building` is explicitly an **opaque exterior proxy**, not a guaranteed architectural wall surface. Sky, vegetation, doors and all other classes are excluded. This can also exclude frames/reveals or misclassified facade parts. The selected ROI excludes neighbouring buildings by construction where the ROI is correct; the model itself does not separate building instances. No hidden windows or walls are reconstructed.

Thus every result is an **estimated visible-pixel WWR for the chosen region**, not exact whole-building/geometric WWR. Oblique views still bias area ratios. Pixel mask dimensions refer to the EXIF-oriented original image. There is no additional perspective correction in this pipeline.

## License check

The upstream code has an MIT license, retained in `sources/LICENSE`. The Drive folder contains the checkpoint but no separate weight license/model card or redistribution grant that we could verify. Do **not** infer explicit weight redistribution terms from the code license alone. Weights are downloaded locally and ignored by Git; they are not bundled into HTML or committed. The B0 configuration's origin is also retained in the manifest. Clarify weight redistribution/commercial-use terms with the authors before distributing weights; no contact was sent.

## Executed validation

- Installed a project-local CPU environment: Python 3.12.10, PyTorch 2.7.1+cpu, Transformers 4.51.3. No SAM/DINO or GPU runtime was installed for this workflow.
- Strict checkpoint loading and actual inference succeeded offline on real local facade photographs.
- A 20-image pilot with explicit approximate target-region rectangles completed in **35.4 seconds**, with **0 failed images**, **0 undefined ratios**, and **0 manually verified results**. Values ranged from 0 to approximately 31.2 percent. This is a functional smoke test, not a benchmark of accuracy.
- `IMG_4443.jpg`, upper facade ROI `[0,0.13,1,0.75]`: 165,686 window pixels, 653,706 opaque-proxy pixels, **20.2206%** WWR. The overlay identifies most openings but boundaries are incomplete and shuttered openings have uneven coverage.
- `IMG_4441-2.jpg` returned zero detected windows; the narrow bottom window strip appears missed. It is flagged for review, not accepted as a verified zero.
- `IMG_4443` is absent from the current HTML collection, so it is deliberately excluded from application import.
- The pilot covers punched windows, deep reveals, shutters, balconies/loggias, reflections, shadows and ground-floor obstructions. These are not independently annotated references. `validate.py --references ...` computes MAE and bias only when manual reference values for the same regions are supplied.

Original images were read, not modified. Generated masks, overlays and pilot exports live under ignored `results/`. The importer stores exact measurements separately from manually classified fractional ratios.
