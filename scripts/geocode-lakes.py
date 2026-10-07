#!/usr/bin/env python3
"""Geocode FishMB lakes via Nominatim (OpenStreetMap).

Writes public/fishmb/lake-coords.json: {lake_id: {lat, lng, name}}.
Only keeps results inside Manitoba's bounding box. Respects Nominatim's
1 req/sec usage policy. Safe to re-run — skips lakes already geocoded.
"""
import json, os, sys, time, urllib.parse, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "public", "fish-manitoba", "data.json")
OUT = os.path.join(BASE, "public", "fishmb", "lake-coords.json")

# Manitoba bounding box
LAT_MIN, LAT_MAX = 48.9, 60.1
LNG_MIN, LNG_MAX = -102.1, -88.9

def in_manitoba(lat, lng):
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX

def geocode(name):
    q = urllib.parse.quote(f"{name}, Manitoba, Canada")
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    req = urllib.request.Request(url, headers={"User-Agent": "FishMB-lake-geocoder/1.0 (contact: wallyworldtackle.ca)"})
    with urllib.request.urlopen(req, timeout=20) as res:
        data = json.loads(res.read().decode())
    if not data:
        return None
    lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
    if not in_manitoba(lat, lng):
        return None
    return {"lat": round(lat, 4), "lng": round(lng, 4), "name": data[0].get("display_name", "")[:80]}

def main():
    lakes = json.load(open(DATA))["lakes"]
    existing = json.load(open(OUT)) if os.path.exists(OUT) else {}
    done = skipped = failed = 0
    for lake in lakes:
        lid = lake["id"]
        if lid in existing:
            skipped += 1
            continue
        try:
            r = geocode(lake["name"])
        except Exception as e:
            print(f"[lake] {lake['name']}: error {e}", flush=True)
            r = None
        time.sleep(1.1)  # Nominatim politeness
        if r:
            existing[lid] = r
            done += 1
            print(f"[lake] {lake['name']}: {r['lat']},{r['lng']}", flush=True)
        else:
            failed += 1
            print(f"[lake] {lake['name']}: NOT FOUND", flush=True)
        if (done + failed) % 10 == 0:
            json.dump(existing, open(OUT, "w"), indent=1)
    json.dump(existing, open(OUT, "w"), indent=1)
    print(f"DONE: {done} geocoded, {skipped} already had, {failed} not found")

main()
