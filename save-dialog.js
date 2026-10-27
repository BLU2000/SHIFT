/* Save revision is distinct from the answer-file schema version. */
let saveMeta = {revision: 0, initials: '', savedAt: null};
function restoreSaveMeta(value) {
  if (value && Number.isSafeInteger(value.revision) && value.revision >= saveMeta.revision)
    saveMeta = {revision: value.revision, initials: String(value.initials || ''), savedAt: value.savedAt || null};
  updateRevisionLabel();
}
function revisionLabel(n) { return 'v' + String(n).padStart(3, '0'); }
function saveFilename(initials, revision) { return `Facade-ID_${initials}_${revisionLabel(revision)}.html`; }
function updateRevisionLabel() {
  const label = document.getElementById('revisionLabel');
  if (label) label.textContent = revisionLabel(saveMeta.revision) + (saveMeta.initials ? ' · ' + saveMeta.initials : '');
}
function openSaveDialog() {
  const dialog = document.getElementById('saveDialog');
  document.getElementById('saveInitials').value = saveMeta.initials;
  updateSavePreview();
  if (!dialog.open) dialog.showModal();
  document.getElementById('saveInitials').focus();
}
function updateSavePreview() {
  const input = document.getElementById('saveInitials');
  input.setCustomValidity('');
  document.getElementById('saveFilenamePreview').textContent = saveFilename(input.value.trim().toUpperCase() || 'INITIALS', saveMeta.revision + 1);
}
document.addEventListener('input', event => {
  if (event.target.id === 'saveInitials') updateSavePreview();
});
document.addEventListener('click', event => {
  if (event.target.closest('#cancelSave')) document.getElementById('saveDialog').close();
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'saveForm') return;
  event.preventDefault();
  const input = document.getElementById('saveInitials');
  const initials = input.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(initials)) {
    input.setCustomValidity('Enter 1–12 letters or numbers, for example BU.'); input.reportValidity(); return;
  }
  document.getElementById('saveDialog').close();
  await saveHtml(initials);
});
