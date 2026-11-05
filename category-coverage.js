/* Ordered-category coverage around the category nearest the observed mean. */
(function(root){
 'use strict';
 function nearest(value,categories){
  let index=0;
  for(let i=1;i<categories.length;i++)if(Math.abs(categories[i]-value)<=Math.abs(categories[index]-value)+1e-12)index=i;
  return index;
 }
 function coverage(values,categoryValues){
  const categories=[...new Set(categoryValues.filter(v=>typeof v==='number'&&Number.isFinite(v)))].sort((a,b)=>a-b);
  const valid=values.map((value,index)=>({value,index})).filter(v=>typeof v.value==='number'&&Number.isFinite(v.value));
  const n=valid.length;
  if(!n||!categories.length)return {n:0,mean:null,anchor:null,buckets:[],ranges:[]};
  const mean=valid.reduce((s,v)=>s+v.value,0)/n,anchorIndex=nearest(mean,categories);
  const buckets=categories.map(value=>({value,indices:[]}));
  valid.forEach(item=>buckets[nearest(item.value,categories)].indices.push(item.index));
  const ranges=[0,1,2].map(radius=>{
   const lowIndex=Math.max(0,anchorIndex-radius),highIndex=Math.min(categories.length-1,anchorIndex+radius);
   const indices=buckets.slice(lowIndex,highIndex+1).flatMap(b=>b.indices);
   return {radius,lowIndex,highIndex,low:categories[lowIndex],high:categories[highIndex],count:indices.length,percentage:100*indices.length/n,indices};
  });
  return {n,mean,anchor:categories[anchorIndex],anchorIndex,buckets,ranges};
 }
 const api={coverage,nearest};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 root.FacadeCategoryCoverage=api;
 if(typeof distributionGraphSvg!=='function')return;
 const numericKeys=new Set(['record.wwrBand','context.storeys','type.windows','type.share']);
 function numericValue(profile,definition){
  const key=definition.key,record=profile.record;
  if(key==='record.wwrBand'){
   const measurement=record.wwrSegmentation?.measurement;
   const measured=measurement?.vector_measurement?.wwr_percent??measurement?.wwr_percent;
   if(typeof measured==='number'&&Number.isFinite(measured)&&measured>=0&&measured<=100)return measured;
   const raw=record.wwrBand;
   if(raw==null||String(raw).trim()===''||['Unknown','Not applicable'].includes(raw))return null;
   const text=String(raw).trim();if(!/^\d+(?:\.\d+)?%?$/.test(text))return null;
   const n=Number(text.replace('%',''));return n>=0&&n<=100?n:null;
  }
  const raw=attributeFilterValue(profile.photo,record,profile.type,definition);
  if(key==='context.storeys'){const n=Number(raw);return raw!=null&&String(raw).trim()!==''&&Number.isInteger(n)&&n>=1&&n<=200?n:null;}
  return root.FacadeClustering?.fraction(raw)??null;
 }
 const original=distributionGraphSvg;
 distributionGraphSvg=function(graph,definitions){
  const definition=definitions.find(d=>d.key===(graph.attribute||graph.x));
  if(graph.type!=='bar'||!definition||!numericKeys.has(definition.key))return original(graph,definitions);
  const profiles=filteredAnalysisPhotos.flatMap(photo=>{
   const record=records[photo.id]||{};
   return definition.scope==='type'?(record.types?.length?record.types:[{}]).flatMap((type,index)=>graphProfileMatches(photo,type)?[{photo,record,type,index}]:[]):[{photo,record,type:{},index:-1}];
  });
  const items=profiles.map(profile=>({profile,value:numericValue(profile,definition)})).filter(item=>item.value!==null);
  const values=items.map(item=>item.value),excluded=profiles.length-items.length;
  const unit=definition.scope==='type'?'section observations':'facades',suffix=definition.key==='record.wwrBand'?'%':'';
  if(!items.length)return {html:'<p class="empty">No valid numeric values in this selection.</p>',groups:[],description:`0 valid of ${profiles.length} ${unit}; ${excluded} missing, Unknown, Not applicable or invalid values excluded.`};
  let categories;
  if(definition.key==='context.storeys')categories=Array.from({length:200},(_,i)=>i+1);
  else if(definition.key==='record.wwrBand')categories=Array.from({length:21},(_,i)=>i*5);
  else categories=(definition.values||[]).map(v=>root.FacadeClustering.fraction(v)).filter(v=>v!==null);
  const data=coverage(values,categories),groups=data.buckets.map(b=>b.indices.map(i=>items[i]));
  const fmt=v=>Number(v.toFixed(3))+suffix;
  let first=0,last=data.buckets.length-1;
  if(definition.key==='context.storeys'){
   const occupied=data.buckets.map((b,i)=>b.indices.length?i:-1).filter(i=>i>=0);
   first=Math.max(0,Math.min(...occupied)-2);last=Math.min(data.buckets.length-1,Math.max(...occupied)+2);
  }
  const displayed=data.buckets.slice(first,last+1),left=65,right=785,top=45,bottom=335,step=(right-left)/displayed.length;
  const X=index=>left+(index-first+.5)*step,max=Math.max(1,...displayed.map(b=>b.indices.length)),Y=n=>bottom-n/max*(bottom-top-10);
  let svg=`<svg class="category-coverage-chart" viewBox="0 0 830 420" role="img" aria-label="Category counts and neighbouring-category coverage around the mean"><title>${esc(definition.label)}: mean ${fmt(data.mean)}; nearest category ${fmt(data.anchor)}. Highlighted ranges count actual observations.</title>`;
  const shades=['#477bd0','#8baee4','#dbe7f7'];
  for(const radius of [2,1,0]){
   const range=data.ranges[radius],x=X(range.lowIndex)-step/2,width=(range.highIndex-range.lowIndex+1)*step;
   svg+=`<rect data-category-area="${radius}" x="${x}" y="${top}" width="${width}" height="${bottom-top}" fill="${shades[radius]}" fill-opacity=".5" style="pointer-events:none"/>`;
  }
  for(let tick=0;tick<=4;tick++){const n=max*tick/4;svg+=`<path d="M${left} ${Y(n)}H${right}" stroke="#dce1e9"/><text x="${left-8}" y="${Y(n)+4}" text-anchor="end" font-size="11">${Number(n.toFixed(1))}</text>`;}
  displayed.forEach((bucket,j)=>{
   const index=first+j,x=X(index),width=Math.max(1,step*.72),radius=Math.abs(index-data.anchorIndex),color=graph.colorEnabled?graphColorFor(graph,suffix?bucket.value+'%':String((definition.values||[]).find(v=>root.FacadeClustering.fraction(v)===bucket.value)??bucket.value)):radius===0?'#143f91':radius===1?'#477bd0':radius===2?'#8baee4':'#a7adb7';
   svg+=`<g data-comparison-point="${esc(graph.id)}" data-point-index="${index}" tabindex="0" role="button" aria-label="${fmt(bucket.value)}: ${bucket.indices.length} ${unit}"><title>${fmt(bucket.value)}: ${bucket.indices.length} ${unit}</title><rect x="${x-width/2}" y="${Y(bucket.indices.length)}" width="${width}" height="${bottom-Y(bucket.indices.length)}" fill="${color}" stroke="white"/>${bucket.indices.length?`<text x="${x}" y="${Y(bucket.indices.length)-6}" text-anchor="middle" font-size="10">${bucket.indices.length}</text>`:''}</g>`;
   if(displayed.length<=25||j%Math.ceil(displayed.length/20)===0||index===data.anchorIndex)svg+=`<text x="${x}" y="356" text-anchor="middle" font-size="10">${fmt(bucket.value)}</text>`;
  });
  // Map the numeric mean onto the ordered category axis, including uneven fractional categories.
  let meanPosition=data.anchorIndex;
  for(let i=0;i<data.buckets.length-1;i++)if(data.mean>=data.buckets[i].value&&data.mean<=data.buckets[i+1].value){meanPosition=i+(data.mean-data.buckets[i].value)/(data.buckets[i+1].value-data.buckets[i].value);break;}
  svg+=`<path d="M${X(meanPosition)} ${top}V${bottom}" stroke="#b54525" stroke-width="2" stroke-dasharray="5 4"/><text x="425" y="22" text-anchor="middle" font-size="12">Mean ${fmt(data.mean)} → nearest category ${fmt(data.anchor)}</text><path d="M${left} ${top}V${bottom}H${right}" stroke="#58677b" fill="none"/><text x="425" y="393" text-anchor="middle" font-size="12">${esc(definition.label)} · ordered categories</text><text x="18" y="185" transform="rotate(-90 18 185)" text-anchor="middle" font-size="11">Count of ${unit}</text></svg>`;
  const rows=data.ranges.map(range=>{
   const index=groups.push(range.indices.map(i=>items[i]))-1;
   return `<tr data-category-summary="${range.radius}"><td>${range.radius===0?'Nearest category only':`Nearest category ±${range.radius} neighbouring ${range.radius===1?'category':'categories'}`}</td><td>${fmt(range.low)}${range.low===range.high?'':' to '+fmt(range.high)}</td><td>${range.count} / ${data.n}</td><td>${range.percentage.toFixed(1)}%</td><td><button type="button" data-comparison-point="${esc(graph.id)}" data-point-index="${index}">Inspect ${range.count}</button></td></tr>`;
  }).join('');
  return {html:svg+`<div class="category-coverage-summary"><b>Valid n = ${data.n}</b> · Mean = ${fmt(data.mean)} · Nearest category = ${fmt(data.anchor)} · Excluded = ${excluded}</div><p class="hint">Darkest highlight: nearest category. Medium: one category on either side. Lightest: two categories on either side. Ranges are nested and stop at the ends of the category scale. Empty categories still count as steps; exact ties choose the higher category. ${suffix?'WWR uses 5-percentage-point categories; exact measurements are assigned to the nearest category, while the mean uses unrounded values.':''}</p><table class="average-stats-table category-coverage-table"><thead><tr><th>Coverage</th><th>Included categories</th><th>Count / valid total</th><th>Observed share</th><th>Members</th></tr></thead><tbody>${rows}</tbody></table>`,groups,description:`${data.n} valid of ${profiles.length} ${unit}; ${excluded} missing, Unknown, Not applicable or invalid values excluded. ${definition.scope==='type'?'Each matching section counts once.':'Each facade counts once.'} Percentages count observed category membership, not Gaussian or standard-deviation ranges.`};
 };
})(typeof window!=='undefined'?window:globalThis);
