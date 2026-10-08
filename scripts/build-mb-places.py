#!/usr/bin/env python3
"""Build public/fishmb/mb-places.json — Manitoba cities/towns/villages with
real coordinates from Nominatim (1 req/s per usage policy, proper UA).
Run: python3 scripts/build-mb-places.py
"""
import json
import time
import urllib.parse
import urllib.request

COMMUNITIES = [
    # Cities
    "Winnipeg", "Brandon", "Thompson", "Portage la Prairie", "Steinbach",
    "Winkler", "Selkirk", "Morden", "Dauphin", "The Pas",
    # Towns
    "Altona", "Arborg", "Beausejour", "Carberry", "Carman", "Churchill",
    "Emerson", "Flin Flon", "Gimli", "Gladstone", "Grand Rapids", "Hamiota",
    "Hartney", "Lac du Bonnet", "Lynn Lake", "Melita", "Minnedosa", "Morris",
    "Neepawa", "Niverville", "Oakbank", "Pinawa", "Pilot Mound",
    "Powerview-Pine Falls", "Rapid City", "Roblin", "Rossburn", "Russell",
    "Shoal Lake", "Souris", "Stonewall", "Swan River", "Teulon", "Virden",
    "Winnipeg Beach", "Ste. Anne",
    # Villages / smaller communities
    "Binscarth", "Birtle", "Cartwright", "Deloraine", "Dunnottar", "Elkhorn",
    "Erickson", "Ethelbert", "Garson", "Gilbert Plains", "Grandview",
    "McCreary", "Miami", "Notre-Dame-de-Lourdes", "Oak River", "Reston",
    "Rivers", "Riverton", "Snow Lake", "Somerset", "St. Claude", "Treherne",
    "Waskada", "Wawanesa", "Winnipegosis", "Benito", "Bowsman", "Manitou",
    "St-Pierre-Jolys", "Killarney", "Boissevain", "Kenton", "Oak Lake",
    "Alexander", "Whitemouth", "Hadashville", "Falcon Lake", "West Hawk Lake",
]

UA = "FishMB-Manitoba-Fishing-App/1.0 (contact: dave@wallyworldtackle.ca)"


def geocode(name: str):
    for q in (f"{name}, Manitoba, Canada", f"{name}, Canada"):
        params = urllib.parse.urlencode(
            {"q": q, "format": "json", "limit": 1, "countrycodes": "ca"}
        )
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={"User-Agent": UA},
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read().decode())
            if data:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                # Sanity: must be roughly Manitoba
                if 48.5 <= lat <= 60.5 and -102.5 <= lon <= -88.5:
                    return lat, lon
        except Exception as e:
            print(f"  error for {name}: {e}")
        time.sleep(1.2)
    return None


def main():
    places = []
    failed = []
    for i, name in enumerate(COMMUNITIES):
        print(f"[{i+1}/{len(COMMUNITIES)}] {name}")
        res = geocode(name)
        if res:
            lat, lon = res
            places.append({"name": name, "lat": round(lat, 4), "lon": round(lon, 4), "type": "town"})
        else:
            failed.append(name)
        time.sleep(1.2)  # Nominatim: max 1 req/s
    out = "/home/hatch/workspace/wallyworld-store/public/fishmb/mb-places.json"
    with open(out, "w") as f:
        json.dump(places, f)
    print(f"\nwrote {len(places)} places to {out}")
    if failed:
        print("FAILED:", ", ".join(failed))


if __name__ == "__main__":
    main()
