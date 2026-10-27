/* Photos are decoded locally and embedded as portable JPEGs. */
function mergeUploadedPhotos(incoming) {
  for (const photo of incoming) {
    if (!photo?.uploaded || typeof photo.id !== 'string' || !/^photo-[a-f0-9]{64}$/.test(photo.id) || photos.some(p => p.id === photo.id)) continue;
    if (typeof photo.name !== 'string' || typeof photo.src !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.src)) throw new Error('Invalid uploaded photo');
    photos.push({id: photo.id, name: photo.name, src: photo.src, uploaded: true, addedAt: photo.addedAt});
  }
}
async function prepareUploadedPhoto(file) {
  if (!/\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name)) throw new Error('Use a JPEG, PNG, WebP, GIF, AVIF, or browser-supported HEIC photo.');
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const id = 'photo-' + [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
  if (photos.some(p => p.id === id)) return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('This browser cannot open this photo. Convert it to JPEG or PNG first.')); image.src = url; });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {id, name: file.name.replace(/\.[^.]+$/, ''), src: canvas.toDataURL('image/jpeg', .85), uploaded: true, addedAt: new Date().toISOString()};
  } finally { URL.revokeObjectURL(url); }
}
async function addPhotos(files) {
  const button = document.getElementById('addPhotos');
  button.disabled = true;
  const errors = [], added = []; let duplicates = 0;
  try {
    for (const file of files) {
      button.textContent = `Adding ${added.length + duplicates + errors.length + 1} / ${files.length}…`;
      try {
        const photo = await prepareUploadedPhoto(file);
        if (!photo) { duplicates++; continue; }
        photos.push(photo); added.push(photo);
      } catch (error) { errors.push(`${file.name}: ${error.message}`); }
    }
    if (added.length) {
      current = added[0].id; step = 0; typeIndex = 0; view = 'entry';
      document.getElementById('search').value = ''; document.getElementById('statusFilter').value = 'all';
      await persist(); render();
    }
    document.getElementById('uploadStatus').textContent = `${added.length} photo(s) added.${duplicates ? ` ${duplicates} duplicate(s) skipped.` : ''}${errors.length ? ' '+errors.join(' ') : ''}`;
  } finally { button.disabled = false; button.textContent = '+ Add photos'; document.getElementById('photoFiles').value = ''; }
}
document.addEventListener('click', event => { if (event.target.closest('#addPhotos')) document.getElementById('photoFiles').click(); });
document.addEventListener('change', event => { if (event.target.id === 'photoFiles' && event.target.files.length) addPhotos([...event.target.files]); });
