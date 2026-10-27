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
html = html.replace('<head>', '<head><script>window.onerror=(message,source,line)=>{document.title="JS ERROR line "+line+": "+message;};</script>')
html = re.sub(r'(<script id="collection-data" type="application/json">).*?(</script>)', lambda m: m[1] + json.dumps(data) + m[2], html, flags=re.S)
checks = r'''
<script>
async function checks(){
const results=[];const assert=(v,label)=>{if(!v)throw Error(label);results.push(label);};
try{
while(!document.querySelector('#next'))await new Promise(r=>setTimeout(r,20));
assert(photos.length===2,'Collection loads');
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
view='insights';render();assert(document.querySelector('#radar svg')&&document.querySelector('#clusters').textContent.includes('French balcony'),'Analysis renders');
assert(document.querySelectorAll('[data-radar-dimension]').length===8,'Radar dimensions are selectable');
const previousDims=[...analysisSettings.radarDims];
document.querySelectorAll('[data-radar-dimension]').forEach(el=>{el.checked=false;});
document.querySelector('[data-radar-dimension]').dispatchEvent(new Event('change',{bubbles:true}));
assert(document.querySelector('#radar').textContent.includes('at least three'),'Radar requires at least three axes');
document.querySelectorAll('[data-radar-dimension]').forEach(el=>{el.checked=['windows','share','relief'].includes(el.dataset.radarDimension);});
document.querySelector('[data-radar-dimension]').dispatchEvent(new Event('change',{bubbles:true}));
assert(document.querySelector('#radar svg').textContent.includes('Share of entire façade'),'Selected radar axes update diagram');
document.querySelector('#relationshipX').value='material';document.querySelector('#relationshipX').dispatchEvent(new Event('change',{bubbles:true}));
document.querySelector('#relationshipY').value='kind';document.querySelector('#relationshipY').dispatchEvent(new Event('change',{bubbles:true}));
assert(document.querySelector('#relationshipPlot svg')&&relationshipGroups.length===1,'Relationship chart supports categorical axes');
const observed=records['test-1'];observed.types.push(structuredClone(observed.types[0]));render();
assert(relationshipGroups[0].length===2&&document.querySelector('#relationshipCount').textContent.includes('2 of 2'),'Overlapping observations are grouped and counted');
document.querySelector('#compareB').value='test-1|1';document.querySelector('#compareB').dispatchEvent(new Event('change',{bubbles:true}));
assert(analysisSettings.radarB==='test-1|1'&&document.querySelector('#radarDetails').textContent.includes('Type 2'),'Radar compares individual types within a photo');
document.querySelector('[data-relationship-group]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
assert(document.querySelectorAll('[data-analysis-profile]').length===2,'Chart bubble lists underlying profiles');
document.querySelectorAll('[data-analysis-profile]')[1].click();assert(view==='entry'&&step===3&&typeIndex===1,'Relationship chart opens selected type');
observed.types.pop();analysisSettings.radarDims=previousDims;analysisSettings.x='windows';analysisSettings.y='enclosure';view='insights';render();await persist();
assert(analysisValue({type:{windows:'Unknown'},record:{context:{}}},analysisDimensions[0])===null,'Unknown chart values are omitted rather than treated as zero');
assert(document.querySelectorAll('#mapPlot circle').length===2,'GPS map includes unclassified photographs');
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
assert(saved.analysisSettings.radarDims.length===4&&saved.analysisSettings.x==='windows','Saved HTML retains chart choices');
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
document.body.innerHTML='<pre id="test-results">PASS: '+results.join('\nPASS: ')+'</pre>';
}catch(e){document.body.innerHTML='<pre id="test-results">FAIL: '+e.stack+'\nPassed: '+results.join(', ')+'</pre>';}
}checks();
</script>
'''
(root / 'browser-checks.html').write_text(html.replace('</body>', checks + '</body>'), encoding='utf-8')
