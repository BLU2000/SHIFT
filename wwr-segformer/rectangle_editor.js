'use strict';
const svgNS='http://www.w3.org/2000/svg';
document.querySelector('.preview-image').insertAdjacentHTML('beforeend','<svg id="rectangleLayer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Editable facade boundary and window rectangles"></svg>');
document.querySelector('.legend').insertAdjacentHTML('afterend',`<div class="rectangle-tools"><h3>Adjust windows</h3><p class="hint">Drag a window to move it. Drag its corner handles to resize. Click the red facade frame to move it, or drag its corner handles to resize.</p><div class="rect-actions"><button id="rectAdd">Add window</button><button id="rectRemove">Remove window</button></div><p id="rectSummary" class="hint"></p></div>`);
const layer=$('rectangleLayer');let rectSelected='facade',rectMode='select',rectDrag=null;
function vectorData(){return results[current];}
function fitWindowObjects(data,minimum=.02){const total=data.crop_size[0]*data.crop_size[1];return (data.window_objects||[]).filter(object=>object.mask_pixels>=Math.max(4,total*minimum/100)).map(object=>structuredClone(object));}
function initializeVectors(data){if(!data.vector)data.vector={facade:[0,0,1,1],windows:fitWindowObjects(data),min_area_percent:.02};}
function vectorChanged(){const data=vectorData();if(!data)return;data.result.verified=false;data.result.status='needs_review';data.result.verified_at=null;$('verified').checked=false;$('export').disabled=!Object.values(results).some(d=>d.result.verified);list();}
function boxFor(id){const data=vectorData();return id==='facade'?data.vector.facade:data.vector.windows.find(w=>w.id===id)?.box;}
function renderVectors(){
 const data=vectorData();layer.toggleAttribute('hidden',!data);if(!data)return;initializeVectors(data);
 if(rectSelected!=='facade'&&!data.vector.windows.some(w=>w.id===rectSelected))rectSelected='facade';
 const v=data.vector,measurement=WWRRectangles.measure(v.facade,v.windows);
 data.result.vector_measurement={version:1,method:'edited-rectangles',coordinate_system:'normalized-to-crop',crop_size:data.crop_size,facade:structuredClone(v.facade),windows:structuredClone(v.windows),...measurement,verified:data.result.verified};
 const items=[{id:'facade',box:v.facade},...v.windows];
 const nodes=[];for(const item of items){const [x0,y0,x1,y1]=item.box,r=document.createElementNS(svgNS,'rect');r.setAttribute('x',x0*1000);r.setAttribute('y',y0*1000);r.setAttribute('width',(x1-x0)*1000);r.setAttribute('height',(y1-y0)*1000);r.setAttribute('class',item.id==='facade'?'facade-box':'window-box');if(item.id===rectSelected)r.classList.add('selected-box');r.dataset.rectId=item.id;nodes.push(r);}
 const selected=boxFor(rectSelected),bounds=layer.getBoundingClientRect();if(selected){const [x0,y0,x1,y1]=selected;for(const [corner,x,y]of [['nw',x0,y0],['ne',x1,y0],['se',x1,y1],['sw',x0,y1]]){const handle=document.createElementNS(svgNS,'rect'),sx=10000/Math.max(100,bounds.width),sy=10000/Math.max(100,bounds.height);handle.setAttribute('x',x*1000-sx/2);handle.setAttribute('y',y*1000-sy/2);handle.setAttribute('width',sx);handle.setAttribute('height',sy);handle.setAttribute('class','rect-handle');handle.dataset.corner=corner;handle.dataset.rectId=rectSelected;nodes.push(handle);}}
 layer.replaceChildren(...nodes);layer.style.cursor=rectMode==='add'?'crosshair':'default';
 $('rectAdd').setAttribute('aria-pressed',String(rectMode==='add'));$('rectRemove').setAttribute('aria-pressed',String(rectMode==='remove'));
 $('rectSummary').textContent=`${v.windows.length} rectangles · overlap counted once · window rectangles are clipped to the facade boundary. AI mask: ${Number.isFinite(data.result.wwr_percent)?data.result.wwr_percent.toFixed(2)+'%':'undefined'}.`;
 $('ratio').textContent=measurement.wwr_percent.toFixed(2)+'% rectangle WWR';
}
const originalShowPreview=showPreview;showPreview=function(){originalShowPreview();renderVectors();};
function rectPoint(event){const b=layer.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-b.left)/b.width)),Math.max(0,Math.min(1,(event.clientY-b.top)/b.height))];}
function newWindowId(data){let n=1;while(data.vector.windows.some(w=>w.id==='manual-'+n))n++;return 'manual-'+n;}
layer.onpointerdown=event=>{if(busy||!vectorData())return;event.preventDefault();const data=vectorData(),p=rectPoint(event),id=event.target.dataset.rectId;if(rectMode==='remove'){if(id&&id!=='facade'){data.vector.windows=data.vector.windows.filter(w=>w.id!==id);rectSelected=null;rectMode='select';vectorChanged();renderVectors();}return;}if(rectMode==='add'){rectDrag={kind:'add',start:p,before:structuredClone(data.vector)};}else if(id){rectSelected=id;rectDrag={kind:event.target.dataset.corner||'move',start:p,box:[...boxFor(id)],before:structuredClone(data.vector)};renderVectors();}else return;layer.setPointerCapture(event.pointerId);};
layer.onpointermove=event=>{if(!rectDrag)return;const data=vectorData(),p=rectPoint(event),drag=rectDrag;
 if(drag.kind==='add'){const draft=rectangle(drag.start,p);let r=layer.querySelector('.draft-box');if(!r){r=document.createElementNS(svgNS,'rect');r.setAttribute('class','draft-box');layer.append(r);}r.setAttribute('x',draft[0]*1000);r.setAttribute('y',draft[1]*1000);r.setAttribute('width',(draft[2]-draft[0])*1000);r.setAttribute('height',(draft[3]-draft[1])*1000);return;}
 const box=boxFor(rectSelected),old=drag.box,min=.002;
 if(drag.kind==='move'){const dx=Math.max(-old[0],Math.min(1-old[2],p[0]-drag.start[0])),dy=Math.max(-old[1],Math.min(1-old[3],p[1]-drag.start[1]));box.splice(0,4,old[0]+dx,old[1]+dy,old[2]+dx,old[3]+dy);}else{if(drag.kind.includes('w'))box[0]=Math.min(old[2]-min,p[0]);if(drag.kind.includes('e'))box[2]=Math.max(old[0]+min,p[0]);if(drag.kind.includes('n'))box[1]=Math.min(old[3]-min,p[1]);if(drag.kind.includes('s'))box[3]=Math.max(old[1]+min,p[1]);}
 vectorChanged();renderVectors();};
layer.onpointerup=event=>{if(!rectDrag)return;const data=vectorData(),drag=rectDrag;rectDrag=null;if(drag.kind==='add'){const box=rectangle(drag.start,rectPoint(event));if(box[2]-box[0]>.002&&box[3]-box[1]>.002){const id=newWindowId(data);data.vector.windows.push({id,box,source:'manual'});rectSelected=id;vectorChanged();}rectMode='select';}renderVectors();};
layer.onpointercancel=()=>{if(rectDrag){vectorData().vector=rectDrag.before;rectDrag=null;renderVectors();}};
$('rectAdd').onclick=()=>{if(busy)return;rectMode=rectMode==='add'?'select':'add';renderVectors();message(rectMode==='add'?'Drag a rectangle over the missing window.':'Drag a window to move or resize it.');};
$('rectRemove').onclick=()=>{if(busy)return;rectMode=rectMode==='remove'?'select':'remove';renderVectors();message(rectMode==='remove'?'Click the window rectangle you want to remove.':'Drag a window to move or resize it.');};
window.addEventListener('resize',renderVectors);
