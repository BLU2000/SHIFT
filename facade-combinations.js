/* Counts observed combinations, one contribution per photograph. No synthetic cross-products. */
(function(root){
 'use strict';
 function canonical(raw){
  const values=Array.isArray(raw)?raw:[raw];
  return [...new Set((values.length?values:[null]).map(v=>v==null||v===''?'Unanswered':String(v)))].sort();
 }
 function tabulate(items,keys,read,includeMissing=true){
  const groups=new Map(),excluded=[];
  for(const item of items){
   const values=keys.map(key=>canonical(read(item,key)));
   if(!includeMissing&&values.some(v=>v.some(x=>['Unanswered','Unknown'].includes(x)))){excluded.push(item);continue;}
   const key=JSON.stringify(values);
   if(!groups.has(key))groups.set(key,{values,members:[]});
   groups.get(key).members.push(item);
  }
  const total=items.length-excluded.length;
  return {groups:[...groups.values()].sort((a,b)=>b.members.length-a.members.length||JSON.stringify(a.values).localeCompare(JSON.stringify(b.values))).map(g=>({...g,count:g.members.length,percentage:total?100*g.members.length/total:0})),total,excluded};
 }
 const api={canonical,tabulate};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 root.FacadeCombinations=api;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let dialog,defs=[],result=null,chosen=[],lastFocus=null,mapHits=[],mapLocations=[],combinationMap=null;
 const palette=['#0057b8','#df5b16','#198754','#a13eb5','#d12c66','#a27900','#008e9b','#6949ce','#823b24','#626a12','#006b64','#b73f3f','#3985cc','#a05195','#bd7800','#536a9e','#238a55','#8d4b64','#654321','#595959'];
 function groupColor(index){
  return palette[index]||`hsl(${((index-palette.length)*137.508)%360} 72% ${index%2?35:48}%)`;
 }
 function disposeMap(){if(combinationMap){combinationMap.remove();combinationMap=null;}}
 if(typeof restoreAnalysisSettings==='function'){
  const restore=restoreAnalysisSettings;restoreAnalysisSettings=function(value){restore(value);if(value?.combinations)analysisSettings.combinations=structuredClone(value.combinations);};
  if(embedded.analysisSettings?.combinations)analysisSettings.combinations=structuredClone(embedded.analysisSettings.combinations);
 }
 if(typeof saveHtml==='function'){
  const save=saveHtml;saveHtml=async function(...args){const panel=document.getElementById('facadeCombinationsDialog');if(panel){panel.close();panel.remove();}try{return await save.apply(this,args);}finally{if(panel)document.body.appendChild(panel);}};
 }
 function attach(){
  const existing=document.getElementById('facadeCombinationsOpen');if(existing){existing.onclick=open;return;}
  const host=document.querySelector('header .toolbar')||document.querySelector('header');if(!host)return;
  const button=document.createElement('button');button.id='facadeCombinationsOpen';button.className='fc-entry';button.type='button';button.textContent='Category combinations';button.onclick=open;host.appendChild(button);
 }
 function open(){
  lastFocus=document.activeElement;
  defs=filterDefinitions().filter(d=>!['type.share','type.threshold','record.location'].includes(d.key));
  const saved=analysisSettings.combinations||{};
  const selected=new Set(saved.attributes||['context.streetRatio','context.orientation','context.storeys','record.thresholdTypes']);
  disposeMap();result=null;
  dialog=document.getElementById('facadeCombinationsDialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='facadeCombinationsDialog';dialog.className='fc-dialog';document.body.appendChild(dialog);dialog.addEventListener('close',()=>{disposeMap();lastFocus?.focus();});}
  dialog.innerHTML=`<div class="fc-head"><div><h2>Category combinations</h2><p>Observed combinations, counted once per facade. No clustering or inferred groups.</p></div><button type="button" id="comb-close">Close</button></div><div class="fc-body"><aside class="fc-controls"><p class="fc-help">Choose the attributes that define a combination. Multiple labels stay together, for example Balcony + Loggia. Each photograph represents one facade.</p><label><input type="checkbox" id="comb-filter" ${saved.filtered?'checked':''}>Use current analysis filters</label><label><input type="checkbox" id="comb-missing" ${saved.includeMissing!==false?'checked':''}>Include incomplete profiles as categories</label><label>Storey bands <select id="comb-storeys"><option value="0">Exact storey count</option><option value="3">1–3, 4–6, 7–9, …</option><option value="5">1–5, 6–10, 11–15, …</option></select></label><fieldset><legend>Combination attributes</legend>${defs.map(d=>`<label><input type="checkbox" data-comb-attribute="${esc(d.key)}" ${selected.has(d.key)?'checked':''}>${esc(d.label)}${d.scope==='type'?' (all section labels)':''}</label>`).join('')}</fieldset><button type="button" class="fc-primary" id="comb-run">Show combinations</button><button type="button" id="comb-export" disabled>Export frequency table CSV</button><p class="fc-help">Percentages use included facades after filters and missing-data exclusions. All observed rows are shown, with no invented zero-count combinations. Type-level attributes summarize the label set across all non-zero-share sections of the facade.</p></aside><section class="fc-results"><div class="fc-status" id="comb-status" role="status">Choose attributes and show combinations.</div><div id="comb-output"></div><div id="comb-preview"></div></section></div>`;
  dialog.querySelector('#comb-storeys').value=String(saved.storeyBand||0);
  dialog.querySelector('#comb-close').onclick=()=>dialog.close();
  dialog.querySelector('#comb-run').onclick=run;dialog.querySelector('#comb-export').onclick=exportCSV;
  dialog.querySelectorAll('input,select').forEach(input=>input.addEventListener('change',()=>{disposeMap();result=null;dialog.querySelector('#comb-export').disabled=true;dialog.querySelector('#comb-output').innerHTML='';dialog.querySelector('#comb-preview').innerHTML='';dialog.querySelector('#comb-status').textContent='Settings changed. Select Show combinations to update.';}));
  dialog.showModal();run();
 }
 function read(item,key){
  const d=defs.find(d=>d.key===key),record=records[item.id]||{};
  if(d.field==='storeys'){
   const raw=attributeFilterValue(item,record,{},d),band=Number(dialog.querySelector('#comb-storeys').value),n=Number(raw);
   return band&&raw!=null&&raw!==''&&Number.isInteger(n)&&n>=1?`${Math.floor((n-1)/band)*band+1}–${Math.floor((n-1)/band)*band+band} storeys`:raw;
  }
  if(d.scope==='type'){
   const parts=(record.types||[]).filter(t=>window.FacadeClustering.fraction(t.share)!==0);
   return parts.length?parts.flatMap(t=>{const raw=attributeFilterValue(item,record,t,d);return Array.isArray(raw)?raw.length?raw:[null]:[raw];}):null;
  }
  return attributeFilterValue(item,record,{},d);
 }
 function run(){
  disposeMap();
  chosen=defs.filter(d=>dialog.querySelector(`[data-comb-attribute="${d.key}"]`).checked);
  if(!chosen.length){dialog.querySelector('#comb-status').textContent='Select at least one attribute.';return;}
  const filtered=dialog.querySelector('#comb-filter').checked,includeMissing=dialog.querySelector('#comb-missing').checked;
  const items=photos.filter(p=>!filtered||filterPhotoMatches(p));
  result=tabulate(items,chosen.map(d=>d.key),read,includeMissing);
  const allCombinations=tabulate(photos,chosen.map(d=>d.key),read,true).groups;
  const colorKeys=allCombinations.map(g=>JSON.stringify(g.values));
  result.groups.forEach(g=>g.color=groupColor(colorKeys.indexOf(JSON.stringify(g.values))));
  analysisSettings.combinations={attributes:chosen.map(d=>d.key),filtered,includeMissing,storeyBand:Number(dialog.querySelector('#comb-storeys').value)};persist();
  dialog.querySelector('#comb-status').textContent=`${result.total} facades · ${result.groups.length} observed combinations · ${result.excluded.length} excluded for incomplete selected attributes · ${photos.length-items.length} outside enabled filters. Each included facade counts once.`;
  const max=result.groups[0]?.count||1;
  const bars=result.groups.slice(0,12).map((g,i)=>`<g><text x="5" y="${27+i*29}" font-size="11">${i+1}</text><rect x="35" y="${12+i*29}" width="${g.count/max*490}" height="20" fill="${g.color}" tabindex="0" role="button" data-comb-row="${i}" aria-label="View combination ${i+1}"><title>${esc(g.values.map(v=>v.join(' + ')).join(' / '))}: ${g.count}</title></rect><text x="${45+g.count/max*490}" y="${27+i*29}" font-size="11">${g.count} (${g.percentage.toFixed(1)}%)</text></g>`).join('');
  dialog.querySelector('#comb-output').innerHTML=result.total?`<div class="fc-charts"><section class="fc-chart fc-wide"><h3>Most frequent combinations</h3><svg viewBox="0 0 650 ${25+Math.min(12,result.groups.length)*29}" role="img" aria-label="Counts of up to twelve most frequent combinations">${bars}</svg><p class="fc-help">Numbers match the table rows below. All ${result.groups.length} combinations appear in the table.</p></section><section class="fc-chart fc-wide"><h3>Combination locations</h3><div id="comb-map"></div></section></div><div style="overflow-x:auto"><table class="fc-table" id="comb-table"><thead><tr><th>#</th>${chosen.map(d=>`<th>${esc(d.label)}</th>`).join('')}<th>Facades</th><th>Share</th><th>Members</th></tr></thead><tbody>${result.groups.map((g,i)=>`<tr><td><i class="fc-swatch" style="background:${g.color}"></i>${i+1}</td>${g.values.map(v=>`<td>${esc(v.join(' + '))}</td>`).join('')}<td>${g.count}</td><td>${g.percentage.toFixed(1)}%</td><td><button type="button" data-comb-row="${i}">View ${g.count}</button></td></tr>`).join('')}</tbody><tfoot><tr><th colspan="${chosen.length+1}">Total included</th><th>${result.total}</th><th>100%</th><th></th></tr></tfoot></table></div>`:'<p>No facades match these settings. Include incomplete profiles, change filters, or select other attributes.</p>';
  if(result.excluded.length)dialog.querySelector('#comb-output').insertAdjacentHTML('beforeend',`<details><summary>Excluded incomplete profiles (${result.excluded.length})</summary><ul>${result.excluded.map(p=>`<li>${esc(p.name)}</li>`).join('')}</ul></details>`);
  dialog.querySelectorAll('[data-comb-row]').forEach(b=>{b.onclick=()=>members(Number(b.dataset.combRow));b.onkeydown=event=>{if(['Enter',' '].includes(event.key)&&b.tagName.toLowerCase()!=='button'){event.preventDefault();b.onclick();}};});
  renderMap();
  dialog.querySelector('#comb-export').disabled=!result.total;dialog.querySelector('#comb-preview').innerHTML='';
 }
 function members(index,subset=null){
  const original=result.groups[index],group=subset?{...original,members:subset,count:subset.length}:original,host=dialog.querySelector('#comb-preview');
  host.innerHTML=`<h3>Combination ${index+1}: ${group.count} facades</h3><p>${esc(group.values.map(v=>v.join(' + ')).join(' / '))}</p><div>${group.members.map((p,i)=>`<button type="button" class="fc-member" data-comb-member="${i}">${esc(p.name)}</button>`).join('')}</div><div id="comb-photo"></div>`;
  host.querySelectorAll('[data-comb-member]').forEach(b=>b.onclick=()=>{
   const photo=group.members[Number(b.dataset.combMember)],target=host.querySelector('#comb-photo');
   target.innerHTML=`<h4>${esc(photo.name)}</h4>${photo.src?`<img class="fc-preview" src="${esc(photo.src)}" alt="${esc(photo.name)}">`:''}<button type="button" id="comb-edit">Open facade profile</button>`;
   target.querySelector('#comb-edit').onclick=()=>{dialog.close();current=photo.id;step=0;typeIndex=0;view='entry';if(typeof topGalleryActive!=='undefined')topGalleryActive=false;render();};
  });host.scrollIntoView({block:'nearest'});
 }
 function mapMarkup(){
  const positioned=[],locations=new Map();mapHits=[];
  result.groups.forEach((group,index)=>group.members.forEach(photo=>{
   const raw=typeof locationFor==='function'?locationFor(photo):photo.location;
   if(!raw||raw.lat==null||raw.lng==null||raw.lat===''||raw.lng==='')return;
   const lat=Number(raw.lat),lng=Number(raw.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
   positioned.push(photo);
   const key=lat.toFixed(6)+','+lng.toFixed(6);
   if(!locations.has(key))locations.set(key,{lat,lng,groups:new Map()});
   const point=locations.get(key);if(!point.groups.has(index))point.groups.set(index,[]);point.groups.get(index).push(photo);
  }));
  const missing=result.total-positioned.length;
  if(!positioned.length)return `<p class="fc-help" id="comb-map-status">No valid coordinates for these ${result.total} facades. Add locations to display them on the map. Counts still include them.</p>`;
  const project=(lng,lat)=>[lng,Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360))*180/Math.PI];
  const points=[...locations.values()],projected=points.map(p=>project(p.lng,p.lat));mapLocations=points;
  let xmin=Math.min(...projected.map(p=>p[0])),xmax=Math.max(...projected.map(p=>p[0])),ymin=Math.min(...projected.map(p=>p[1])),ymax=Math.max(...projected.map(p=>p[1]));
  const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,span=Math.max(xmax-xmin,(ymax-ymin)*650/300,.04)*1.3,sy=span*300/650;
  xmin=cx-span/2;xmax=cx+span/2;ymin=cy-sy/2;ymax=cy+sy/2;
  const xy=p=>[25+(p[0]-xmin)/(xmax-xmin)*600,275-(p[1]-ymin)/(ymax-ymin)*250];
  let svg='<svg viewBox="0 0 650 300" role="img" aria-label="Offline location map of combination types"><defs><clipPath id="comb-map-clip"><rect x="25" y="25" width="600" height="250"/></clipPath></defs><rect x="25" y="25" width="600" height="250" fill="#e5eff5" stroke="#bdcbd7"/><g clip-path="url(#comb-map-clip)">';
  for(const feature of window.FacadeCombinationLand?.features||[]){
   const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
   const d=polygons.map(p=>p.map(r=>'M'+r.map(c=>xy(project(c[0],c[1])).map(v=>v.toFixed(2)).join(',')).join('L')+'Z').join('')).join('');
   svg+=`<path d="${d}" fill="#f7f6ef" fill-rule="evenodd" stroke="#c1c8bd" stroke-width=".7"><title>${esc(feature.properties.name)}</title></path>`;
  }
  for(let step=1;step<=3;step++){
   const lon=xmin+(xmax-xmin)*step/4,my=ymin+(ymax-ymin)*step/4,lat=(2*Math.atan(Math.exp(my*Math.PI/180))-Math.PI/2)*180/Math.PI;
   const [x,y]=xy([lon,my]);
   svg+=`<path d="M${x} 25V275M25 ${y}H625" fill="none" stroke="#aebbc5" stroke-dasharray="3 5" stroke-width=".6"/><text x="${x}" y="270" text-anchor="middle" font-size="9" fill="#58677b">${lon.toFixed(3)}°</text><text x="30" y="${y-3}" font-size="9" fill="#58677b">${lat.toFixed(3)}°</text>`;
  }
  for(const point of points){
   const [x,y]=xy(project(point.lng,point.lat)),total=[...point.groups.values()].reduce((s,v)=>s+v.length,0),radius=total>1?11:7;let angle=-Math.PI/2;
   for(const [index,membersAtLocation] of point.groups){
    const group=result.groups[index],next=angle+2*Math.PI*membersAtLocation.length/total;
    const title=`Combination ${index+1}: ${membersAtLocation.length} facade(s) at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — ${membersAtLocation.map(p=>p.name).join(', ')}`;
    const hit=mapHits.push({index,members:membersAtLocation})-1;
    const attrs=`fill="${group.color}" stroke="white" stroke-width="1.4" tabindex="0" role="button" data-comb-map="${hit}" aria-label="${esc(title)}"`;
    if(point.groups.size===1)svg+=`<circle cx="${x}" cy="${y}" r="${radius}" ${attrs}><title>${esc(title)}</title></circle>`;
    else svg+=`<path d="M${x} ${y}L${x+radius*Math.cos(angle)} ${y+radius*Math.sin(angle)}A${radius} ${radius} 0 ${next-angle>Math.PI?1:0} 1 ${x+radius*Math.cos(next)} ${y+radius*Math.sin(next)}Z" ${attrs}><title>${esc(title)}</title></path>`;
    angle=next;
   }
   if(total>1)svg+=`<text x="${x}" y="${y+3}" text-anchor="middle" fill="white" font-size="9" style="pointer-events:none">${total}</text>`;
  }
  svg+='</g><text x="32" y="17" font-size="10" fill="#58677b">N ↑</text></svg>';
  return svg+`<p class="fc-help" id="comb-map-status">${positioned.length} located facades; ${missing} without valid coordinates. Colours match the bars and table. Shared locations show counts and split colours; select a marker or segment to inspect its facades. Coordinates may describe camera positions.</p><p class="fc-help">Offline country outlines: <a href="https://github.com/datasets/geo-countries" target="_blank" rel="noopener">geo-countries</a>. Local views show coordinates without street detail.</p>`;
 }
 function renderMap(){
  const host=dialog.querySelector('#comb-map');if(!host)return;mapLocations=[];const fallback=mapMarkup();
  host.innerHTML=fallback;
  if(mapLocations.length&&window.L){
   const points=mapLocations,located=points.reduce((s,p)=>s+[...p.groups.values()].reduce((n,v)=>n+v.length,0),0);
   host.innerHTML=`<div class="comb-map-toolbar"><button type="button" id="comb-fit">Show all locations</button><label><input type="checkbox" id="comb-streets" checked>Street background</label></div><div id="comb-live-map" aria-label="Zoomable map of facade combinations"></div><p class="fc-help" id="comb-map-status">${located} located facades; ${result.total-located} without valid coordinates. Scroll or use + / − to zoom; drag to pan. Colours match the chart and table. Shared locations show split colours.</p><p class="fc-help" id="comb-tile-status" role="status">Loading street background. Internet required for street detail; country outlines remain available offline.</p>`;
   const map=L.map(host.querySelector('#comb-live-map'),{scrollWheelZoom:true,minZoom:2,maxZoom:20,maxBounds:[[-85,-180],[85,180]]}).setView([points[0].lat,points[0].lng],13);combinationMap=map;
   map.createPane('combinationLand');map.getPane('combinationLand').style.zIndex=190;
   L.geoJSON(window.FacadeCombinationLand,{pane:'combinationLand',style:{color:'#b6bcb1',weight:1,fillColor:'#f6f5ed',fillOpacity:1},interactive:false}).addTo(map);
   map.attributionControl.addAttribution('Offline outlines: <a href="https://github.com/datasets/geo-countries">geo-countries</a>');
   const tileStatus=host.querySelector('#comb-tile-status');
   let streets=null;
   function enableStreets(){
    try{
     if(!L.maplibreGL||!window.maplibregl)throw Error('Map renderer unavailable');
     streets=L.maplibreGL({style:'https://tiles.openfreemap.org/styles/positron',interactive:false,padding:0.1}).addTo(map);
     const gl=streets.getMaplibreMap();
     gl.on('load',()=>{if(combinationMap===map)tileStatus.textContent='Street background: OpenFreeMap / OpenMapTiles / OpenStreetMap. Select a coloured marker to inspect its facades.';});
     gl.on('error',()=>{if(combinationMap===map)tileStatus.textContent='Some OpenFreeMap background data could not load. Check your connection or uncheck Street background for the offline map.';});
     tileStatus.textContent='Loading OpenFreeMap street background…';
    }catch(error){
     if(streets&&map.hasLayer(streets)){try{map.removeLayer(streets);}catch{}}
     streets=null;host.querySelector('#comb-streets').checked=false;
     tileStatus.textContent='Street rendering is unavailable in this browser. The offline map, markers and zoom controls remain available.';
    }
   }
   map.attributionControl.addAttribution('<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
   host.querySelector('#comb-streets').onchange=event=>{if(event.target.checked)enableStreets();else{if(streets){map.removeLayer(streets);streets=null;}tileStatus.textContent='Offline country outlines. Zoom and pan remain available.';}};
   enableStreets();
   const bounds=L.latLngBounds(points.map(p=>[p.lat,p.lng]));
   map.on('zoomend',()=>{host.querySelector('#comb-live-map').dataset.zoom=String(map.getZoom());});
   const fit=()=>{map.invalidateSize();map.fitBounds(bounds,{padding:[40,40],maxZoom:17,animate:false});host.querySelector('#comb-live-map').dataset.zoom=String(map.getZoom());};
   host.querySelector('#comb-fit').onclick=fit;mapHits=[];
   for(const point of points){
    const total=[...point.groups.values()].reduce((s,v)=>s+v.length,0),radius=total>1?16:11,centre=radius+2,size=centre*2;let angle=-Math.PI/2;
    let svg=`<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
    for(const [index,locatedMembers]of point.groups){
     const next=angle+2*Math.PI*locatedMembers.length/total,hit=mapHits.push({index,members:locatedMembers})-1;
     const label=`Combination ${index+1}: ${locatedMembers.length} facade(s) — ${locatedMembers.map(p=>p.name).join(', ')}`;
     const attrs=`fill="${result.groups[index].color}" stroke="white" stroke-width="1.5" tabindex="0" role="button" data-comb-map="${hit}" aria-label="${esc(label)}"`;
     svg+=point.groups.size===1?`<circle cx="${centre}" cy="${centre}" r="${radius}" ${attrs}><title>${esc(label)}</title></circle>`:`<path d="M${centre} ${centre}L${centre+radius*Math.cos(angle)} ${centre+radius*Math.sin(angle)}A${radius} ${radius} 0 ${next-angle>Math.PI?1:0} 1 ${centre+radius*Math.cos(next)} ${centre+radius*Math.sin(next)}Z" ${attrs}><title>${esc(label)}</title></path>`;
     angle=next;
    }
    if(total>1)svg+=`<text x="${centre}" y="${centre+4}" text-anchor="middle" fill="white" font-size="11" style="pointer-events:none">${total}</text>`;
    svg+='</svg>';
    L.marker([point.lat,point.lng],{keyboard:false,icon:L.divIcon({className:'comb-map-marker',html:svg,iconSize:[size,size],iconAnchor:[centre,centre]})}).addTo(map);
   }
   fit();
  }
  host.querySelectorAll('[data-comb-map]').forEach(marker=>{marker.onclick=()=>{const hit=mapHits[Number(marker.dataset.combMap)];members(hit.index,hit.members);};marker.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();marker.onclick();}};});
 }
 function exportCSV(){
  if(!result)return;
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=[[...chosen.map(d=>d.label),'Facade count','Percentage of included facades','Included facade denominator','Photo IDs'],...result.groups.map(g=>[...g.values.map(v=>v.join(' + ')),g.count,g.percentage.toFixed(6),result.total,g.members.map(p=>p.id).join('; ')])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='facade-category-combinations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 attach();new MutationObserver(attach).observe(document.querySelector('header')||document.body,{childList:true,subtree:true});
})(typeof window!=='undefined'?window:globalThis);
