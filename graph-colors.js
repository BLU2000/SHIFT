/* Attribute color mapping shared by graphs and photo-location markers. */
const graphCategoryPalette=['#002FA7','#D65A21','#21835B','#943E99','#B38A00','#007F99','#A43348','#6049BE','#607A22','#83532D','#2469C6','#C34389'];
function graphCategoryColor(index){
  if(index<graphCategoryPalette.length)return graphCategoryPalette[index];
  const hue=(index*137.508)%360,saturation=.65,lightness=.4;
  const channel=n=>{const k=(n+hue/30)%12;return lightness-saturation*Math.min(lightness,1-lightness)*Math.max(-1,Math.min(k-3,9-k,1));};
  return '#'+[0,8,4].map(n=>Math.round(channel(n)*255).toString(16).padStart(2,'0')).join('');
}
function graphColorDefinition(graph){return graphDefinitions().find(d=>d.key===(['pie','bar'].includes(graph.type)?graph.attribute||graph.x:graph[graph.colorAxis==='y'?'y':'x']));}
function graphColorDomain(definition){return definition?definition.values.filter(v=>!['Unknown','Not applicable'].includes(v)):[];}
function graphColorFor(graph,value){
  if(value==null||value===''||['Unknown','Not applicable'].includes(value))return '#777777';
  const definition=graphColorDefinition(graph),domain=graphColorDomain(definition),index=domain.indexOf(String(value));
  if(index<0)return '#777777';
  if(graph.colorStyle==='categories')return graphCategoryColor(index);
  const ratio=['type.windows','type.share'].includes(definition.key)?({'0':0,'¼':.25,'⅓':1/3,'½':.5,'⅔':2/3,'¾':.75,'1':1}[value]):index/Math.max(1,domain.length-1);
  if(ratio===undefined)return '#777777';
  const start=[220,234,255],end=[0,47,167];return '#'+start.map((v,i)=>Math.round(v+(end[i]-v)*ratio).toString(16).padStart(2,'0')).join('');
}
function graphColorControls(graph){
  return `<div class="graph-color-controls"><label><input type="checkbox" data-enable-graph-color="${esc(graph.id)}" ${graph.colorEnabled?'checked':''}>Color graph + map</label><label>Palette<select data-graph-color-style="${esc(graph.id)}"><option value="gradient" ${graph.colorStyle!=='categories'?'selected':''}>Gradient</option><option value="categories" ${graph.colorStyle==='categories'?'selected':''}>Category colors</option></select></label>${!['pie','bar'].includes(graph.type)?`<label>Color by<select data-graph-color-axis="${esc(graph.id)}"><option value="x" ${graph.colorAxis!=='y'?'selected':''}>X attribute</option><option value="y" ${graph.colorAxis==='y'?'selected':''}>Y attribute</option></select></label>`:''}</div>${graph.colorEnabled?graphColorLegend(graph):''}`;
}
function graphColorLegend(graph){
  const definition=graphColorDefinition(graph),domain=graphColorDomain(definition);if(!definition)return '';
  const title=`<strong>${esc(definition.label)}</strong> · colors linked to map`;
  const colors=graph.colorStyle==='categories'?`<div class="graph-category-legend">${domain.map(v=>`<span><i style="background:${graphColorFor(graph,v)}"></i>${esc(v)}</span>`).join('')}</div>`:`<div class="graph-gradient-bar" style="background:linear-gradient(to right,${domain.map(v=>graphColorFor(graph,v)).join(',')||'#777777,#777777'})"></div><div class="graph-gradient-labels"><span>${esc(domain[0]||'No values')}</span><span>${esc(domain[domain.length-1]||'')}</span></div>`;
  return `<div class="graph-color-legend">${title}${colors}<small><i style="background:#777777"></i>Missing / unknown · Split markers indicate multiple values at a location.</small></div>`;
}
function mapPhotoColorValues(photo,graph){
  const definition=graphColorDefinition(graph),record=records[photo.id]||{};if(!definition)return [];
  const types=definition.scope==='type'?(record.types||[]).filter(type=>graphProfileMatches(photo,type)):[{}];
  return [...new Set(types.flatMap(type=>{const raw=attributeFilterValue(photo,record,type,definition);return (Array.isArray(raw)?raw:[raw]).map(v=>v==null?'Unknown':String(v));}))];
}
function refreshMapColors(){
  const graph=analysisFilters.graphs?.find(g=>g.colorEnabled),host=document.getElementById('mapPlot');
  document.getElementById('mapColorLegend')?.remove();
  if(graph&&host){const legend=document.createElement('div');legend.id='mapColorLegend';legend.innerHTML=graphColorLegend(graph);const map=document.getElementById('geographicMap');map?map.before(legend):host.prepend(legend);}
  for(const element of document.querySelectorAll('.overview-marker[data-color-photo-ids]')){
    if(!graph){element.style.background='#002FA7';element.style.color='white';delete element.dataset.mappedColors;continue;}
    const ids=JSON.parse(element.dataset.colorPhotoIds),values=[...new Set(ids.flatMap(id=>{const photo=photos.find(p=>p.id===id);return photo?mapPhotoColorValues(photo,graph):[];}))],colors=[...new Set((values.length?values:['Unknown']).map(v=>graphColorFor(graph,v)))];
    element.style.background=colors.length===1?colors[0]:`conic-gradient(${colors.map((color,i)=>`${color} ${100*i/colors.length}% ${100*(i+1)/colors.length}%`).join(',')})`;
    element.style.color=colors.some(color=>{const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>165;})?'black':'white';
    element.dataset.mappedColors=colors.join(',');
  }
}
document.addEventListener('change',event=>{
  const el=event.target,id=el.dataset.enableGraphColor||el.dataset.graphColorStyle||el.dataset.graphColorAxis;if(!id)return;
  const graph=analysisFilters.graphs?.find(g=>g.id===id);if(!graph)return;
  if(el.dataset.enableGraphColor){if(el.checked)analysisFilters.graphs.forEach(g=>g.colorEnabled=false);graph.colorEnabled=el.checked;}
  if(el.dataset.graphColorStyle)graph.colorStyle=el.value;
  if(el.dataset.graphColorAxis)graph.colorAxis=el.value;
  renderComparisonGraphs();refreshMapColors();persist();
});
