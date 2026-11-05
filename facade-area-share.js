/* Mean whole-facade area composition, grouped by a facade-level attribute. */
(function(root){
 'use strict';
 const C=typeof module!=='undefined'&&module.exports?require('./facade-clustering-core.js'):root.FacadeClustering;
 function composition(record){
  const parts=C.parts(record);if(!parts)return null;
  const shares={};
  for(const part of parts){const kind=part.type.kind==='Half-loggia'?'Semi-loggia':part.type.kind;if(!kind||['Unknown','Not applicable'].includes(kind))return null;shares[kind]=(shares[kind]||0)+part.weight;}
  const raw=(record.types||[]).map(t=>C.fraction(t.share)),total=raw.reduce((s,v)=>s+(v||0),0);
  return {shares,rescaled:(record.types||[]).length>1&&Math.abs(total-1)>.01};
 }
 function summarize(items,groupFor){
  const buckets=new Map(),categories=new Set();let excluded=0,rescaled=0;
  for(const item of items){
   const raw=groupFor(item),label=Array.isArray(raw)?[...new Set(raw)].sort().join(' + '):raw;
   const key=label==null||label===''?'Unanswered':String(label);
   if(!buckets.has(key))buckets.set(key,{label:key,items:[],excluded:0});
   const profile=composition(item.record);
   if(!profile){excluded++;buckets.get(key).excluded++;continue;}
   Object.keys(profile.shares).forEach(v=>categories.add(v));if(profile.rescaled)rescaled++;
   buckets.get(key).items.push({...item,shares:profile.shares});
  }
  return {buckets:[...buckets.values()],categories:[...categories],excluded,rescaled};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={composition,summarize};return;}
 root.FacadeAreaShare={composition,summarize};
 const order=['Punched-window façade','French balcony','Bay window','Loggia','Semi-loggia','Balcony'];
 const colors=['#4163a4','#df651f','#168665','#9a4ea5','#a18112','#c43867','#597b23','#337f92'];
 const originalRestore=restoreRelationshipGraphs;
 restoreRelationshipGraphs=function(value){const result=originalRestore(value);for(const g of result){const source=value.find(s=>s.id===g.id);if(source?.type==='areaShare'){g.type='areaShare';g.x=source.x||'context.orientation';g.y='type.kind';g.colorEnabled=false;}}return result;};
 for(const graph of analysisFilters.graphs||[]){const source=embedded.analysisFilters?.graphs?.find(g=>g.id===graph.id);if(source?.type==='areaShare'){graph.type='areaShare';graph.x=source.x||'context.orientation';graph.y='type.kind';graph.colorEnabled=false;}}
 function renderArea(graph,definitions){
  const grouping=definitions.find(d=>d.key===(graph.x||'context.orientation'));
  if(!grouping||grouping.scope==='type')return {html:'<p>Choose a whole-facade attribute to group area shares.</p>',groups:[],description:''};
  const data=summarize(filteredAnalysisPhotos.map(photo=>({photo,record:records[photo.id]||{}})),item=>attributeFilterValue(item.photo,item.record,{},grouping));
  const rank=label=>order.includes(label)?order.indexOf(label):order.length+data.categories.indexOf(label);
  data.categories.sort((a,b)=>rank(a)-rank(b));
  const declared=grouping.key==='context.orientation'?['North','East','South','West']:grouping.values||[];
  for(const label of declared)if(!['Unknown','Not applicable'].includes(label)&&!data.buckets.some(b=>b.label===label)&&grouping.key==='context.orientation')data.buckets.push({label,items:[],excluded:0});
  const labels=[...new Set([...declared,...data.buckets.map(b=>b.label)])];data.buckets.sort((a,b)=>labels.indexOf(a.label)-labels.indexOf(b.label));
  const groups=[],width=Math.max(680,data.buckets.length*120+100),height=390,left=60,right=width-30,top=35,bottom=285,step=(right-left)/Math.max(1,data.buckets.length),Y=v=>bottom-v/100*(bottom-top);
  let svg=`<svg class="facade-area-share-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mean facade type area share by ${esc(grouping.label)}"><title>Average of whole-facade section shares, not counts of facades containing a type. Each facade has equal weight.</title>`;
  for(const percent of [0,25,50,75,100])svg+=`<path d="M${left} ${Y(percent)}H${right}" stroke="#dce1e9"/><text x="${left-8}" y="${Y(percent)+4}" text-anchor="end" font-size="11">${percent}%</text>`;
  const averages=new Map();
  data.buckets.forEach((bucket,i)=>{
   const x=left+step*(i+.5),bar=step*.6,means=data.categories.map(kind=>bucket.items.length?bucket.items.reduce((s,item)=>s+(item.shares[kind]||0),0)/bucket.items.length:0);averages.set(bucket.label,means);
   let sum=0;
   means.forEach((mean,j)=>{
    const kind=data.categories[j],items=bucket.items.filter(item=>(item.shares[kind]||0)>0).map(item=>({profile:{photo:item.photo,record:item.record,type:{},index:-1},share:item.shares[kind]}));
    const index=groups.push(items)-1,base=sum;sum+=mean*100;
    if(mean>0)svg+=`<g data-area-group="${esc(bucket.label)}" data-area-kind="${esc(kind)}" data-area-share="${mean}" data-comparison-point="${esc(graph.id)}" data-point-index="${index}" tabindex="0" role="button"><title>${esc(bucket.label)} / ${esc(kind)}: ${(mean*100).toFixed(1)}% of facade area on average; ${bucket.items.length} valid facades</title><rect x="${x-bar/2}" y="${Y(sum)}" width="${bar}" height="${Y(base)-Y(sum)}" fill="${colors[j%colors.length]}" stroke="white"/>${mean>=.07?`<text x="${x}" y="${(Y(sum)+Y(base))/2+4}" text-anchor="middle" font-size="11" fill="white">${(mean*100).toFixed(1)}%</text>`:''}</g>`;
   });
   svg+=`<text x="${x}" y="310" text-anchor="middle" font-size="12">${esc(bucket.label)}</text><text x="${x}" y="330" text-anchor="middle" font-size="10">n=${bucket.items.length}</text>${!bucket.items.length?`<text x="${x}" y="260" text-anchor="middle" font-size="10">No valid shares</text>`:''}`;
  });
  svg+=`<text x="${width/2}" y="372" text-anchor="middle" font-size="12">${esc(grouping.label)}</text></svg>`;
  const legend=`<div class="graph-category-legend">${data.categories.map((kind,j)=>`<span><i style="background:${colors[j%colors.length]}"></i>${esc(kind)}</span>`).join('')}</div>`;
  const table=`<table class="average-stats-table facade-area-share-table"><thead><tr><th>${esc(grouping.label)}</th><th>Valid facades</th>${data.categories.map(kind=>`<th>${esc(kind)}</th>`).join('')}<th>Missing shares/types</th></tr></thead><tbody>${data.buckets.map(bucket=>`<tr><td>${esc(bucket.label)}</td><td>${bucket.items.length}</td>${averages.get(bucket.label).map(mean=>`<td>${bucket.items.length?(mean*100).toFixed(1)+'%':'—'}</td>`).join('')}<td>${bucket.excluded}</td></tr>`).join('')}</tbody></table>`;
  return {html:legend+svg+table,groups,description:`Mean area share per facade: each valid facade contributes one full area split between its section types. This is not the percentage of facades containing each type and is not weighted by total square metres. ${data.excluded} facades excluded for missing shares or section types; ${data.rescaled} share totals rescaled to 100%. A single known type can omit its share (100%). Existing type filters select the facade cohort; all sections of each selected facade are included. Select a segment to inspect facades contributing that type.`};
 }
 const originalSvg=relationshipGraphSvg;
 relationshipGraphSvg=function(graph,definitions){return graph.type==='areaShare'?renderArea(graph,definitions):originalSvg(graph,definitions);};
 const originalRender=renderComparisonGraphs;
 renderComparisonGraphs=function(){
  originalRender();const definitions=graphDefinitions();
  for(const graph of analysisFilters.graphs||[]){
   const card=[...document.querySelectorAll('[data-graph-card]')].find(el=>el.dataset.graphCard===graph.id);if(!card)continue;
   const type=card.querySelector('[data-graph-type]');
   if(type&&!type.querySelector('option[value="areaShare"]')){const option=document.createElement('option');option.value='areaShare';option.textContent='Facade type area shares';type.appendChild(option);}
   if(graph.type!=='areaShare')continue;
   type.value='areaShare';card.querySelector('h2').textContent='Facade type area shares';
   const selectors=card.querySelector('.comparison-selectors');for(const label of [...selectors.children])if(!label.contains(type))label.remove();
   selectors.insertAdjacentHTML('beforeend',`<label>Group by<select data-comparison-axis="x" data-comparison-id="${esc(graph.id)}">${definitions.filter(d=>d.scope!=='type').map(d=>`<option value="${esc(d.key)}" ${(graph.x||'context.orientation')===d.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label>`);
   card.querySelector('.graph-color-controls')?.remove();
   const svg=card.querySelector('.comparison-svg');let previous=svg.previousElementSibling;if(previous?.classList.contains('hint'))previous.remove();
  }
 };
 document.addEventListener('change',event=>{
  if(event.target.dataset.graphType&&event.target.value==='areaShare'){
   const graph=analysisFilters.graphs.find(g=>g.id===event.target.dataset.graphType);if(graph){graph.type='areaShare';graph.x='context.orientation';graph.y='type.kind';graph.colorEnabled=false;renderComparisonGraphs();persist();}
  }
 });
})(typeof window!=='undefined'?window:globalThis);
