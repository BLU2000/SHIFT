// Building families are independent of facade-feature tags. Category 2 merges into 1.
const buildingCategoryVersion='postwar-merge-20261030';
const buildingCategoryNames={1:'Postwar Buildings',3:'Altbauten',4:'Contemp.',5:'Modern',6:'TBS'};
function migrateBuildingCategories(){let changed=false;if(analysisSettings.buildingCategoryVersion!==buildingCategoryVersion){analysisSettings.priorityLabels??={};for(const [n,name]of Object.entries(buildingCategoryNames))analysisSettings.priorityLabels['group:'+n]=name;delete analysisSettings.priorityLabels['group:2'];analysisSettings.buildingCategoryVersion=buildingCategoryVersion;changed=true;}for(const r of [...Object.values(records),...conflicts.map(c=>c.incoming)])if(r&&Number(r.buildingType)===2){r.buildingType=1;changed=true;}for(const rule of analysisFilters.rules||[])if(rule.key==='record.buildingType'&&rule.value==='2'){rule.value='1';changed=true;}if(typeof bulkCategory!=='undefined'&&bulkCategory==='2')bulkCategory='1';if(typeof polygonField!=='undefined'&&polygonField==='record.buildingType'&&polygonValue==='2')polygonValue='1';return changed;}
const categoriesOriginalRestore=restoreAnalysisSettings;
restoreAnalysisSettings=function(value){categoriesOriginalRestore(value);analysisSettings.buildingCategoryVersion=value?.buildingCategoryVersion||null;};
restoreAnalysisSettings(embedded.analysisSettings);
const categoriesOriginalRender=render;
render=function(){const changed=migrateBuildingCategories();categoriesOriginalRender();if(changed)persist();};
const categoriesOriginalMerge=mergeData;
mergeData=function(data){const normalized={...data,records:data?.records&&Object.fromEntries(Object.entries(data.records).map(([id,r])=>[id,r&&Number(r.buildingType)===2?{...r,buildingType:1}:r]))};return categoriesOriginalMerge(normalized);};
const categoriesOriginalNext=nextBuildingType;nextBuildingType=function(){const next=categoriesOriginalNext();return next===2?3:next;};
