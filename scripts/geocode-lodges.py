#!/usr/bin/env python3
"""Geocode FishMB lodge locations via Nominatim.
Writes public/fishmb/lodge-coords.json: {lodge_id: {lat, lng}}.
Only keeps results inside Manitoba's bounding box. 1 req/sec politeness.
Safe to re-run — skips lodges already geocoded.
"""
import json, os, time, urllib.parse, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "public", "fish-manitoba", "data.json")
OUT = os.path.join(BASE, "public", "fishmb", "lodge-coords.json")

LAT_MIN, LAT_MAX = 48.9, 60.1
LNG_MIN, LNG_MAX = -102.1, -88.9

def geocode(location):
    # Locations look like "Woodlands, Manitoba" — query as-is first.
    for q in (location, location + ", Manitoba, Canada"):
        url = "https://nominatim.openstreetmap.org/search?q=" + urllib.parse.quote(q) + "&format=json&limit=1"
        req = urllib.request.Request(url, headers={"User-Agent": "FishMB-lodge-geocoder/1.0 (contact: wallyworldtackle.ca)"})
        with urllib.request.urlopen(req, timeout=20) as res:
            data = json.loads(res.read().decode())
        time.sleep(1.1)
        if not data:
            continue
        lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
        if LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX:
            return {"lat": round(lat, 4), "lng": round(lng, 4)}
    return None

def main():
    lodges = json.load(open(DATA))["lodges"]
    existing = json.load(open(OUT)) if os.path.exists(OUT) else {}
    done = failed = skipped = 0
    for lodge in lodges:
        lid = lodge["id"]
        if lid in existing:
            skipped += 1
            continue
        try:
            r = geocode(lodge.get("location", "") or lodge["name"])
        except Exception as e:
            print(f"[lodge] {lodge['name']}: error {e}", flush=True)
            r = None
        if r:
            existing[lid] = r
            done += 1
            print(f"[lodge] {lodge['name']}: {r['lat']},{r['lng']}", flush=True)
        else:
            failed += 1
            print(f"[lodge] {lodge['name']}: NOT FOUND", flush=True)
        if (done + failed) % 10 == 0:
            json.dump(existing, open(OUT, "w"), indent=1)
    json.dump(existing, open(OUT, "w"), indent=1)
    print(f"DONE: {done} geocoded, {skipped} already had, {failed} not found")

main()
