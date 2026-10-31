// The collection now uses one white, black-text design, including restored copies.
applyCollectionTheme=function(){document.documentElement.dataset.theme='light';analysisSettings.theme='light';};
const simpleDesignRestore=restoreAnalysisSettings;
restoreAnalysisSettings=function(value){simpleDesignRestore(value);applyCollectionTheme();};
applyCollectionTheme();
