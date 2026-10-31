/* Exact rectangle union areas in normalized crop coordinates; no raster rounding. */
window.WWRRectangles={
 valid(box){return Array.isArray(box)&&box.length===4&&box.every(Number.isFinite)&&box[0]>=0&&box[1]>=0&&box[2]<=1&&box[3]<=1&&box[2]>box[0]&&box[3]>box[1];},
 measure(facade,windows){
  if(!this.valid(facade)||!Array.isArray(windows)||windows.some(w=>!this.valid(w.box)))throw Error('Invalid facade or window rectangle.');
  const clipped=windows.map(w=>[Math.max(facade[0],w.box[0]),Math.max(facade[1],w.box[1]),Math.min(facade[2],w.box[2]),Math.min(facade[3],w.box[3])]).filter(b=>b[2]>b[0]&&b[3]>b[1]);
  const xs=[...new Set(clipped.flatMap(b=>[b[0],b[2]]))].sort((a,b)=>a-b);let area=0;
  for(let i=1;i<xs.length;i++){const intervals=clipped.filter(b=>b[0]<xs[i]&&b[2]>xs[i-1]).map(b=>[b[1],b[3]]).sort((a,b)=>a[0]-b[0]);let length=0,end=-Infinity;for(const [a,b]of intervals){length+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}area+=(xs[i]-xs[i-1])*length;}
  const facadeArea=(facade[2]-facade[0])*(facade[3]-facade[1]);return {window_area:area,facade_area:facadeArea,wwr_percent:Math.min(100,100*area/facadeArea)};
 }
};
