/* Multiple independent attribute comparisons, using the same filtered collection. */
let relationshipGraphGroups=new Map();
function restoreRelationshipGraphs(value){
  if(!Array.isArray(value))return [];
  const seen=new Set();return value.filter(g=>g&&typeof g.id==='string'&&!seen.has(g.id)&&seen.add(g.id)&&typeof g.x==='string'&&typeof g.y==='string').map(g=>({id:g.id,x:g.x,y:g.y,type:['scatter','bar','pie'].includes(g.type)?g.type:'scatter',attribute:typeof g.attribute==='string'?g.attribute:g.x,colorEnabled:!!g.colorEnabled,colorStyle:g.colorStyle==='categories'?'categories':'gradient',colorAxis:g.colorAxis==='y'?'y':'x'}));
}
function graphDefinitions(){return filterDefinitions();}
function graphProfileMatches(photo,type){
  const defs=filterDefinitions(),rules=new Map(),record=records[photo.id]||{};
  for(const rule of analysisFilters.rules){if(!rule.value||!rule.key.startsWith('type.'))continue;if(!rules.has(rule.key))rules.set(rule.key,[]);rules.get(rule.key).push(rule.value);}
  for(const [key,values]of rules){const def=defs.find(d=>d.key===key);if(!def)continue;const actual=attributeFilterValue(photo,record,type,def);if(!values.some(v=>v==='__missing__'?actual==null||actual===''||Array.isArray(actual)&&!actual.length:Array.isArray(actual)?actual.includes(v):String(actual)===v))return false;}
  return true;
}
function graphValues(profile,definition){
  const raw=attributeFilterValue(profile.photo,profile.record,profile.type,definition);
  return (Array.isArray(raw)?raw:[raw]).filter(v=>v!=null&&v!==''&&!['Unknown','Not applicable'].includes(v)).flatMap(v=>{
    if(['type.windows','type.share'].includes(definition.key)){const number={'0':0,'¼':.25,'⅓':1/3,'½':.5,'⅔':2/3,'¾':.75,'1':1}[v];return number===undefined?[]:[{value:number,label:String(v)}];}
    const index=definition.values.indexOf(String(v));return index<0?[]:[{value:index,label:String(v)}];
  });
}
function relationshipGraphSvg(graph,definitions){
  const x=definitions.find(d=>d.key===graph.x),y=definitions.find(d=>d.key===graph.y);
  if(!x||!y)return {html:'<p class="empty">Select an attribute for each axis.</p>',groups:[],description:''};
  const profiles=filteredAnalysisPhotos.flatMap(photo=>(records[photo.id]?.types?.length?records[photo.id].types:[{}]).flatMap((type,index)=>graphProfileMatches(photo,type)?[{photo,type,index,record:records[photo.id]||{}}]:[]));
  const points=[],used=new Set();profiles.forEach(p=>{for(const a of graphValues(p,x))for(const b of graphValues(p,y)){points.push({profile:p,x:a,y:b});used.add(p.photo.id+'|'+p.index);}});
  const buckets=new Map();for(const point of points){const key=point.x.value+'|'+point.y.value;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(point);}const groups=[...buckets.values()];
  const quantitative=d=>['type.windows','type.share'].includes(d.key);
  const ticks=d=>quantitative(d)?[{value:0,label:'0'},{value:.25,label:'¼'},{value:1/3,label:'⅓'},{value:.5,label:'½'},{value:2/3,label:'⅔'},{value:.75,label:'¾'},{value:1,label:'1'}]:d.values.map((label,value)=>({label,value})).filter(t=>!['Unknown','Not applicable'].includes(t.label));
  const scale=(d,v,length)=>quantitative(d)?v*length:(v+.5)/Math.max(1,d.values.length)*length;
  const w=820,h=530,left=190,top=35,pw=585,ph=330;
  let svg=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(x.label)} versus ${esc(y.label)}"><rect x="${left}" y="${top}" width="${pw}" height="${ph}" fill="white" stroke="#00000066"/>`;
  ticks(x).forEach(t=>{const px=left+scale(x,t.value,pw);svg+=`<line x1="${px}" y1="${top}" x2="${px}" y2="${top+ph}" stroke="#00000018"/><text x="${px}" y="${top+ph+18}" transform="rotate(35 ${px} ${top+ph+18})" font-size="10">${esc(t.label)}</text>`;});
  ticks(y).forEach(t=>{const py=top+ph-scale(y,t.value,ph);svg+=`<line x1="${left}" y1="${py}" x2="${left+pw}" y2="${py}" stroke="#00000018"/><text x="${left-9}" y="${py+3}" text-anchor="end" font-size="10">${esc(t.label)}</text>`;});
  svg+=`<text x="${left+pw/2}" y="${h-12}" text-anchor="middle" font-size="12">${esc(x.label)}</text><text transform="translate(14 ${top+ph/2}) rotate(-90)" text-anchor="middle" font-size="12">${esc(y.label)}</text>`;
  groups.forEach((group,index)=>{const px=left+scale(x,group[0].x.value,pw),py=top+ph-scale(y,group[0].y.value,ph),r=Math.min(23,7+Math.sqrt(group.length-1)*3);svg+=`<a href="#" data-comparison-point="${esc(graph.id)}" data-point-index="${index}" aria-label="${esc(group[0].x.label+' / '+group[0].y.label+' · '+group.length+' observations')}"><circle cx="${px}" cy="${py}" r="${r}" fill="${graph.colorEnabled?graphColorFor(graph,group[0][graph.colorAxis==='y'?'y':'x'].label):'#002FA7'}" fill-opacity="${graph.colorEnabled?1:.8}" stroke="white" stroke-width="2"><title>${esc(group[0].x.label+' / '+group[0].y.label+' · '+group.length+' observations')}</title></circle>${group.length>1?`<text x="${px}" y="${py+4}" text-anchor="middle" font-size="11" fill="white">${group.length}</text>`:''}</a>`;});
  return {html:svg+'</svg>'+(points.length?'':'<p class="empty">No matching observations have answers for both attributes.</p>'),groups,description:`${used.size} of ${profiles.length} façade observations plotted · ${profiles.length-used.size} missing or not applicable · ${points.length} points before grouping.`};
}
function renderComparisonGraphs(){
  const host=document.getElementById('relationshipGraphs');if(!host)return;
  relationshipGraphGroups.clear();
  const definitions=graphDefinitions();
  host.innerHTML=(analysisFilters.graphs||[]).map((graph,index)=>{
    const isDistribution=['bar','pie'].includes(graph.type),result=isDistribution?distributionGraphSvg(graph,definitions):relationshipGraphSvg(graph,definitions);relationshipGraphGroups.set(graph.id,result.groups);
    const selector=(axis)=>`<label>${axis.toUpperCase()} axis<select data-comparison-axis="${axis}" data-comparison-id="${esc(graph.id)}">${definitions.map(d=>`<option value="${esc(d.key)}" ${graph[axis]===d.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label>`;
    const chartType=`<label>Chart type<select data-graph-type="${esc(graph.id)}">${[['scatter','X/Y comparison'],['bar','Bar chart'],['pie','Pie chart']].map(([value,label])=>`<option value="${value}" ${(graph.type||'scatter')===value?'selected':''}>${label}</option>`).join('')}</select></label>`;
    const attribute=`<label>Attribute<select data-distribution-attribute="${esc(graph.id)}">${definitions.map(d=>`<option value="${esc(d.key)}" ${(graph.attribute||graph.x)===d.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select></label>`;
    return `<section class="insight-card comparison-graph" data-graph-card="${esc(graph.id)}"><div class="comparison-heading"><h2>${isDistribution?(graph.type==='pie'?'Pie chart':'Bar chart'):'Attribute comparison'} ${index+1}</h2><button data-remove-comparison="${esc(graph.id)}">Remove graph</button></div><div class="comparison-selectors">${chartType}${isDistribution?attribute:selector('x')+selector('y')}</div>${graphColorControls(graph)}${isDistribution?'':'<p class="hint">Each façade type is an observation. Photo-level attributes repeat across its types. Multiple selections can produce multiple points. Bubble numbers show overlapping observations.</p>'}<div class="comparison-svg">${result.html}</div><p class="hint" role="status">${esc(result.description)}</p><div data-comparison-details="${esc(graph.id)}"></div></section>`;
  }).join('');refreshMapColors();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(button?.id==='addRelationshipGraph'){
    if(!analysisFilters.graphs)analysisFilters.graphs=[];
    analysisFilters.graphs.push({id:crypto.randomUUID(),type:'scatter',attribute:'type.kind',x:'type.windows',y:'type.enclosure'});renderComparisonGraphs();persist();
  }
  if(button?.dataset.removeComparison){analysisFilters.graphs=(analysisFilters.graphs||[]).filter(g=>g.id!==button.dataset.removeComparison);renderComparisonGraphs();persist();}
  const point=event.target.closest('[data-comparison-point]');
  if(point){event.preventDefault();const group=relationshipGraphGroups.get(point.dataset.comparisonPoint)?.[+point.dataset.pointIndex]||[],host=[...document.querySelectorAll('[data-comparison-details]')].find(e=>e.dataset.comparisonDetails===point.dataset.comparisonPoint);if(host)host.innerHTML=group.map(p=>`<button data-comparison-photo="${esc(p.profile.photo.id)}" class="comparison-photo-link">${esc(p.profile.photo.name)}${p.profile.index>=0?' · Type '+(p.profile.index+1):''}</button>`).join('');}
  if(button?.dataset.comparisonPhoto)openGalleryPreview(button.dataset.comparisonPhoto);
});
document.addEventListener('change',event=>{
  const element=event.target;
  if(element.dataset.graphType||element.dataset.distributionAttribute){const id=element.dataset.graphType||element.dataset.distributionAttribute,graph=analysisFilters.graphs?.find(g=>g.id===id);if(graph){if(element.dataset.graphType)graph.type=element.value;else graph.attribute=element.value;renderComparisonGraphs();persist();}return;}
  if(!element.dataset.comparisonAxis)return;
  const graph=analysisFilters.graphs?.find(g=>g.id===element.dataset.comparisonId);if(!graph)return;
  graph[element.dataset.comparisonAxis]=element.value;renderComparisonGraphs();persist();
});

function distributionGraphData(graph,definitions){
  const definition=definitions.find(d=>d.key===(graph.attribute||graph.x));
  if(!definition)return {definition:null,buckets:[],observations:0,answered:0,total:0,multi:false};
  const profiles=filteredAnalysisPhotos.flatMap(photo=>{
    const record=records[photo.id]||{};
    return definition.scope==='type'?(record.types?.length?record.types:[{}]).flatMap((type,index)=>graphProfileMatches(photo,type)?[{photo,record,type,index}]:[]):[{photo,record,type:{},index:-1}];
  });
  const buckets=new Map();let answered=0,multi=false;
  for(const profile of profiles){const raw=attributeFilterValue(profile.photo,profile.record,profile.type,definition),values=[...new Set((Array.isArray(raw)?raw:[raw]).filter(v=>v!=null&&v!=='').map(String))];
    if(!values.length)continue;answered++;if(values.length>1)multi=true;
    for(const value of values){if(!buckets.has(value))buckets.set(value,[]);buckets.get(value).push({profile});}
  }
  const ordered=[...definition.values,...buckets.keys()].filter((v,i,array)=>array.indexOf(v)===i&&buckets.has(v));
  return {definition,buckets:ordered.map(label=>({label,items:buckets.get(label)})),observations:profiles.length,answered,total:[...buckets.values()].reduce((n,items)=>n+items.length,0),multi};
}
function distributionGraphSvg(graph,definitions){
  const data=distributionGraphData(graph,definitions),groups=data.buckets.map(b=>b.items);
  if(!data.total)return {html:'<p class="empty">No matching observations have an answer for this attribute.</p>',groups,description:`${data.observations} observations · no answers.`};
  const unit=data.definition.scope==='type'?'façade types':'photos';
  const description=`${data.answered} of ${data.observations} ${unit} answered · ${data.observations-data.answered} missing. ${data.multi?'Multiple selections: counts and pie percentages represent selections, not unique '+unit+'.':'One count per '+(unit==='photos'?'photo':'façade type')+'.'} Explicit Unknown / Not applicable answers are included.`;
  const link=(index,content)=>`<a href="#" data-comparison-point="${esc(graph.id)}" data-point-index="${index}" aria-label="${esc(data.buckets[index].label+' · '+data.buckets[index].items.length)}">${content}</a>`;
  if(graph.type==='bar'){
    const row=38,height=80+row*data.buckets.length,max=Math.max(...data.buckets.map(b=>b.items.length));let svg=`<svg viewBox="0 0 820 ${height}" role="img" aria-label="Bar chart of ${esc(data.definition.label)}">`;
    data.buckets.forEach((b,i)=>{const y=25+i*row,width=480*b.items.length/max;svg+=link(i,`<text x="230" y="${y+18}" text-anchor="end" font-size="12">${esc(b.label)}</text><rect x="245" y="${y}" width="${width}" height="26" fill="${graph.colorEnabled?graphColorFor(graph,b.label):'#002FA7'}"><title>${esc(b.label)}: ${b.items.length}</title></rect><text x="${255+width}" y="${y+18}" font-size="12">${b.items.length}</text>`);});
    svg+=`<line x1="245" y1="15" x2="245" y2="${height-45}" stroke="black"/><text x="485" y="${height-10}" text-anchor="middle" font-size="12">Count of ${unit}${data.multi?' selections':''}</text></svg>`;
    return {html:svg,groups,description};
  }
  let svg='<svg viewBox="0 0 440 340" role="img" aria-label="Pie chart">',angle=-Math.PI/2;
  const colors=['#002FA7','#000000','#002FA7','#000000','#002FA7','#000000'];
  data.buckets.forEach((b,i)=>{const portion=b.items.length/data.total,end=angle+portion*2*Math.PI,color=graph.colorEnabled?graphColorFor(graph,b.label):colors[i%colors.length],opacity=graph.colorEnabled?1:[1,1,.65,.65,.35,.35][i%6],title=`${b.label}: ${b.items.length} (${(portion*100).toFixed(1)}%)`;
    const shape=portion===1?`<circle cx="220" cy="170" r="140" fill="${color}" fill-opacity="${opacity}"><title>${esc(title)}</title></circle>`:`<path d="M 220 170 L ${220+140*Math.cos(angle)} ${170+140*Math.sin(angle)} A 140 140 0 ${portion>.5?1:0} 1 ${220+140*Math.cos(end)} ${170+140*Math.sin(end)} Z" fill="${color}" fill-opacity="${opacity}" stroke="white" stroke-width="2"><title>${esc(title)}</title></path>`;
    svg+=link(i,shape);angle=end;
  });
  const legend=data.buckets.map((b,i)=>`<button class="distribution-legend-item" data-comparison-point="${esc(graph.id)}" data-point-index="${i}"><span style="background:${graph.colorEnabled?graphColorFor(graph,b.label):colors[i%6]};opacity:${graph.colorEnabled?1:[1,1,.65,.65,.35,.35][i%6]}"></span><b>${esc(b.label)}</b><span>${b.items.length} · ${(100*b.items.length/data.total).toFixed(1)}%</span></button>`).join('');
  return {html:`<div class="distribution-pie">${svg}</svg><div class="distribution-legend">${legend}</div></div>`,groups,description};
}
