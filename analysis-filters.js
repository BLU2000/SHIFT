/* Attribute filtering of photographs, including same-type matching for heterogeneous facades. */
let analysisFilters={search:'',rules:[],mode:'both',graphs:[]},filterSearchTimer=null,filteredAnalysisPhotos=[],galleryPreviewId=null;
function filterDefinitions(){
  const make=(scope,definitions)=>definitions.map(([key,label,values])=>({key:scope+'.'+key,label,scope,field:key,values}));
  return [
    {key:'record.buildingType',label:'Sorted category number',scope:'record',field:'buildingType',values:buildingTypeGroups().map(([n])=>String(n))},
    {key:'record.status',label:'Tagging status',scope:'record',field:'status',values:['Not started','In progress','Completed']},
    {key:'record.location',label:'Location coordinates',scope:'record',field:'location',values:['Has coordinates','No coordinates']},
    ...make('context',contextFields),
    {key:'division.homogeneity',label:'Façade composition',scope:'division',field:'homogeneity',values:['Homogeneous','Heterogeneous']},
    ...make('type',typeFields.filter(d=>d[0]!=='threshold')),
    {key:'type.depth',label:'Threshold depth',scope:'type',field:'depth',values:['Under 1 m','1 m or more','Not applicable','Unknown']},
    {key:'type.enclosure',label:'Threshold enclosure',scope:'type',field:'enclosure',values:['Low','Medium','High','Unknown']},
    ...make('type',extraFields)
  ];
}
function restoreAnalysisFilters(value){
  if(!value||typeof value!=='object')return;
  analysisFilters.graphs=restoreRelationshipGraphs(value.graphs);
  analysisFilters.search=typeof value.search==='string'?value.search:'';
  if(['gallery','map','both'].includes(value.mode))analysisFilters.mode=value.mode;
  analysisFilters.rules=Array.isArray(value.rules)?value.rules.filter(r=>r&&typeof r.key==='string'&&typeof r.value==='string').map(r=>({key:r.key,value:r.value})):[];
}
function attributeFilterValue(photo,record,type,definition){
  if(definition.scope==='record'){
    if(definition.field==='status')return record.completed?'Completed':record.updatedAt?'In progress':'Not started';
    if(definition.field==='location')return validPosition(locationFor(photo))?'Has coordinates':'No coordinates';
    return record[definition.field]==null?undefined:String(record[definition.field]);
  }
  if(definition.scope==='type'&&['depth','enclosure'].includes(definition.field)&&thresholdValue(type)!=='Yes')return undefined;
  return (definition.scope==='type'?type:record[definition.scope]||{})[definition.field];
}
function filterPhotoMatches(photo){
  if(analysisFilters.search&&!photo.name.toLowerCase().includes(analysisFilters.search.toLowerCase().trim()))return false;
  const definitions=filterDefinitions(),groups=new Map();
  for(const rule of analysisFilters.rules){if(!rule.value||!definitions.some(d=>d.key===rule.key))continue;if(!groups.has(rule.key))groups.set(rule.key,[]);groups.get(rule.key).push(rule.value);}
  const record=records[photo.id]||{},typeGroups=[];
  const matches=(definition,values,type)=>{
    const actual=attributeFilterValue(photo,record,type||{},definition);
    return values.some(value=>value==='__missing__'?actual==null||actual===''||Array.isArray(actual)&&!actual.length:Array.isArray(actual)?actual.includes(value):String(actual)===value);
  };
  for(const [key,values]of groups){const definition=definitions.find(d=>d.key===key);if(definition.scope==='type')typeGroups.push([definition,values]);else if(!matches(definition,values))return false;}
  return !typeGroups.length||(record.types?.length?record.types:[{}]).some(type=>typeGroups.every(([definition,values])=>matches(definition,values,type)));
}
function filterRuleMarkup(rule,index){
  const definitions=filterDefinitions(),definition=definitions.find(d=>d.key===rule.key)||definitions.find(d=>d.key==='type.kind');
  return `<div class="analysis-filter-row"><label>Attribute<select data-filter-key="${index}">${definitions.map(d=>`<option value="${esc(d.key)}" ${d.key===definition.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label><label>Value<select data-filter-value="${index}"><option value="">Any value</option>${definition.values.map(v=>`<option value="${esc(v)}" ${v===rule.value?'selected':''}>${esc(v)}</option>`).join('')}<option value="__missing__" ${rule.value==='__missing__'?'selected':''}>Not answered / not applicable</option></select></label><button data-remove-filter="${index}" aria-label="Remove filter ${index+1}">×</button></div>`;
}
function renderFilterAnalysis(){
  document.getElementById('main').innerHTML=`<div class="intro"><div><div class="eyebrow">Collection analysis</div><h1>Explore the façades.</h1><p class="muted">One set of filters. Browse the matching photographs and locations.</p></div><button id="returnEntry">← Back to tagging</button></div><div class="filtered-analysis-layout"><section class="insight-card analysis-filter-panel"><h2>Attribute filters</h2><p class="hint">Different attributes narrow the results. Repeated choices for one attribute are alternatives. Type-specific attributes must match the same façade type.</p><label class="filter-search-label">Photo name<input id="analysisPhotoSearch" value="${esc(analysisFilters.search)}" placeholder="Find a photo…"></label><div id="analysisFilterRows">${analysisFilters.rules.map(filterRuleMarkup).join('')}</div><div class="filter-actions"><button id="addAnalysisFilter">+ Add filter</button><button id="clearAnalysisFilters">Clear all</button></div><p id="analysisMatchCount" class="hint" role="status"></p></section><div class="analysis-content"><nav class="analysis-view-switch" aria-label="Analysis view">${['gallery','map','both'].map(mode=>`<button data-analysis-view="${mode}" aria-pressed="${analysisFilters.mode===mode}">${mode[0].toUpperCase()+mode.slice(1)}</button>`).join('')}</nav><div class="comparison-toolbar"><button id="addRelationshipGraph">+ Add graph</button></div><div id="relationshipGraphs"></div><section id="analysisMapSection" class="insight-card analysis-map-panel"><h2>Geographic overview</h2><p class="hint">Only matching photos appear here. Zoom and pan, then select a marker to open a photo.</p><div id="mapPlot"></div></section><section id="analysisGallerySection" class="insight-card analysis-gallery-panel"><h2>Photo library</h2><p class="hint">Select a photo to preview its tags or continue editing. Photos without coordinates are included.</p><div id="filteredPhotoResults" class="facade-gallery"></div></section></div></div>`;
  updateFilteredAnalysis();
}
function updateFilteredAnalysis(){
  if(view!=='insights'||!document.getElementById('filteredPhotoResults'))return;
  filteredAnalysisPhotos=photos.filter(filterPhotoMatches);
  const located=filteredAnalysisPhotos.filter(p=>validPosition(locationFor(p))).length;
  document.getElementById('analysisMatchCount').textContent=`${filteredAnalysisPhotos.length} of ${photos.length} photos match · ${located} on map · ${filteredAnalysisPhotos.length-located} without coordinates`;
  document.getElementById('filteredPhotoResults').innerHTML=filteredAnalysisPhotos.map(p=>{const r=records[p.id]||{},kinds=[...new Set((r.types||[]).map(t=>t.kind).filter(Boolean))];return `<button class="facade-gallery-card" data-gallery-photo="${esc(p.id)}" aria-label="Preview ${esc(p.name)}"><img src="${esc(p.src)}" alt="${esc(p.name)}" loading="lazy"><span class="gallery-card-info"><strong>${esc(p.name)}</strong><span>${r.buildingType?'Category '+r.buildingType:'Unsorted'} · ${r.completed?'Completed':r.updatedAt?'In progress':'Not started'}</span><span>${esc(kinds.join(' · ')||'No façade tags yet')}</span>${validPosition(locationFor(p))?'':'<span class="gallery-no-location">No coordinates</span>'}</span></button>`;}).join('')||'<p class="empty">No photos match these filters.</p>';
  applyAnalysisView();renderComparisonGraphs();
}
function applyAnalysisView(){
  const mode=analysisFilters.mode||'both';
  document.getElementById('analysisMapSection').hidden=mode==='gallery';
  document.getElementById('analysisGallerySection').hidden=mode==='map';
  document.querySelectorAll('[data-analysis-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.analysisView===mode)));
  disposeOverviewMap();
  if(mode!=='gallery')renderMap(filteredAnalysisPhotos);
  else{overviewPoints=filteredAnalysisPhotos.filter(p=>validPosition(locationFor(p)));document.getElementById('mapPlot').innerHTML='';}
}
function openGalleryPreview(id){
  const photo=filteredAnalysisPhotos.find(p=>p.id===id);if(!photo)return;
  galleryPreviewId=id;
  let dialog=document.getElementById('galleryPreview');if(!dialog){dialog=document.createElement('dialog');dialog.id='galleryPreview';dialog.className='gallery-preview-dialog';document.body.append(dialog);}
  const record=records[id]||blank(),index=filteredAnalysisPhotos.indexOf(photo);
  dialog.innerHTML=`<div class="gallery-preview-header"><div><h2>${esc(photo.name)}</h2><span class="hint">${index+1} / ${filteredAnalysisPhotos.length} matching photos${record.buildingType?' · Category '+record.buildingType:''}</span></div><button data-preview-close aria-label="Close preview">×</button></div><div class="gallery-preview-layout"><img class="gallery-preview-image" src="${esc(photo.src)}" alt="${esc(photo.name)}"><div class="gallery-preview-tags"><h3>Urban context</h3>${summaryRows(record.context||{},contextFields)}<h3>Façade composition</h3><p>${esc(record.division?.homogeneity||'Not answered')}</p>${(record.types||[]).map((type,i)=>`<h3>Type ${i+1}</h3>${summaryRows(type,[...questionsForType(type),...(thresholdValue(type)==='Yes'?[['depth','Threshold depth'],['enclosure','Threshold enclosure']]:[]),...extraFields])}`).join('')}${record.notes?`<h3>Notes</h3><p>${esc(record.notes)}</p>`:''}</div></div><div class="gallery-preview-footer"><div><button data-preview-direction="-1" ${index===0?'disabled':''}>← Previous</button> <button data-preview-direction="1" ${index===filteredAnalysisPhotos.length-1?'disabled':''}>Next →</button></div><button class="primary" data-preview-edit="${esc(id)}">Edit tags</button></div>`;
  if(!dialog.open)dialog.showModal();
}
function saveAnalysisFilterChange(){persist();updateFilteredAnalysis();}
document.addEventListener('change',event=>{
  const element=event.target;
  if(element.dataset.filterKey!==undefined){const index=+element.dataset.filterKey;analysisFilters.rules[index]={key:element.value,value:''};document.getElementById('analysisFilterRows').innerHTML=analysisFilters.rules.map(filterRuleMarkup).join('');saveAnalysisFilterChange();}
  if(element.dataset.filterValue!==undefined){analysisFilters.rules[+element.dataset.filterValue].value=element.value;saveAnalysisFilterChange();}
});
document.addEventListener('input',event=>{if(event.target.id==='analysisPhotoSearch'){analysisFilters.search=event.target.value;clearTimeout(filterSearchTimer);filterSearchTimer=setTimeout(saveAnalysisFilterChange,250);}});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.id==='addAnalysisFilter'){analysisFilters.rules.push({key:'type.kind',value:''});document.getElementById('analysisFilterRows').innerHTML=analysisFilters.rules.map(filterRuleMarkup).join('');persist();}
  if(button.dataset.removeFilter!==undefined){analysisFilters.rules.splice(+button.dataset.removeFilter,1);document.getElementById('analysisFilterRows').innerHTML=analysisFilters.rules.map(filterRuleMarkup).join('');saveAnalysisFilterChange();}
  if(button.id==='clearAnalysisFilters'){analysisFilters={search:'',rules:[],mode:analysisFilters.mode||'both',graphs:analysisFilters.graphs||[]};renderFilterAnalysis();persist();}
  if(button.dataset.analysisView){analysisFilters.mode=button.dataset.analysisView;applyAnalysisView();persist();}
  if(button.dataset.galleryPhoto)openGalleryPreview(button.dataset.galleryPhoto);
  if(button.hasAttribute('data-preview-close'))document.getElementById('galleryPreview').close();
  if(button.dataset.previewDirection){const index=filteredAnalysisPhotos.findIndex(p=>p.id===galleryPreviewId),photo=filteredAnalysisPhotos[index+Number(button.dataset.previewDirection)];if(photo)openGalleryPreview(photo.id);}
  if(button.dataset.previewEdit){document.getElementById('galleryPreview').close();current=button.dataset.previewEdit;step=0;typeIndex=0;view='entry';render();}
});
document.addEventListener('keydown',event=>{if(!document.getElementById('galleryPreview')?.open||!['ArrowLeft','ArrowRight'].includes(event.key)||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;event.preventDefault();const index=filteredAnalysisPhotos.findIndex(p=>p.id===galleryPreviewId),photo=filteredAnalysisPhotos[index+(event.key==='ArrowRight'?1:-1)];if(photo)openGalleryPreview(photo.id);});
