// Top navigation separates tagging, the connected canvas, and the profile gallery.
let topGalleryActive=false,canvasOverviewFilters=null;
function syncTopNavigation(){document.getElementById('topTagging')?.setAttribute('aria-pressed',String(view!=='insights'));document.getElementById('topAnalysis')?.setAttribute('aria-pressed',String(view==='insights'&&!topGalleryActive));document.getElementById('topGallery')?.setAttribute('aria-pressed',String(view==='insights'&&topGalleryActive));document.body.classList.toggle('profile-gallery-view',view==='insights'&&topGalleryActive);}
const topNavigationInsights=renderInsights;
renderInsights=function(){if(topGalleryActive){analysisFilters.mode='gallery';renderFilterAnalysis();const title=document.querySelector('#main h1');if(title)title.textContent='Facade profiles';const hint=document.querySelector('#main .intro .muted');if(hint)hint.textContent='Browse all profiles or filter by their attributes.';}else topNavigationInsights();};
const topNavigationRender=render;
render=function(){topNavigationRender();syncTopNavigation();};
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||!['topTagging','topAnalysis','topGallery'].includes(button.id))return;if(document.getElementById('analysisCanvasBoard'))window.releaseCanvasModules?.();disposeOverviewMap();if(topGalleryActive){analysisSettings.galleryFilters=structuredClone(analysisFilters);if(canvasOverviewFilters)analysisFilters=canvasOverviewFilters;}topGalleryActive=button.id==='topGallery';if(topGalleryActive){canvasOverviewFilters=structuredClone(analysisFilters);analysisFilters=structuredClone(analysisSettings.galleryFilters||{search:'',rules:[],mode:'gallery',graphs:[]});}view=button.id==='topTagging'?'entry':'insights';render();persist();});
const gallerySettingsRestore=restoreAnalysisSettings;
restoreAnalysisSettings=function(value){gallerySettingsRestore(value);if(value?.galleryFilters)analysisSettings.galleryFilters=structuredClone(value.galleryFilters);};
syncTopNavigation();

const galleryNavigationPersist=persist;
persist=function(){if(topGalleryActive)analysisSettings.galleryFilters=structuredClone(analysisFilters);return galleryNavigationPersist();};
