#!/usr/bin/env python3
"""Lodge coordinates, second approach: match each lodge to a geocoded lake.

Most lodges sit on (or are named for) a lake already in lake-coords.json.
We match lake names against the lodge's name, location, and fishing_waters.
Unmatched lodges fall back to Nominatim on a cleaned town name.
"""
import json, os, re, time, urllib.parse, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "public", "fish-manitoba", "data.json")
LAKE_COORDS = os.path.join(BASE, "public", "fishmb", "lake-coords.json")
OUT = os.path.join(BASE, "public", "fishmb", "lodge-coords.json")

LAT_MIN, LAT_MAX = 48.9, 60.1
LNG_MIN, LNG_MAX = -102.1, -88.9

data = json.load(open(DATA))
lakes = data["lakes"]
lodges = data["lodges"]
lake_coords = json.load(open(LAKE_COORDS))

# Lake names sorted longest-first so "Big Whiteshell Lake" beats "Whiteshell Lake".
lake_names = sorted(
    [(l["id"], l["name"]) for l in lakes if l["id"] in lake_coords],
    key=lambda x: -len(x[1]),
)

def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", (s or "").lower())

def find_lake(lodge):
    hay = norm(" ".join([
        lodge.get("name", ""),
        lodge.get("location", ""),
        " ".join(lodge.get("fishing_waters", []) or []),
    ]))
    for lid, lname in lake_names:
        if norm(lname) and norm(lname) in hay:
            return lid
    return None

def geocode_town(location):
    # Take the first chunk before "/" or "," as the town candidate.
    town = re.split(r"[/,]", location or "")[0].strip()
    town = re.sub(r"\(.*?\)", "", town).strip()
    if len(town) < 3:
        return None
    q = urllib.parse.quote(f"{town}, Manitoba, Canada")
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    req = urllib.request.Request(url, headers={"User-Agent": "FishMB-lodge-geocoder/1.0 (contact: wallyworldtackle.ca)"})
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    time.sleep(1.1)
    if not data:
        return None
    lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
    if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
        return None
    return {"lat": round(lat, 4), "lng": round(lng, 4)}

def main():
    existing = json.load(open(OUT)) if os.path.exists(OUT) else {}
    lake_matched = town_matched = failed = 0
    for lodge in lodges:
        lid = lodge["id"]
        if lid in existing:
            continue
        lake_id = find_lake(lodge)
        if lake_id:
            c = lake_coords[lake_id]
            # Jitter slightly so stacked lodge pins on one lake don't overlap exactly.
            import random
            random.seed(hash(lid) % (2**32))
            existing[lid] = {
                "lat": round(c["lat"] + random.uniform(-0.03, 0.03), 4),
                "lng": round(c["lng"] + random.uniform(-0.03, 0.03), 4),
                "via": lake_id,
            }
            lake_matched += 1
            continue
        try:
            r = geocode_town(lodge.get("location", ""))
        except Exception as e:
            print(f"[lodge] {lodge['name']}: error {e}", flush=True)
            r = None
        if r:
            existing[lid] = r
            town_matched += 1
            print(f"[lodge] {lodge['name']}: town -> {r['lat']},{r['lng']}", flush=True)
        else:
            failed += 1
            print(f"[lodge] {lodge['name']}: NOT FOUND", flush=True)
        json.dump(existing, open(OUT, "w"), indent=1)
    json.dump(existing, open(OUT, "w"), indent=1)
    print(f"DONE: {lake_matched} via lake, {town_matched} via town, {failed} not found, total {len(existing)}")

main()
