import * as THREE from 'three';
const status=document.getElementById('status'),speedLabel=document.getElementById('speed');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9ebed1);scene.fog=new THREE.Fog(0x9ebed1,650,1800);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(67,innerWidth/innerHeight,0.2,3200);
scene.add(new THREE.HemisphereLight(0xddefff,0x5e625a,2.0));const sun=new THREE.DirectionalLight(0xffefcf,2.2);sun.position.set(-220,500,300);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-650;sun.shadow.camera.right=650;sun.shadow.camera.top=650;sun.shadow.camera.bottom=-650;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshStandardMaterial({color:0x798b79,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const roadMat=new THREE.MeshStandardMaterial({color:0x28313a,roughness:1,side:THREE.DoubleSide}),sidewalkMat=new THREE.MeshStandardMaterial({color:0xb5b4aa,roughness:1,side:THREE.DoubleSide}),lineMat=new THREE.MeshBasicMaterial({color:0xe9dfbc,side:THREE.DoubleSide}),waterMat=new THREE.MeshStandardMaterial({color:0x3e91b0,roughness:0.35}),parkMat=new THREE.MeshStandardMaterial({color:0x5d9560}),buildingMats=[0x9dacae,0xd1c6b6,0x8396a5,0xb8b9b3,0xa69e91,0x788a98].map(color=>new THREE.MeshStandardMaterial({color,roughness:0.9}));
// Perth CBD / Northbridge bounding box; coordinates are geographic, not an invented street layout.
const bbox={south:-31.959,north:-31.946,west:115.853,east:115.866};const origin={lat:-31.9525,lon:115.8605};const R=6378137,cos=Math.cos(origin.lat*Math.PI/180);
function xy(lat,lon){return new THREE.Vector2((lon-origin.lon)*Math.PI/180*R*cos,-(lat-origin.lat)*Math.PI/180*R)}
function makeRibbon(points,width,material,y=0.05){if(points.length<2)return;const v=[],ind=[];for(let i=0;i<points.length;i++){const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];let dx=next.x-prev.x,dz=next.y-prev.y,l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;v.push(p.x-dz*width/2,y,p.y+dx*width/2,p.x+dz*width/2,y,p.y-dx*width/2);if(i){let k=2*i;ind.push(k-2,k-1,k,k-1,k+1,k)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ind);g.computeVertexNormals();scene.add(new THREE.Mesh(g,material))}

const roads=[],roadNames=[],buildings=[];let worldLoaded=false;
function roadDecorations(pts,width,highway){
 makeRibbon(pts,width+5,sidewalkMat,0.11);
 makeRibbon(pts,width,roadMat,0.15);
 if(['residential','living_street','unclassified'].includes(highway))return;
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],length=a.distanceTo(b);if(length<6)continue;
  const direction=new THREE.Vector2().subVectors(b,a).normalize();
  for(let d=5;d<length-3;d+=13){
   const from=new THREE.Vector2().copy(a).addScaledVector(direction,d);
   const to=new THREE.Vector2().copy(a).addScaledVector(direction,Math.min(d+5,length-1));
   makeRibbon([from,to],0.18,lineMat,0.19);
  }
 }
}
function nearestStreet(originPoint){
 let found=null,dist2=Infinity;
 for(const pts of roads)for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],vec=new THREE.Vector2().subVectors(b,a),l2=vec.lengthSq();
  if(l2<0.01)continue;
  const t=THREE.MathUtils.clamp(new THREE.Vector2().subVectors(originPoint,a).dot(vec)/l2,0,1);
  const pt=new THREE.Vector2().copy(a).addScaledVector(vec,t);
  const d=pt.distanceToSquared(originPoint);
  const direction=Math.atan2(-vec.x,-vec.y);if(d<dist2&&!blocked(pt.x,pt.y,0,true,direction)){dist2=d;found={position:pt,angle:direction}}
 }
 return found;
}
function positionAtStreet(){
 const near=nearestStreet(spawn);
 if(!near)return;
 car.position.set(near.position.x,0,near.position.y);car.rotation.y=near.angle;
 heading=near.angle;
 const px=car.position.x+Math.cos(heading)*4.5,pz=car.position.z-Math.sin(heading)*4.5;
 player.position.set(blocked(px,pz)?car.position.x+6:px,0,blocked(px,pz)?car.position.z:pz);
 yaw=heading;
}


const facadeBuckets=Array.from({length:5},()=>({positions:[],uvs:[],indices:[]}));
const roofEdgeVertices=[];
const facadePalettes=[
 {wall:'#aeb6b7',frame:'#d8e0df',glass:'#31536d',glassLit:'#7698ab'},
 {wall:'#b4a69a',frame:'#dfd5ca',glass:'#314353',glassLit:'#8b9caa'},
 {wall:'#8b9b9e',frame:'#c6d0d0',glass:'#27435c',glassLit:'#7194a1'},
 {wall:'#d2c0a9',frame:'#eee2ce',glass:'#435766',glassLit:'#9eacaa'},
 {wall:'#8e847c',frame:'#c4b9ad',glass:'#263d51',glassLit:'#788fa2'}
];
function facadeTexture(style){
 const palette=facadePalettes[style];
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const c=canvas.getContext('2d');c.fillStyle=palette.wall;c.fillRect(0,0,128,128);
 // A single repeatable floor + window bay. Fully original procedural pattern.
 c.fillStyle=palette.frame;c.fillRect(13,13,102,94);
 c.fillStyle=palette.glass;c.fillRect(19,19,90,82);
 c.fillStyle=palette.glassLit;c.globalAlpha=.45;c.fillRect(20,20,43,78);c.globalAlpha=1;
 c.fillStyle='#e3f2f3';c.globalAlpha=.26;c.fillRect(21,21,12,76);c.globalAlpha=1;
 c.fillStyle=palette.frame;c.fillRect(62,14,5,94);
 c.fillStyle='#3f4b50';c.globalAlpha=.28;c.fillRect(0,112,128,5);c.globalAlpha=1;
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 return texture;
}
const facadeMaterials=facadePalettes.map((_,i)=>new THREE.MeshStandardMaterial({
 map:facadeTexture(i),roughness:.78,metalness:.08,side:THREE.DoubleSide
}));
function addWallToBatch(a,b,height,style,orientation,base=0){
 const dx=b.x-a.x,dz=b.y-a.y,len=Math.hypot(dx,dz);
 if(len<.6)return;
 // Winding gives the outward normal, moving the finish slightly beyond
 // the simple extruded collision shell to avoid z-fighting.
 const sign=orientation>0?1:-1,ox=sign*dz/len*.09,oz=-sign*dx/len*.09;
 const bucket=facadeBuckets[style],index=bucket.positions.length/3;
 bucket.positions.push(a.x+ox,base+.12,a.y+oz,b.x+ox,base+.12,b.y+oz,b.x+ox,height+.12,b.y+oz,a.x+ox,height+.12,a.y+oz);
 bucket.uvs.push(0,0,len/4,0,len/4,(height-base)/3.5,0,(height-base)/3.5);
 bucket.indices.push(index,index+1,index+2,index,index+2,index+3);
}
function finalizeFacades(){
 if(roofEdgeVertices.length){const edges=new THREE.BufferGeometry();edges.setAttribute('position',new THREE.Float32BufferAttribute(roofEdgeVertices,3));scene.add(new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:0xd6d9d5,transparent:true,opacity:.55})));}
 for(let i=0;i<facadeBuckets.length;i++){
  const batch=facadeBuckets[i];if(!batch.indices.length)continue;
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
  geo.setIndex(batch.indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,facadeMaterials[i]);
  mesh.receiveShadow=true;scene.add(mesh);
 }
}
// On-map landmark directory: only uses names/coordinates present in the OSM snapshot.
const discoveredLandmarks=[];
const landmarkPanel=document.createElement('section');
landmarkPanel.style.cssText='position:absolute;top:125px;right:18px;background:#101c29e8;border:1px solid #9bc8e866;border-radius:10px;padding:12px;width:245px;color:#fff;font:13px system-ui;z-index:2';
const landmarkTitle=document.createElement('div');landmarkTitle.textContent='PERTH BUILDING EXPLORER';landmarkTitle.style.cssText='font-weight:800;font-size:12px;letter-spacing:1px;margin-bottom:8px';
const landmarkSelect=document.createElement('select');landmarkSelect.style.cssText='width:100%;padding:8px;background:#1b3040;color:#fff;border:1px solid #6e95ae;border-radius:5px';
landmarkSelect.setAttribute('aria-label','Choose a named Perth building');
const introOption=document.createElement('option');introOption.value='';introOption.textContent='Choose mapped landmark…';landmarkSelect.append(introOption);
const landmarkButton=document.createElement('button');landmarkButton.textContent='VISIT BUILDING';landmarkButton.style.cssText='margin-top:8px;width:100%;padding:9px;font-size:12px;border-radius:5px;cursor:pointer';
const landmarkStatus=document.createElement('div');landmarkStatus.style.cssText='margin-top:6px;color:#b2c8d8;font-size:11px';landmarkStatus.textContent='Only buildings named in OpenStreetMap';
landmarkPanel.append(landmarkTitle,landmarkSelect,landmarkButton,landmarkStatus);document.body.append(landmarkPanel);
function registerLandmark(tags,outline,height){
 const name=(tags.name||'').trim();if(!name||name.length>70||discoveredLandmarks.some(b=>b.name===name))return;
 const point=new THREE.Vector2();
 for(const v of outline)point.add(v);
 point.multiplyScalar(1/outline.length);
 discoveredLandmarks.push({name,point,height,osmId:tags['ref']||null});
}
function setupLandmarkExplorer(){
 const items=discoveredLandmarks.sort((a,b)=>a.name.localeCompare(b.name)).slice(0,120);
 for(let index=0;index<items.length;index++){
  const opt=document.createElement('option');opt.value=String(index);opt.textContent=items[index].name;landmarkSelect.append(opt);
 }
 landmarkStatus.textContent=items.length+' named mapped buildings · approximate 3D appearance';
 landmarkButton.onclick=()=>{
  const index=Number(landmarkSelect.value);
  if(landmarkSelect.value===''||!items[index])return;
  const target=items[index],candidate=nearestStreet(target.point);
  if(!candidate){landmarkStatus.textContent='No nearby mapped road found';return}
  // Stop the car and place the player safely in the neighbourhood, not inside a building.
  driving=false;velocity=0;player.visible=true;
  const p=candidate.position.clone();
  const step=new THREE.Vector2(-Math.sin(candidate.angle),-Math.cos(candidate.angle));
  let selected=null;
  for(const side of [0,4,-4,7,-7,10,-10]){
   const trial=p.clone().addScaledVector(new THREE.Vector2(-step.y,step.x),side);
   if(!blocked(trial.x,trial.y,.8)){selected=trial;break}
  }
  if(!selected){landmarkStatus.textContent='Could not find safe walking location';return}
  player.position.set(selected.x,0,selected.y);
  car.position.set(p.x,0,p.y);car.rotation.y=candidate.angle;heading=candidate.angle;yaw=heading;
  landmarkStatus.textContent='Viewing neighbourhood: '+target.name;
 };
}

// Map-source building tags take precedence over the approximate visual style.
const namedBuildingMarkers=[];
function osmColor(raw){
 if(!raw)return null;
 const named={brick:'#a96b50',concrete:'#aaa9a3',glass:'#4f7f90',steel:'#75858c',stone:'#b1a594',sandstone:'#c6a77b',metal:'#85949c',white:'#dedbd4',grey:'#999e9e',gray:'#999e9e',brown:'#896950',red:'#a85d4e',cream:'#d8c7a7'};
 const v=String(raw).trim().toLowerCase();
 if(named[v])return named[v];
 if(/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v))return v;
 return null;
}
const customWallMaterials=new Map();
function wallMaterialForOSM(tags){
 const color=osmColor(tags['building:colour']||tags['building:color']||tags['building:material']);
 if(!color)return null;
 if(!customWallMaterials.has(color))customWallMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:.79,side:THREE.DoubleSide}));
 return customWallMaterials.get(color);
}
function makeBuildingLabel(name,point,height){
 if(namedBuildingMarkers.length>=26||!name||name.length>54)return;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const c=canvas.getContext('2d');c.fillStyle='#0b1d28db';c.fillRect(0,0,512,96);
 c.strokeStyle='#a5dbf2';c.lineWidth=3;c.strokeRect(2,2,508,92);
 c.font='bold 29px Arial';c.fillStyle='white';c.textAlign='center';c.fillText(name,256,59,485);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
 sprite.scale.set(25,4.7,1);sprite.position.set(point.x,Math.min(height+9,115),point.y);scene.add(sprite);
 namedBuildingMarkers.push(sprite);
}

// Roof geometry is only applied when the source explicitly contains roof:shape.
// Unsupported shapes retain the mapped footprint with a flat placeholder roof.
const roofStats={tagged:0,modelled:0};
const roofMaterials=new Map();
function roofMaterial(tags,style){
 const color=osmColor(tags['roof:colour']||tags['roof:color']||tags['roof:material']);
 if(!color)return buildingMats[style];
 if(!roofMaterials.has(color))roofMaterials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82,side:THREE.DoubleSide}));
 return roofMaterials.get(color);
}
function buildRoof(outline,totalHeight,tags,style){
 const shape=(tags['roof:shape']||'').toLowerCase();
 if(!shape||shape==='flat')return false;
 roofStats.tagged++;
 const rawHeight=parseFloat(tags['roof:height']);
 const roofHeight=Number.isFinite(rawHeight)&&rawHeight>0?Math.min(rawHeight,totalHeight*.65):Math.min(3,totalHeight*.35);
 if(roofHeight<.5)return false;
 const eave=totalHeight-roofHeight;
 if(shape==='pyramidal'){
  const center=outline.reduce((p,v)=>p.add(v),new THREE.Vector2()).multiplyScalar(1/outline.length);
  const coords=[];
  for(let i=0;i<outline.length;i++){
   const a=outline[i],b=outline[(i+1)%outline.length];
   coords.push(a.x,eave+.12,a.y,b.x,eave+.12,b.y,center.x,totalHeight+.12,center.y);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,roofMaterial(tags,style));mesh.receiveShadow=true;scene.add(mesh);
  roofStats.modelled++;return true;
 }
 if(shape==='gabled' && outline.length===4){
  // Approximate gable aligned to the longer pair of mapped rectangle edges.
  const a=outline[0],b=outline[1],c=outline[2],d=outline[3];
  const ab=a.distanceTo(b),bc=b.distanceTo(c);
  const first=ab>=bc?[a,b,c,d]:[b,c,d,a];
  const [p0,p1,p2,p3]=first;
  const midA=new THREE.Vector2().addVectors(p0,p3).multiplyScalar(.5);
  const midB=new THREE.Vector2().addVectors(p1,p2).multiplyScalar(.5);
  const v=(points)=>points.flatMap(p=>[p.x,p.h,p.y]);
  const a0={x:p0.x,y:p0.y,h:eave+.12},a1={x:p1.x,y:p1.y,h:eave+.12};
  const a2={x:p2.x,y:p2.y,h:eave+.12},a3={x:p3.x,y:p3.y,h:eave+.12};
  const ra={x:midA.x,y:midA.y,h:totalHeight+.12},rb={x:midB.x,y:midB.y,h:totalHeight+.12};
  const coords=v([a0,a1,rb,a0,rb,ra,a3,ra,rb,a3,rb,a2]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  geo.computeVertexNormals();const roof=new THREE.Mesh(geo,roofMaterial(tags,style));roof.receiveShadow=true;scene.add(roof);
  roofStats.modelled++;return true;
 }
 return false;
}

function registerBuildingCollision(outline){
 const minX=Math.min(...outline.map(p=>p.x)),maxX=Math.max(...outline.map(p=>p.x));
 const minZ=Math.min(...outline.map(p=>p.y)),maxZ=Math.max(...outline.map(p=>p.y));
 buildings.push({minX,maxX,minZ,maxZ,outline});
}
function createBuilding(points,height,tags={},base=0,renderVisible=true,collision=true){

 if(points.length<3)return;
 const outline=points.slice();
 if(outline[0].distanceTo(outline.at(-1))<.1)outline.pop();
 if(outline.length<3)return;
 if(!renderVisible){registerBuildingCollision(outline);return}
 const style=Math.abs(Math.floor(outline[0].x*7+outline[0].y*11))%facadePalettes.length;
 const shape=new THREE.Shape();shape.moveTo(outline[0].x,-outline[0].y);
 for(let i=1;i<outline.length;i++)shape.lineTo(outline[i].x,-outline[i].y);
 shape.closePath();
 const roofShape=(tags['roof:shape']||'').toLowerCase();const roofRise=(!roofShape||roofShape==='flat')?0:(Number.isFinite(parseFloat(tags['roof:height']))?Math.min(parseFloat(tags['roof:height']),height*.65):Math.min(3,height*.35));
 const wallHeight=(roofShape==='pyramidal'||(roofShape==='gabled'&&outline.length===4))?height-Math.max(0,roofRise):height;
 const geom=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.5,wallHeight-base),bevelEnabled:false,curveSegments:1});
 geom.rotateX(-Math.PI/2);
 const explicitWall=wallMaterialForOSM(tags);const mesh=new THREE.Mesh(geom,explicitWall||buildingMats[style]);
 mesh.position.y=base+.12;mesh.receiveShadow=true;mesh.castShadow=height<90;scene.add(mesh);
 let winding=0;
 for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];winding+=a.x*b.y-b.x*a.y}
 for(let i=0;i<outline.length;i++){
 const a=outline[i],b=outline[(i+1)%outline.length];
 // Generic windows remain a clearly approximate visual treatment.
 // Tagged colours are respected instead of covering them with arbitrary textures.
 if(!explicitWall)addWallToBatch(a,b,wallHeight,style,winding,base);
 roofEdgeVertices.push(a.x,wallHeight+.14,a.y,b.x,wallHeight+.14,b.y);
}
buildRoof(outline,height,tags,style);
 if(tags.name){registerLandmark(tags,outline,height);const centroid=new THREE.Vector2(outline.reduce((v,p)=>v+p.x,0)/outline.length,outline.reduce((v,p)=>v+p.y,0)/outline.length);makeBuildingLabel(tags.name,centroid,height)}
 if(collision)registerBuildingCollision(outline);
}

function fallback(){// Clearly synthetic fallback when live map service is unavailable.
 for(let x=-1050;x<=1050;x+=135){roads.push([new THREE.Vector2(x,-1200),new THREE.Vector2(x,1200)]);makeRibbon(roads.at(-1),17,roadMat)}for(let z=-1200;z<=1200;z+=130){roads.push([new THREE.Vector2(-1100,z),new THREE.Vector2(1100,z)]);makeRibbon(roads.at(-1),17,roadMat)}for(let x=-1050;x<1000;x+=135)for(let z=-1200;z<1100;z+=130){if(Math.abs(x)<160&&Math.abs(z)<170)continue;const h=14+Math.random()*70;createBuilding([new THREE.Vector2(x+24,z+24),new THREE.Vector2(x+98,z+24),new THREE.Vector2(x+98,z+88),new THREE.Vector2(x+24,z+88)],h)}status.innerHTML='Offline fallback: <b>synthetic blocks</b> (not real Perth). Reload to retry OpenStreetMap.';worldLoaded=true}
async function loadOSM(){
 try {
  status.textContent='Loading cached real Perth CBD map…';
  const cached=await fetch('./data/perth-cbd.json',{cache:'no-cache'});
  if(cached.ok){const json=await cached.json();if(json.elements?.length){renderOSM(json);return}}
 }catch(error){console.warn('Static Perth map not ready:',error)}
 status.textContent='Static map not yet generated. Trying live OpenStreetMap…';
 const query=`[out:json][timeout:30];(way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});way["natural"="water"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});way["landuse"="grass"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}););out geom;`;
 const endpoints=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter','https://lz4.overpass-api.de/api/interpreter'];let data;for(const endpoint of endpoints){try{status.textContent='Loading real Perth buildings and roads (trying '+new URL(endpoint).hostname+')…';const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);const response=await fetch(endpoint,{method:'POST',body:'data='+encodeURIComponent(query),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:controller.signal});clearTimeout(timer);if(!response.ok)throw Error(response.status);data=await response.json();if(data.elements?.length)break}catch(e){console.warn('Map service:',e)}}if(!data?.elements?.length){status.innerHTML='Real Perth map unavailable. <b>No synthetic replacement loaded.</b> Please retry after the map snapshot workflow completes.';return}
 renderOSM(data)}
function renderOSM(data){
 let roadCount=0,buildingCount=0,verifiedHeightCount=0;
 const outlines=[],parts=[];
 const heightFor=tags=>{
  const taggedHeight=parseFloat(tags.height),levels=parseFloat(tags['building:levels']);
  const verified=(Number.isFinite(taggedHeight)&&taggedHeight>0)||(Number.isFinite(levels)&&levels>0);
  const height=Number.isFinite(taggedHeight)&&taggedHeight>0?taggedHeight:Number.isFinite(levels)&&levels>0?levels*3.2:14;
  return {height:THREE.MathUtils.clamp(height,3,260),verified};
 };
 for(const item of data.elements){
  if(!item.geometry?.length)continue;
  const pts=item.geometry.map(g=>xy(g.lat,g.lon)),tags=item.tags||{};
  if(tags.highway){
   if(['footway','path','steps','pedestrian','cycleway','service'].includes(tags.highway))continue;
   const width=tags.highway==='motorway'?22:tags.highway==='primary'?18:tags.highway==='secondary'?15:tags.highway==='tertiary'?13:10;
   roads.push(pts);roadNames.push(tags.name||tags.ref||null);
   roadDecorations(pts,width,tags.highway);roadCount++;
  }else if(tags['building:part']&&tags['building:part']!=='no'){
   if(pts.length>=3)parts.push({pts,tags});
  }else if(tags.building&&tags.building!=='no'){
   if(pts.length>=3)outlines.push({pts,tags});
  }
 }
 // OSM Simple 3D Buildings: a building outline provides the land footprint,
 // while its constituent building:part polygons provide the visible 3D volumes.
 // Avoid extruding the parent over the detailed tower/podium sections.
 const partPoints=parts.map(p=>{
  const outline=p.pts[0].distanceTo(p.pts.at(-1))<.1?p.pts.slice(0,-1):p.pts;
  const centroid=outline.reduce((v,q)=>v.add(q),new THREE.Vector2()).multiplyScalar(1/outline.length);
  return {centroid,...p};
 });
 let parentsWithParts=0;
 for(const {pts,tags} of outlines){
  const {height,verified}=heightFor(tags);if(verified)verifiedHeightCount++;
  const hull=pts[0].distanceTo(pts.at(-1))<.1?pts.slice(0,-1):pts;
  const hasParts=partPoints.some(p=>insidePolygon(p.centroid.x,p.centroid.y,hull));
  if(hasParts){
   parentsWithParts++;
   createBuilding(pts,height,tags,0,false,true);
   if(tags.name&&namedBuildingMarkers.length<26){
    registerLandmark(tags,hull,height);
    const centroid=hull.reduce((v,q)=>v.add(q),new THREE.Vector2()).multiplyScalar(1/hull.length);
    makeBuildingLabel(tags.name,centroid,height);
   }
  }else createBuilding(pts,height,tags);
  buildingCount++;
 }
 let sections=0;
 for(const {pts,tags} of parts){
  const {height,verified}=heightFor(tags);if(verified)verifiedHeightCount++;
  const min=Number.isFinite(parseFloat(tags.min_height))?Math.max(0,parseFloat(tags.min_height)):
    Number.isFinite(parseFloat(tags['building:min_level']))?Math.max(0,parseFloat(tags['building:min_level'])*3.2):0;
  if(min>=height)continue;
  // Parent footprints already enforce street-level collisions. Elevated pieces
  // should not create imaginary solid walls at ground level.
  createBuilding(pts,height,tags,min,true,min<1);
  sections++;
 }
 finalizeFacades();positionAtStreet();addStreetFurniture();createPedestrians();nextCheckpoint();setupLandmarkExplorer();
 status.innerHTML=`Perth CBD: <b>${roadCount} roads</b> · <b>${buildingCount} outlines</b> · <b>${sections} 3D sections</b><br>${parentsWithParts} buildings use detailed part geometry · ${verifiedHeightCount} tagged heights · ${roofStats.modelled} mapped roofs. Untagged architecture remains approximate.`;
 worldLoaded=true;
}
// Lightweight procedural street furniture, deliberately capped for desktop performance.
function addStreetFurniture(){
 const poleGeometry=new THREE.CylinderGeometry(.075,.11,6.7,6);
 const poleMaterial=new THREE.MeshStandardMaterial({color:0x626d73,metalness:0.55,roughness:0.5});
 const lampGeometry=new THREE.BoxGeometry(1.25,.24,.4);
 const lampMaterial=new THREE.MeshStandardMaterial({color:0xf3e3b5,emissive:0x4d4325,emissiveIntensity:.35});
 const trunkGeometry=new THREE.CylinderGeometry(.15,.22,3.2,6);
 const trunkMaterial=new THREE.MeshStandardMaterial({color:0x705a43});
 const leavesGeometry=new THREE.ConeGeometry(2.4,6.2,7);
 const leavesMaterial=new THREE.MeshStandardMaterial({color:0x3f7355,roughness:1});
 const poles=[],lamps=[],trunks=[],crowns=[];
 for(const points of roads){
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],len=a.distanceTo(b);
   if(len<22)continue;
   const dx=(b.x-a.x)/len,dz=(b.y-a.y)/len;
   const perpX=-dz,perpZ=dx;
   for(let distanceAlong=18;distanceAlong<len-10;distanceAlong+=75){
    for(const side of [-1,1]){
     const x=a.x+dx*distanceAlong+perpX*side*9;
     const z=a.y+dz*distanceAlong+perpZ*side*9;
     if(blocked(x,z,1.5)||Math.abs(x)>600||Math.abs(z)>750)continue;
     if(poles.length<180){poles.push([x,z]);lamps.push([x+perpX*side*.5,z+perpZ*side*.5])}
     if((Math.floor(distanceAlong/75)%2===0)&&trunks.length<150){
      const treeX=x+perpX*side*4,treeZ=z+perpZ*side*4;
      if(!blocked(treeX,treeZ,2.8)){trunks.push([treeX,treeZ]);crowns.push([treeX,treeZ])}
     }
    }
   }
  }
 }
 function instance(geometry,material,positions,y){
  const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
  const dummy=new THREE.Object3D();
  positions.forEach(([x,z],i)=>{dummy.position.set(x,y,z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});
  mesh.instanceMatrix.needsUpdate=true;
  scene.add(mesh);
 }
 instance(poleGeometry,poleMaterial,poles,3.35);
 instance(lampGeometry,lampMaterial,lamps,6.5);
 instance(trunkGeometry,trunkMaterial,trunks,1.6);
 instance(leavesGeometry,leavesMaterial,crowns,6.2);
}

// Simple ambient pedestrians and a repeatable driving checkpoint challenge.
const pedestrians=[],checkpointMaterial=new THREE.MeshBasicMaterial({color:0x00e6ff,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
const checkpoint=new THREE.Mesh(new THREE.TorusGeometry(3.2,.13,8,32),checkpointMaterial);
checkpoint.rotation.x=Math.PI/2;checkpoint.position.y=3.2;checkpoint.visible=false;scene.add(checkpoint);
let checkpointsCompleted=0,checkpointRoadIndex=0;
const challenge=document.createElement('div');challenge.style.cssText='position:absolute;right:20px;top:75px;text-align:right;font:600 14px system-ui;color:#fff;text-shadow:0 2px 5px black;pointer-events:none';challenge.textContent='Drive through the cyan checkpoint';document.body.append(challenge);
function nextCheckpoint(){
 if(!roads.length)return;
 for(let tries=0;tries<roads.length;tries++){
  checkpointRoadIndex=(checkpointRoadIndex+17)%roads.length;
  const line=roads[checkpointRoadIndex];if(line.length<2)continue;
  const a=line[0],b=line[Math.floor(line.length/2)];
  const mid=new THREE.Vector2().lerpVectors(a,b,.5);
  if(blocked(mid.x,mid.y,0,true,0))continue;
  checkpoint.position.set(mid.x,3.2,mid.y);checkpoint.visible=true;break;
 }
}
function createPedestrians(){
 const palette=[0x345a84,0x985e48,0x6b758a,0x5c7c68,0x998344];
 const peopleGeometry=new THREE.CapsuleGeometry(.28,.95,3,6);
 for(let k=0;k<24;k++){
  const route=roads[(k*19+3)%roads.length];if(!route||route.length<2)continue;
  const a=route[0],b=route[route.length-1];const length=a.distanceTo(b);if(length<25)continue;
  const direction=new THREE.Vector2().subVectors(b,a).normalize();
  const side=k%2?1:-1;
  const offset=new THREE.Vector2(-direction.y*side*7,direction.x*side*7);
  const npc=new THREE.Mesh(peopleGeometry,new THREE.MeshStandardMaterial({color:palette[k%palette.length]}));
  npc.position.set(a.x+offset.x,1.05,a.y+offset.y);
  if(blocked(npc.position.x,npc.position.z,1))continue;
  scene.add(npc);pedestrians.push({npc,a,b,offset,progress:(k%5)/5,direction:k%3?1:-1,length,speed:0.65+(k%4)*.22});
 }
}
function animateWorld(dt,now){
 checkpoint.rotation.z+=dt*.45;
 checkpoint.position.y=3.2+Math.sin(now*.002)*.3;
 if(driving&&checkpoint.visible&&car.position.distanceTo(new THREE.Vector3(checkpoint.position.x,0,checkpoint.position.z))<7){
  checkpointsCompleted++;challenge.textContent='Checkpoints: '+checkpointsCompleted+' · Continue driving';
  nextCheckpoint();
 }
 for(const p of pedestrians){
  p.progress+=p.direction*dt*p.speed/p.length;
  if(p.progress>1){p.progress=1;p.direction=-1}
  if(p.progress<0){p.progress=0;p.direction=1}
  const pos=new THREE.Vector2().lerpVectors(p.a,p.b,p.progress).add(p.offset);
  p.npc.position.set(pos.x,1.05+Math.sin(now*.007+p.progress*8)*.035,pos.y);
  p.npc.rotation.y=Math.atan2(-p.direction*(p.b.x-p.a.x),-p.direction*(p.b.y-p.a.y));
 }
}

// Original low-poly character and vehicle models.
const player=new THREE.Group();const torso=new THREE.Mesh(new THREE.CapsuleGeometry(0.42,1.1,4,8),new THREE.MeshStandardMaterial({color:0x214e80}));torso.position.y=1.25;player.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,10),new THREE.MeshStandardMaterial({color:0xc99474}));head.position.y=2.25;player.add(head);scene.add(player);
const car=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(2.25,0.8,4.4),new THREE.MeshStandardMaterial({color:0xd64035,metalness:0.4,roughness:0.4}));body.position.y=0.85;body.castShadow=true;car.add(body);const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.7,2.1),new THREE.MeshStandardMaterial({color:0x344c61,metalness:0.25}));cabin.position.set(0,1.53,-0.2);car.add(cabin);for(const x of [-1.1,1.1])for(const z of [-1.45,1.45]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.28,12),new THREE.MeshStandardMaterial({color:0x16191c}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,0.48,z);car.add(wheel)}scene.add(car);
// Roof/windscreen details, lamps, and bumpers.
const glassMat=new THREE.MeshStandardMaterial({color:0x263b4e,metalness:.35,roughness:.22});
const frontGlass=new THREE.Mesh(new THREE.BoxGeometry(1.65,.38,.045),glassMat);
frontGlass.position.set(0,1.58,-1.28);frontGlass.rotation.x=-.45;car.add(frontGlass);
const lightWhite=new THREE.MeshStandardMaterial({color:0xfff3c6,emissive:0xffe4a1,emissiveIntensity:.6});
const lightRed=new THREE.MeshStandardMaterial({color:0xe01e18,emissive:0x7b0906,emissiveIntensity:.65});
for(const x of [-.78,.78])for(const z of [-2.22,2.22]){
 const lamp=new THREE.Mesh(new THREE.BoxGeometry(.42,.22,.07),z<0?lightWhite:lightRed);
 lamp.position.set(x,.92,z);car.add(lamp);
}
for(const z of [-2.24,2.24]){
 const bumper=new THREE.Mesh(new THREE.BoxGeometry(2.3,.17,.18),new THREE.MeshStandardMaterial({color:0x22272b,metalness:.35}));
 bumper.position.set(0,.56,z);car.add(bumper);
}

const spawn=xy(-31.9522,115.8590);player.position.set(spawn.x,0,spawn.y);car.position.set(spawn.x+9,0,spawn.y-5);let driving=false,velocity=0,heading=0,yaw=0.65,pitch=0.43,distance=15,mouseDown=false,lastX=0,lastY=0;const keys=new Set();addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='KeyE'){if(driving){driving=false;player.position.copy(car.position).add(new THREE.Vector3(3,0,0));player.visible=true;velocity=0}else if(player.position.distanceTo(car.position)<9){driving=true;player.visible=false;heading=car.rotation.y}}if(e.code==='KeyR'){driving=false;player.visible=true;player.position.set(spawn.x,0,spawn.y);car.position.set(spawn.x+9,0,spawn.y-5);if(worldLoaded)positionAtStreet();velocity=0}if(e.code==='KeyM')document.getElementById('map').hidden=!document.getElementById('map').hidden});addEventListener('keyup',e=>keys.delete(e.code));renderer.domElement.addEventListener('pointerdown',e=>{mouseDown=true;lastX=e.clientX;lastY=e.clientY});addEventListener('pointerup',()=>mouseDown=false);addEventListener('pointermove',e=>{if(!mouseDown)return;yaw-=(e.clientX-lastX)*0.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastY)*0.004,0.12,1.25);lastX=e.clientX;lastY=e.clientY});addEventListener('wheel',e=>distance=THREE.MathUtils.clamp(distance+e.deltaY*.012,6,40),{passive:true});addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
// True footprint collision rather than giant building bounding rectangles.
function insidePolygon(x,z,poly){
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a.y>z)!==(b.y>z) && x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
function distanceToSegmentSq(x,z,a,b){
 const dx=b.x-a.x,dz=b.y-a.y,lengthSq=dx*dx+dz*dz;
 const t=lengthSq>0?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.y)*dz)/lengthSq,0,1):0;
 const px=a.x+t*dx,pz=a.y+t*dz;
 return (x-px)*(x-px)+(z-pz)*(z-pz);
}
// Collision uses exact polygon footprints and the oriented car rectangle.
// Roads do NOT override building collision; overlapping OSM data remains solid.
function segmentsCross(a,b,c,d){
 const cross=(u,v)=>u.x*v.y-u.y*v.x;
 const r=new THREE.Vector2().subVectors(b,a),v=new THREE.Vector2().subVectors(d,c),den=cross(r,v);
 if(Math.abs(den)<1e-8)return false;
 const delta=new THREE.Vector2().subVectors(c,a),t=cross(delta,v)/den,u=cross(delta,r)/den;
 return t>=0&&t<=1&&u>=0&&u<=1;
}
function polygonCollision(rect,poly){
 for(const p of rect)if(insidePolygon(p.x,p.y,poly))return true;
 for(const p of poly)if(insidePolygon(p.x,p.y,rect))return true;
 for(let i=0;i<rect.length;i++)for(let j=0;j<poly.length;j++)
  if(segmentsCross(rect[i],rect[(i+1)%rect.length],poly[j],poly[(j+1)%poly.length]))return true;
 return false;
}
function carRectangle(x,z,angle){
 const forward=new THREE.Vector2(-Math.sin(angle),-Math.cos(angle));
 const right=new THREE.Vector2(Math.cos(angle),-Math.sin(angle));
 return [[-1.18,-2.32],[1.18,-2.32],[1.18,2.32],[-1.18,2.32]].map(([side,front])=>
  new THREE.Vector2(x+right.x*side+forward.x*front,z+right.y*side+forward.y*front));
}
function blocked(x,z,radius=0.7,vehicle=false,angle=heading){
 const rect=vehicle?carRectangle(x,z,angle):null;
 const reach=vehicle?2.65:radius;
 return buildings.some(b=>{
  if(x<b.minX-reach||x>b.maxX+reach||z<b.minZ-reach||z>b.maxZ+reach)return false;
  if(vehicle)return polygonCollision(rect,b.outline);
  if(insidePolygon(x,z,b.outline))return true;
  for(let i=0;i<b.outline.length;i++){
   if(distanceToSegmentSq(x,z,b.outline[i],b.outline[(i+1)%b.outline.length])<radius*radius)return true;
  }
  return false;
 });
}
function moveCarSafely(dt){
 // Swept, sub-stepped collision stops tunnelling through narrow buildings.
 const travel=velocity*dt;
 const steps=Math.max(1,Math.ceil(Math.abs(travel)/0.45));
 const sx=-Math.sin(heading)*travel/steps,sz=-Math.cos(heading)*travel/steps;
 for(let i=0;i<steps;i++){
  const nx=car.position.x+sx,nz=car.position.z+sz;
  if(blocked(nx,nz,0,true,heading)){velocity=0;return}
  car.position.set(nx,0,nz);
 }
}
const streetLabel=document.createElement('div');streetLabel.style.cssText='position:absolute;top:58px;right:18px;text-align:right;font:bold 13px system-ui;letter-spacing:.5px;text-shadow:0 2px 5px #000;pointer-events:none';streetLabel.textContent='Locating street…';document.body.append(streetLabel);
function closestStreetName(x,z){let best=Infinity,name='Unnamed road';for(let j=0;j<roads.length;j++){if(!roadNames[j])continue;const points=roads[j];for(let i=1;i<points.length;i++){const d=distanceToSegmentSq(x,z,points[i-1],points[i]);if(d<best){best=d;name=roadNames[j]}}}return best<2500?name:'Off mapped streets'}
const mini=document.getElementById('mini'),ctx=mini.getContext('2d');function drawMap(target){const w=420,scale=.16;ctx.fillStyle='#172633';ctx.fillRect(0,0,w,w);ctx.save();ctx.translate(w/2,w/2);ctx.rotate(-heading*(driving?1:0));ctx.translate(-target.x*scale,-target.z*scale);ctx.strokeStyle='#8296a1';ctx.lineWidth=2;for(const pts of roads){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));ctx.stroke()}ctx.fillStyle='#526879';for(const b of buildings)ctx.fillRect(b.minX*scale,b.minZ*scale,(b.maxX-b.minX)*scale,(b.maxZ-b.minZ)*scale);ctx.fillStyle='#ff8b74';ctx.beginPath();ctx.arc(car.position.x*scale,car.position.z*scale,5,0,7);ctx.fill();ctx.restore();ctx.fillStyle='#8cdbff';ctx.beginPath();ctx.moveTo(w/2,w/2-10);ctx.lineTo(w/2-7,w/2+9);ctx.lineTo(w/2+7,w/2+9);ctx.fill()}
let last=performance.now(),mapTimer=0;function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.05);last=now;const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),turn=(keys.has('KeyA')?1:0)-(keys.has('KeyD')?1:0);if(driving){velocity+=f*dt*(velocity*f<0?29:16);velocity*=Math.exp(-dt*(f?0.27:2.4));velocity=THREE.MathUtils.clamp(velocity,-11,30);const steerFactor=Math.min(1,Math.abs(velocity)/5);heading+=turn*dt*(0.55+Math.min(Math.abs(velocity)/25,.7))*steerFactor*Math.sign(velocity||1);if(blocked(car.position.x,car.position.z,0,true,heading)){heading-=turn*dt*(0.65+Math.min(Math.abs(velocity)/20,1))*Math.sign(velocity||1);velocity=0}else moveCarSafely(dt);car.rotation.y=heading;speedLabel.textContent=Math.round(Math.abs(velocity)*3.6)+' KM/H';}else{const move=new THREE.Vector3();if(f||turn){const angle=yaw;move.set(-Math.sin(angle)*f-Math.cos(angle)*turn,0,-Math.cos(angle)*f+Math.sin(angle)*turn).normalize();const rate=keys.has('ShiftLeft')?10:5;const nx=player.position.x+move.x*rate*dt,nz=player.position.z+move.z*rate*dt;if(!blocked(nx,nz)){player.position.x=nx;player.position.z=nz}player.rotation.y=Math.atan2(-move.x,-move.z)}speedLabel.textContent='ON FOOT';}
 const target=driving?car.position:player.position;if(driving&&!mouseDown){const delta=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw));yaw+=delta*Math.min(1,dt*1.8)}const desired=new THREE.Vector3(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+2.2+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.position.lerp(desired,Math.min(1,dt*6));camera.lookAt(target.x,target.y+1.6,target.z);if(now-mapTimer>350){drawMap(target);streetLabel.textContent=worldLoaded?closestStreetName(target.x,target.z):'Loading streets…';mapTimer=now}animateWorld(dt,now);renderer.render(scene,camera)}requestAnimationFrame(tick);
document.getElementById('start').onclick=()=>{document.getElementById('splash').remove();status.textContent='Downloading live Perth map from OpenStreetMap…';loadOSM().catch(e=>{console.error(e);status.textContent='Map load failed. Check connection or retry later.'})};