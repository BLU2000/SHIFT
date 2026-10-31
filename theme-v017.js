// Theme is part of saved collection settings and browser autosave.
function applyCollectionTheme(theme){
 const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';
 const button=document.getElementById('themeToggle');if(button){button.textContent=dark?'Light mode':'Dark mode';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');}
}
const themeOriginalRestore=restoreAnalysisSettings;
restoreAnalysisSettings=function(value){themeOriginalRestore(value);if(value?.theme==='dark'||value?.theme==='light')analysisSettings.theme=value.theme;applyCollectionTheme(analysisSettings.theme);};
if(!document.getElementById('themeToggle')){const button=document.createElement('button');button.id='themeToggle';button.type='button';document.getElementById('saveHtml').before(button);}
restoreAnalysisSettings(embedded.analysisSettings);
document.getElementById('themeToggle').addEventListener('click',()=>{analysisSettings.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyCollectionTheme(analysisSettings.theme);persist();});
