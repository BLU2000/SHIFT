// Embedded into HTML 17; stable values keep renamed categories compatible with saved answers.
const wholeFacadeOptions=[...typeFields[0][2],'Mixed','Unknown'];
const priorityDefaults={wholeFacade:'Whole-façade type',orientation:'Orientation',storeys:'Storeys'};
const compassDirections=['North','East','South','West'];
contextFields.find(d=>d[0]==='orientation')[2]=compassDirections;
contextFields.unshift(['wholeFacade','Whole-façade type',wholeFacadeOptions]);
contextFields.push(['storeys','Storeys',Array.from({length:200},(_,i)=>String(i+1)).concat('Unknown')]);
const priorityOriginalRestore=restoreAnalysisSettings;
const priorityRadarDefaults=['windows','relief','enclosure','surroundingGreen','streetRatio'];
function priorityValidRadarDims(value){const keys=Array.isArray(value)?[...new Set(value.filter(k=>analysisDimensions.some(d=>d.key===k&&d.radar)))]:[];return keys.length>=3?keys:[...priorityRadarDefaults];}
function priorityRadarDimensions(){return priorityValidRadarDims(analysisSettings.priorityRadarDims).map(k=>analysisDimensions.find(d=>d.key===k));}
restoreAnalysisSettings=function(value){priorityOriginalRestore(value);if(value?.priorityLabels&&typeof value.priorityLabels==='object')analysisSettings.priorityLabels={...value.priorityLabels};if(value?.priorityRadarDims!==undefined)analysisSettings.priorityRadarDims=priorityValidRadarDims(value.priorityRadarDims);};
// init() has started, but has not passed its asynchronous storage read yet.
restoreAnalysisSettings(embedded.analysisSettings);
function priorityLabel(key,fallback){const value=analysisSettings.priorityLabels?.[key];return typeof value==='string'&&value.trim()?value.trim():fallback;}
function priorityCategory(value){return priorityLabel('category:'+value,value);}
function priorityGroupName(number){
 const n=Number(number)===2?1:Number(number),names={1:'Postwar Buildings',3:'Altbauten',4:'Contemp.',5:'Modern',6:'TBS'};
 return priorityLabel('group:'+n,names[n]||'Category '+n);
}
function priorityField(key,r){
 const def=contextFields.find(d=>d[0]===key),title=priorityLabel(key,def[1]);
 if(key==='storeys')return `<div class="field"><label for="priorityStoreys">${esc(title)}</label><input id="priorityStoreys" class="full" type="number" min="1" max="200" step="1" value="${/^\d+$/.test(r.context.storeys||'')?esc(r.context.storeys):''}" placeholder="Number of above-ground storeys"><label class="priority-unknown"><input type="checkbox" id="priorityStoreysUnknown" ${r.context.storeys==='Unknown'?'checked':''}> Unknown</label></div>`;
 return `<fieldset class="field"><legend>${esc(title)}</legend><div class="options">${def[2].map(v=>`<label class="option"><input type="radio" name="priority-${key}" data-scope="context" data-key="${key}" value="${esc(v)}" ${r.context[key]===v?'checked':''}><span>${esc(key==='wholeFacade'?priorityCategory(v):v)}</span></label>`).join('')}</div></fieldset>`;
}
function priorityEditor(){return `<details class="priority-editor"><summary>Edit category names</summary><p class="hint">Names apply to this collection. Existing tags keep their category when renamed.</p>${Object.entries(priorityDefaults).map(([k,v])=>`<label>${esc(v)}<input class="full" maxlength="80" data-priority-label="${k}" value="${esc(priorityLabel(k,v))}"></label>`).join('')}<h4>Whole-façade categories</h4>${wholeFacadeOptions.map(v=>`<label>${esc(v)}<input class="full" maxlength="80" data-priority-label="${esc('category:'+v)}" value="${esc(priorityCategory(v))}"></label>`).join('')}</details>`;}
const priorityBaseEditor=priorityEditor;
priorityEditor=function(){return priorityBaseEditor().replace('</details>',`<h4>Sorted categories</h4>${buildingTypeGroups().map(([n])=>`<label>Category ${n}<input class="full" maxlength="80" data-priority-label="group:${n}" value="${esc(priorityGroupName(n))}"></label>`).join('')||'<p class="hint">Create categories in visual sorting to name them here.</p>'}</details>`);};
const priorityOriginalForm=formContent;
formContent=function(r){
 if(step===0)return `<h2>Tag the whole façade.</h2><p class="hint">Start with the essential tags for the entire façade. Describe individual parts in the later steps.</p>${['wholeFacade','orientation','storeys'].map(k=>priorityField(k,r)).join('')}${priorityEditor()}<h3>Photo location</h3>${mapPickerMarkup()}<div class="grid2">${textField('lat','Latitude',r.location.lat,'type="number" min="-90" max="90" step="any"')}${textField('lng','Longitude',r.location.lng,'type="number" min="-180" max="180" step="any"')}</div>`;
 if(step===1)return '<h2>Read the urban context.</h2><p class="hint">Describe the space around the building.</p>'+contextFields.filter(d=>!Object.hasOwn(priorityDefaults,d[0])).map(d=>field(d,r.context,'context')).join('');
 return priorityOriginalForm(r);
};
const priorityOriginalMissing=missing;
missing=function(r,stage=4,idx=null){
 const titles=['wholeFacade','orientation','storeys'].map(k=>contextFields.find(d=>d[0]===k)[1]);
 const result=priorityOriginalMissing(r,stage,idx).filter(x=>!titles.includes(x));
 if(stage===0||stage===4){if(stage===0&&document.getElementById('priorityStoreys')?.validity.valid===false)result.push('Valid storey count');for(const key of ['wholeFacade','orientation','storeys'])if(!r.context[key])result.push(priorityLabel(key,priorityDefaults[key]));
 const n=r.context.storeys;if(n&&n!=='Unknown'&&n!=='31+'&&(!Number.isInteger(Number(n))||+n<1||+n>200))result.push('Storeys: enter a whole number from 1 to 200, or Unknown');}
 return result;
};
const priorityOriginalSummary=summaryRows;
summaryRows=function(obj,defs){return priorityOriginalSummary({...obj,wholeFacade:obj.wholeFacade?priorityCategory(obj.wholeFacade):obj.wholeFacade},defs.map(d=>[d[0],priorityLabel(d[0],d[1]),...d.slice(2)]));};
function priorityRadar(r){
 const dimensions=priorityRadarDimensions();
 const values=dimensions.map(d=>{
  const profiles=d.scope==='context'?[{type:{},record:r}]:(r.types||[]).map(type=>({type,record:r}));
  const nums=profiles.map(p=>analysisValue(p,d,true)).filter(v=>v&&Number.isFinite(v.value)).map(v=>v.value);
  return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null;
 });
 const pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/dimensions.length;return [130+Math.cos(a)*70*v,110+Math.sin(a)*70*v];};
 let svg='<svg viewBox="0 0 260 240" role="img" aria-label="Façade radar profile; missing observations are not plotted"><title>Mean of answered type values; ordered categories normalized from 0 to 1</title>';
 for(const scale of [.25,.5,.75,1])svg+=`<polygon points="${dimensions.map((_,i)=>pt(i,scale).join(',')).join(' ')}" fill="none" stroke="#d7dce4"/>`;
 dimensions.forEach((d,i)=>{const p=pt(i,1),label=pt(i,1.32);svg+=`<path d="M130 110 L${p.join(' ')}" stroke="#d7dce4"/><text x="${label[0]}" y="${label[1]}" text-anchor="middle" font-size="9">${esc(({windows:'Windows',surroundingGreen:'Greenery',streetRatio:'Street / height',enclosure:'Enclosure',relief:'Relief',share:'Type share',depth:'Depth',thermal:'Insulation'})[d.key]||d.label)}</text>`;});
 if(values.every(v=>v!==null))svg+=`<polygon points="${values.map((v,i)=>pt(i,v).join(',')).join(' ')}" fill="#3957a522" stroke="#3957a5" stroke-width="2"/>`;
 else values.forEach((v,i)=>{const next=(i+1)%values.length;if(v!==null&&values[next]!==null)svg+=`<path d="M${pt(i,v).join(' ')} L${pt(next,values[next]).join(' ')}" stroke="#3957a5" stroke-width="2"/>`;});
 values.forEach((v,i)=>{if(v!==null){const p=pt(i,v);svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#3957a5"><title>${esc(dimensions[i].label)}: ${Math.round(v*100)}%</title></circle>`;}});
 return `<div class="priority-radar">${svg}</svg><small>${values.filter(v=>v!==null).length}/${dimensions.length} dimensions answered · missing values left open</small><details><summary>Profile values</summary>${dimensions.map((d,i)=>`<div>${esc(d.label)}: ${values[i]===null?'Not answered':Math.round(values[i]*100)+'%'}</div>`).join('')}<p>Type values are averaged equally. Ordered categories use a 0–1 scale; higher does not mean better.</p></details></div>`;
}
function priorityRadarMenu(){const selected=priorityRadarDimensions().map(d=>d.key);return `<details id="priorityRadarSettings" class="priority-radar-settings"><summary>Radar settings <span>${selected.length} dimensions · all façades</span></summary><p class="hint">Choose at least three dimensions. Changes apply to every gallery and profile radar and save automatically.</p><fieldset><legend>Show on radar</legend>${analysisDimensions.filter(d=>d.radar).map(d=>`<label><input type="checkbox" data-priority-radar="${d.key}" ${selected.includes(d.key)?'checked':''} ${selected.length===3&&selected.includes(d.key)?'disabled':''}>${esc(d.label)}</label>`).join('')}</fieldset><button type="button" id="priorityRadarReset">Reset to defaults</button></details>`;}
function refreshPriorityRadars(){
 const menu=document.getElementById('priorityRadarSettings'),open=menu?.open;
 if(menu){menu.outerHTML=priorityRadarMenu();document.getElementById('priorityRadarSettings').open=open;}
 document.querySelectorAll('.facade-gallery-card').forEach(card=>{const host=card.querySelector('.priority-card-radar');if(host)host.innerHTML=priorityRadar(records[card.dataset.galleryPhoto]||blank()).replace(/<details>[\s\S]*?<\/details>/,'');});
 const radar=document.querySelector('#galleryPreview .priority-profile .priority-radar');if(radar)radar.outerHTML=priorityRadar(records[galleryPreviewId]||blank());
}
function priorityNorth(orientation){const index=compassDirections.indexOf(orientation),known=index>=0&&index<4;return `<div class="priority-compass"><svg viewBox="0 0 110 110" role="img" aria-label="North is up. Façade facing ${esc(known?orientation:'unknown')}"><text x="55" y="13" text-anchor="middle" font-size="13">N</text><path d="M55 21 L50 32 L60 32 Z" fill="black"/><circle cx="55" cy="62" r="29" fill="none" stroke="#cbd0d9"/>${known?`<g transform="rotate(${index*90} 55 62)"><path d="M55 62 L55 38 M50 43 L55 36 L60 43" fill="none" stroke="#3957a5" stroke-width="3"/></g>`:'<text x="55" y="67" text-anchor="middle">?</text>'}</svg><small>${esc(orientation||'Orientation not tagged')}</small></div>`;}
function priorityLocation(p){const l=locationFor(p);if(!validPosition(l))return '<div class="priority-location-empty">Location not tagged</div>';const lat=+l.lat,lng=+l.lng,bbox=[Math.max(-180,lng-.0025),Math.max(-90,lat-.0015),Math.min(180,lng+.0025),Math.min(90,lat+.0015)].join(',');return `<div class="priority-location"><iframe loading="lazy" title="Location of ${esc(p.name)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}" referrerpolicy="no-referrer"></iframe><a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}" target="_blank" rel="noopener">${lat.toFixed(5)}, ${lng.toFixed(5)} ↗</a><small>Map requires internet · © OpenStreetMap contributors</small></div>`;}
function priorityStreetSection(){return `<figure class="priority-street-section"><figcaption>Street section <span>Placeholder · not to scale</span></figcaption><svg viewBox="0 0 360 125" role="img" aria-label="Schematic street cross-section: two pitched-roof buildings, pavements and a narrow roadway"><path d="M15 100 H65 V48 L95 24 L125 48 V100 H150 V105 H210 V100 H235 V56 L265 32 L295 56 V100 H345" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/><path d="M174 105 H186" stroke="currentColor" stroke-width="1"/><g fill="currentColor" font-size="9" text-anchor="middle"><text x="95" y="14">Building</text><text x="136" y="120">Pavement</text><text x="180" y="120">Street</text><text x="224" y="120">Pavement</text><text x="265" y="22">Building</text></g></svg></figure>`;}
function priorityProfile(p){const r=records[p.id]||blank();return `<section class="priority-profile"><div class="priority-profile-tags">${summaryRows(r.context||{},['wholeFacade','orientation','storeys'].map(k=>contextFields.find(d=>d[0]===k)))}</div><div class="priority-profile-visuals"><div><h4>Façade profile</h4>${priorityRadar(r)}</div><div><h4>Location</h4>${priorityLocation(p)}</div><div><h4>Facing</h4>${priorityNorth(r.context?.orientation)}</div></div>${priorityStreetSection()}</section>`;}
const priorityOriginalSorting=renderSortingCanvas;
renderSortingCanvas=function(){priorityOriginalSorting();document.querySelectorAll('[data-sort-target]').forEach(folder=>{const n=folder.dataset.sortTarget;if(n==='new')return;folder.querySelector('.folder-title').textContent=priorityGroupName(n);folder.setAttribute('aria-label','Assign to '+priorityGroupName(n));});document.querySelector('.sorting-toolbar')?.insertAdjacentHTML('afterend',priorityEditor());};
const priorityOriginalSortPreview=showSortPreview;
showSortPreview=function(number){priorityOriginalSortPreview(number);const title=document.getElementById('sortPreviewTitle');if(title&&number!=='new')title.textContent=priorityGroupName(number)+' · Category '+number;};
const priorityOriginalPreview=openGalleryPreview;
openGalleryPreview=function(id){priorityOriginalPreview(id);const p=photos.find(p=>p.id===id),host=document.querySelector('#galleryPreview .gallery-preview-tags');if(p&&host)host.insertAdjacentHTML('afterbegin',priorityProfile(p));const n=records[id]?.buildingType,hint=document.querySelector('#galleryPreview .gallery-preview-header .hint');if(n&&hint)hint.textContent=hint.textContent.replace('Category '+n,priorityGroupName(n)+' · Category '+n);};
const priorityOriginalUpdate=updateFilteredAnalysis;
updateFilteredAnalysis=function(){priorityOriginalUpdate();document.querySelectorAll('.facade-gallery-card').forEach(card=>{const p=photos.find(p=>p.id===card.dataset.galleryPhoto);if(!p)return;const r=records[p.id]||blank(),info=card.querySelector('.gallery-card-info');if(r.buildingType&&info?.children[1])info.children[1].textContent=info.children[1].textContent.replace('Category '+r.buildingType,priorityGroupName(r.buildingType));info?.insertAdjacentHTML('beforeend',`<span>${esc(r.context?.wholeFacade?priorityCategory(r.context.wholeFacade):'Whole façade untagged')} · ${esc(r.context?.orientation||'Orientation untagged')} · ${esc(r.context?.storeys||'?')} storeys</span><span class="priority-card-radar">${priorityRadar(r).replace(/<details>[\s\S]*?<\/details>/,'')}</span>`);});};
const priorityOriginalMerge=mergeData;
mergeData=function(data){const result=priorityOriginalMerge(data);if(data.analysisSettings?.priorityLabels&&typeof data.analysisSettings.priorityLabels==='object')analysisSettings.priorityLabels={...data.analysisSettings.priorityLabels,...analysisSettings.priorityLabels};return result;};
const priorityRadarOriginalUpdate=updateFilteredAnalysis;
updateFilteredAnalysis=function(){priorityRadarOriginalUpdate();document.querySelectorAll('.facade-gallery-card').forEach(card=>card.insertAdjacentHTML('beforeend',priorityStreetSection()));if(!document.getElementById('priorityRadarSettings'))document.getElementById('filteredPhotoResults')?.insertAdjacentHTML('beforebegin',priorityRadarMenu());};
document.addEventListener('click',event=>{if(event.target.closest('#priorityRadarReset')){analysisSettings.priorityRadarDims=[...priorityRadarDefaults];refreshPriorityRadars();persist();}});
document.addEventListener('change',event=>{
 const el=event.target;
 if(el.dataset.priorityRadar){const selected=[...document.querySelectorAll('[data-priority-radar]:checked')].map(input=>input.dataset.priorityRadar);analysisSettings.priorityRadarDims=priorityValidRadarDims(selected);refreshPriorityRadars();persist();}
 if(el.dataset.priorityLabel){analysisSettings.priorityLabels??={};analysisSettings.priorityLabels[el.dataset.priorityLabel]=el.value.trim().slice(0,80);persist();render();}
 if(el.id==='priorityStoreys'||el.id==='priorityStoreysUnknown'){
  const input=document.getElementById('priorityStoreys'),unknown=document.getElementById('priorityStoreysUnknown');
  if(el.id==='priorityStoreys'){if(!input.checkValidity()){input.reportValidity();return;}unknown.checked=false;}
  rec().context.storeys=unknown.checked?'Unknown':input.value;changed();
 }
});

let bulkCategory='',bulkSelected=new Set(),bulkField='wholeFacade',bulkValue='',bulkMode='fill',bulkUndo=null,bulkMessage='';
let bulkFilters=[],bulkFilterSerial=0;
function bulkMembers(){const definitions=filterDefinitions();return photos.filter(photo=>{const record=records[photo.id]||blank();return bulkFilters.every(rule=>{if(!rule.value)return true;const def=definitions.find(d=>d.key===rule.key);if(!def)return true;const types=def.scope==='type'?(record.types?.length?record.types:[{}]):[{}];return types.some(type=>{const actual=attributeFilterValue(photo,record,type,def);return rule.value==='__missing__'?actual==null||actual===''||Array.isArray(actual)&&!actual.length:Array.isArray(actual)?actual.includes(rule.value):String(actual)===rule.value;});});});}
function bulkFilterControls(){const definitions=filterDefinitions();return `<h3>1. Find facades</h3><p class="hint">Combine filters to find matching images, then choose the attribute to change below. All filters must match.</p>${bulkFilters.map(rule=>{const def=definitions.find(d=>d.key===rule.key)||definitions[0];return `<div class="bulk-controls"><label>Filter attribute<select data-bulk-filter-key="${rule.id}">${definitions.map(d=>`<option value="${esc(d.key)}" ${d.key===rule.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label><label>Matches<select data-bulk-filter-value="${rule.id}"><option value="">Any value</option><option value="__missing__" ${rule.value==='__missing__'?'selected':''}>Unanswered</option>${def.values.map(v=>`<option value="${esc(v)}" ${v===rule.value?'selected':''}>${esc(def.field==='buildingType'?priorityGroupName(v):def.field==='wholeFacade'?priorityCategory(v):v)}</option>`).join('')}</select></label><button data-bulk-filter-remove="${rule.id}">Remove filter</button></div>`;}).join('')}<button id="bulkAddFilter">Add filter</button> <button id="bulkResetFilters">Clear filters</button><p>${bulkMembers().length} matching images</p><h3>2. Choose attribute to change</h3>`;}
function bulkRefreshFilterSelection(){bulkSelected=new Set(bulkMembers().map(p=>p.id));bulkMessage='';renderBulkTags();}
document.addEventListener('change',event=>{const el=event.target;const id=el.dataset.bulkFilterKey||el.dataset.bulkFilterValue;if(!id)return;const rule=bulkFilters.find(r=>String(r.id)===id);if(!rule)return;if(el.dataset.bulkFilterKey){rule.key=el.value;rule.value='';}else rule.value=el.value;bulkRefreshFilterSelection();});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.id==='bulkAddFilter'){bulkFilters.push({id:++bulkFilterSerial,key:filterDefinitions()[0].key,value:''});bulkRefreshFilterSelection();}else if(button.id==='bulkResetFilters'){bulkFilters=[];bulkRefreshFilterSelection();}else if(button.dataset.bulkFilterRemove){bulkFilters=bulkFilters.filter(r=>String(r.id)!==button.dataset.bulkFilterRemove);bulkRefreshFilterSelection();}});
function bulkPlan(){const def=contextFields.find(d=>d[0]===bulkField);if(!def||!def[2].includes(bulkValue))return [];return bulkMembers().filter(p=>bulkSelected.has(p.id)).filter(p=>{const old=records[p.id]?.context?.[bulkField];return (bulkMode==='replace'||old===undefined||old===''||Array.isArray(old)&&!old.length)&&JSON.stringify(old)!==JSON.stringify(def[3]?[bulkValue]:bulkValue);});}
function renderBulkTags(){
 const host=document.getElementById('bulkTags');if(!host)return;const groups=buildingTypeGroups();
 const members=bulkMembers(),def=contextFields.find(d=>d[0]===bulkField)||contextFields[0],planned=bulkPlan();
 host.innerHTML=`<h2>Tag selected façades</h2>${bulkFilterControls()}<div class="bulk-controls"><label>Tag<select id="bulkField">${contextFields.map(d=>`<option value="${d[0]}" ${d[0]===bulkField?'selected':''}>${esc(priorityLabel(d[0],d[1]))}</option>`).join('')}</select></label><label>Value<select id="bulkValue"><option value="">Choose a value</option>${def[2].map(v=>`<option value="${esc(v)}" ${v===bulkValue?'selected':''}>${esc(bulkField==='wholeFacade'?priorityCategory(v):v)}</option>`).join('')}</select></label><label>Existing answers<select id="bulkMode"><option value="fill" ${bulkMode==='fill'?'selected':''}>Fill unanswered only</option><option value="replace" ${bulkMode==='replace'?'selected':''}>Replace existing answers</option></select></label></div><div class="bulk-actions"><button id="bulkSelectAll" ${members.length?'':'disabled'}>Select all matching images</button><button id="bulkClear">Clear selection</button><span>${members.filter(p=>bulkSelected.has(p.id)).length} selected · ${planned.length} façades will change</span><button id="bulkApply" class="primary" ${planned.length?'':'disabled'}>Apply tag to ${planned.length}</button><button id="bulkUndo" ${bulkUndo?'':'disabled'}>Undo last bulk tag</button></div><p class="hint" role="status">${esc(bulkMessage)}</p><div class="bulk-photos">${members.map(p=>`<label class="bulk-photo"><input type="checkbox" data-bulk-photo="${esc(p.id)}" ${bulkSelected.has(p.id)?'checked':''}><img src="${esc(p.src)}" alt="" loading="lazy"><span>${esc(p.name)}<small>${esc(Array.isArray(records[p.id]?.context?.[bulkField])?records[p.id].context[bulkField].join(', '):records[p.id]?.context?.[bulkField]||'Unanswered')}</small></span></label>`).join('')||'<p class="hint">No images match these filters.</p>'}</div>`;
}
const bulkOriginalSorting=renderSortingCanvas;
renderSortingCanvas=function(){bulkOriginalSorting();document.querySelectorAll('[data-sort-target]').forEach(folder=>{const n=Number(folder.dataset.sortTarget);if(n>0)folder.style.borderTop='4px solid '+graphCategoryColor(n-1);});document.querySelector('.sort-preview')?.insertAdjacentHTML('beforebegin','<section id="bulkTags" class="insight-card bulk-tags"></section>');renderBulkTags();};
document.addEventListener('change',event=>{const el=event.target;if(el.dataset.bulkPhoto){if(el.checked)bulkSelected.add(el.dataset.bulkPhoto);else bulkSelected.delete(el.dataset.bulkPhoto);renderBulkTags();}else if(el.id==='bulkCategory'){bulkCategory=el.value;bulkSelected.clear();bulkMessage='';renderBulkTags();}else if(el.id==='bulkField'){bulkField=el.value;bulkValue='';renderBulkTags();}else if(el.id==='bulkValue'){bulkValue=el.value;renderBulkTags();}else if(el.id==='bulkMode'){bulkMode=el.value;renderBulkTags();}});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.id==='bulkSelectAll'){bulkSelected=new Set(bulkMembers().map(p=>p.id));renderBulkTags();}
 if(button.id==='bulkClear'){bulkSelected.clear();renderBulkTags();}
 if(button.id==='bulkApply'){
  const planned=bulkPlan();if(!planned.length)return;const def=contextFields.find(d=>d[0]===bulkField),at=new Date().toISOString();
  bulkUndo=planned.map(p=>({id:p.id,before:structuredClone(records[p.id]),at}));
  for(const p of planned){const r=records[p.id]||(records[p.id]=blank());r.context??={};r.context[bulkField]=def[3]?[bulkValue]:bulkValue;r.completed=false;r.updatedAt=at;}
  bulkMessage=`Updated ${planned.length} façade(s). Changed profiles are marked in progress.`;await persist();renderList();renderBulkTags();
 }
 if(button.id==='bulkUndo'&&bulkUndo){let restored=0,skipped=0;for(const item of bulkUndo){if(records[item.id]?.updatedAt!==item.at){skipped++;continue;}records[item.id]={...item.before,updatedAt:new Date().toISOString()};restored++;}bulkUndo=null;bulkMessage=`Restored ${restored} façade(s).${skipped?' Kept later edits on '+skipped+' façade(s).':''}`;await persist();renderList();renderBulkTags();}
});
const corbusierOriginalUpdate=updateFilteredAnalysis;
updateFilteredAnalysis=function(){corbusierOriginalUpdate();document.querySelectorAll('.facade-gallery-card').forEach(card=>{const n=Number(records[card.dataset.galleryPhoto]?.buildingType);if(n>0)card.style.borderTop='4px solid '+graphCategoryColor(n-1);});};

// Diagonal tags cannot be assigned to a cardinal direction without user input.
function migrateCardinalOrientations(){for(const record of Object.values(records)){const value=record.context?.orientation;if(['Northeast','Southeast','Southwest','Northwest','Unknown'].includes(value)){record.context.previousOrientation=value;record.context.orientation='';}}}
const cardinalRender=render;
render=function(){migrateCardinalOrientations();cardinalRender();};
const cardinalPersist=persist;
persist=function(){migrateCardinalOrientations();return cardinalPersist();};
migrateCardinalOrientations();
