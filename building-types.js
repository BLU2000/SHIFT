/* A reusable numeric building-type tag, separate from facade-type descriptions. */
function buildingTypeGroups(){
  const groups=new Map();
  for(const photo of photos){const value=Number(records[photo.id]?.buildingType);if(!Number.isSafeInteger(value)||value<1)continue;if(!groups.has(value))groups.set(value,[]);groups.get(value).push(photo);}
  return [...groups].sort((a,b)=>a[0]-b[0]);
}
function nextBuildingType(){return Math.max(0,...Object.values(records).map(r=>Number.isSafeInteger(r.buildingType)&&r.buildingType>0?r.buildingType:0))+1;}
