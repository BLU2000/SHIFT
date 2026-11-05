(function(){
 'use strict';
 const C=window.FacadeClustering;
 if(!C)return;
 const colors=['#002fa7','#d65529','#16806a','#8b4bb1','#aa7600','#cf3978','#368aa6','#5a7330','#744a37','#525d75'];
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let dialog,definitions=[],state=null,selected=null,previousFocus=null;
 if(typeof restoreAnalysisSettings==='function'){
  const restore=restoreAnalysisSettings;
  restoreAnalysisSettings=function(value){restore(value);if(value?.clustering&&typeof value.clustering==='object')analysisSettings.clustering=structuredClone(value.clustering);};
  if(typeof embedded==='object'&&embedded.analysisSettings?.clustering)analysisSettings.clustering=structuredClone(embedded.analysisSettings.clustering);
 }
 if(typeof saveHtml==='function'){
  const save=saveHtml;
  saveHtml=async function(...args){const panel=document.getElementById('facadeClusterDialog');if(panel){panel.close();panel.remove();}try{return await save.apply(this,args);}finally{if(panel)document.body.appendChild(panel);}};
 }
 const numberFields=new Set(['windows','relief','enclosure','reveal','depth','surroundingGreen','streetRatio','storeys']);
 function getDefinitions(){
  const source=typeof filterDefinitions==='function'?filterDefinitions():[];
  return [{key:'thresholdScore',label:'Average threshold score',scope:'type',field:'thresholdScore',type:'numeric'},...source.filter(d=>(['type','context','division'].includes(d.scope)||['record.wwrBand','record.hasThreshold','record.thresholdTypes'].includes(d.key))&&!['share','threshold','facadeDepth'].includes(d.field)).map(d=>({...d,type:numberFields.has(d.field)||d.key==='record.wwrBand'?'numeric':'categorical',label:d.field==='kind'?'Threshold-type shares':d.label}))];
 }
 function settings(){return typeof analysisSettings==='object'?analysisSettings.clustering||{}:{};}
 function remember(config){if(typeof analysisSettings==='object'){analysisSettings.clustering=config;if(typeof persist==='function')persist();}}
 function attach(){
  const existing=document.getElementById('facadeClusterOpen');if(existing){existing.onclick=open;return;}
  const host=document.querySelector('header .toolbar')||document.querySelector('header');if(!host)return;
  const b=document.createElement('button');b.id='facadeClusterOpen';b.type='button';b.className='fc-entry';b.textContent='Cluster facades';b.onclick=open;host.appendChild(b);
 }
 function open(){
  previousFocus=document.activeElement;
  definitions=getDefinitions();const saved=settings();
  selected=new Set(saved.attributes||['type.kind',definitions.some(d=>d.key==='record.wwrBand')?'record.wwrBand':'type.windows','type.relief']);
  dialog=document.getElementById('facadeClusterDialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='facadeClusterDialog';dialog.className='fc-dialog';document.body.appendChild(dialog);dialog.addEventListener('close',()=>previousFocus?.focus());}
  dialog.innerHTML=`<div class="fc-head"><div><h2>Cluster whole facades</h2><p>Area-weighted profiles · normalized attributes · k-medoids</p></div><button type="button" id="fc-close" aria-label="Close clustering">Close</button></div><div class="fc-body"><aside class="fc-controls"><p class="fc-help">Choose attributes and their importance. Categories stay categories; multi-label answers use overlap. Unknown or missing selected attributes exclude a facade.</p><label><input id="fc-filter" type="checkbox" ${saved.filtered?'checked':''}>Use current analysis filters</label><fieldset><legend>Attributes / weight</legend>${definitions.map(d=>`<div class="fc-feature"><label><input type="checkbox" data-fc-attribute="${e(d.key)}" ${selected.has(d.key)?'checked':''}>${e(d.label)}${d.type==='numeric'?'':' (labels)'}</label><input type="number" data-fc-weight="${e(d.key)}" aria-label="Weight for ${e(d.label)}" min="0.1" max="10" step="0.1" value="${Number(saved.weights?.[d.key])||1}"></div>`).join('')}</fieldset><details><summary>Threshold scale and weighting</summary><p class="fc-help">Proposed ordinal scale: punched opening 0; French balcony 1; bay window 2; loggia 3; semi-loggia 4; balcony 5. Score = area-weighted mean / 5. This is an analytical scale, not measured projection depth.</p><p class="fc-help">Shares refer to the entire facade and are rescaled to sum to 1. A single type can omit its share. Multiple types require known shares. Every positive-share type must answer each selected type attribute. Shares and the average score cannot both be selected.</p></details><fieldset><legend>Cluster counts</legend><label>Elbow maximum k <input id="fc-max" type="number" min="2" max="10" value="${Math.min(10,Math.max(2,Number(saved.maxK)||6))}"></label><label>Final clusters k <input id="fc-k" type="number" min="1" max="10" value="${Math.min(10,Math.max(1,Number(saved.k)||3))}"></label><label>Starting configurations <input id="fc-starts" type="number" min="1" max="50" value="${Math.min(50,Math.max(1,Number(saved.starts)||20))}"></label><label>Random seed <input id="fc-seed" type="number" min="0" max="4294967295" step="1" value="${Number.isInteger(saved.seed)?saved.seed:42}"></label><p class="fc-help">Keep the most compact result among distinct starts for each k. The same seed reproduces the same starts. One start may extend the previous k result to keep the elbow curve non-increasing. If fewer distinct starts exist, all available starts are used.</p></fieldset><button class="fc-primary" id="fc-run" type="button">Evaluate and cluster</button><p class="fc-help">Elbow: total distance to representatives. Lower is tighter. Compare silhouette scores too; an elbow is not guaranteed.</p><button id="fc-export" type="button" disabled>Export assignments CSV</button><p class="fc-source">Method: <a href="https://en.wikipedia.org/wiki/K-medoids" target="_blank" rel="noopener">k-medoids</a>, with a mixed-attribute distance: numeric absolute differences, categorical Jaccard distance, and total variation of area-weighted type-label distributions. All run locally.</p></aside><section class="fc-results"><div id="fc-status" class="fc-status" role="status">Select attributes, then evaluate. Existing labels and sorted categories remain unchanged.</div><div id="fc-output" class="fc-empty">Your cluster comparison, radar profiles and result plot will appear here.</div></section></div>`;
  dialog.querySelector('#fc-close').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-fc-attribute]').forEach(input=>input.onchange=()=>{if(input.checked)selected.add(input.dataset.fcAttribute);else selected.delete(input.dataset.fcAttribute);if(input.checked&&['type.kind','thresholdScore'].includes(input.dataset.fcAttribute)){const other=input.dataset.fcAttribute==='type.kind'?'thresholdScore':'type.kind';selected.delete(other);dialog.querySelector(`[data-fc-attribute="${other}"]`).checked=false;}});
  dialog.querySelector('#fc-run').onclick=run;
  dialog.querySelector('#fc-export').onclick=exportCSV;
  dialog.showModal();
 }
 function status(message){dialog.querySelector('#fc-status').textContent=message;}
 async function run(){
  const defs=definitions.filter(d=>selected.has(d.key)).map(d=>({...d,weight:Number(dialog.querySelector(`[data-fc-weight="${d.key}"]`).value)}));
  const maxK=Number(dialog.querySelector('#fc-max').value),k=Number(dialog.querySelector('#fc-k').value);
  if(!defs.length){status('Select at least one attribute.');return;}
  if(defs.some(d=>!Number.isFinite(d.weight)||d.weight<.1||d.weight>10)){status('Attribute weights must be between 0.1 and 10.');return;}
  if(!Number.isInteger(maxK)||maxK<2||maxK>10||!Number.isInteger(k)||k<1||k>maxK){status('Use an elbow maximum from 2 to 10 and a final k between 1 and that maximum.');return;}
  const starts=Number(dialog.querySelector('#fc-starts').value),seed=Number(dialog.querySelector('#fc-seed').value);
  if(!Number.isInteger(starts)||starts<1||starts>50||!Number.isInteger(seed)||seed<0||seed>4294967295){status('Use 1?50 starting configurations and a seed from 0 to 4294967295.');return;}
  const filtered=dialog.querySelector('#fc-filter').checked;
  const items=photos.filter(p=>!filtered||typeof filterPhotoMatches!=='function'||filterPhotoMatches(p)).map(p=>({id:p.id,name:p.name,photo:p,record:records[p.id]||{}}));
  const prepared=C.prepare(items,defs);
  if(prepared.rows.length<2||k>prepared.rows.length){status(`Only ${prepared.rows.length} eligible facade(s). Add answers or reduce selected attributes / k.`);showExcluded(prepared);return;}
  remember({attributes:defs.map(d=>d.key),weights:Object.fromEntries(defs.map(d=>[d.key,d.weight])),maxK,k,filtered,starts,seed});
  const button=dialog.querySelector('#fc-run');button.disabled=true;dialog.querySelector('#fc-export').disabled=true;status('Evaluating cluster counts locally…');
  await new Promise(resolve=>setTimeout(resolve,30));
  try{
   const D=C.matrix(prepared.rows,defs),curve=[];
   for(let n=1;n<=Math.min(maxK,prepared.rows.length);n++){
    curve.push({k:n,...C.fit(D,n,starts,curve.at(-1)?.medoids,seed)});
    status(`Evaluated k = ${n} of ${Math.min(maxK,prepared.rows.length)}…`);
    await new Promise(resolve=>setTimeout(resolve,0));
   }
   state={...prepared,defs,D,curve,k,result:curve[k-1],yaw:35,pitch:25};
   const fingerprints=new Set(prepared.rows.map(r=>JSON.stringify(r.values))).size;
   status(`${prepared.rows.length} facades clustered; ${prepared.excluded.length} excluded; ${fingerprints} distinct profiles. ${prepared.renormalized} multi-type share totals rescaled. ${k>fingerprints?'More clusters than distinct profiles: some groups have identical attributes. ':''}Best start ${state.result.bestStart} of ${state.result.trials.length}; mean representative distance ${(state.result.cost/prepared.rows.length).toFixed(3)}. Silhouette: ${state.result.silhouette===null?'not defined for this k':state.result.silhouette.toFixed(3)}.`);
   renderResults();dialog.querySelector('#fc-export').disabled=false;
  }catch(error){status('Clustering failed: '+error.message);}finally{button.disabled=false;}
 }
 function excludedMarkup(data){return `<details><summary>Excluded facades (${data.excluded.length})</summary><ul>${data.excluded.map(r=>`<li>${e(r.name)}: ${e(r.missing.join(', '))}</li>`).join('')}</ul></details>`;}
 function showExcluded(data){state=null;dialog.querySelector('#fc-export').disabled=true;dialog.querySelector('#fc-output').innerHTML=excludedMarkup(data);}
 function lineChart(){
  const {curve,k}=state,max=Math.max(...curve.map(c=>c.cost),.001),X=n=>50+(n-1)*470/Math.max(1,curve.length-1),Y=v=>180-v/max*140;
  return `<svg viewBox="0 0 560 225" role="img" aria-label="Elbow plot of total within-cluster distance"><path d="M50 30V180H530" fill="none" stroke="#bfc9d8"/><text x="50" y="17" class="fc-axis-label">Total distance (lower is tighter)</text><text x="44" y="184" text-anchor="end" class="fc-axis-label">0</text><text x="44" y="44" text-anchor="end" class="fc-axis-label">${max.toFixed(2)}</text><polyline points="${curve.map(c=>`${X(c.k)},${Y(c.cost)}`).join(' ')}" fill="none" stroke="#002fa7" stroke-width="2"/>${curve.map(c=>`<circle cx="${X(c.k)}" cy="${Y(c.cost)}" r="${c.k===k?6:4}" fill="${c.k===k?'#d65529':'#002fa7'}"><title>k=${c.k}; cost=${c.cost.toFixed(3)}; silhouette=${c.silhouette?.toFixed(3)??'n/a'}</title></circle><text x="${X(c.k)}" y="200" text-anchor="middle" class="fc-axis-label">${c.k}</text>`).join('')}<text x="290" y="220" text-anchor="middle" class="fc-axis-label">Number of clusters k</text></svg>`;
 }
 function summaries(){
  const {rows,result,defs}=state;
  return result.medoids.map((m,c)=>{const members=rows.filter((r,i)=>result.labels[i]===c);return {c,m,members,means:defs.map((d,j)=>d.type==='numeric'?members.reduce((s,r)=>s+r.values[j],0)/members.length:null)};});
 }
 function radar(){
  const {rows,defs}=state,axes=[];
  defs.forEach((d,j)=>{if(d.type==='numeric')axes.push({j,label:d.label,value:r=>r.values[j]});else{const cats=[...new Set(rows.flatMap(r=>Array.isArray(r.values[j])?r.values[j]:Object.keys(r.values[j])))].sort();cats.forEach(key=>axes.push({j,label:d.label+' / '+key,value:r=>Array.isArray(r.values[j])?Number(r.values[j].includes(key)):r.values[j][key]||0}));}});
  if(axes.length<3)return '<p class="fc-help">A radar needs at least three axes. The selected attribute values appear in the results plot and summary below.</p>';
  if(axes.length>24)return '<p class="fc-help">More than 24 expanded category axes: use fewer attributes for a readable radar. Cluster summaries remain available below.</p>';
  const pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/axes.length;return [300+Math.cos(a)*145*v,230+Math.sin(a)*145*v];};
  let svg='<svg viewBox="0 0 600 470" role="img" aria-label="Cluster mean radar, normalized from zero to one">';
  for(const scale of [.25,.5,.75,1])svg+=`<polygon points="${axes.map((a,i)=>pt(i,scale).join(',')).join(' ')}" fill="none" stroke="#dce1e9"/><text x="304" y="${230-145*scale}" font-size="9">${scale}</text>`;
  axes.forEach((a,i)=>{const p=pt(i,1),l=pt(i,1.25);const words=a.label.split(/\s+/),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).length>22)lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}svg+=`<path d="M300 230L${p.join(' ')}" stroke="#dce1e9"/><text x="${l[0]}" y="${l[1]}" text-anchor="middle" font-size="9"><title>${e(a.label)}</title>${lines.slice(0,3).map((line,j)=>`<tspan x="${l[0]}" dy="${j?10:0}">${e(line)}</tspan>`).join('')}</text>`;});
  for(const group of summaries())svg+=`<polygon points="${axes.map((a,i)=>pt(i,group.members.reduce((s,r)=>s+a.value(r),0)/group.members.length).join(',')).join(' ')}" fill="${colors[group.c]}18" stroke="${colors[group.c]}" stroke-width="2"><title>Cluster ${group.c+1}: ${group.members.length} facades</title></polygon>`;
  return svg+'</svg><p class="fc-help">Cluster means, 0–1. Categorical axes show label prevalence or area share, not category rankings. Each facade has equal weight in cluster averages.</p>';
 }
 function plot(){
  const {rows,defs,result}=state,plain=defs.every(d=>d.type==='numeric')&&defs.length<=3;
  let points,names,caption;
  if(plain){
   names=defs.map(d=>d.label);points=rows.map(r=>r.values);
   caption=defs.length===1?'1D strip plot; vertical offsets separate overlapping facades.':defs.length===2?'2D scatter of normalized attributes.':'3D view of normalized attributes. Rotate using the sliders.';
  }else{const encoded=C.vectors(rows,defs),projection=C.pca(encoded.points);points=projection.points;names=['PC1','PC2'];caption=`2D PCA projection for visualization only (${(projection.explained*100).toFixed(1)}% of encoded variance). Clustering uses the full mixed-attribute distance, not this projection.`;}
  let coords;
  if(plain&&defs.length===3){const yaw=state.yaw*Math.PI/180,pitch=state.pitch*Math.PI/180;coords=points.map(p=>{const x=p[0]-.5,y=p[1]-.5,z=p[2]-.5;const u=x*Math.cos(yaw)-y*Math.sin(yaw),v=x*Math.sin(yaw)+y*Math.cos(yaw);return [u,v*Math.sin(pitch)+z*Math.cos(pitch)];});}
  else coords=points.map((p,i)=>[p[0],plain&&defs.length===1?((i%7)-3)*.02:p[1]]);
  const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const X=v=>xmax===xmin?300:60+480*(v-xmin)/(xmax-xmin),Y=v=>ymax===ymin?160:270-220*(v-ymin)/(ymax-ymin);
  let svg=`<svg viewBox="0 0 600 330" role="img" aria-label="${e(caption)}"><path d="M50 35V280H555" fill="none" stroke="#bfc9d8"/>`;
  coords.forEach((p,i)=>svg+=`<g tabindex="0" role="button" data-fc-point="${i}" aria-label="${e(rows[i].name)}, cluster ${result.labels[i]+1}"><circle cx="${X(p[0])}" cy="${Y(p[1])}" r="6" fill="${colors[result.labels[i]]}" stroke="white" stroke-width="1.5"/><title>${e(rows[i].name)} · Cluster ${result.labels[i]+1}</title></g>`);
  svg+=`<text x="300" y="315" text-anchor="middle" class="fc-axis-label">${e(plain&&defs.length===3?'Rotated X / Y':names[0])}</text><text x="14" y="160" text-anchor="middle" transform="rotate(-90 14 160)" class="fc-axis-label">${e(plain&&defs.length===3?'Rotated Z':names[1]||'Layout offset')}</text></svg>`;
  if(plain&&defs.length<=2){svg+=`<p class="fc-help">X: ${xmin.toFixed(3)} to ${xmax.toFixed(3)}${defs.length===2?`; Y: ${ymin.toFixed(3)} to ${ymax.toFixed(3)}`:''}.</p>`;}
  if(plain&&defs.length===3)svg+=`<label>Rotation <input id="fc-yaw" type="range" min="-180" max="180" value="${state.yaw}"></label> <label>Tilt <input id="fc-pitch" type="range" min="-80" max="80" value="${state.pitch}"></label><p class="fc-help">X: ${e(names[0])}; Y: ${e(names[1])}; Z: ${e(names[2])}. All 0–1.</p>`;
  return svg+`<p class="fc-help">${e(caption)} Select a point to inspect its facade.</p><div id="fc-point-preview"></div>`;
 }
 function initializationResults(){
  const r=state.result;
  return `<details open id="fc-initializations"><summary>Starting configurations for k = ${state.k}: best start ${r.bestStart} of ${r.trials.length}</summary><p class="fc-help">Lowest total distance wins (ties keep the earliest start). Average distance is total / eligible facades. This is the best result found, not a guarantee of the global optimum. Seed: ${r.seed}. Requested starts: ${r.requestedStarts}; distinct starts tried: ${r.trials.length}.</p><table class="fc-table"><thead><tr><th>Start</th><th>Initial distance</th><th>Final distance ?</th><th>Mean distance ?</th><th>Initial representatives</th></tr></thead><tbody>${r.trials.map(t=>`<tr><td>${t.start}${t.start===r.bestStart?' ? Best':''}${t.warm?' ? From previous k':''}</td><td>${t.initialCost.toFixed(3)}</td><td>${t.cost.toFixed(3)}</td><td>${(t.cost/state.rows.length).toFixed(3)}</td><td>${t.initialMedoids.map(i=>e(state.rows[i].name)).join(', ')}</td></tr>`).join('')}</tbody></table></details>`;
 }
 function clusterPie(){
  const groups=summaries(),total=state.rows.length;
  let angle=-Math.PI/2;
  const point=a=>[160+115*Math.cos(a),140+115*Math.sin(a)];
  let svg='<svg viewBox="0 0 320 280" role="img" aria-label="Cluster shares of eligible facades"><title>Each eligible facade counts once; excluded facades are outside the denominator.</title>';
  for(const group of groups){
   const share=group.members.length/total,next=angle+share*2*Math.PI,start=point(angle),end=point(next);
   const title=`Cluster ${group.c+1}: ${group.members.length} facades (${(share*100).toFixed(1)}%)`;
   if(share===1)svg+=`<circle cx="160" cy="140" r="115" fill="${colors[group.c]}"><title>${e(title)}</title></circle>`;
   else svg+=`<path d="M160 140L${start.join(' ')}A115 115 0 ${share>.5?1:0} 1 ${end.join(' ')}Z" fill="${colors[group.c]}" stroke="white" stroke-width="2"><title>${e(title)}</title></path>`;
   if(share>=.05){const mid=(angle+next)/2;svg+=`<text x="${160+76*Math.cos(mid)}" y="${144+76*Math.sin(mid)}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">${(share*100).toFixed(1)}%</text>`;}
   angle=next;
  }
  svg+='</svg>';
  return svg+`<div class="fc-legend">${groups.map(g=>`<span><i class="fc-swatch" style="background:${colors[g.c]}"></i>Cluster ${g.c+1}: ${g.members.length} (${(100*g.members.length/total).toFixed(1)}%)</span>`).join('')}</div><p class="fc-help">Share of ${total} clustered facades. Each facade counts once, regardless of its area or number of types. ${state.excluded.length} missing-data exclusions are outside this total; current analysis filters apply when enabled.</p>`;
 }
 function renderResults(){
  const groups=summaries();
  dialog.querySelector('#fc-output').className='';
  dialog.querySelector('#fc-output').innerHTML=`<div class="fc-legend">${groups.map(g=>`<span><i class="fc-swatch" style="background:${colors[g.c]}"></i>Cluster ${g.c+1} (${g.members.length})</span>`).join('')}</div><div class="fc-charts"><section class="fc-chart"><h3>Elbow comparison</h3>${lineChart()}<table class="fc-table"><thead><tr><th>k</th><th>Total distance</th><th>Silhouette ↑</th></tr></thead><tbody>${state.curve.map(r=>`<tr><td>${r.k}</td><td>${r.cost.toFixed(3)}</td><td>${r.silhouette?.toFixed(3)??'—'}</td></tr>`).join('')}</tbody></table></section><section class="fc-chart"><h3>Cluster radar</h3>${radar()}</section><section class="fc-chart fc-wide" id="fc-cluster-pie"><h3>Cluster shares</h3>${clusterPie()}</section><section class="fc-chart fc-wide"><h3>Facade distribution</h3><div id="fc-plot">${plot()}</div></section></div><h3>Clusters and representative facades</h3>${groups.map(g=>`<details open><summary><i class="fc-swatch" style="background:${colors[g.c]}"></i>Cluster ${g.c+1} · ${g.members.length} facades · Representative: ${e(state.rows[g.m].name)}</summary><p class="fc-help">${state.defs.map((d,j)=>{let text;if(d.type==='numeric')text=g.means[j].toFixed(3);else{const counts={};g.members.forEach(r=>{const v=r.values[j];(Array.isArray(v)?v:Object.keys(v)).forEach(key=>counts[key]=(counts[key]||0)+(Array.isArray(v)?1:v[key]));});text=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([key,n])=>`${key} ${(100*n/g.members.length).toFixed(0)}%`).join(', ');}return e(d.label)+': '+e(text);}).join(' · ')}</p>${g.members.map(r=>`<button class="fc-member" type="button" data-fc-member="${e(r.id)}">${e(r.name)}</button>`).join('')}</details>`).join('')}${initializationResults()}${excludedMarkup(state)}<p class="fc-help">Numeric summaries use normalized values. Cluster colours and numbers are arbitrary; they may change after attributes or k change. No original tags have been replaced.</p>`;
  wirePlot();dialog.querySelectorAll('[data-fc-member]').forEach(b=>b.onclick=()=>preview(state.rows.find(r=>r.id===b.dataset.fcMember)));
 }
 function wirePlot(){
  dialog.querySelectorAll('[data-fc-point]').forEach(g=>{g.onclick=()=>preview(state.rows[Number(g.dataset.fcPoint)]);g.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();g.onclick();}};});
  for(const key of ['yaw','pitch']){const input=dialog.querySelector('#fc-'+key);if(input)input.oninput=()=>{state[key]=Number(input.value);const focus=key;dialog.querySelector('#fc-plot').innerHTML=plot();wirePlot();dialog.querySelector('#fc-'+focus)?.focus();};}
 }
 function preview(row){
  const host=dialog.querySelector('#fc-point-preview');if(!host||!row)return;
  host.innerHTML=`<strong>${e(row.name)}</strong>${row.photo.src?`<img class="fc-preview" src="${e(row.photo.src)}" alt="${e(row.name)}">`:''}<button id="fc-edit" type="button">Open facade profile</button>`;
  host.querySelector('#fc-edit').onclick=()=>{dialog.close();current=row.id;step=0;typeIndex=0;view='entry';if(typeof topGalleryActive!=='undefined')topGalleryActive=false;render();};
 }
 function exportCSV(){
  if(!state)return;
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[['photo_id','photo_name','cluster','is_representative',...state.defs.map(d=>d.label)],...state.rows.map((r,i)=>[r.id,r.name,state.result.labels[i]+1,state.result.medoids.includes(i),...r.values.map(v=>typeof v==='object'?JSON.stringify(v):v)])].map(row=>row.map(quote).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='facade-clusters.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 attach();new MutationObserver(()=>attach()).observe(document.querySelector('header')||document.body,{childList:true,subtree:true});
})();
