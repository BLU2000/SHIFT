const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const port=9347;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless','--disable-gpu','--no-first-run','--no-default-browser-check',
 '--remote-debugging-port='+port,'--remote-allow-origins=*',
 '--user-data-dir='+path.join(__dirname,'.qa-facade-clustering'),
 pathToFileURL(path.join(__dirname,'Facade ID/Facade-ID_Main.html')).href
],{stdio:'ignore',windowsHide:true});
let ws;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let pages;
 for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json')).json();if(pages.some(p=>p.type==='page'))break;}catch{}await delay(250);}
 const page=pages?.find(p=>p.type==='page');assert(page,'Chrome debugging page available');
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map();const errors=[];
 ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(Error(data.error.message)):p.resolve(data.result);}}};
 function call(method,params={}){return new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params}));});}
 async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
 await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for(let i=0;i<80;i++){if(await evaluate('!!document.getElementById("facadeClusterOpen")'))break;await delay(200);}
 assert(await evaluate('!!document.getElementById("facadeClusterOpen")'),'Clustering entry button rendered');
 await evaluate('document.getElementById("facadeClusterOpen").click()');
 assert(await evaluate('document.getElementById("facadeClusterDialog").open'),'Dialog opened');
 assert(await evaluate('filterDefinitions().some(d=>d.key==="record.thresholdTypes")'),'Whole-facade threshold types available as analysis filter');
 assert(await evaluate('Array.from(document.querySelectorAll("[data-fc-attribute]")).some(x=>x.dataset.fcAttribute==="record.thresholdTypes")'),'Threshold types available for clustering');
 assert(await evaluate(`attributeFilterValue({}, {types:[{kind:'Loggia'},{kind:'Balcony'}]}, {}, filterDefinitions().find(d=>d.key==='record.thresholdTypes')).sort().join(',')==='Balcony,Loggia'`),'Multiple threshold labels propagated to the whole facade');
 // Synthetic records only in this isolated QA browser; block autosave before any changes.
 await evaluate(`persist=async function(){};
 photos=Array.from({length:12},(_,i)=>({id:'qa-'+i,name:'Test facade '+i,src:''}));
 records=Object.fromEntries(photos.map((p,i)=>[p.id,{wwrBand:i<6?'25%':'75%',context:{groundUse:i<6?['Retail']:['Residential'],surroundingGreen:i<6?'Low':'High'},division:{homogeneity:'Homogeneous'},types:[{kind:i<6?'Punched-window fa\u00e7ade':'Balcony',windows:i<6?'\u00bc':'\u00be',relief:i<6?'Flat':'Strongly articulated',material:i<6?'Masonry':'Timber',share:'1'}]}]));
 for(const input of document.querySelectorAll('[data-fc-attribute]')){input.checked=['type.kind','record.wwrBand','type.relief'].includes(input.dataset.fcAttribute);input.dispatchEvent(new Event('change'));}
 document.getElementById('fc-k').value=2;
 document.getElementById('fc-max').value=4;
 document.getElementById('fc-run').click();`);
 async function waitRun(){for(let i=0;i<100;i++){if(await evaluate('!document.getElementById("fc-run").disabled'))return;await delay(100);}throw Error('Clustering timed out');}
 await waitRun();
 const status=await evaluate('document.getElementById("fc-status").textContent');assert(status.includes('12 facades clustered'),status);
 assert(await evaluate('document.querySelectorAll("#fc-output svg").length>=3'),'Elbow, radar and results plot rendered');
 assert(await evaluate('document.getElementById("fc-plot").textContent.includes("PCA")'),'Mixed attributes use PCA');
 assert(await evaluate('document.getElementById("fc-cluster-pie").textContent.includes("6 (50.0%)")'),'Pie shows cluster counts and percentages');
 assert(await evaluate('document.getElementById("fc-initializations").textContent.includes("Best")'),'Best initialization and compactness comparison rendered');
 assert.equal(await evaluate('analysisSettings.clustering.starts'),20,'Starting configuration setting persisted');
 assert.equal(await evaluate('analysisSettings.clustering.seed'),42,'Random seed persisted');
 // Three normalized numeric attributes -> 3D controls.
 await evaluate(`document.querySelector('[data-fc-attribute="type.kind"]').click();document.querySelector('[data-fc-attribute="thresholdScore"]').click();document.getElementById('fc-run').click();`);
 await waitRun();assert(await evaluate('!!document.getElementById("fc-yaw")'),'Three numeric attributes offer 3D rotation: '+await evaluate('document.getElementById("fc-status").textContent+" / "+Array.from(document.querySelectorAll("[data-fc-attribute]:checked")).map(x=>x.dataset.fcAttribute).join(",")+" / "+document.getElementById("fc-plot")?.textContent'));
 await evaluate(`document.getElementById('fc-yaw').value=60;document.getElementById('fc-yaw').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-fc-point="0"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
 assert(await evaluate('document.getElementById("fc-point-preview").textContent.includes("Test facade 0")'),'Point preview works');
 // Two numeric attributes -> direct 2D; one -> strip.
 await evaluate(`document.querySelector('[data-fc-attribute="thresholdScore"]').click();document.getElementById('fc-run').click();`);await waitRun();
 assert(await evaluate('document.getElementById("fc-plot").textContent.includes("2D scatter")'),'Two attributes use scatter');
 await evaluate(`document.querySelector('[data-fc-attribute="type.relief"]').click();document.getElementById('fc-run').click();`);await waitRun();
 assert(await evaluate('document.getElementById("fc-plot").textContent.includes("1D strip")'),'One attribute uses strip plot');
 // k validation and selected-field missing-data handling.
 await evaluate(`records['qa-0'].wwrBand='Unknown';document.getElementById('fc-run').click();`);await waitRun();
 assert(await evaluate('document.getElementById("fc-status").textContent.includes("1 excluded")'),'Missing data exclusions reported');
 assert(await evaluate('document.getElementById("fc-cluster-pie").textContent.includes("Share of 11 clustered facades")'),'Pie denominator excludes missing-data records');
 assert.equal(errors.length,0,'No runtime errors: '+errors.join('\n'));
 await evaluate(`document.querySelector('[data-fc-attribute="type.relief"]').click();document.querySelector('[data-fc-attribute="thresholdScore"]').click();document.getElementById('fc-run').click();`);await waitRun();
 await evaluate(`document.getElementById('facadeClusterDialog').scrollTop=0;document.querySelector('.fc-results').scrollTop=0;document.querySelector('.fc-controls').scrollTop=0;`);
 await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>fs.writeFileSync(path.join(__dirname,'facade-clustering-preview.png'),Buffer.from(r.data,'base64')));
 // A saved HTML contains a cloned header button without its event listeners.
 await evaluate(`document.getElementById('facadeClusterDialog').close();const old=document.getElementById('facadeClusterOpen');old.replaceWith(old.cloneNode(true));`);
 await delay(50);
 await evaluate('document.getElementById("facadeClusterOpen").click()');
 assert(await evaluate('document.getElementById("facadeClusterDialog").open'),'Cloned saved-file button rebinds');
 await evaluate(`restoreAnalysisSettings({clustering:{attributes:['type.kind'],k:2,maxK:4}});`);
 assert.equal(await evaluate('analysisSettings.clustering.k'),2,'Saved clustering settings restore');
 await evaluate(`document.getElementById('facadeClusterDialog').close();
 photos.forEach((p,i)=>Object.assign(records[p.id].context,{orientation:i<6?'North':'South',streetRatio:'Street width < building height',storeys:String(i%2+4)}));
 photos.forEach((p,i)=>{records[p.id].location=i===1?{}:i===11?{lat:95,lng:11.5}:{lat:48.1+(i===6?0:i)*0.002,lng:11.5+(i===6?0:i)*0.002};});
 records['qa-0'].types=[{kind:'Loggia',share:'0.5'},{kind:'Balcony',share:'0.5'}];
 document.getElementById('facadeCombinationsOpen').click();
 document.getElementById('comb-storeys').value='3';document.getElementById('comb-run').click();`);
 assert(await evaluate('document.getElementById("facadeCombinationsDialog").open'),'Combination dialog opens');
 assert.equal(await evaluate('document.querySelectorAll("#comb-table tbody tr").length'),3,'Whole-facade multi-label combinations produce three observed rows');
 assert(await evaluate('document.getElementById("comb-status").textContent.includes("12 facades")'),'All facades counted once');
 assert(await evaluate('document.getElementById("comb-map-status").textContent.includes("10 located facades; 2 without valid coordinates")'),'Map reports valid and missing locations without changing counts');
 assert.equal(await evaluate('new Set(Array.from(document.querySelectorAll("#comb-output rect[data-comb-row]")).map(r=>r.getAttribute("fill"))).size'),3,'Each bar has a distinct combination colour');
 assert(await evaluate('Array.from(document.querySelectorAll("#comb-map [data-comb-map]")).every(m=>Array.from(document.querySelectorAll("#comb-output rect[data-comb-row]")).some(b=>b.getAttribute("fill")===m.getAttribute("fill")))'),'Map colours match bar colours');
 assert(await evaluate('!!document.querySelector("#comb-map path[data-comb-map]")'),'Shared locations split colours across combinations');
 assert(await evaluate('document.getElementById("comb-live-map").getBoundingClientRect().height>=500'),'Map has a larger dedicated area');
 assert(await evaluate('!!document.querySelector("#comb-live-map .leaflet-control-zoom-in")'),'Map exposes zoom controls');
 assert(await evaluate('!!document.querySelector("#comb-live-map .maplibregl-canvas")'),'OpenFreeMap background renderer initialized');
 const beforeZoom=await evaluate('document.getElementById("comb-live-map").dataset.zoom');
 await evaluate('document.querySelector("#comb-live-map .leaflet-control-zoom-in").click()');await delay(450);
 assert.notEqual(await evaluate('document.getElementById("comb-live-map").dataset.zoom'),beforeZoom,'Zoom control changes map scale');
 await evaluate('document.getElementById("comb-streets").click()');
 assert(await evaluate('document.getElementById("comb-tile-status").textContent.includes("Offline country outlines")'),'Street toggle retains an offline interactive map');
 await evaluate('document.getElementById("comb-streets").click();document.getElementById("comb-fit").click()');
 await evaluate('document.querySelector("#comb-map [data-comb-map]").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
 assert(await evaluate('document.getElementById("comb-preview").textContent.includes("1 facades")'),'Map marker selects only its located members');
 assert(await evaluate('document.getElementById("comb-table").textContent.includes("Balcony + Loggia")'),'Mixed thresholds stay together');
 assert(await evaluate('document.getElementById("comb-table").textContent.includes("4–6 storeys")'),'Storey bands group heights');
 await evaluate(`document.querySelector('button[data-comb-row="0"]').click();document.querySelector('[data-comb-member="0"]').click();`);
 assert(await evaluate('document.getElementById("comb-photo").textContent.includes("Open facade profile")'),'Combination member preview opens');
 await evaluate(`delete records['qa-1'].context.orientation;document.getElementById('comb-missing').checked=false;document.getElementById('comb-run').click();`);
 assert(await evaluate('document.getElementById("comb-status").textContent.includes("11 facades")'),'Missing-data policy updates frequency denominator');
 await evaluate(`analysisFilters.search='';analysisFilters.rules=[{key:'context.orientation',value:'North'}];document.getElementById('comb-filter').checked=true;document.getElementById('comb-run').click();`);
 assert(await evaluate('document.getElementById("comb-status").textContent.includes("5 facades")'),'Current filters select frequency cohort');
 assert.equal(await evaluate('analysisSettings.combinations.storeyBand'),3,'Combination settings persist');
 await evaluate(`document.getElementById('facadeCombinationsDialog').close();const b=document.getElementById('facadeCombinationsOpen');b.replaceWith(b.cloneNode(true));`);await delay(50);
 await evaluate('document.getElementById("facadeCombinationsOpen").click()');
 assert(await evaluate('document.getElementById("facadeCombinationsDialog").open'),'Saved-file combination button rebinds');
 assert.equal(errors.length,0,'No runtime errors after frequency analysis: '+errors.join('\n'));
 await evaluate(`document.getElementById('facadeCombinationsDialog').scrollTop=0;document.querySelector('#facadeCombinationsDialog .fc-results').scrollTop=0;`);
 await evaluate('document.getElementById("comb-live-map").scrollIntoView({block:"center"})');await delay(500);
 assert(await evaluate('Array.from(document.querySelectorAll("#comb-live-map .leaflet-control-attribution svg")).every(svg=>svg.getBoundingClientRect().width<20)'),'Attribution icons retain their compact size');
 await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>fs.writeFileSync(path.join(__dirname,'facade-combinations-preview.png'),Buffer.from(r.data,'base64')));
 await evaluate(`document.getElementById('facadeCombinationsDialog').close();records['qa-0'].types=[{kind:'Punched-window fa\u00e7ade',share:'0.9'},{kind:'Balcony',share:'0.1'}];records['qa-0'].context.wholeFacade='Mixed';current='qa-0';view='entry';step=0;render();`);
 assert.equal(await evaluate('records["qa-0"].context.wholeFacade'),'Balcony','Primary type follows the threshold despite a larger punched area');
 assert.equal(await evaluate('records["qa-0"].context.wholeFacadeOriginal'),'Mixed','Original manual tag preserved');
 assert(await evaluate('!filterDefinitions().find(d=>d.key==="context.wholeFacade").values.includes("Mixed")'),'Mixed removed from primary type choices');
 assert(await evaluate('document.getElementById("main").textContent.includes("Primary façade type")'),'Primary type displayed in tagging interface');
 await evaluate(`photos=Array.from({length:6},(_,i)=>({id:'sigma-'+i,name:'Sigma facade '+i,src:''}));
 records=Object.fromEntries(photos.map((p,i)=>[p.id,{context:{orientation:i<3?'North':'South',wholeFacade:'Balcony',storeys:String(i+1)},types:[{kind:'Balcony'},{kind:'Loggia'}],wwrBand:i<5?((i+1)*10)+'%':'Unknown'}]));
 analysisSettings.analysisCanvas=[{id:'sigma-data',kind:'data',title:'Data',x:1200,y:0,width:400,height:400,filters:{search:'',rules:[],graphs:[]}},{id:'sigma-analysis',kind:'analysis',title:'Numeric distribution',x:20,y:20,width:1080,height:1000,filters:{search:'',rules:[],graphs:[{id:'sigma-graph',type:'bar',attribute:'record.wwrBand',x:'record.wwrBand',y:'type.kind',colorEnabled:false}]}}];
 analysisSettings.analysisCanvasConnections=[];analysisSettings.analysisCanvasGroups=[];analysisSettings.analysisCanvasCamera={x:0,y:0,zoom:1};
 document.getElementById('topAnalysis').click();`);
 for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".canvas-node[data-kind=analysis] iframe")?.contentDocument?.querySelector(".category-coverage-chart")'))break;await delay(100);}
 assert(await evaluate('!!document.querySelector(".canvas-node[data-kind=analysis] iframe").contentDocument.querySelector(".category-coverage-chart")'),'Category coverage renders inside canvas graph module');
 assert.equal(await evaluate('document.querySelector(".canvas-node[data-kind=analysis] iframe").contentDocument.querySelectorAll("[data-category-area]").length'),3,'Nearest category and both neighbour ranges shaded');
 assert(await evaluate('document.querySelector(".canvas-node[data-kind=analysis] iframe").contentDocument.querySelectorAll("[data-category-summary]")[0].textContent.includes("1 / 5")'),'Nearest category coverage correct');
 assert(await evaluate('document.querySelector(".canvas-node[data-kind=analysis] iframe").contentDocument.querySelectorAll("[data-category-summary]")[2].textContent.includes("60.0%")'),'Two-neighbour observed percentage correct');
 assert(await evaluate('document.querySelector(".canvas-node[data-kind=analysis] iframe").contentDocument.querySelector(".category-coverage-summary").textContent.includes("Excluded = 1")'),'Missing values reported without duplicating facade types');
 const inFrame=code=>'document.querySelector(".canvas-node[data-kind=analysis] iframe").contentWindow.eval('+JSON.stringify(code)+')';
 assert.equal(await evaluate(inFrame(`(()=>{const button=document.querySelector('[data-category-summary="2"] button');return relationshipGraphGroups.get(button.dataset.comparisonPoint)[Number(button.dataset.pointIndex)].length;})()`)),3,'Category inspect button maps to actual contributing facades');
 await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>fs.writeFileSync(path.join(__dirname,'category-coverage-canvas-preview.png'),Buffer.from(r.data,'base64')));
 await evaluate(inFrame(`analysisFilters.graphs[0].attribute='context.orientation';renderComparisonGraphs();`));
 assert(await evaluate(inFrame('!document.querySelector(".category-coverage-chart")')),'Categorical bars remain categorical');
 await evaluate(inFrame(`analysisFilters.graphs[0].attribute='record.wwrBand';for(const r of Object.values(records))r.wwrBand='25%';renderComparisonGraphs();`));
 assert(await evaluate(inFrame('document.querySelector(".category-coverage-summary").textContent.includes("Nearest category = 25%")&&document.querySelector("[data-category-summary]").textContent.includes("100.0%")')),'Identical values have 100% nearest-category coverage');
 await evaluate(inFrame(`photos.forEach((photo,i)=>{records[photo.id].types=i===0?[{kind:'Punched-window fa\u00e7ade',share:'0.8'},{kind:'Loggia',share:'0.2'}]:i===1?[{kind:'Punched-window fa\u00e7ade',share:'0.4'},{kind:'Loggia',share:'0.6'}]:i===2?[{kind:'Loggia'},{kind:'Balcony'}]:[{kind:'Balcony'}];});
 const select=document.querySelector('[data-graph-type]');select.value='areaShare';select.dispatchEvent(new Event('change',{bubbles:true}));`));
 assert(await evaluate(inFrame('!!document.querySelector(".facade-area-share-chart")')),'Area-share chart available through the canvas chart-type selector');
 assert.equal(await evaluate(inFrame(`Number(document.querySelector('[data-area-group="North"][data-area-kind="Loggia"]').dataset.areaShare)`)),.4,'North-facing loggia area share averages whole-facade proportions');
 assert.equal(await evaluate(inFrame(`Number(document.querySelector('[data-area-group="South"][data-area-kind="Balcony"]').dataset.areaShare)`)),1,'Single-type facades contribute full area');
 assert(await evaluate(inFrame('document.querySelector(".comparison-graph p[role=status]").textContent.includes("1 facades excluded")')),'Missing area shares reported');
 assert.equal(await evaluate(inFrame(`restoreRelationshipGraphs(analysisFilters.graphs)[0].type`)),'areaShare','Area-share chart type survives save/restore');
 assert.equal(await evaluate(inFrame(`(()=>{const part=document.querySelector('[data-area-group="North"][data-area-kind="Loggia"]');return relationshipGraphGroups.get(part.dataset.comparisonPoint)[Number(part.dataset.pointIndex)].length;})()`)),2,'Area segments retain contributing facade profiles');
 await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>fs.writeFileSync(path.join(__dirname,'facade-area-share-canvas-preview.png'),Buffer.from(r.data,'base64')));
 assert.equal(errors.length,0,'No runtime errors in numeric canvas graphs: '+errors.join('\n'));
 console.log('Browser checks passed: clustering regression checks; combination counts, multi-label sets, height bands, previews, missing-data denominator, filters, settings and saved-file entry.');
 await call('Browser.close');ws.close();
})().catch(error=>{console.error(error.stack);process.exitCode=1;if(ws)ws.close();browser.kill();});
