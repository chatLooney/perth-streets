/* Perth Streets independent photorealistic visual evaluation.
   Does not save keys, cache tiles, extract geometry or merge Google content into game assets. */
(()=>{
 const button=document.getElementById('load');
 const status=document.getElementById('status');
 const input=document.getElementById('key');
 let viewer=null;
 button.addEventListener('click',async()=>{
  const key=input.value.trim();
  if(!key){status.textContent='Enter a Google Maps Platform key first.';return}
  if(typeof Cesium==='undefined'){status.textContent='CesiumJS did not load. Check your internet connection.';return}
  button.disabled=true;status.textContent='Connecting to Google 3D Tiles…';
  try{
   // Only the tile service receives the key; it is never written to GitHub or local storage.
   Cesium.GoogleMaps.defaultApiKey=key;
   if(viewer){viewer.destroy();viewer=null}
   viewer=new Cesium.Viewer('view',{
    globe:false,baseLayerPicker:false,animation:false,timeline:false,
    homeButton:false,infoBox:false,selectionIndicator:false,
    geocoder:Cesium.IonGeocodeProviderType.GOOGLE,
    sceneModePicker:false,shouldAnimate:false
   });
   const tileset=await Cesium.createGooglePhotorealistic3DTileset(
    {key,onlyUsingWithGoogleGeocoder:true},
    {showCreditsOnScreen:true,maximumScreenSpaceError:16}
   );
   viewer.scene.primitives.add(tileset);
   viewer.scene.globe.show=false;
   viewer.camera.flyTo({
    destination:Cesium.Cartesian3.fromDegrees(115.8613,-31.9531,850),
    orientation:{heading:Cesium.Math.toRadians(18),pitch:Cesium.Math.toRadians(-45),roll:0},
    duration:1.6
   });
   input.value=''; // remove key from form after initialization
   status.textContent='3D tiles requested. Explore Perth with mouse drag, wheel and Ctrl+drag. Confirm imagery quality visually.';
  }catch(err){
   status.textContent='Could not load Google 3D tiles: '+(err?.message||String(err))+'\nCheck billing, Map Tiles API permissions, browser console, and API key restrictions.';
   console.error('Perth 3D test error',err);
  }finally{button.disabled=false}
 });
})();