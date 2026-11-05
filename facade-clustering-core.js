/* Local clustering of whole-facade profiles. No survey records are mutated. */
(function(root){
 'use strict';
 const missing=v=>v==null||v===''||['Unknown','Not applicable'].includes(v);
 function fraction(v){
  const known={'¼':.25,'⅓':1/3,'½':.5,'⅔':2/3,'¾':.75};
  if(Object.hasOwn(known,v))return known[v];
  if(missing(v))return null;
  if(typeof v==='string'&&/^\d+(\.\d+)?%$/.test(v))return Number(v.slice(0,-1))/100;
  const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1?n:null;
 }
 function parts(record){
  const types=record.types||[];
  if(!types.length)return null;
  const shares=types.map(t=>fraction(t.share));
  if(types.length===1&&shares[0]===null)shares[0]=1;
  if(shares.some(v=>v===null))return null;
  const total=shares.reduce((a,b)=>a+b,0);
  return total>0?types.map((type,i)=>({type,weight:shares[i]/total})).filter(t=>t.weight>0):null;
 }
 function threshold(kind){
  if(/^Punched|^Flush/i.test(kind||''))return 0;
  return {'French balcony':1,'Bay window':2,'Loggia':3,'Semi-loggia':4,'Half-loggia':4,'Balcony':5}[kind]??null;
 }
 function facadeThreshold(record){
  const whole=record.context?.wholeFacade;
  const parts=(record.types||[]).filter(t=>fraction(t.share)!==0);
  const answered=parts.filter(t=>t.kind&&!['Unknown','Not applicable'].includes(t.kind));
  const types=new Set();let incomplete=false;
  for(const part of answered){const score=threshold(part.kind);if(score>0)types.add(part.kind==='Half-loggia'?'Semi-loggia':part.kind);else if(score===null)incomplete=true;}
  const wholeScore=threshold(whole);
  const hasDetail=answered.length>0;
  if(!hasDetail&&wholeScore>0)types.add(whole==='Half-loggia'?'Semi-loggia':whole);
  if(hasDetail&&answered.length<parts.length)incomplete=true;
  if(!hasDetail&&whole==='Mixed')incomplete=true;
  if(!hasDetail&&wholeScore===null)incomplete=true;
  const hasThreshold=types.size?'Yes':incomplete?'Unknown':hasDetail||wholeScore===0?'No':'Unknown';
  const labels=[...types].sort();
  if(incomplete)labels.push('Unknown');
  if(!labels.length)labels.push(hasThreshold==='No'?'None':'Unknown');
  return {hasThreshold,types:labels};
 }
 function primaryFacade(record){
  const tags=facadeThreshold(record);
  if(tags.hasThreshold==='No')return {value:'Punched-window façade',reason:'No threshold is present.'};
  if(tags.hasThreshold!=='Yes'||tags.types.includes('Unknown'))return {value:'Unknown',reason:'Complete the section-type classifications to determine the primary type.'};
  const labels=tags.types.filter(v=>v!=='Unknown');
  if(labels.length===1)return {value:labels[0],reason:'The threshold type determines the primary label; punched openings do not compete.'};
  const totals=new Map(labels.map(v=>[v,0]));
  for(const type of record.types||[]){
   if(threshold(type.kind)>0){const share=fraction(type.share);if(share===0)continue;if(share===null)return {value:'Unknown',reason:'Add area shares for every threshold section to determine the largest threshold type.'};const kind=type.kind==='Half-loggia'?'Semi-loggia':type.kind;totals.set(kind,(totals.get(kind)||0)+share);}
  }
  const ranked=[...totals].sort((a,b)=>b[1]-a[1]);
  if(!ranked.length||Math.abs(ranked[0][1]-(ranked[1]?.[1]||0))<1e-9)return {value:'Unknown',reason:'Threshold types have equal largest shares; no unique primary type can be chosen.'};
  return {value:ranked[0][0],reason:'Largest combined area share among threshold types; punched openings are excluded from this comparison.'};
 }
 function ordinal(field,value){
  if(field==='windows')return fraction(value);
  if(missing(value))return null;
  const maps={relief:{Flat:0,'Moderately articulated':.5,'Strongly articulated':1},enclosure:{Low:0,Medium:.5,High:1},reveal:{Flush:0,Medium:.5,Deep:1},depth:{'Under 1 m':0,'1 m or more':1},surroundingGreen:{None:0,Low:1/3,Medium:2/3,High:1},streetRatio:{'Street width < building height':0,'Street width = building height':.5,'Street width > building height':1,Narrow:0,Balanced:.5,Wide:1}};
  return maps[field]?.[value]??null;
 }
 function value(record,def){
  if(def.key==='context.wholeFacade'){const answer=primaryFacade(record).value;return answer==='Unknown'?null:[answer];}
  if(def.key==='record.hasThreshold'){const answer=facadeThreshold(record).hasThreshold;return answer==='Unknown'?null:[answer];}
  if(def.key==='record.thresholdTypes'){const answer=facadeThreshold(record).types;return answer.includes('Unknown')?null:answer;}
  if(def.key==='record.wwrBand')return fraction(record.wwrBand);
  if(def.key==='thresholdScore'){
   const p=parts(record);if(!p||p.some(p=>threshold(p.type.kind)===null))return null;
   return p.reduce((s,p)=>s+p.weight*threshold(p.type.kind)/5,0);
  }
  if(def.scope==='type'){
   const p=parts(record);if(!p)return null;
   if(def.type==='numeric'){
    const vals=p.map(p=>ordinal(def.field,p.type[def.field]));
    return vals.some(v=>v===null)?null:p.reduce((s,p,i)=>s+p.weight*vals[i],0);
   }
   const result={};
   for(const part of p){
    const raw=part.type[def.field],labels=Array.isArray(raw)?raw:[raw];
    if(!labels.length||labels.some(missing))return null;
    for(const label of labels)result[label]=(result[label]||0)+part.weight/labels.length;
   }
   return result;
  }
  const raw=(record[def.scope]||{})[def.field];
  if(def.type==='numeric'){
   if(def.field==='storeys'){const n=Number(raw);return !missing(raw)&&Number.isFinite(n)&&n>=1?n:null;}
   return ordinal(def.field,raw);
  }
  const labels=Array.isArray(raw)?raw:[raw];
  return !labels.length||labels.some(missing)?null:[...new Set(labels)];
 }
 function prepare(items,defs){
  let renormalized=0;
  const excluded=[],rows=[];
  for(const item of items){
   const values=defs.map(d=>value(item.record,d));
   const absent=defs.filter((d,i)=>values[i]===null).map(d=>d.label);
   if(absent.length)excluded.push({id:item.id,name:item.name,missing:absent});
   else {rows.push({...item,values});const t=item.record.types||[];const total=t.reduce((s,t)=>s+(fraction(t.share)||0),0);if(defs.some(d=>d.scope==='type'||d.key==='thresholdScore')&&t.length>1&&Math.abs(total-1)>.01)renormalized++;}
  }
  const ranges=defs.map((d,j)=>{const v=rows.map(r=>r.values[j]);return d.field==='storeys'&&v.length?[Math.min(...v),Math.max(...v)]:[0,1];});
  rows.forEach(r=>r.values=r.values.map((v,j)=>defs[j].type==='numeric'?(ranges[j][1]===ranges[j][0]?0:(v-ranges[j][0])/(ranges[j][1]-ranges[j][0])):v));
  return {rows,excluded,renormalized,ranges};
 }
 function distance(a,b,defs){
  let sum=0,total=0;
  defs.forEach((d,i)=>{
   const w=d.weight||1;let delta;
   if(d.type==='numeric')delta=Math.abs(a[i]-b[i]);
   else if(d.scope==='type')delta=[...new Set([...Object.keys(a[i]),...Object.keys(b[i])])].reduce((s,k)=>s+Math.abs((a[i][k]||0)-(b[i][k]||0)),0)/2;
   else {const union=new Set([...a[i],...b[i]]);delta=1-a[i].filter(v=>b[i].includes(v)).length/union.size;}
   sum+=delta*w;total+=w;
  });return total?sum/total:0;
 }
 function matrix(rows,defs){return rows.map(a=>rows.map(b=>distance(a.values,b.values,defs)));}
 function fit(D,k,restarts=8,previousMedoids=null,seed=42){
  const n=D.length;if(!Number.isInteger(k)||k<1||k>n)throw Error('Choose a cluster count between 1 and the eligible record count.');
  if(!Number.isInteger(restarts)||restarts<1||restarts>50)throw Error('Choose between 1 and 50 starting configurations.');
  if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Seed must be an integer from 0 to 4294967295.');
  let best=null,randomState=(seed^Math.imul(k,2654435761))>>>0;
  const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const trials=[],seen=new Set();
  function evaluate(medoids){const labels=D.map((row,i)=>{const own=medoids.indexOf(i);if(own!==-1)return own;let c=0;for(let j=1;j<k;j++)if(row[medoids[j]]<row[medoids[c]])c=j;return c;});return {medoids,labels,cost:labels.reduce((s,c,i)=>s+D[i][medoids[c]],0)};}
  for(let attempt=0;trials.length<restarts&&attempt<Math.max(200,restarts*100);attempt++){
   let medoids;
   const warm=attempt===0&&previousMedoids?.length===k-1;
   if(warm){
    medoids=[...previousMedoids];
    let next=-1,far=-1;for(let i=0;i<n;i++)if(!medoids.includes(i)){const gap=Math.min(...medoids.map(m=>D[i][m]));if(gap>far){next=i;far=gap;}}medoids.push(next);
   }else{
    const pool=Array.from({length:n},(_,i)=>i);
    for(let j=0;j<k;j++){const next=j+Math.floor(random()*(n-j));[pool[j],pool[next]]=[pool[next],pool[j]];}
    medoids=pool.slice(0,k);
   }
   const signature=[...medoids].sort((a,b)=>a-b).join(',');if(seen.has(signature))continue;seen.add(signature);
   let result=evaluate(medoids);
   const initialCost=result.cost,initialMedoids=[...medoids];let iterations=0;
   for(let iteration=0;iteration<40;iteration++){
    const next=result.medoids.map((old,c)=>{const members=result.labels.map((l,i)=>l===c?i:-1).filter(i=>i>=0);let medoid=old,cost=Infinity;for(const i of members){const v=members.reduce((s,j)=>s+D[i][j],0);if(v<cost){cost=v;medoid=i;}}return medoid;});
    const updated=evaluate(next);if(updated.cost>=result.cost-1e-12)break;result=updated;iterations++;
   }
   const trial={start:trials.length+1,initialMedoids,initialCost,cost:result.cost,iterations,warm};trials.push(trial);
   if(!best||result.cost<best.cost)best={...result,bestStart:trial.start};
  }
  best.trials=trials;best.seed=seed;best.requestedStarts=restarts;
  best.silhouette=k<2||k===n?null:D.reduce((sum,row,i)=>{
   const own=best.labels[i],same=best.labels.map((l,j)=>l===own&&j!==i?j:-1).filter(j=>j>=0);
   if(!same.length)return sum;
   const a=same.reduce((s,j)=>s+row[j],0)/same.length;let b=Infinity;
   for(let c=0;c<k;c++)if(c!==own){const members=best.labels.map((l,j)=>l===c?j:-1).filter(j=>j>=0);if(members.length)b=Math.min(b,members.reduce((s,j)=>s+row[j],0)/members.length);}
   return sum+(Math.max(a,b)>0?(b-a)/Math.max(a,b):0);
  },0)/n;
  return best;
 }
 function vectors(rows,defs){
  const axes=[];
  defs.forEach((d,j)=>{
   if(d.type==='numeric')axes.push({j,label:d.label});
   else {const keys=[...new Set(rows.flatMap(r=>Array.isArray(r.values[j])?r.values[j]:Object.keys(r.values[j])))].sort();keys.forEach(key=>axes.push({j,key,label:d.label+' / '+key,scale:1/Math.sqrt(keys.length||1)}));}
  });
  return {axes,points:rows.map(r=>axes.map(a=>a.key===undefined?r.values[a.j]*Math.sqrt(defs[a.j].weight||1):(Array.isArray(r.values[a.j])?Number(r.values[a.j].includes(a.key)):r.values[a.j][a.key]||0)*a.scale*Math.sqrt(defs[a.j].weight||1)))};
 }
 function pca(points){
  if(!points.length)return {points:[],explained:0};
  const n=points.length,p=points[0].length,means=points[0].map((_,j)=>points.reduce((s,r)=>s+r[j],0)/n),X=points.map(r=>r.map((v,j)=>v-means[j]));
  const cov=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>X.reduce((s,r)=>s+r[i]*r[j],0)/n));
  const total=cov.reduce((s,r,i)=>s+r[i],0),components=[],eigen=[];
  for(let c=0;c<2;c++){
   let v=Array.from({length:p},(_,i)=>Math.sin((i+1)*(c+1)*1.7));
   for(let step=0;step<100;step++){let next=cov.map(r=>r.reduce((s,x,j)=>s+x*v[j],0));for(const u of components){const dot=next.reduce((s,x,i)=>s+x*u[i],0);next=next.map((x,i)=>x-dot*u[i]);}const norm=Math.hypot(...next);if(norm<1e-12){v=Array(p).fill(0);break;}v=next.map(x=>x/norm);}
   const lambda=v.reduce((s,x,i)=>s+x*cov[i].reduce((t,y,j)=>t+y*v[j],0),0);components.push(v);eigen.push(Math.max(0,lambda));
  }
  return {points:X.map(r=>components.map(v=>v.reduce((s,x,j)=>s+x*r[j],0))),explained:total?Math.min(1,eigen.reduce((a,b)=>a+b,0)/total):0};
 }
 const api={fraction,parts,threshold,facadeThreshold,primaryFacade,value,prepare,distance,matrix,fit,vectors,pca};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FacadeClustering=api;
})(typeof window!=='undefined'?window:globalThis);
