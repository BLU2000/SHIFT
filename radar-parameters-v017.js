// Nominal attributes use category-match axes, never arbitrary numeric category rankings.
let pendingRadarParameters=null;
function ensureRadarParameters(){
 const represented=new Set(['type.windows','record.wwrBand','type.share','type.relief','type.enclosure','type.depth','context.surroundingGreen','context.streetRatio','type.thermal','type.reveal','context.storeys','context.facadeDepth']);
 if(!analysisDimensions.some(d=>d.key==='facadeDepth'))analysisDimensions.push({key:'facadeDepth',label:'Facade depth',scope:'context',radar:true,radarFacadeDepth:true});
 const reveal=analysisDimensions.find(d=>d.key==='reveal');if(reveal)reveal.radar=true;
 if(!analysisDimensions.some(d=>d.key==='storeys'))analysisDimensions.push({key:'storeys',label:'Storeys',scope:'context',radar:true,radarStoreys:true});
 for(const def of filterDefinitions()){
  if(represented.has(def.key))continue;
  for(const value of def.values.filter(v=>!['Unknown','Not applicable'].includes(v))){
   const key='category|'+def.key+'|'+encodeURIComponent(value),categoryLabel=def.field==='buildingType'?priorityGroupName(value):def.field==='wholeFacade'?priorityCategory(value):value;
   let dimension=analysisDimensions.find(d=>d.key===key);
   if(!dimension){dimension={key,scope:def.scope,radar:true,radarCategory:{definition:def,value}};analysisDimensions.push(dimension);}
   dimension.radarCategory.definition=def;dimension.label=def.label+' / '+categoryLabel;const short={kind:'Type',wholeFacade:'Facade',material:'Material',orientation:'Facing',setting:'Setting',ground:'Ground',groundUse:'Ground use',shade:'Shade',green:'Greenery',homogeneity:'Composition',buildingType:'Category',location:'Location',status:'Status'}[def.field]||def.label;dimension.radarLabel=short+' / '+categoryLabel;
  }
 }
}
const allParametersValidDims=priorityValidRadarDims;
priorityValidRadarDims=function(value){ensureRadarParameters();return allParametersValidDims(value);};
const allParametersRestore=restoreAnalysisSettings;
restoreAnalysisSettings=function(value){if(Array.isArray(value?.priorityRadarDims))pendingRadarParameters=[...value.priorityRadarDims];allParametersRestore(value);const scale=Number(value?.radarStoreysMax);if(Number.isInteger(scale)&&scale>=1&&scale<=200)analysisSettings.radarStoreysMax=scale;};
const allParametersRender=render;
render=function(){ensureRadarParameters();if(pendingRadarParameters){analysisSettings.priorityRadarDims=priorityValidRadarDims(pendingRadarParameters);pendingRadarParameters=null;analysisSettings.facadeDepthAttributeVersion=null;}syncFacadeDepthAttributes();allParametersRender();};
ensureRadarParameters();restoreAnalysisSettings(embedded.analysisSettings);
const allParametersAnalysisValue=analysisValue;
analysisValue=function(profile,dimension,normalized=false){
 if(dimension.radarFacadeDepth){const raw=profile.record.context?.wholeFacade,positions={'Loggia':0,'Semi-loggia':0,'Flush':.5,'Punched-window façade':.5,'Bay window':1,'French balcony':1,'Balcony':1};if(!Object.hasOwn(positions,raw))return null;return {value:positions[raw],raw};}
 if(dimension.radarCategory){const {definition,value}=dimension.radarCategory,raw=attributeFilterValue(profile.photo||{},profile.record,profile.type,definition);if(raw==null||raw===''||raw==='Unknown'||raw==='Not applicable'||Array.isArray(raw)&&(!raw.length||raw.every(v=>['Unknown','Not applicable'].includes(v))))return null;return {value:(Array.isArray(raw)?raw.includes(value):String(raw)===String(value))?1:0,raw};}
 if(dimension.radarStoreys){const raw=profile.record.context?.storeys,n=Number(raw),max=analysisSettings.radarStoreysMax||20;if(raw==null||raw===''||!Number.isFinite(n)||n<1)return null;return {value:normalized?Math.min(1,n/max):n,raw:raw+' storeys'};}
 return allParametersAnalysisValue(profile,dimension,normalized);
};
function radarParameterCheckbox(d,selected){return `<label><input type="checkbox" data-priority-radar="${esc(d.key)}" ${selected.includes(d.key)?'checked':''} ${selected.length===3&&selected.includes(d.key)?'disabled':''}>${esc(d.radarCategory?d.label.split(' / ').slice(1).join(' / '):d.label)}</label>`;}
priorityRadarMenu=function(){
 ensureRadarParameters();const selected=priorityRadarDimensions().map(d=>d.key),groups=new Map();
 for(const d of analysisDimensions.filter(d=>d.radarCategory)){const def=d.radarCategory.definition;if(!groups.has(def.key))groups.set(def.key,{label:def.label,dimensions:[]});groups.get(def.key).dimensions.push(d);}
 return `<details id="priorityRadarSettings" class="priority-radar-settings"><summary>Radar settings <span>${selected.length} axes · all façades</span></summary><p class="hint">Choose at least three axes. All axes are normalized from 0 at the centre to 1 at the outer ring. For categorical parameters, choose the category to show: a match = 1, a different answered category = 0. Type-level axes show the mean across answered types; missing answers stay missing.</p><fieldset><legend>Measures</legend>${analysisDimensions.filter(d=>d.radar&&!d.radarCategory).map(d=>radarParameterCheckbox(d,selected)).join('')}</fieldset><label class="radar-scale">Storeys at full scale <input id="radarStoreysMax" type="number" min="1" max="200" step="1" value="${analysisSettings.radarStoreysMax||20}"></label><p class="hint">Facade depth: loggia / semi-loggia = 0, flush / punched facade = 0.5, bay window / French balcony / balcony = 1. Mixed, Other and Unknown remain unanswered. Storeys use this maximum; larger values are capped at the outer ring.</p><div class="radar-parameter-groups">${[...groups].map(([key,group])=>`<details data-radar-group="${esc(key)}"><summary>${esc(group.label)} <span>${group.dimensions.filter(d=>selected.includes(d.key)).length} selected</span></summary><fieldset><legend>${esc(group.label)} categories</legend>${group.dimensions.map(d=>radarParameterCheckbox(d,selected)).join('')}</fieldset></details>`).join('')}</div><button type="button" id="priorityRadarReset">Reset to defaults</button></details>`;
};
priorityRadar=function(record){
 const photo=photos.find(p=>records[p.id]===record),dims=priorityRadarDimensions(),values=dims.map(d=>{const profiles=d.scope==='type'?(record.types||[]).map(type=>({type,record,photo})):[{type:{},record,photo}],answers=profiles.map(p=>analysisValue(p,d,true)).filter(v=>v&&Number.isFinite(v.value));return answers.length?answers.reduce((sum,v)=>sum+v.value,0)/answers.length:null;});
 const point=(i,value)=>{const angle=-Math.PI/2+i*2*Math.PI/dims.length;return [180+Math.cos(angle)*87*value,150+Math.sin(angle)*87*value];};
 let svg='<svg viewBox="0 0 360 320" role="img" aria-label="Façade radar profile"><title>Selected measures and category matches; missing observations are not plotted</title>';
 for(const scale of [.25,.5,.75,1])svg+=`<polygon points="${dims.map((_,i)=>point(i,scale).join(',')).join(' ')}" fill="none" stroke="#d7dce4"/>`;
 svg+='<text x="185" y="162" font-size="9" fill="currentColor">0</text>';for(const scale of [.25,.5,.75,1])svg+=`<text x="185" y="${150-87*scale+3}" font-size="9" fill="currentColor">${scale===1?'1':String(scale)}</text>`;
 dims.forEach((d,i)=>{const p=point(i,1),label=point(i,1.38),name=d.radarCategory?d.radarLabel:d.radarStoreys?'Storeys / '+(analysisSettings.radarStoreysMax||20):({windows:'Whole WWR',surroundingGreen:'Greenery',streetRatio:'Street / height',enclosure:'Enclosure',relief:'Relief',share:'Type share',depth:'Depth',thermal:'Insulation',reveal:'Reveal'})[d.key]||d.label;
 const words=name.split(' '),lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>16&&lines.at(-1))lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}const text=lines.slice(0,2);if(lines.length>2)text[1]+='…';svg+=`<path d="M180 150 L${p.join(' ')}" stroke="#d7dce4"/><text x="${label[0]}" y="${label[1]-4*(text.length-1)}" text-anchor="middle" font-size="10"><title>${esc(d.label)}</title>${text.map((line,j)=>`<tspan x="${label[0]}" dy="${j?11:0}">${esc(line)}</tspan>`).join('')}</text>`;});
 if(values.every(v=>v!==null))svg+=`<polygon points="${values.map((v,i)=>point(i,v).join(',')).join(' ')}" fill="#0057ff22" stroke="#0057ff" stroke-width="2"/>`;
 else values.forEach((value,i)=>{const next=(i+1)%values.length;if(value!==null&&values[next]!==null)svg+=`<path d="M${point(i,value).join(' ')} L${point(next,values[next]).join(' ')}" stroke="#0057ff" stroke-width="2"/>`;});
 values.forEach((value,i)=>{if(value!==null){const p=point(i,value);svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#0057ff"><title>${esc(dims[i].label)}: ${Number(value.toFixed(2))}</title></circle>`;}});
 return `<div class="priority-radar">${svg}</svg><small>${values.filter(v=>v!==null).length}/${dims.length} dimensions answered · missing values left open</small><details><summary>Profile values</summary>${dims.map((d,i)=>`<div>${esc(d.label)}: ${values[i]===null?'Not answered':String(Number(values[i].toFixed(2)))}</div>`).join('')}<p>All values use a normalized 0 to 1 scale. Category axes indicate matching answers, not a ranking. Type-level values are averaged equally. Higher values are not necessarily better.</p></details></div>`;
};
const allParametersRefresh=refreshPriorityRadars;
refreshPriorityRadars=function(){const open=[...document.querySelectorAll('[data-radar-group][open]')].map(el=>el.dataset.radarGroup),focus=document.activeElement?.dataset.priorityRadar;allParametersRefresh();for(const el of document.querySelectorAll('[data-radar-group]'))if(open.includes(el.dataset.radarGroup))el.open=true;if(focus)document.querySelector('[data-priority-radar="'+CSS.escape(focus)+'"]')?.focus();};
document.addEventListener('change',event=>{if(event.target.id!=='radarStoreysMax')return;const value=Number(event.target.value);if(!Number.isInteger(value)||value<1||value>200){event.target.reportValidity();return;}analysisSettings.radarStoreysMax=value;refreshPriorityRadars();persist();});

document.addEventListener('click',event=>{if(event.target.closest('#priorityRadarReset'))analysisSettings.radarStoreysMax=20;},true);

// Derived whole-facade attribute, refreshed before saving or displaying records.
function syncFacadeDepthAttributes(){
 const groups={'Loggia':'Recessed','Semi-loggia':'Recessed','Flush':'Flush','Punched-window fa\u00e7ade':'Flush','Bay window':'Projecting','French balcony':'Projecting','Balcony':'Projecting'};
 for(const record of Object.values(records)){record.context??={};record.context.facadeDepth=groups[record.context.wholeFacade]||'Unknown';}
 if(!analysisSettings.facadeDepthAttributeVersion){analysisSettings.priorityRadarDims=[...new Set([...priorityValidRadarDims(analysisSettings.priorityRadarDims),'facadeDepth'])];analysisSettings.facadeDepthAttributeVersion=1;}
}
const facadeDepthFilterDefinitions=filterDefinitions;
filterDefinitions=function(){return [...facadeDepthFilterDefinitions(),{key:'context.facadeDepth',label:'Facade depth',scope:'context',field:'facadeDepth',values:['Recessed','Flush','Projecting','Unknown']}];};
const facadeDepthPersist=persist;
persist=function(){syncFacadeDepthAttributes();return facadeDepthPersist();};
const facadeDepthPayload=payload;
payload=function(){syncFacadeDepthAttributes();return facadeDepthPayload();};
const facadeDepthRender=render;
render=function(){facadeDepthRender();};
syncFacadeDepthAttributes();
