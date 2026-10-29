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

let overviewMap=null,overviewMarkers=[],overviewPoints=[],overviewLoadTimer=null;
function disposeOverviewMap(){
  clearTimeout(overviewLoadTimer);
  overviewMarkers.forEach(marker=>marker.remove());overviewMarkers=[];
  if(overviewMap)overviewMap.remove();overviewMap=null;
}
function fitOverviewPhotos(){
  if(!overviewMap||!overviewPoints.length)return;
  const bounds=new maplibregl.LngLatBounds();overviewPoints.forEach(p=>{const v=validPosition(locationFor(p));bounds.extend([v.lng,v.lat]);});
  overviewMap.fitBounds(bounds,{padding:55,maxZoom:17,duration:0});
}
function mountOverviewMap(list){
  overviewPoints=list.filter(p=>validPosition(locationFor(p)));
  const host=document.getElementById('mapPlot'),fallback=host.innerHTML;
  host.innerHTML=`<div class="overview-map-toolbar"><span>${overviewPoints.length} located · ${list.length-overviewPoints.length} without coordinates</span><button type="button" id="fitOverviewPhotos">Show all photos</button></div><div id="geographicMap" class="geographic-map" aria-label="Interactive map of all photo locations"></div><p id="overviewMapStatus" class="hint" role="status">Loading live street map… Internet required.</p><details id="overviewMapFallback" hidden><summary>Offline coordinate overview</summary>${fallback}</details>`;
  const status=(message,failed=false)=>{const label=document.getElementById('overviewMapStatus');if(label)label.textContent=message;const backup=document.getElementById('overviewMapFallback');if(backup)backup.hidden=!failed;};
  if(window.DISABLE_LIVE_OVERVIEW_FOR_TESTS){status('Live overview disabled for automated form checks.');return;}
  if(typeof maplibregl==='undefined'){status('Live map controls are unavailable. The offline coordinate overview is available below.',true);return;}
  try{
    const first=overviewPoints[0]&&validPosition(locationFor(overviewPoints[0]));
    const map=new maplibregl.Map({container:'geographicMap',style:LIVE_MAP_STYLE,center:first?[first.lng,first.lat]:[11.58,48.14],zoom:12,attributionControl:{compact:false},maxZoom:20});overviewMap=map;
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    const groups=new Map();overviewPoints.forEach(photo=>{const location=validPosition(locationFor(photo)),key=location.lat+','+location.lng;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(photo);});
    for(const group of groups.values()){
      const position=validPosition(locationFor(group[0])),element=document.createElement('button');
      element.type='button';element.dataset.colorPhotoIds=JSON.stringify(group.map(p=>p.id));element.className='overview-marker';element.textContent=group.length>1?String(group.length):'';
      element.setAttribute('aria-label',group.length>1?group.length+' photos at this location':group[0].name);element.title=group.map(p=>p.name).join(', ');
      const marker=new maplibregl.Marker({element}).setLngLat([position.lng,position.lat]).addTo(map);overviewMarkers.push(marker);
      element.addEventListener('click',event=>{
        event.stopPropagation();
        const content=document.createElement('div');content.className='overview-popup';
        const title=document.createElement('strong');title.textContent=group.length>1?group.length+' photos at this location':group[0].name;content.append(title);
        group.forEach(photo=>{const button=document.createElement('button');button.type='button';button.dataset.photo=photo.id;button.className='overview-photo';const image=document.createElement('img');image.src=photo.src;image.alt='';const text=document.createElement('span');text.textContent=photo.name+' · '+(records[photo.id]?.completed?'Completed':records[photo.id]?.updatedAt?'In progress':'Not started');button.append(image,text);content.append(button);});
        new maplibregl.Popup({maxWidth:'300px'}).setLngLat([position.lng,position.lat]).setDOMContent(content).addTo(map);
      });
    }
    fitOverviewPhotos();refreshMapColors();
    map.on('load',()=>{clearTimeout(overviewLoadTimer);if(overviewMap===map)status('Scroll or use + / − to zoom. Drag to pan. Select a marker to open its photos.');});
    map.on('error',()=>{if(overviewMap===map)status('Some map data could not load. Check your connection, or use the offline coordinate overview below.',true);});
    overviewLoadTimer=setTimeout(()=>{if(overviewMap===map&&!map.isStyleLoaded())status('The live map is unavailable. Use the offline coordinate overview below.',true);},15000);
  }catch(error){disposeOverviewMap();status('The live map is unavailable in this browser. Use the offline coordinate overview below.',true);}
}
document.addEventListener('click',event=>{if(event.target.closest('#fitOverviewPhotos'))fitOverviewPhotos();});
