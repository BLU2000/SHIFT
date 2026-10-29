/* Collection deletions never remove the original files from disk. */
let deletedPhotoIds=new Set(),lastDeletedPhoto=null;
function restoreDeletedPhotos(ids){if(Array.isArray(ids))ids.filter(id=>typeof id==='string').forEach(id=>deletedPhotoIds.add(id));}
function applyPhotoDeletions(){
  photos=photos.filter(p=>!deletedPhotoIds.has(p.id));
  for(const id of deletedPhotoIds)delete records[id];
  conflicts=conflicts.filter(c=>!deletedPhotoIds.has(c.id));
  if(!photos.some(p=>p.id===current)){current=photos[0]?.id;step=0;typeIndex=0;}
}
async function deleteCurrentPhoto(){
  const photo=photos.find(p=>p.id===current);if(!photo)return;
  if(!window.confirm(`Delete ${photo.name} from this collection?\n\nThis also removes its saved answers. The original image file on disk is kept. You can undo this deletion until you reload or close the app.`))return;
  lastDeletedPhoto={photo,index:photos.indexOf(photo),record:records[photo.id],conflicts:conflicts.filter(c=>c.id===photo.id)};
  const next=photos[lastDeletedPhoto.index+1]||photos[lastDeletedPhoto.index-1];
  deletedPhotoIds.add(photo.id);applyPhotoDeletions();current=next?.id;step=0;typeIndex=0;view='entry';
  document.getElementById('undoPhotoDelete').hidden=false;
  await persist();render();
}
async function undoPhotoDelete(){
  if(!lastDeletedPhoto)return;
  const item=lastDeletedPhoto;deletedPhotoIds.delete(item.photo.id);
  photos.splice(Math.min(item.index,photos.length),0,item.photo);
  if(item.record)records[item.photo.id]=item.record;
  conflicts.push(...item.conflicts);current=item.photo.id;step=0;typeIndex=0;view='entry';lastDeletedPhoto=null;
  document.getElementById('undoPhotoDelete').hidden=true;
  await persist();render();
}
document.addEventListener('click',event=>{
  if(event.target.closest('#deletePhoto'))deleteCurrentPhoto();
  if(event.target.closest('#undoPhotoDelete'))undoPhotoDelete();
});
