// Default missing storey counts; retain explicit counts and Unknown answers.
const storeysOriginalBlank=blank;
blank=function(){const r=storeysOriginalBlank();r.context.storeys='6';return r;};
const storeysOriginalRender=render;
render=function(){let changedDefaults=false;for(const r of Object.values(records)){r.context??={};if(r.context.storeys===undefined||r.context.storeys===null||r.context.storeys===''){r.context.storeys='6';changedDefaults=true;}}storeysOriginalRender();if(changedDefaults)persist();};
