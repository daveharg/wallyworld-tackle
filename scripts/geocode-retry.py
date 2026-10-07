#!/usr/bin/env python3
"""Second pass for lakes that missed geocoding, with cleaned name overrides."""
import json, os, time, urllib.parse, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "public", "fish-manitoba", "data.json")
OUT = os.path.join(BASE, "public", "fishmb", "lake-coords.json")

LAT_MIN, LAT_MAX = 48.9, 60.1
LNG_MIN, LNG_MAX = -102.1, -88.9

OVERRIDES = {
    "Clear Lake (Riding Mountain)": "Clear Lake, Riding Mountain National Park",
    "Lake of the Woods (Manitoba portion)": "Lake of the Woods",
    "Shoal Lakes (East & West)": "Shoal Lake",
    "Lake Metigoshe": "Metigoshe Lake",
    "Vermilion Reservoir": "Vermilion Lake",
    "Cranberry Lakes": "Cranberry Lake",
    "Minnedosa Trout Pond": "Minnedosa",
    "Minnedosa Lake": "Minnedosa",
    "Langan Lakes": "Langan Lake",
    "Nueltin Lake": "Nueltin Lake, Nunavut",
    "Reindeer Lake": "Reindeer Lake, Saskatchewan",
}

def geocode(name, strict_mb=True):
    q = urllib.parse.quote(f"{name}, Manitoba, Canada" if strict_mb else name)
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    req = urllib.request.Request(url, headers={"User-Agent": "FishMB-lake-geocoder/1.0 (contact: wallyworldtackle.ca)"})
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    if not data:
        return None
    lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
    if strict_mb and not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
        return None
    return {"lat": round(lat, 4), "lng": round(lng, 4), "name": data[0].get("display_name", "")[:80]}

def main():
    lakes = json.load(open(DATA))["lakes"]
    name_to_id = {l["name"]: l["id"] for l in lakes}
    coords = json.load(open(OUT))
    done = failed = 0
    for lake_name, query in OVERRIDES.items():
        lake_id = name_to_id.get(lake_name)
        if not lake_id:
            print(f"[retry] {lake_name}: no such lake in data", flush=True)
            continue
        if lake_id in coords:
            continue
        try:
            r = geocode(query)
            if not r and "," not in query:
                r = geocode(query, strict_mb=False)
        except Exception as e:
            print(f"[retry] {lake_name}: error {e}", flush=True)
            r = None
        time.sleep(1.1)
        if r:
            coords[lake_id] = r
            done += 1
            print(f"[retry] {lake_name} -> {query}: {r['lat']},{r['lng']}", flush=True)
        else:
            failed += 1
            print(f"[retry] {lake_name}: STILL NOT FOUND", flush=True)
        json.dump(coords, open(OUT, "w"), indent=1)
    print(f"RETRY DONE: {done} found, {failed} still missing, total {len(coords)}")

main()
