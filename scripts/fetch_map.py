"""Build a static Perth CBD road/building snapshot from OpenStreetMap's primary API.

Uses the standard OSM 0.6 map endpoint, not the frequently overloaded Overpass
query servers. Requests small bbox tiles to stay under per-request node limits.
"""
import json
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

SOUTH, NORTH = -31.959, -31.946
WEST, EAST = 115.853, 115.866
ENDPOINT = "https://api.openstreetmap.org/api/0.6/map"
HEADERS = {"User-Agent": "PerthStreetsGame/0.2 (educational static snapshot)"}
MAX_SPLIT_DEPTH = 3

def get_tile(south, west, north, east, depth=0):
    bounds = f"{west:.7f},{south:.7f},{east:.7f},{north:.7f}"
    url = ENDPOINT + "?" + urllib.parse.urlencode({"bbox": bounds})
    last_error = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=50) as response:
                xml_bytes = response.read()
            root = ET.fromstring(xml_bytes)
            nodes = {
                n.get("id"): (float(n.get("lat")), float(n.get("lon")))
                for n in root.findall("node")
            }
            ways = []
            for way in root.findall("way"):
                tags = {t.get("k"): t.get("v") for t in way.findall("tag")}
                if not ("highway" in tags or "building" in tags):
                    continue
                geom = []
                for ref in way.findall("nd"):
                    point = nodes.get(ref.get("ref"))
                    if point:
                        geom.append({"lat": point[0], "lon": point[1]})
                if len(geom) < 2:
                    continue
                ways.append({"type": "way", "id": int(way.get("id")), "tags": tags, "geometry": geom})
            print(f"OSM tile {bounds}: {len(ways)} road/building ways", flush=True)
            return ways
        except (urllib.error.URLError, TimeoutError, ET.ParseError, ValueError) as exc:
            last_error = exc
            print(f"OSM request failed ({bounds}, attempt {attempt+1}): {exc}", flush=True)
            time.sleep(3 * (attempt+1))
    if depth >= MAX_SPLIT_DEPTH:
        raise RuntimeError(f"Map API failed for {bounds}: {last_error}")
    print(f"Splitting failed tile {bounds} into four smaller requests", flush=True)
    mid_lat, mid_lon = (south+north)/2, (west+east)/2
    items = []
    for limits in (
        (south, west, mid_lat, mid_lon),
        (south, mid_lon, mid_lat, east),
        (mid_lat, west, north, mid_lon),
        (mid_lat, mid_lon, north, east),
    ):
        items.extend(get_tile(*limits, depth=depth+1))
    return items

def main():
    mid_lat, mid_lon = (SOUTH+NORTH)/2, (WEST+EAST)/2
    tiles = (
        (SOUTH, WEST, mid_lat, mid_lon),
        (SOUTH, mid_lon, mid_lat, EAST),
        (mid_lat, WEST, NORTH, mid_lon),
        (mid_lat, mid_lon, NORTH, EAST),
    )
    ways = {}
    for limits in tiles:
        for item in get_tile(*limits):
            ways[item["id"]] = item
    if len(ways) < 100:
        raise RuntimeError(f"Only {len(ways)} map features retrieved; refusing incomplete snapshot")
    output = {
        "source": "OpenStreetMap contributors (ODbL)",
        "bbox": [SOUTH, WEST, NORTH, EAST],
        "elements": list(ways.values()),
    }
    target = pathlib.Path("data/perth-cbd.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(ways)} real OSM ways ({target.stat().st_size:,} bytes) to {target}", flush=True)

if __name__ == "__main__":
    main()
