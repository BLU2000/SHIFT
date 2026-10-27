/* OpenFreeMap + MapLibre location picker. Application records stay local. */
let locationMap = null, locationMarker = null, liveMapsEnabled = false;
let lastMapView = null, mapSyncTimer = null, mapLoadTimer = null;
const LIVE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

function validPosition(location) {
  if (!location || location.lat === '' || location.lng === '' || location.lat == null || location.lng == null) return null;
  const lat = Number(location.lat), lng = Number(location.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? {lat, lng} : null;
}

function mapPickerMarkup() {
  const photo = photos.find(p => p.id === current);
  return `<section class="location-picker" aria-label="Choose photo location on a map">
    <div class="map-heading"><strong>Pin the photograph</strong><a id="osmLocationLink" target="_blank" rel="noopener">Open in OpenStreetMap ↗</a></div>
    <p class="hint">Open the live street map, then click to place a pin or drag the pin to move it. Zoom in to select the correct building.</p>
    <button type="button" id="openLocationMap">${liveMapsEnabled ? 'Reload live map' : 'Open live map'}</button>
    <div id="locationMap" class="location-map" hidden aria-label="Interactive location map"></div>
    <p id="locationMapStatus" class="hint" role="status">Live map by OpenFreeMap · OpenStreetMap data · Internet required. Photos and answers stay on your device.</p>
    <div class="map-actions"><button type="button" id="pinMapCenter" disabled>Pin map center</button><button type="button" id="clearMapPin">Clear location</button>${photo.location ? '<button type="button" id="restorePhotoGps">Restore photo GPS</button>' : ''}</div>
  </section>`;
}

function setMapStatus(text, warning = false) {
  const status = document.getElementById('locationMapStatus');
  if (status) { status.textContent = text; status.classList.toggle('error', warning); }
}

function updateOsmLink() {
  const link = document.getElementById('osmLocationLink');
  if (!link) return;
  const position = validPosition(rec().location);
  const center = position || lastMapView || photos.map(p => validPosition(locationFor(p))).find(Boolean) || {lat: 48.14, lng: 11.58};
  link.href = position
    ? `https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=19/${position.lat}/${position.lng}`
    : `https://www.openstreetmap.org/#map=12/${center.lat}/${center.lng}`;
}

function disposeLocationMap() {
  clearTimeout(mapSyncTimer); clearTimeout(mapLoadTimer);
  if (locationMap) {
    const center = locationMap.getCenter();
    lastMapView = {lat: center.lat, lng: center.lng, zoom: locationMap.getZoom()};
    locationMap.remove();
  }
  locationMap = null; locationMarker = null;
}

function mountLocationPicker() {
  updateOsmLink();
  if (liveMapsEnabled) openLocationMap();
}

function writeMapPosition(position, source) {
  const lat = Math.max(-90, Math.min(90, position.lat));
  const lng = ((position.lng + 180) % 360 + 360) % 360 - 180;
  const record = rec();
  record.location.lat = lat.toFixed(7); record.location.lng = lng.toFixed(7);
  record.location.source = source;
  for (const key of ['lat', 'lng']) {
    const input = document.getElementById(key);
    if (input) input.value = record.location[key];
  }
  changed(); syncLocationMarker(false); updateOsmLink();
  setMapStatus('Pin updated. Coordinates save automatically in this browser.');
}

function syncLocationMarker(recenter = false) {
  updateOsmLink();
  if (!locationMap) return;
  const position = validPosition(rec().location);
  if (!position) {
    if (locationMarker) locationMarker.remove();
    locationMarker = null;
    return;
  }
  if (!locationMarker) {
    locationMarker = new maplibregl.Marker({color: '#002FA7', draggable: true})
      .setLngLat([position.lng, position.lat]).addTo(locationMap);
    const element = locationMarker.getElement();
    element.setAttribute('aria-label', 'Photo location pin. Drag to move, or edit the coordinate fields.');
    locationMarker.on('dragend', () => writeMapPosition(locationMarker.getLngLat(), 'Manual map pin'));
  } else locationMarker.setLngLat([position.lng, position.lat]);
  if (recenter) locationMap.jumpTo({center: [position.lng, position.lat], zoom: Math.max(16, locationMap.getZoom())});
}

function scheduleMapSync() {
  clearTimeout(mapSyncTimer);
  mapSyncTimer = setTimeout(() => syncLocationMarker(true), 300);
}

function openLocationMap() {
  const container = document.getElementById('locationMap');
  if (!container || locationMap) return;
  liveMapsEnabled = true; container.hidden = false;
  const button = document.getElementById('openLocationMap');
  button.hidden = true;
  if (typeof maplibregl === 'undefined') {
    setMapStatus('Map controls could not load. Enter coordinates manually or use the OpenStreetMap link.', true);
    button.hidden = false; return;
  }
  const position = validPosition(rec().location);
  const nearby = photos.map(p => validPosition(locationFor(p))).find(Boolean);
  const center = position || lastMapView || nearby || {lat: 48.14, lng: 11.58};
  try {
    const map = new maplibregl.Map({container, style: LIVE_MAP_STYLE,
      center: [center.lng, center.lat], zoom: position ? 17 : lastMapView?.zoom || 12,
      attributionControl: {compact: false}, maxZoom: 20});
    locationMap = map;
    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
    map.addControl(new maplibregl.AttributionControl({compact: false, customAttribution: '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>'}), 'bottom-left');
    document.getElementById('pinMapCenter').disabled = false;
    syncLocationMarker();
    setMapStatus('Loading street map… You can pan, zoom, and click to place the pin.');
    map.on('click', event => {
      if (locationMap === map) writeMapPosition(event.lngLat, 'Manual map pin');
    });
    map.on('load', () => {
      clearTimeout(mapLoadTimer);
      if (locationMap === map) setMapStatus('Click the map to place the pin. Drag it to adjust. Changes save automatically.');
    });
    map.on('error', () => {
      if (locationMap !== map) return;
      setMapStatus('Some map data could not load. Check your connection. Coordinates and the OpenStreetMap link still work.', true);
      button.hidden = false;
    });
    mapLoadTimer = setTimeout(() => {
      if (locationMap === map && !map.isStyleLoaded()) {
        setMapStatus('The live map is taking too long to load. Check your connection or use the OpenStreetMap link.', true);
        button.hidden = false;
      }
    }, 15000);
  } catch (error) {
    disposeLocationMap(); button.hidden = false;
    setMapStatus('The live map is unavailable in this browser. Enter coordinates manually or use the OpenStreetMap link.', true);
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'openLocationMap') { disposeLocationMap(); openLocationMap(); }
  if (button.id === 'pinMapCenter' && locationMap) writeMapPosition(locationMap.getCenter(), 'Manual map pin');
  if (button.id === 'clearMapPin') {
    rec().location.lat = ''; rec().location.lng = ''; rec().location.source = 'Manually cleared';
    document.getElementById('lat').value = ''; document.getElementById('lng').value = '';
    changed(); syncLocationMarker(); setMapStatus('Location cleared. Click the map to choose a new position.');
  }
  if (button.id === 'restorePhotoGps') {
    const photo = photos.find(p => p.id === current);
    if (photo.location) { writeMapPosition(photo.location, 'Photo GPS metadata'); syncLocationMarker(true); }
  }
});
