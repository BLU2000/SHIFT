/* Dependency-free SVG analysis. One observation represents one facade type. */
let analysisSettings={radarDims:['windows','relief','enclosure','surroundingGreen'],radarA:'',radarB:'',x:'windows',y:'enclosure'};
const analysisDimensions=[
  {key:'windows',label:'Window-to-wall ratio',scope:'type',quantitative:true,radar:true},
  {key:'share',label:'Share of entire façade',scope:'type',quantitative:true,radar:true},
  {key:'relief',label:'Relief',scope:'type',values:['Flat','Moderately articulated','Strongly articulated'],radar:true},
  {key:'enclosure',label:'Threshold enclosure',scope:'type',values:['Low','Medium','High'],radar:true,threshold:true},
  {key:'depth',label:'Threshold depth',scope:'type',values:['Under 1 m','1 m or more'],radar:true,threshold:true},
  {key:'surroundingGreen',label:'Surrounding greenery',scope:'context',values:['None','Low','Medium','High'],radar:true},
  {key:'streetRatio',label:'Street width / building height',scope:'context',values:['Narrow','Balanced','Wide'],radar:true},
  {key:'thermal',label:'Thermal envelope',scope:'type',values:['Uninsulated','Insulated'],radar:true},
  {key:'kind',label:'Façade type',scope:'type',values:['Punched-window façade','Loggia','Semi-loggia','Balcony','Bay window','French balcony','Other']},
  {key:'material',label:'Structural material',scope:'type',values:['Masonry','Concrete','Steel','Timber','Other']},
  {key:'reveal',label:'Window reveal depth',scope:'type',values:['Flush','Medium','Deep']},
  {key:'setting',label:'Setting',scope:'context',values:['Street','Courtyard','Other']},
  {key:'orientation',label:'Orientation',scope:'context',values:['North','East','South','West']}
];
function restoreAnalysisSettings(value){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value.radarDims))analysisSettings.radarDims=[...new Set(value.radarDims.filter(k=>analysisDimensions.some(d=>d.key===k&&d.radar)))];
  for(const key of ['radarA','radarB'])if(typeof value[key]==='string')analysisSettings[key]=value[key];
  for(const key of ['x','y'])if(analysisDimensions.some(d=>d.key===value[key]))analysisSettings[key]=value[key];
}
function analysisProfiles(){return photos.flatMap(p=>(records[p.id]?.types||[]).flatMap((type,index)=>type.kind?[{key:p.id+'|'+index,photo:p,type,index,record:records[p.id],label:p.name+' · Type '+(index+1)+' · '+type.kind}]:[]));}
function analysisValue(profile,dimension,normalized=false){
  if(dimension.threshold&&thresholdValue(profile.type)!=='Yes')return null;
  const raw=(dimension.scope==='context'?profile.record.context:profile.type)[dimension.key];
  if(dimension.quantitative){const value={'0':0,'¼':.25,'⅓':1/3,'½':.5,'1':1}[raw];return value===undefined?null:{value,raw};}
  const index=dimension.values.indexOf(raw);if(index<0)return null;
  return {value:normalized?index/(dimension.values.length-1):index,raw};
}
function mountAnalysisCharts(){
  const profiles=analysisProfiles();
  const options=selected=>profiles.map(p=>`<option value="${esc(p.key)}" ${p.key===selected?'selected':''}>${esc(p.label)}</option>`).join('');
  if(!profiles.some(p=>p.key===analysisSettings.radarA))analysisSettings.radarA=profiles[0]?.key||'';
  if(!profiles.some(p=>p.key===analysisSettings.radarB))analysisSettings.radarB=(profiles[1]||profiles[0])?.key||'';
  const radarCard=document.getElementById('radar').closest('section');
  radarCard.classList.add('analysis-wide');
  radarCard.innerHTML=`<h2>Radar comparison</h2><p class="hint">Choose at least three dimensions and two façade types. Photo-level dimensions apply to every type in that photo. Ordered categories are spaced evenly from 0 to 1; higher values are not necessarily better. Unknown and not-applicable values remain missing.</p><fieldset class="radar-dimensions"><legend>Dimensions</legend>${analysisDimensions.filter(d=>d.radar).map(d=>`<label><input type="checkbox" data-radar-dimension="${d.key}" ${analysisSettings.radarDims.includes(d.key)?'checked':''}>${esc(d.label)}${d.scope==='context'?' (photo)':''}</label>`).join('')}</fieldset><div class="chart-selectors"><label>Profile A<select id="compareA">${options(analysisSettings.radarA)}</select></label><label>Profile B<select id="compareB">${options(analysisSettings.radarB)}</select></label></div><div id="radar"></div><div id="radarDetails" class="hint"></div>`;
  const pair=document.createElement('section');pair.className='insight-card analysis-wide';pair.id='relationshipCard';
  pair.innerHTML=`<h2>Attribute relationship</h2><p class="hint">One observation per described façade type. Photo-level attributes repeat for each of its types. Unknown, missing, and not-applicable answers are excluded. Larger bubbles contain multiple observations; select one to explore its profiles.</p><div class="chart-selectors"><label>X axis<select id="relationshipX"></select></label><label>Y axis<select id="relationshipY"></select></label></div><div id="relationshipPlot"></div><p id="relationshipCount" class="hint"></p><div id="relationshipSelection"></div>`;
  radarCard.after(pair);
  for(const [id,key]of [['relationshipX','x'],['relationshipY','y']])document.getElementById(id).innerHTML=analysisDimensions.map(d=>`<option value="${d.key}" ${analysisSettings[key]===d.key?'selected':''}>${esc(d.label)}${d.scope==='context'?' (photo)':''}</option>`).join('');
  renderCustomRadar();renderRelationship();
}
function renderCustomRadar(){
  const target=document.getElementById('radar'),details=document.getElementById('radarDetails');
  if(!target||!details)return;
  const dims=analysisSettings.radarDims.map(k=>analysisDimensions.find(d=>d.key===k)).filter(Boolean);
  if(dims.length<3){target.innerHTML='<p class="empty">Select at least three dimensions to draw a radar diagram.</p>';details.textContent='';return;}
  const profiles=analysisProfiles(),selected=[analysisSettings.radarA,analysisSettings.radarB].map(key=>profiles.find(p=>p.key===key));
  if(!selected.some(Boolean)){target.innerHTML='<p class="empty">Describe a façade type to start comparing profiles.</p>';details.textContent='';return;}
  const pos=(i,value)=>[300+Math.sin(i*2*Math.PI/dims.length)*value*120,200-Math.cos(i*2*Math.PI/dims.length)*value*120];
  let svg='<svg viewBox="0 0 600 420" role="img" aria-label="Radar diagram with selected dimensions">';
  for(const fraction of [.25,.5,.75,1])svg+=`<polygon points="${dims.map((_,i)=>pos(i,fraction).join(',')).join(' ')}" fill="none" stroke="#00000026"/><text x="304" y="${200-fraction*120-3}" font-size="9" fill="#00000099">${fraction}</text>`;
  dims.forEach((d,i)=>{const [x,y]=pos(i,1),[tx,ty]=pos(i,1.38);svg+=`<line x1="300" y1="200" x2="${x}" y2="${y}" stroke="#00000020"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="10">${esc(d.label)}</text>`;});
  const notes=[];
  selected.forEach((p,j)=>{if(!p)return;const color=j?'#000000':'#002FA7',values=dims.map(d=>analysisValue(p,d,true)),missing=dims.filter((d,i)=>!values[i]).map(d=>d.label);
    if(!missing.length)svg+=`<polygon points="${values.map((v,i)=>pos(i,v.value).join(',')).join(' ')}" fill="${color}" fill-opacity=".08" stroke="${color}" stroke-width="2" ${j?'stroke-dasharray="5 3"':''}/>`;
    else values.forEach((v,i)=>{const next=(i+1)%dims.length;if(v&&values[next]){const [x1,y1]=pos(i,v.value),[x2,y2]=pos(next,values[next].value);svg+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;}});
    values.forEach((v,i)=>{if(!v)return;const [x,y]=pos(i,v.value);svg+=`<circle cx="${x}" cy="${y}" r="4" fill="${color}"><title>${esc(p.label+' · '+dims[i].label+': '+v.raw)}</title></circle>`;});
    notes.push(`<p style="color:${color}"><b>${j?'B':'A'} · ${esc(p.label)}</b>${missing.length?'<br>Missing: '+esc(missing.join(', ')):''}</p>`);
  });
  target.innerHTML=svg+'</svg>';details.innerHTML=notes.join('');
}
let relationshipGroups=[];
function renderRelationship(){
  const x=analysisDimensions.find(d=>d.key===analysisSettings.x),y=analysisDimensions.find(d=>d.key===analysisSettings.y);
  const profiles=analysisProfiles(),valid=profiles.flatMap(p=>{const xv=analysisValue(p,x),yv=analysisValue(p,y);return xv&&yv?[{profile:p,x:xv,y:yv}]:[];});
  const groups=new Map();valid.forEach(p=>{const key=p.x.value+'|'+p.y.value;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);});relationshipGroups=[...groups.values()];
  const width=760,height=500,left=150,right=35,top=35,bottom=150,plotW=width-left-right,plotH=height-top-bottom;
  const ticks=d=>d.quantitative?[0,.25,.5,.75,1].map(v=>({value:v,label:String(v)})):d.values.map((label,value)=>({value,label}));
  const scale=(d,v,length)=>d.quantitative?v*length:(v+.5)/d.values.length*length;
  let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(x.label)} versus ${esc(y.label)}"><rect x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="white" stroke="#00000055"/>`;
  ticks(x).forEach(t=>{const px=left+scale(x,t.value,plotW);svg+=`<line x1="${px}" y1="${top}" x2="${px}" y2="${top+plotH}" stroke="#00000015"/><text x="${px}" y="${top+plotH+18}" transform="rotate(30 ${px} ${top+plotH+18})" text-anchor="start" font-size="11">${esc(t.label)}</text>`;});
  ticks(y).forEach(t=>{const py=top+plotH-scale(y,t.value,plotH);svg+=`<line x1="${left}" y1="${py}" x2="${left+plotW}" y2="${py}" stroke="#00000015"/><text x="${left-10}" y="${py+4}" text-anchor="end" font-size="11">${esc(t.label)}</text>`;});
  svg+=`<text x="${left+plotW/2}" y="${height-15}" text-anchor="middle" font-size="13">${esc(x.label)}</text><text transform="translate(18 ${top+plotH/2}) rotate(-90)" text-anchor="middle" font-size="13">${esc(y.label)}</text>`;
  relationshipGroups.forEach((g,i)=>{const px=left+scale(x,g[0].x.value,plotW),py=top+plotH-scale(y,g[0].y.value,plotH),radius=Math.min(24,7+Math.sqrt(g.length-1)*3);svg+=`<a href="#" data-relationship-group="${i}" aria-label="${esc(g.length+' profiles: '+g[0].x.raw+' / '+g[0].y.raw)}"><circle cx="${px}" cy="${py}" r="${radius}" fill="#002FA7" fill-opacity=".8" stroke="white" stroke-width="2"><title>${esc(g[0].x.raw+' / '+g[0].y.raw+' · '+g.length+' observation(s)')}</title></circle>${g.length>1?`<text x="${px}" y="${py+4}" text-anchor="middle" font-size="11" fill="white">${g.length}</text>`:''}</a>`;});
  document.getElementById('relationshipPlot').innerHTML=svg+'</svg>';
  document.getElementById('relationshipCount').textContent=`${valid.length} of ${profiles.length} façade types plotted · ${profiles.length-valid.length} excluded for missing or inapplicable answers.`;
  document.getElementById('relationshipSelection').innerHTML=valid.length?'':'<p class="empty">No observations have answers for both selected attributes yet.</p>';
}
document.addEventListener('change',event=>{
  const element=event.target;
  if(element.dataset.radarDimension){analysisSettings.radarDims=[...document.querySelectorAll('[data-radar-dimension]:checked')].map(e=>e.dataset.radarDimension);renderCustomRadar();persist();}
  if(['compareA','compareB'].includes(element.id)){analysisSettings[element.id==='compareA'?'radarA':'radarB']=element.value;renderCustomRadar();persist();}
  if(['relationshipX','relationshipY'].includes(element.id)){analysisSettings[element.id==='relationshipX'?'x':'y']=element.value;renderRelationship();persist();}
});
document.addEventListener('click',event=>{
  const group=event.target.closest('[data-relationship-group]');
  if(group){event.preventDefault();const values=relationshipGroups[+group.dataset.relationshipGroup]||[];document.getElementById('relationshipSelection').innerHTML=values.map(v=>`<button class="chart-profile-link" data-analysis-profile="${esc(v.profile.key)}">${esc(v.profile.label)}</button>`).join('');}
  const link=event.target.closest('[data-analysis-profile]');
  if(link){const profile=analysisProfiles().find(p=>p.key===link.dataset.analysisProfile);if(profile){current=profile.photo.id;typeIndex=profile.index;step=3;view='entry';render();}}
});
