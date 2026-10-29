"""Prepare an offline browser smoke test using the same application script."""
import json
import pathlib
import re
import uuid

root = pathlib.Path(__file__).resolve().parent
data = {'version': 1, 'dataset': 'shift-browser-checks-' + uuid.uuid4().hex, 'photos': [
    {'id': 'test-1', 'name': 'Test one', 'src': 'images/browser/IMG_2708.jpg', 'location': {'lat': 48.1483833, 'lng': 11.56535}},
    {'id': 'test-2', 'name': 'Test two', 'src': 'images/browser/IMG_2710.jpg', 'location': {'lat': 48.15, 'lng': 11.57}}], 'records': {}, 'conflicts': []}
html = (root / 'index.html').read_text(encoding='utf-8')
html = html.replace('<head>', '<head><script>window.DISABLE_LIVE_OVERVIEW_FOR_TESTS=true;window.onerror=(message,source,line)=>{document.title="JS ERROR line "+line+": "+message;};</script>')
html = re.sub(r'(<script id="collection-data" type="application/json">).*?(</script>)', lambda m: m[1] + json.dumps(data) + m[2], html, flags=re.S)
checks = r'''
<script>
async function checks(){
const results=[];const assert=(v,label)=>{if(!v)throw Error(label);results.push(label);};
try{
while(!document.querySelector('#next'))await new Promise(r=>setTimeout(r,20));
assert(photos.length===2,'Collection loads');
assert(!document.querySelector('#buildingTypeNumber'),'Manual category selector is removed from tagging');
document.querySelector('#sortPhotos').click();assert(view==='sorting'&&sortPhotoId==='test-1','Sorting canvas opens with the first unsorted photo');
await sortAssignPhoto('test-1','new');assert(records['test-1'].buildingType===1&&sortPhotoId==='test-2','New folder assigns a number and advances to next photo');
showSortPreview(1);assert(document.querySelectorAll('[data-sort-select]').length===1,'Folder contents are visible during sorting');
records['test-2']=blank();records['test-2'].completed=true;await sortAssignPhoto('test-2','1');
assert(buildingTypeGroups()[0][1].length===2&&!sortPhotoId&&records['test-2'].completed,'Existing folder groups images without resetting facade completion');
await undoSortAssignment();assert(!records['test-2'].buildingType&&sortPhotoId==='test-2','Undo restores previous category and queue position');
await sortAssignPhoto('test-2','1');records['test-2'].completed=false;
assert(nextBuildingType()===2,'Next category number increments automatically');current='test-1';view='entry';render();
assert(fractions.join('|')==='0|¼|⅓|½|⅔|¾|1','Ratio choices include complementary thirds and quarters');
assert(Math.abs(analysisValue({type:{windows:'⅔'}},analysisDimensions[0]).value-2/3)<1e-10&&analysisValue({type:{windows:'¾'}},analysisDimensions[0]).value===.75,'Charts interpret new ratio values correctly');
assert(rec().location.lat==='48.1483833'&&document.querySelector('#lat').value==='48.1483833','Photo GPS prefills location');
rec().location.lat='48.2';assert(rec().location.lat==='48.2','Manual coordinates override photo GPS');
rec().location.lat='';assert(rec().location.lat==='','Explicitly cleared coordinate stays empty');
rec().location.lat='0';rec().location.lng='0';assert(missing(rec(),0).length===0,'Zero coordinates are valid');
writeMapPosition({lat:48.155,lng:11.575},'Manual map pin');await saveQueue;
assert(rec().location.lat==='48.1550000'&&document.querySelector('#lng').value==='11.5750000','Map pin updates coordinate fields');
assert(rec().location.source==='Manual map pin'&&document.querySelector('#osmLocationLink').href.includes('mlat=48.155'),'Map pin source and live OpenStreetMap link update');
document.querySelector('#clearMapPin').click();assert(rec().location.lat===''&&rec().location.lng==='','Clear pin removes both coordinates');
document.querySelector('#restorePhotoGps').click();assert(rec().location.lat==='48.1483833','Restore GPS recovers original metadata position');
document.querySelector('#next').click(); assert(step===1,'Optional location can be skipped');
document.querySelector('#next').click(); assert(step===1&&document.querySelector('#validation').textContent.includes('Setting'),'Required fields block progression');
for(const d of contextFields){const el=[...document.querySelectorAll('input[data-key="'+d[0]+'"]')][0];el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));}
const secondGround=[...document.querySelectorAll('input[data-key="ground"]')][1];secondGround.checked=true;secondGround.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().context.ground.length===2,'Ground floor supports multiple answers');
const residential=document.querySelector('input[data-key="groundUse"][value="Residential"]');residential.checked=true;residential.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().context.groundUse.includes('Gastronomy')&&rec().context.groundUse.includes('Residential'),'Ground-floor use supports mixed uses');
rec().context.streetRatio='Narrow';render();
assert(document.querySelectorAll('input[data-key="streetRatio"]').length===3&&rec().context.streetRatio==='Street width < building height','Three explicit street-width choices migrate previous answers');
document.querySelector('#next').click();assert(step===2,'Context advances');
let el=document.querySelector('input[value="Heterogeneous"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().types.length===2,'Heterogeneous creates two types');
rec().types[1].kind='Balcony';el=document.querySelector('#typeCount');el.value=3;el.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().types.length===3&&rec().types[1].kind==='Balcony','Changing count preserves types');
el=document.querySelector('input[value="Homogeneous"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().types.length===1,'Homogeneous uses one type');
el=document.querySelector('input[value="Heterogeneous"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().types[1].kind==='Balcony','Switching composition restores archived answers');
rec().division.homogeneity='Homogeneous';rec().types=[{kind:'French balcony',share:'1',relief:'Flat',material:'Masonry',thermal:'Unknown',windows:'⅓',reveal:'Flush',threshold:'Yes',enclosure:'Low',shade:['None'],green:['None']}];
step=3;typeIndex=0;render();assert(document.querySelector('input[data-key="depth"]')&&document.querySelector('input[data-key="enclosure"]'),'French balcony asks depth and enclosure');
rec().types[0].depth='Not applicable';
assert(!document.querySelector('input[data-key="threshold"]'),'Redundant threshold yes/no is omitted');
const originalType=structuredClone(rec().types[0]);
rec().types[0]={...originalType,kind:'Balcony'};render();
assert(document.querySelector('input[data-key="depth"]')&&!document.querySelector('input[data-key="threshold"]'),'Balcony automatically shows threshold attributes without yes/no');
rec().types[0]={...originalType,kind:'Other',threshold:undefined};render();
assert(!document.querySelector('input[data-key="threshold"]')&&document.querySelector('input[data-key="depth"]')&&document.querySelector('input[data-key="enclosure"]'),'Other also asks depth and enclosure directly');
rec().types[0]={...originalType,kind:'Punched-window façade',depth:undefined,enclosure:undefined};render();
assert(!document.querySelector('input[data-key="depth"]')&&!document.querySelector('input[data-key="enclosure"]')&&missing(rec(),3,0).length===0,'Only punched-window facade skips threshold details');
rec().types[0]={...originalType,kind:'Bay window',depth:undefined,enclosure:undefined};render();
assert(missing(rec(),3,0).some(x=>x.includes('depth'))&&missing(rec(),3,0).some(x=>x.includes('enclosure')),'Bay window requires depth and enclosure');
rec().types[0]=originalType;render();
assert(missing(rec()).length===0,'Valid French balcony profile completes with depth marked not applicable');
el=document.querySelector('input[data-key="shade"][value="Awning"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));
assert(rec().types[0].shade.length===1&&rec().types[0].shade[0]==='Awning','None is exclusive with concrete selections');
changed();await saveQueue;assert(storageOK,'IndexedDB autosave succeeds');
const stored=await new Promise((resolve,reject)=>{const q=db.transaction('state').objectStore('state').get(embedded.dataset);q.onsuccess=()=>resolve(JSON.parse(q.result));q.onerror=reject;});
assert(stored.records['test-1'].types[0].kind==='French balcony','Autosave retains answers');
const incoming=structuredClone(rec());incoming.notes='Different assessment';incoming.updatedAt=new Date().toISOString();
let merged=mergeData({version:1,dataset:embedded.dataset,records:{'test-1':incoming}});
assert(merged.clash===1&&rec().notes!==incoming.notes,'Merge detects conflicts without overwriting');
showConflicts();document.querySelector('[data-resolve="incoming"]').click();
assert(rec().notes==='Different assessment'&&conflicts.length===0,'Incoming conflict resolution works');
document.querySelector('#mergeDialog').close();step=4;render();document.querySelector('#next').click();await saveQueue;await new Promise(r=>setTimeout(r,50));
assert(records['test-1'].completed&&current==='test-2','Complete advances to next photograph');
view='insights';render();assert(document.querySelector('#geographicMap')&&document.querySelector('#analysisFilterRows')&&!document.querySelector('#radar')&&!document.querySelector('#relationshipPlot')&&!document.querySelector('main table'),'Analysis contains only map and filters');
document.querySelector('#addAnalysisFilter').click();
let valueSelect=document.querySelector('[data-filter-value="0"]');valueSelect.value='French balcony';valueSelect.dispatchEvent(new Event('change',{bubbles:true}));
assert(filteredAnalysisPhotos.length===1&&overviewPoints.length===1&&overviewPoints[0].id==='test-1','Attribute filter limits photo results and map together');
analysisFilters.rules=[{key:'type.kind',value:'French balcony'},{key:'type.kind',value:'Balcony'}];updateFilteredAnalysis();assert(filteredAnalysisPhotos.length===1,'Repeated values for one attribute act as alternatives');
const keptTypes=structuredClone(records['test-1'].types);records['test-1'].types=[{kind:'French balcony',material:'Masonry'},{kind:'Balcony',material:'Concrete'}];
analysisFilters.rules=[{key:'type.kind',value:'Balcony'},{key:'type.material',value:'Masonry'}];updateFilteredAnalysis();assert(!filteredAnalysisPhotos.length&&!overviewPoints.length,'Type filters must match the same facade type');
analysisFilters.rules[1].value='Concrete';updateFilteredAnalysis();assert(filteredAnalysisPhotos.length===1,'Matching attributes within one type are included');
records['test-1'].types=keptTypes;
analysisFilters.rules=[{key:'context.groundUse',value:'Residential'}];updateFilteredAnalysis();assert(filteredAnalysisPhotos.length===1,'Ground-floor multiple-use attributes can be filtered');
const previousLocation=structuredClone(records['test-2'].location);records['test-2'].location={lat:'',lng:''};analysisFilters.rules=[{key:'record.location',value:'No coordinates'}];updateFilteredAnalysis();assert(filteredAnalysisPhotos.length===1&&overviewPoints.length===0&&document.querySelector('#analysisMatchCount').textContent.includes('1 without coordinates'),'Matching photos without coordinates remain listed but not plotted');
records['test-2'].location=previousLocation;document.querySelector('#clearAnalysisFilters').click();assert(filteredAnalysisPhotos.length===2&&overviewPoints.length===2,'Clear all restores the full map');
assert(document.querySelectorAll('[data-gallery-photo]').length===2,'Gallery displays all matching facade photographs');
document.querySelector('[data-analysis-view="gallery"]').click();assert(document.querySelector('#analysisMapSection').hidden&&!document.querySelector('#analysisGallerySection').hidden&&overviewMap===null,'Gallery-only mode hides and disposes map');
document.querySelector('[data-gallery-photo="test-1"]').click();assert(document.querySelector('#galleryPreview').open&&document.querySelector('.gallery-preview-tags').textContent.includes('French balcony'),'Gallery opens a larger photo preview with its tags');
document.querySelector('[data-preview-direction="1"]').click();assert(galleryPreviewId==='test-2','Preview advances within filtered photos');
document.querySelector('[data-preview-edit]').click();assert(view==='entry'&&current==='test-2'&&!document.querySelector('#galleryPreview').open,'Edit tags opens the selected photo without changing answers');
view='insights';render();document.querySelector('[data-analysis-view="map"]').click();assert(!document.querySelector('#analysisMapSection').hidden&&document.querySelector('#analysisGallerySection').hidden,'Map-only mode hides gallery');
document.querySelector('[data-analysis-view="both"]').click();assert(!document.querySelector('#analysisMapSection').hidden&&!document.querySelector('#analysisGallerySection').hidden,'Both mode displays map and gallery');
analysisFilters.rules=[{key:'type.kind',value:'French balcony'}];updateFilteredAnalysis();assert(document.querySelectorAll('[data-gallery-photo]').length===1&&overviewPoints.length===1,'One filter updates both gallery and map');
document.querySelector('#clearAnalysisFilters').click();
document.querySelector('#addRelationshipGraph').click();document.querySelector('#addRelationshipGraph').click();
assert(document.querySelectorAll('[data-graph-card]').length===2&&analysisFilters.graphs.length===2,'Multiple relationship graphs can be added');
const firstGraph=analysisFilters.graphs[0],secondGraph=analysisFilters.graphs[1];
let axis=[...document.querySelectorAll('[data-comparison-axis="x"]')].find(e=>e.dataset.comparisonId===secondGraph.id);axis.value='type.material';axis.dispatchEvent(new Event('change',{bubbles:true}));
axis=[...document.querySelectorAll('[data-comparison-axis="y"]')].find(e=>e.dataset.comparisonId===secondGraph.id);axis.value='type.kind';axis.dispatchEvent(new Event('change',{bubbles:true}));
assert(firstGraph.x==='type.windows'&&secondGraph.x==='type.material'&&secondGraph.y==='type.kind','Each graph has independent attribute selectors');
assert(relationshipGraphGroups.get(secondGraph.id).length===1,'Graph plots known categorical attribute pairs');
document.querySelector('[data-comparison-point]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
assert(document.querySelector('[data-comparison-photo]'),'Selecting a graph bubble lists underlying photos');
document.querySelector('[data-comparison-photo]').click();assert(document.querySelector('#galleryPreview').open,'Graph observations open photo previews');document.querySelector('[data-preview-close]').click();
analysisFilters.rules=[{key:'type.kind',value:'Balcony'}];updateFilteredAnalysis();assert(relationshipGraphGroups.get(firstGraph.id).length===0,'Graphs respect current attribute filters');
document.querySelector('#clearAnalysisFilters').click();assert(analysisFilters.graphs.length===2&&relationshipGraphGroups.get(firstGraph.id).length===1,'Clearing filters preserves graphs and restores observations');
document.querySelector('[data-remove-comparison]').click();assert(analysisFilters.graphs.length===1&&document.querySelectorAll('[data-graph-card]').length===1,'Graphs can be removed independently');
let chartSelector=document.querySelector('[data-graph-type]');chartSelector.value='bar';chartSelector.dispatchEvent(new Event('change',{bubbles:true}));
let attributeSelector=document.querySelector('[data-distribution-attribute]');attributeSelector.value='type.material';attributeSelector.dispatchEvent(new Event('change',{bubbles:true}));
assert(document.querySelector('.comparison-svg svg').getAttribute('aria-label').includes('Bar chart')&&relationshipGraphGroups.get(secondGraph.id).length===1,'Bar chart counts the selected attribute');
chartSelector=document.querySelector('[data-graph-type]');chartSelector.value='scatter';chartSelector.dispatchEvent(new Event('change',{bubbles:true}));
assert(secondGraph.x==='type.material'&&secondGraph.y==='type.kind'&&document.querySelector('[data-comparison-axis="y"]'),'Switching back to XY preserves chosen axes');
document.querySelector('#addRelationshipGraph').click();const pieGraph=analysisFilters.graphs[1];
chartSelector=[...document.querySelectorAll('[data-graph-type]')].find(e=>e.dataset.graphType===pieGraph.id);chartSelector.value='pie';chartSelector.dispatchEvent(new Event('change',{bubbles:true}));
attributeSelector=document.querySelector('[data-distribution-attribute]');attributeSelector.value='context.groundUse';attributeSelector.dispatchEvent(new Event('change',{bubbles:true}));
let distribution=distributionGraphData(pieGraph,graphDefinitions());
assert(distribution.answered===1&&distribution.total===2&&distribution.buckets.length===2&&document.querySelector('.distribution-pie'),'Pie chart counts multiple selections with correct selection denominator');
const previousTypes=records['test-1'].types;records['test-1'].types=[...previousTypes,...previousTypes];distribution=distributionGraphData(pieGraph,graphDefinitions());
assert(distribution.answered===1&&distribution.total===2,'Photo attributes are counted once per photo in distribution charts');records['test-1'].types=previousTypes;
document.querySelector('.distribution-legend-item').click();assert(document.querySelector('[data-comparison-photo]'),'Pie legend reveals contributing photo observations');
const legacy=restoreRelationshipGraphs([{id:'old',x:'type.windows',y:'type.kind'}]);assert(legacy[0].type==='scatter','Previously saved XY graphs remain compatible');
let colorToggle=[...document.querySelectorAll('[data-enable-graph-color]')].find(e=>e.dataset.enableGraphColor===pieGraph.id);colorToggle.checked=true;colorToggle.dispatchEvent(new Event('change',{bubbles:true}));
let palette=[...document.querySelectorAll('[data-graph-color-style]')].find(e=>e.dataset.graphColorStyle===pieGraph.id);palette.value='categories';palette.dispatchEvent(new Event('change',{bubbles:true}));
assert(pieGraph.colorEnabled&&pieGraph.colorStyle==='categories'&&document.querySelector('#mapColorLegend'),'Graph color toggle adds the shared map legend');
assert(graphColorFor(pieGraph,'Gastronomy')!==graphColorFor(pieGraph,'Residential'),'Distinct categories receive distinct colors');
const fakeMarker=document.createElement('button');fakeMarker.className='overview-marker';fakeMarker.dataset.colorPhotoIds=JSON.stringify(['test-1']);document.querySelector('#mapPlot').append(fakeMarker);refreshMapColors();
assert(fakeMarker.style.background.includes('conic-gradient')&&fakeMarker.dataset.mappedColors.split(',').length===2,'Multi-valued photo receives a split marker matching graph colors');fakeMarker.remove();
const ratioGraph={...pieGraph,type:'scatter',x:'type.windows',colorAxis:'x',colorStyle:'gradient'};assert(graphColorFor(ratioGraph,'0')!==graphColorFor(ratioGraph,'1')&&graphColorFor(ratioGraph,'Unknown')==='#777777','Gradient colors numeric values and keeps unknown values neutral');
colorToggle=[...document.querySelectorAll('[data-enable-graph-color]')].find(e=>e.dataset.enableGraphColor===secondGraph.id);colorToggle.checked=true;colorToggle.dispatchEvent(new Event('change',{bubbles:true}));
assert(secondGraph.colorEnabled&&!pieGraph.colorEnabled,'Only one graph controls map colors at a time');
colorToggle=[...document.querySelectorAll('[data-enable-graph-color]')].find(e=>e.dataset.enableGraphColor===pieGraph.id);colorToggle.checked=true;colorToggle.dispatchEvent(new Event('change',{bubbles:true}));
await persist();
assert(overviewPoints.length===2&&document.querySelector('#geographicMap')&&document.querySelectorAll('#overviewMapFallback circle').length===2,'Geographic overview includes unclassified photographs and offline fallback');
let exported;download=(content,name,mime)=>{exported={content,name,mime};};
assert(document.querySelectorAll('header button').length===1&&document.querySelector('header button').textContent==='Save','Header has only one Save action');
document.querySelector('#saveHtml').click();assert(document.querySelector('#saveDialog').open,'Save asks for initials');
document.querySelector('#saveInitials').value='bu';updateSavePreview();
assert(document.querySelector('#saveFilenamePreview').textContent==='Facade-ID_BU_v001.html','Save preview includes initials and next version');
document.querySelector('#cancelSave').click();assert(!document.querySelector('#saveDialog').open&&saveMeta.revision===0,'Cancelling save does not increment version');
photos.forEach(p=>p.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
document.querySelector('#saveHtml').click();document.querySelector('#saveInitials').value='bu';document.querySelector('#saveForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
while(saveMeta.revision!==1)await new Promise(r=>setTimeout(r,20));await saveQueue;
assert(exported.name==='Facade-ID_BU_v001.html','Dialog normalizes initials and downloads named HTML');
const parsed=new DOMParser().parseFromString(exported.content,'text/html');const saved=JSON.parse(parsed.querySelector('#collection-data').textContent);
assert(saved.photos.length===2&&saved.records['test-1'].completed&&saved.photos.every(p=>p.src.startsWith('data:')),'HTML export embeds images and answers');
assert(saved.records['test-1'].location.source==='Photo GPS metadata','HTML export retains location provenance');
assert(!parsed.querySelector('#saveHtml').disabled,'Exported copy keeps save button enabled');
assert(saved.saveMeta.revision===1&&saved.saveMeta.initials==='BU'&&!parsed.querySelector('#saveDialog').open,'HTML embeds version and initials with closed save dialog');
assert(Array.isArray(saved.analysisFilters.rules)&&saved.analysisFilters.search==='','Saved HTML retains map filter settings');
assert(saved.analysisFilters.mode==='both'&&!parsed.querySelector('#galleryPreview'),'HTML preserves display preference and omits temporary preview dialog');
assert(saved.analysisFilters.graphs.length===2&&saved.analysisFilters.graphs[0].x==='type.material'&&saved.analysisFilters.graphs[1].type==='pie'&&saved.analysisFilters.graphs[1].attribute==='context.groundUse','HTML preserves graph types and attribute configurations');
assert(saved.analysisFilters.graphs[1].colorEnabled&&saved.analysisFilters.graphs[1].colorStyle==='categories','HTML preserves graph and map color mapping');
assert(saved.records['test-1'].buildingType===1&&saved.records['test-2'].buildingType===1,'Building type numbers are included in saved HTML');
assert(saved.records['test-1'].context.streetRatio==='Street width < building height','Street-width comparison survives HTML export');
await saveHtml('BU');assert(exported.name==='Facade-ID_BU_v002.html'&&saveMeta.revision===2,'Subsequent save increments revision');
const savedState=await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get(embedded.dataset);request.onsuccess=()=>resolve(JSON.parse(request.result));request.onerror=reject;});
assert(savedState.saveMeta.revision===2&&savedState.saveMeta.initials==='BU','Browser storage retains revision and initials');
const canvas=document.createElement('canvas');canvas.width=4;canvas.height=4;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,4,4);
const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const file=new File([blob],'New facade.png',{type:'image/png'});
await addPhotos([file]);const uploaded=photos.find(p=>p.uploaded);
assert(photos.length===3&&uploaded&&current===uploaded.id&&step===0,'Photo upload adds and opens a new profile');
writeMapPosition({lat:48.2,lng:11.6},'Manual map pin');await saveQueue;
await addPhotos([file]);assert(photos.length===3&&document.querySelector('#uploadStatus').textContent.includes('duplicate'),'Uploading the same photo twice avoids duplicates');
const uploadState=await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get(embedded.dataset);request.onsuccess=()=>resolve(JSON.parse(request.result));request.onerror=reject;});
assert(uploadState.uploadedPhotos.length===1&&uploadState.uploadedPhotos[0].src.startsWith('data:image/jpeg'),'Uploaded photo is persisted for reopening');
await saveHtml('BU');const withUpload=JSON.parse(new DOMParser().parseFromString(exported.content,'text/html').querySelector('#collection-data').textContent);
assert(withUpload.photos.length===3&&withUpload.photos.some(p=>p.id===uploaded.id)&&withUpload.records[uploaded.id].location.lat==='48.2000000','Saved HTML contains uploaded image and its answers');
photos=photos.filter(p=>p.id!==uploaded.id);delete records[uploaded.id];
mergeData(withUpload);assert(photos.some(p=>p.id===uploaded.id)&&records[uploaded.id].location.lng==='11.6000000','Merge imports new participant photos and their answers');
const originalConfirm=window.confirm;current=uploaded.id;window.confirm=()=>false;await deleteCurrentPhoto();
assert(photos.some(p=>p.id===uploaded.id),'Cancelling photo deletion keeps image and answers');
window.confirm=()=>true;await deleteCurrentPhoto();window.confirm=originalConfirm;
assert(!photos.some(p=>p.id===uploaded.id)&&!records[uploaded.id]&&deletedPhotoIds.has(uploaded.id),'Deleting a photo removes image and answers');
const deleteState=await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get(embedded.dataset);request.onsuccess=()=>resolve(JSON.parse(request.result));request.onerror=reject;});
assert(deleteState.deletedPhotoIds.includes(uploaded.id),'Deleted image IDs persist in browser storage');
mergeData(withUpload);assert(!photos.some(p=>p.id===uploaded.id),'Merging an older copy does not resurrect a locally deleted image');
await saveHtml('BU');const afterDelete=JSON.parse(new DOMParser().parseFromString(exported.content,'text/html').querySelector('#collection-data').textContent);
assert(!afterDelete.photos.some(p=>p.id===uploaded.id)&&!afterDelete.records[uploaded.id]&&afterDelete.deletedPhotoIds.includes(uploaded.id),'Saved HTML omits deleted image and answers');
photos=[...withUpload.photos];records=structuredClone(withUpload.records);restoreDeletedPhotos(deleteState.deletedPhotoIds);applyPhotoDeletions();
assert(!photos.some(p=>p.id===uploaded.id)&&!records[uploaded.id],'Reopening old embedded photos respects saved deletions');
await undoPhotoDelete();assert(photos.some(p=>p.id===uploaded.id)&&records[uploaded.id].location.lng==='11.6000000'&&!deletedPhotoIds.has(uploaded.id),'Undo restores deleted photo and its answers');
document.body.innerHTML='<pre id="test-results">PASS: '+results.join('\nPASS: ')+'</pre>';
}catch(e){document.body.innerHTML='<pre id="test-results">FAIL: '+e.stack+'\nPassed: '+results.join(', ')+'</pre>';}
}checks();
</script>
'''
(root / 'browser-checks.html').write_text(html.replace('</body>', checks + '</body>'), encoding='utf-8')
data['dataset'] += '-sorting-preview'
preview = re.sub(r'(<script id="collection-data" type="application/json">).*?(</script>)', lambda m: m[1] + json.dumps(data) + m[2], html, flags=re.S)
(root / 'sorting-preview.html').write_text(preview,encoding='utf-8')
