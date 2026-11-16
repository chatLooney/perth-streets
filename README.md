# Perth Streets — original browser-game prototype v0.10

A desktop-browser 3D exploration prototype based on real OpenStreetMap road and building geometry for Perth CBD and Northbridge. This is an original implementation, not Brisbane Streets source code.

## Play

When GitHub Pages is enabled for the main branch's root folder, visit https://chatlooney.github.io/perth-streets/ .

To run locally, run `python -m http.server 8000` from the repository directory, then visit http://localhost:8000 in Chrome or Edge. Internet access is required for Three.js and OpenStreetMap requests.

## Photorealistic Perth 3D evaluation (separate from the game)

Visit [photorealistic.html](https://chatlooney.github.io/perth-streets/photorealistic.html) for an opt-in, view-only CesiumJS test using Google Maps Platform Photorealistic 3D Tiles.

**Requirements:** a Google Cloud account with billing enabled, Map Tiles API enabled, and a browser-restricted API key authorized for `https://chatlooney.github.io/*`. Set a **low daily root-tiles quota** in Google Cloud to reduce unexpected charges. Confirm current rates at https://developers.google.com/maps/billing-and-pricing/pricing . Google currently lists 1,000 free 3D root tileset requests per month, followed by usage-based charges.

- Input a restricted API key into the viewer page, not GitHub source code or a public chat.
- The key is held in memory and provided to Google via Cesium, with no localStorage, cookies or repository storage by this project.
- The CesiumJS loader displays required source credits on screen.
- This is **visual research only**; Google imagery, meshes and 3D geometry are not downloaded, exported, recreated or bundled in the open-source game.
- Whether Perth CBD has good textured 3D coverage requires a live test; coverage is **not yet confirmed**.
- We must verify Google platform terms before any integration into live driving gameplay; do not assume photorealistic tiles are suitable for a publicly distributed game.

References: https://developers.google.com/maps/documentation/tile/3d-tiles , https://developers.google.com/maps/documentation/tile/policies , https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/

## Controls

- WASD: walk / drive
- Shift: sprint while walking
- E: enter or exit the nearby red car
- Mouse drag: orbit camera
- Mouse wheel: zoom
- R: reset
- M: minimap

## v0.10 — full landmark search

- Removed the first-120 alphabetical selection limit that hid buildings after M.
- Added a live-search input to find any named building present in the current OpenStreetMap snapshot.
- The dropdown filters matching names while retaining stable item IDs for Visit Building.
- Names that do not exist in the current map snapshot cannot be found until that snapshot/coverage is expanded.

## v0.9 — first distinctive heritage landmark

- Original procedural **stylised** Perth Town Hall model at the OSM-mapped Town Hall footprint.
- Red-brick facade, contrasting pale bands, dark roof, clock tower and small roof turrets inspired by published heritage descriptions.
- The actual OSM footprint determines its placement. Building/tower elevations, widths and decoration are approximations, **not measured architectural geometry**.
- Reference: City of Perth Town Hall hire guide and heritage record at https://www.perth.wa.gov.au/perthtownhall and https://inherit.dplh.wa.gov.au/public/inventory/details/210dee80-f68f-427a-ad20-d2028265b650
- No third-party photo or 3D mesh is included. Clock art and geometry are generated in code.

## v0.8 — Perth building explorer

- New in-game directory of named buildings extracted from OpenStreetMap building tags.
- Select a mapped building, then choose VISIT BUILDING to move the walking character to the closest collision-free area around a mapped road.
- The selection moves the character, not the car. The minimap and nearby street label continue working.
- Landmarks are OSM locations with approximate building geometry, **not** photogrammetric or architecturally correct 3D models.
- This directory does not add arbitrary named landmarks absent from the current Perth CBD snapshot.

## v0.7 — real building sections

- The OSM snapshot generator now includes `building:part` polygons as well as building outlines and roads.
- Buildings with mapped 3D sections render their tower/podium volumes separately instead of filling the parent outline with a single generic block.
- Uses section-specific mapped heights, `min_height`, `building:min_level`, roof tags, and material tags where available.
- Preserves parent building footprints for collisions, avoiding doubled-up visible parent structures.
- Reports the number of 3D building parts successfully loaded.
- Parts exist only where OSM contributors have mapped them; photorealistic façades are still not available.

## v0.6 — roof tags and street identification

- Uses OSM roof:shape and roof:height when available for rectangular gabled roofs and pyramidal roofs, without assigning random roof shapes.
- Displays the closest named OSM road while walking or driving.
- Retains OSM-coloured façades, explicitly tagged heights and real mapped building footprints.
- Geometry still represents approximations, not exact photoscanned or textured Perth buildings.
- Next step for true visual fidelity: obtain licensed textured meshes or independently model and texture individual landmarks using suitable source material.

## v0.5 — improving building data fidelity

- OSM-tagged building colours and materials now take precedence over decorative generic textures.
- OSM `height` and `building:levels` are used when available; untagged building heights use a consistent, explicit 14-metre placeholder.
- Named buildings can show OSM-derived labels.
- The in-game HUD reports how many buildings had height/level tags.
- **Not photorealistic:** building façades, most roof shapes and numerous heights remain approximate. Do not treat this as an accurate architectural model.

### Real architectural data and licence constraints

- City of Perth 3D City Model: https://www.perth.wa.gov.au/building-and-planning/planning-and-building-applications/3d-perth
- The city's Level 1 grey 3D model is offered under an agreement for development application purposes, not automatically for redistribution in a public game: https://perth.wa.gov.au/-/media/Project/COP/COP/COP/Documents-and-Forms/Develop/Documents/Development-Applications/3D-Digital-Model.pdf
- Landgate Perth metro LiDAR: https://catalogue.data.wa.gov.au/dataset/perth-metro-lidar-data — custom licence; do not add raw or derivative content until reuse is confirmed.
- Commercial licensed photogrammetry may provide textured 3D tiles; an asset licence must explicitly permit public online gaming.

Next: obtain explicitly redistributable height/roof/texture data and model key landmarks individually using properly licensed references.

## v0.4 improvements

- Original procedural building façades with repeating window bays, mullions and varying materials.
- Batched wall meshes to reduce draw calls compared with an individual mesh per window.
- Roof-edge silhouettes for more architectural definition.
- Footprints are real OSM outlines, but façade features and many heights remain approximations, not accurate replicas of Perth buildings.

## v0.3 improvements

- Full oriented car-footprint collision against mapped building polygons, with swept movement steps to prevent clipping through buildings.
- Vehicle spawn checked against the whole car body.
- More detailed low-poly car, decorative streetlights and trees.
- Improved acceleration, braking and car-follow camera.
- Ambient placeholder pedestrians and a simple driving checkpoint activity.

## v0.2 improvements

- Pavements, dark asphalt roads and dashed lane markings drawn above ground (fixed invisible roads).
- Player and car spawn near a real mapped street once loading completes.
- Bundled static OpenStreetMap geometry generated by GitHub Actions; no public Overpass call needed when the map is present.

## Scope and limitations

- Area: approximately 31.963°S–31.940°S, 115.846°E–115.872°E.
- The site first loads the checked-in data/perth-cbd.json map snapshot from GitHub Pages. It tries public Overpass only if that file is unavailable. The game does not present synthetic blocks as real Perth if both fail.
- Building heights use OSM height/levels when tagged and otherwise approximate values.
- Movement uses simplified kinematics and AABB collisions, not production vehicle physics.
- Pedestrians and driving checkpoints are simple prototypes; no AI dialogue, multiplayer, combat, or full missions yet.
- Geographic data © OpenStreetMap contributors, ODbL; the webpage also displays attribution. See https://www.openstreetmap.org/copyright .

## Next steps

1. Host processed map chunks instead of live Overpass calls.
2. Improve polygon geometry, terrain, lane markings, crossings and sidewalks.
3. Add proper physics, player animations and traffic.
4. Add NPCs, missions and multiplayer.
5. Optimize rendering using instancing and LOD.
