# Facade ID

Open **Facade-ID.html** in a modern browser. It contains the entire English application and all 85 photographs from `images/Sorted Images`. No server, account, internet connection, or photo import is required. The original HEIC files are preserved; embedded JPEG copies are resized to a maximum of 1600 pixels for portability.

The interface uses Yves/Klein blue (#002FA7), white, and black. The preferred font is DIN 2014, with Bahnschrift and system sans-serif fallbacks. DIN 2014 is not bundled; it must be installed on the user's computer or supplied as a licensed webfont to display exactly on every computer. Photograph colors are preserved; the live map uses a neutral Positron style.

**Add photos** in the sidebar accepts multiple new photographs. JPEG, PNG, WebP, GIF and AVIF are decoded locally; HEIC/HEIF works only if the browser supports it, otherwise convert to JPEG first. Photos are resized to a maximum of 1600 pixels and embedded as JPEG. Uploaded photos persist in browser storage and are included in saved HTML, including when merging participant copies. The same original file has a stable SHA-256 ID, so uploading it twice skips duplicates. Use the map to place newly uploaded photos; GPS extraction from new uploads is not implemented.

Every selected façade type except Punched-window façade (Lochfassade) asks for threshold depth and enclosure directly. There is no separate threshold yes/no question. Enclosure uses Low (mostly open), Medium (partly enclosed), High (mostly enclosed), or Unknown. Depth includes Not applicable. Previous fractional opening ratios are preserved in old data but are not silently converted into the new enclosure categories. The radar comparison uses enclosure rather than opening ratio. The app background is Yves blue, with white form panels.

The optional **live location map** requires internet. In Location, click **Open live map**, then click the street map or drag the pin to place the photograph. **Pin map center** provides another way to choose a location. You can clear the pin, restore the photo's original GPS, or edit coordinates directly. All changes save automatically and are included in HTML/JSON exports and merges. The OpenStreetMap link opens the selected position in a separate tab.

Live maps use [OpenFreeMap](https://openfreemap.org/) with OpenStreetMap data and the open-source MapLibre GL JS library; no API key is needed. MapLibre and its CSS are embedded in the standalone HTML. Only map styles and tiles load online, when you open the map. If the map service or WebGL is unavailable, the coordinate fields and external OpenStreetMap link remain usable. Standard browser requests for the viewed map area are sent to the map provider; photos and answers remain local. Map attribution is displayed on the live map.

## Working and sharing

- Answer Location → Urban context → Divide façade → Describe types → Review.
- Location and contributor information are optional. All classification questions are required before marking a photograph complete.
- Answers save automatically to IndexedDB in the same browser. Browser storage is local to the browser/profile and can be cleared. Some private browsing environments restrict persistence.
- **Save** asks for your initials (for example BU), then downloads a self-contained copy such as `Facade-ID_BU_v001.html`. The next save becomes `v002`. Initials, revision, and save time are stored inside the HTML, and the sequence continues when reopening a saved copy. The browser also remembers the latest revision for this collection. Each participant's independent copy can have its own sequence; this is not a central version-control system. Canceling does not increment the revision.
- Use Save before sharing or moving computers. It downloads a new file rather than silently overwriting the original. Allow the download and verify the downloaded copy exists; browsers cannot confirm that a download was actually kept on disk.
- **Merge files** in the sidebar accepts HTML files and legacy JSON answers, including multiple files. Stable photograph IDs match records. Conflicting profiles require an explicit choice; they are never silently overwritten. Resolve conflicts before handing off the final collection.
- Each participant should work in their own browser/profile. Multiple copies of this collection opened in the same browser share its saved work. Avoid editing this collection in multiple tabs simultaneously.

## Analysis

Includes completion counts, filtering and grouping by façade type and greenery, a façade-type × greenery matrix, and two configurable charts. Chart settings persist in browser storage and saved HTML.

- The radar compares two individual façade types (including types within the same photo). Choose at least three of eight quantitative, ordered, or binary dimensions. Fractions use their actual 0–1 values; ordered and binary categories are evenly normalized between 0 and 1. Unknown/not-applicable values remain missing, with gaps instead of zero-filled polygons. Higher values do not imply better performance.
- The X/Y relationship chart offers 13 attributes, including façade type and material as categorical axes. Each described façade type contributes one observation; photo-level context repeats across a photo's types. Missing/not-applicable pairs are excluded and counted. Coincident observations form a counted bubble; select it to list profiles, then open a specific façade type. No artificial jitter or numerical correlation is applied to categorical attributes.

Optional coordinates also appear on an offline coordinate plot without a street basemap. Select a location or a grouped photograph to open its profile.

Photo region annotations are not implemented. The collection overview uses an offline coordinate plot; a live street map is available for each photo in the Location step.

GPS metadata is available for 35 of the 85 original photos. These coordinates prefill the Location step and appear on the geographic overview even before classification. Existing manually entered coordinates take priority. The remaining 50 photos need manual locations. Photo GPS describes the camera position, rather than an exact building address. No reverse geocoding or external upload is performed.

## Source and rebuilding

`index.html` is the editable application template. `prepare_collection.ps1` produces the standalone deliverable with the existing JPEG copies. Run it again after changing the template:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File prepare_collection.ps1
```

`convert_photos.py` originally decoded the HEIC files using the locally installed GIMP 3 `libheif.dll`. It requires the Python interpreter bundled with GIMP and skips photos that already have a JPEG. `prepare_collection.ps1` converts its intermediate BMPs to JPEG and removes only those intermediate files.

`extract_locations.py` reads GPS EXIF directly from the original HEIC photos using the same library and writes `photo-locations.json`. The preparation script embeds those locations in the portable HTML.

`browser_checks.py` prepares an offline browser smoke test from the template, covering required fields, multiple selection, conditional types, autosave, merging, completion, analysis, and HTML export. It uses only the Python standard library.
