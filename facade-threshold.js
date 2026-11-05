/* Derived facade-level tags remain current after edits, imports and merges. */
(function(){
 'use strict';
 const C=window.FacadeClustering;if(!C)return;
 const typeField=typeof contextFields!=='undefined'?contextFields.find(d=>d[0]==='wholeFacade'):null;
 if(typeField){typeField[1]='Primary façade type';typeField[2]=typeField[2].filter(v=>v!=='Mixed');}
 if(typeof wholeFacadeOptions!=='undefined'){const index=wholeFacadeOptions.indexOf('Mixed');if(index>=0)wholeFacadeOptions.splice(index,1);}
 if(typeof priorityDefaults!=='undefined')priorityDefaults.wholeFacade='Primary façade type';
 function syncPrimary(){
  for(const record of Object.values(records)){
   if(!record.context)record.context={};
   const value=C.primaryFacade(record).value;
   if(record.context.wholeFacade!==value){
    if(record.context.wholeFacade&&!Object.hasOwn(record.context,'wholeFacadeOriginal'))record.context.wholeFacadeOriginal=record.context.wholeFacade;
    record.context.wholeFacade=value;
   }
  }
 }
 if(typeof render==='function'){const original=render;render=function(){syncPrimary();return original.apply(this,arguments);};}
 if(typeof persist==='function'){const original=persist;persist=function(){syncPrimary();return original.apply(this,arguments);};}
 if(typeof priorityField==='function'){
  const original=priorityField;
  priorityField=function(key,record){
   if(key!=='wholeFacade'||!(record.types||[]).some(t=>t.kind))return original(key,record);
   const primary=C.primaryFacade(record);
   return `<section class="field"><h3>Primary façade type</h3><strong>${esc(primary.value)}</strong><p class="hint">${esc(primary.reason)} Update section types and area shares to change this derived label.</p></section>`;
  };
 }
 const definitions=[
  {key:'record.hasThreshold',label:'Whole facade: has threshold',scope:'record',field:'hasThreshold',values:['Yes','No','Unknown']},
  {key:'record.thresholdTypes',label:'Whole facade: threshold types',scope:'record',field:'thresholdTypes',values:['French balcony','Bay window','Loggia','Semi-loggia','Balcony','None','Unknown']}
 ];
 if(typeof filterDefinitions==='function'){
  const original=filterDefinitions;
  filterDefinitions=function(){return [...original().filter(d=>!definitions.some(n=>n.key===d.key)).map(d=>d.key==='context.wholeFacade'?{...d,label:'Primary façade type',values:d.values.filter(v=>v!=='Mixed')}:d),...definitions];};
 }
 if(typeof attributeFilterValue==='function'){
  const original=attributeFilterValue;
  attributeFilterValue=function(photo,record,type,definition){
   if(definition.key==='context.wholeFacade')return C.primaryFacade(record).value;
   if(definition.key==='record.hasThreshold')return C.facadeThreshold(record).hasThreshold;
   if(definition.key==='record.thresholdTypes')return C.facadeThreshold(record).types;
   return original(photo,record,type,definition);
  };
 }
 function markup(record){
  const tags=C.facadeThreshold(record);
  const primary=C.primaryFacade(record);
  return `<section class="facade-threshold-tags"><h3>Whole-facade thresholds</h3><div class="review-row"><b>Primary façade type</b><span>${esc(primary.value)}</span></div><div class="review-row"><b>Has threshold</b><span>${esc(tags.hasThreshold)}</span></div><div class="review-row"><b>Threshold types present</b><span>${tags.types.map(esc).join(', ')}</span></div><p class="hint">${esc(primary.reason)} All threshold types are retained separately. Zero-share sections are ignored.</p></section>`;
 }
 if(typeof formContent==='function'){
  const original=formContent;
  formContent=function(record){return original(record)+([0,4].includes(step)?markup(record):'');};
 }
 if(typeof priorityProfile==='function'){
  const original=priorityProfile;
  priorityProfile=function(photo){return original(photo)+markup(records[photo.id]||{});};
 }
})();
