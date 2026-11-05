const fs=require('node:fs');
const path=require('node:path');
const root=__dirname;
const css=fs.readFileSync(path.join(root,'facade-clustering.css'),'utf8');
const core=fs.readFileSync(path.join(root,'facade-clustering-core.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'facade-clustering.js'),'utf8');
const threshold=fs.readFileSync(path.join(root,'facade-threshold.js'),'utf8');
const land=fs.readFileSync(path.join(root,'facade-combination-land.js'),'utf8');
const leaflet=fs.readFileSync(path.join(root,'vendor/leaflet/leaflet.js'),'utf8');
const leafletCSS=fs.readFileSync(path.join(root,'vendor/leaflet/leaflet.css'),'utf8');
const mapAdapter=fs.readFileSync(path.join(root,'vendor/leaflet/leaflet-maplibre-gl.js'),'utf8');
const combinations=fs.readFileSync(path.join(root,'facade-combinations.js'),'utf8');
const categoryCoverage=fs.readFileSync(path.join(root,'category-coverage.js'),'utf8');
const areaShare=fs.readFileSync(path.join(root,'facade-area-share.js'),'utf8');
for(const file of ['index.html','Facade-ID.html','Facade ID/Facade-ID_Main.html']){
 const target=path.join(root,file);if(!fs.existsSync(target))continue;
 let html=fs.readFileSync(target,'utf8');
 html=html.replace(/\n?<!-- facade-clustering:start -->[\s\S]*?<!-- facade-clustering:end -->\n?/g,'\n');
 let block=file==='index.html'
  ? '<link data-facade-clustering-style rel="stylesheet" href="facade-clustering.css">\n<script data-facade-clustering-core src="facade-clustering-core.js"></script>\n<script data-facade-threshold src="facade-threshold.js"></script>\n<script data-facade-clustering src="facade-clustering.js"></script>'
  : `<style data-facade-clustering-style>${css}</style>\n<script data-facade-clustering-core>${core}</script>\n<script data-facade-threshold>${threshold}</script>\n<script data-facade-clustering>${ui}</script>`;
 block=(file==='index.html'?'<link data-combination-leaflet-style rel="stylesheet" href="vendor/leaflet/leaflet.css">\n<script data-combination-leaflet src="vendor/leaflet/leaflet.js"></script>\n':`<style data-combination-leaflet-style>${leafletCSS}</style>\n<script data-combination-leaflet>${leaflet}</script>\n`)+block;
 block+=file==='index.html'?'\n<script data-combination-map-adapter src="vendor/leaflet/leaflet-maplibre-gl.js"></script>':`\n<script data-combination-map-adapter>${mapAdapter}</script>`;
 block+=file==='index.html'?'\n<script data-facade-combination-land src="facade-combination-land.js"></script>':`\n<script data-facade-combination-land>${land}</script>`;
 block+=file==='index.html'?'\n<script data-facade-combinations src="facade-combinations.js"></script>':`\n<script data-facade-combinations>${combinations}</script>`;
 block+=file==='index.html'?'\n<script data-category-coverage src="category-coverage.js"></script>':`\n<script data-category-coverage>${categoryCoverage}</script>`;
 block+=file==='index.html'?'\n<script data-facade-area-share src="facade-area-share.js"></script>':`\n<script data-facade-area-share>${areaShare}</script>`;
 if(!html.includes('</body>'))throw Error('No body end in '+file);
 html=html.replace('</body>',`<!-- facade-clustering:start -->\n${block}\n<!-- facade-clustering:end -->\n</body>`);
 fs.writeFileSync(target,html);console.log('Updated '+file);
}
