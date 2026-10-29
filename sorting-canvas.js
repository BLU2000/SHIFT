/* Visual building-type grouping. Labels reuse the existing per-photo buildingType field. */
let sortPhotoId=null,sortPage=0,sortHistory=[],sortSkipped=new Set(),sortDrag=null;
function sortQueue(){return photos.filter(p=>!Number.isSafeInteger(records[p.id]?.buildingType));}
function nextSortPhoto(){return sortQueue().find(p=>!sortSkipped.has(p.id))||null;}
function openSortingCanvas(){view='sorting';sortSkipped.clear();sortPhotoId=nextSortPhoto()?.id||null;render();}
function renderSortingCanvas(){
  const groups=buildingTypeGroups(),pages=Math.max(1,Math.ceil(groups.length/6));sortPage=Math.max(0,Math.min(sortPage,pages-1));
  if(!photos.some(p=>p.id===sortPhotoId))sortPhotoId=nextSortPhoto()?.id||null;
  const photo=photos.find(p=>p.id===sortPhotoId),queue=sortQueue(),visible=groups.slice(sortPage*6,sortPage*6+6);
  const targets=[{number:'new',items:[]},...visible.map(([number,items])=>({number,items}))];
  document.getElementById('main').innerHTML=`<div class="intro"><div><div class="eyebrow">Visual sorting</div><h1>Find the families.</h1><p class="muted">Drag the center photo into a folder. Its number becomes the building-type label.</p></div><div><button id="sortBack">Back to tagging</button> <button id="insights">View analysis ↗</button></div></div><div class="sorting-toolbar"><span>${photos.length-queue.length} / ${photos.length} sorted · ${queue.length} unassigned</span><button id="sortUndo" ${sortHistory.length?'':'disabled'}>Undo</button><button id="sortSkip" ${photo?'':'disabled'}>Skip photo</button><button id="sortRestart" ${queue.length?'':'disabled'}>Show unsorted</button><span class="sort-pages"><button id="sortPrev" ${sortPage?'':'disabled'} aria-label="Previous category page">←</button> Folders ${sortPage+1} / ${pages} <button id="sortNext" ${sortPage<pages-1?'':'disabled'} aria-label="Next category page">→</button></span></div><div class="sorting-scroll"><div class="sorting-stage" id="sortingStage"><div class="sorting-orbit" aria-hidden="true"></div>${targets.map((target,i)=>{const angle=-Math.PI/2+i*2*Math.PI/targets.length,x=50+Math.sin(angle)*38,y=50-Math.cos(angle)*38;return `<button class="sort-folder ${target.number==='new'?'sort-new':''}" data-sort-target="${target.number}" style="left:${x}%;top:${y}%" aria-label="${target.number==='new'?'Create a new category':'Assign to category '+target.number}"><span class="folder-tab"></span><span class="folder-title">${target.number==='new'?'+ New category':'Category '+target.number}</span><span class="folder-thumbs">${target.items.slice(-3).map(p=>`<img src="${esc(p.src)}" alt="" draggable="false">`).join('')||'<span class="folder-plus">+</span>'}</span><span class="folder-count">${target.number==='new'?'Drop here to create':target.items.length+' photo(s)'}</span></button>`;}).join('')}<div class="sort-center">${photo?`<div class="sort-photo" data-sort-photo="${esc(photo.id)}" role="img" aria-label="Drag ${esc(photo.name)} to a category"><img src="${esc(photo.src)}" alt="${esc(photo.name)}" draggable="false"><span>${esc(photo.name)}</span></div><p>${records[photo.id]?.buildingType?'Currently category '+records[photo.id].buildingType:'Drag into a folder · or click a folder'}</p>`:`<div class="sort-finished"><strong>${queue.length?'Ready for another look?':'All photos sorted.'}</strong><p>${queue.length?'Use Show unsorted to revisit skipped photos.':'Select a folder preview photo below to move it to a different category.'}</p><button id="sortRestart">${queue.length?'Show unsorted':'Review folders'}</button></div>`}</div></div></div><section class="sort-preview"><div class="sort-preview-title"><h2 id="sortPreviewTitle">Folder preview</h2><p class="hint">Hover or focus a folder to see its contents. Select a thumbnail to move it to another category.</p></div><div id="sortPreviewPhotos" class="sort-preview-photos"></div></section><p class="sort-save-note" role="status" id="sortStatus">Category labels save automatically. Use Save to download the updated HTML.</p>`;
  if(visible.length)showSortPreview(visible[0][0]);
}
function showSortPreview(number){
  const group=buildingTypeGroups().find(([n])=>n===Number(number));
  const title=document.getElementById('sortPreviewTitle'),content=document.getElementById('sortPreviewPhotos');if(!title||!content)return;
  title.textContent=number==='new'?'New category':`Category ${number} · ${group?.[1].length||0} photo(s)`;
  content.innerHTML=group?group[1].map(photo=>`<button data-sort-select="${esc(photo.id)}" class="sort-preview-item" title="Select ${esc(photo.name)} to regroup"><img src="${esc(photo.src)}" alt="${esc(photo.name)}" draggable="false"><span>${esc(photo.name)}</span></button>`).join(''):'<p class="hint">Drop the center photo here to start a new numbered category.</p>';
}
async function sortAssignPhoto(photoId,target){
  if(!photos.some(p=>p.id===photoId))return;
  const number=target==='new'?nextBuildingType():Number(target);
  if(!Number.isSafeInteger(number)||number<1)return;
  const old=records[photoId],record=old||(records[photoId]=blank());
  if(record.buildingType===number)return;
  sortHistory.push({id:photoId,previous:record.buildingType,updatedAt:record.updatedAt,hadRecord:!!old});
  record.buildingType=number;record.updatedAt=new Date().toISOString();
  sortSkipped.delete(photoId);sortPhotoId=nextSortPhoto()?.id||null;
  const groups=buildingTypeGroups();sortPage=Math.floor(groups.findIndex(([n])=>n===number)/6);
  await persist();render();showSortPreview(number);
  const status=document.getElementById('sortStatus');if(status)status.textContent=`Assigned to category ${number}. ${sortQueue().length} photo(s) remaining.`;
}
async function undoSortAssignment(){
  const item=sortHistory.pop();if(!item||!photos.some(p=>p.id===item.id))return;
  const record=records[item.id];if(!record)return;
  if(item.previous===undefined)delete record.buildingType;else record.buildingType=item.previous;
  record.updatedAt=item.updatedAt;
  sortSkipped.delete(item.id);sortPhotoId=item.id;await persist();render();
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.id==='sortPhotos')openSortingCanvas();
  if(button.id==='sortBack'){if(sortPhotoId)current=sortPhotoId;view='entry';step=0;typeIndex=0;render();}
  if(button.id==='sortSkip'){if(sortPhotoId)sortSkipped.add(sortPhotoId);sortPhotoId=nextSortPhoto()?.id||null;render();}
  if(button.id==='sortRestart'){sortSkipped.clear();sortPhotoId=nextSortPhoto()?.id||null;render();}
  if(button.id==='sortUndo')undoSortAssignment();
  if(button.id==='sortPrev'){sortPage--;render();}if(button.id==='sortNext'){sortPage++;render();}
  if(button.dataset.sortTarget&&sortPhotoId)sortAssignPhoto(sortPhotoId,button.dataset.sortTarget);
  if(button.dataset.sortSelect){sortPhotoId=button.dataset.sortSelect;render();}
});
document.addEventListener('pointerover',event=>{const folder=event.target.closest('[data-sort-target]');if(folder&&view==='sorting'&&!folder.contains(event.relatedTarget))showSortPreview(folder.dataset.sortTarget);});
document.addEventListener('focusin',event=>{const folder=event.target.closest('[data-sort-target]');if(folder)showSortPreview(folder.dataset.sortTarget);});
document.addEventListener('pointerdown',event=>{
  const photo=event.target.closest('[data-sort-photo]');if(!photo||event.button!==0)return;
  event.preventDefault();photo.setPointerCapture(event.pointerId);
  sortDrag={id:photo.dataset.sortPhoto,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,ghost:null,target:null};
});
document.addEventListener('pointermove',event=>{
  if(!sortDrag||event.pointerId!==sortDrag.pointer)return;
  if(!sortDrag.ghost&&Math.hypot(event.clientX-sortDrag.startX,event.clientY-sortDrag.startY)<8)return;
  if(!sortDrag.ghost){const img=document.createElement('img');img.src=photos.find(p=>p.id===sortDrag.id).src;img.className='sort-drag-ghost';document.body.append(img);sortDrag.ghost=img;}
  sortDrag.ghost.style.left=event.clientX+'px';sortDrag.ghost.style.top=event.clientY+'px';
  const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-sort-target]');
  if(target!==sortDrag.target){sortDrag.target?.classList.remove('sort-drop-active');target?.classList.add('sort-drop-active');sortDrag.target=target;if(target)showSortPreview(target.dataset.sortTarget);}
});
function finishSortDrag(event,cancel=false){
  if(!sortDrag||event.pointerId!==sortDrag.pointer)return;
  const drag=sortDrag;sortDrag=null;drag.ghost?.remove();drag.target?.classList.remove('sort-drop-active');
  if(!cancel&&drag.ghost&&drag.target)sortAssignPhoto(drag.id,drag.target.dataset.sortTarget);
}
document.addEventListener('pointerup',event=>finishSortDrag(event));
document.addEventListener('pointercancel',event=>finishSortDrag(event,true));
