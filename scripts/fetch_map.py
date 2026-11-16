"""Fetch real OpenStreetMap geometry for central Perth, for static GitHub Pages hosting."""
import json
import pathlib
import time
import urllib.parse
import urllib.request

# Perth CBD / Northbridge, roughly 1.2 x 1.4 kilometres.
SOUTH, NORTH = -31.959, -31.946
WEST, EAST = 115.853, 115.866
SERVERS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

def query_api(south, west, north, east, kind):
    if kind == "roads":
        selector = 'way["highway"]'
    else:
        selector = 'way["building"]'
    query = (f'[out:json][timeout:60];'
             f'{selector}({south},{west},{north},{east});out geom;')
    payload = urllib.parse.urlencode({"data": query}).encode()
    for server in SERVERS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    server, data=payload,
                    headers={"User-Agent": "PerthStreets/0.2 (GitHub Pages open source game)",
                             "Content-Type": "application/x-www-form-urlencoded"})
                with urllib.request.urlopen(req, timeout=90) as response:
                    data = json.load(response)
                elements = data.get("elements", [])
                if elements:
                    print(f"{kind} {south},{west}: {len(elements)} from {server}", flush=True)
                    return elements
            except Exception as exc:
                print(f"Attempt {attempt + 1} {server}: {exc}", flush=True)
                time.sleep(2)
    raise RuntimeError(f"Could not download {kind} for {south},{west}")

def main():
    midpoint_lat = (SOUTH + NORTH) / 2
    midpoint_lon = (WEST + EAST) / 2
    pieces = [
        (SOUTH, WEST, midpoint_lat, midpoint_lon),
        (SOUTH, midpoint_lon, midpoint_lat, EAST),
        (midpoint_lat, WEST, NORTH, midpoint_lon),
        (midpoint_lat, midpoint_lon, NORTH, EAST),
    ]
    by_id = {}
    for south, west, north, east in pieces:
        for kind in ("roads", "buildings"):
            for element in query_api(south, west, north, east, kind):
                if element.get("type") == "way" and element.get("geometry"):
                    by_id[element["id"]] = element
    if len(by_id) < 100:
        raise RuntimeError("Map download suspiciously small, refusing to overwrite")
    result = {"source": "© OpenStreetMap contributors", "bbox": [SOUTH, WEST, NORTH, EAST],
              "elements": list(by_id.values())}
    directory = pathlib.Path("data")
    directory.mkdir(exist_ok=True)
    path = directory / "perth-cbd.json"
    path.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(by_id)} OSM ways, {path.stat().st_size} bytes", flush=True)

if __name__ == "__main__":
    main()
