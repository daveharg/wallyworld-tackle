"""Fetch real photos for FishMB lakes (Wikimedia Commons) and lodges (og:image).

Writes lib/fishmb-photos.json incrementally: { "lakes": {id: {...}}, "lodges": {id: {...}} }
Only keeps matches with evidence they depict the actual Manitoba lake/lodge.
Parallel fetching, incremental saves, unbuffered progress.
Run: python3 -u scripts/fetch-real-photos.py
"""
import json, re, time, html, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

DATA = "public/fish-manitoba/data.json"
OUT = "lib/fishmb-photos.json"
UA = {"User-Agent": "FishMB-photo-research/1.0"}

def get(url, timeout=12, max_bytes=300000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ctype = r.headers.get("Content-Type", "")
        return r.read(max_bytes), ctype

def save(out):
    tmp = OUT + ".tmp"
    json.dump(out, open(tmp, "w"), indent=1)
    import os
    os.replace(tmp, OUT)

def commons_search(lake_name):
    q = f"{lake_name} Manitoba"
    params = urllib.parse.urlencode({
        "action": "query", "format": "json",
        "generator": "search", "gsrsearch": q,
        "gsrnamespace": "6", "gsrlimit": "10",
        "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": "800",
    })
    try:
        raw, _ = get(f"https://commons.wikimedia.org/w/api.php?{params}", timeout=15, max_bytes=200000)
        data = json.loads(raw)
    except Exception:
        return None
    pages = (data.get("query") or {}).get("pages") or {}
    for p in pages.values():
        title = p.get("title", "")
        info = (p.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl") or info.get("url")
        meta = info.get("extmetadata") or {}
        desc = html.unescape(re.sub("<[^>]+>", " ", str((meta.get("ImageDescription") or {}).get("value", ""))))
        blob = f"{title} {desc}".lower()
        if "manitoba" not in blob:
            continue
        if re.search(r"\bmap\b|diagram|logo|chart|coat of arms|satellite|modis|aerial", blob):
            continue
        words = [w for w in re.sub(r"[^a-z ]", "", lake_name.lower()).split() if w not in ("lake", "lakes", "river")]
        if words and not any(w in blob for w in words):
            continue
        if thumb and thumb.startswith("http"):
            artist = html.unescape(re.sub("<[^>]+>", " ", str((meta.get("Artist") or {}).get("value", "")))).strip()[:120]
            lic = str((meta.get("LicenseShortName") or {}).get("value", "")).strip()[:40]
            return {"url": thumb, "title": title.replace("File:", ""), "credit": artist, "license": lic}
    return None

def og_image(site):
    if not site or not site.startswith("http"):
        return None
    try:
        raw, ctype = get(site, timeout=8)
    except Exception:
        return None
    if "html" not in ctype:
        return None
    try:
        page = raw.decode("utf-8", "ignore")[:150000]
    except Exception:
        return None
    m = (re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', page, re.I)
         or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', page, re.I)
         or re.search(r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)', page, re.I))
    if not m:
        return None
    url = html.unescape(m.group(1)).strip()
    if url.startswith("//"):
        url = "https:" + url
    if url.startswith("/"):
        base = re.match(r"https?://[^/]+", site).group(0)
        url = base + url
    if not url.startswith("http"):
        return None
    if re.search(r"logo|icon|favicon|sprite", url, re.I):
        return None
    return {"url": url}

def main():
    d = json.load(open(DATA))
    lakes = d["lakes"]; lodges = d["lodges"]
    try:
        out = json.load(open(OUT))
    except Exception:
        out = {"lakes": {}, "lodges": {}}
    print(f"{len(lakes)} lakes, {len(lodges)} lodges; resuming with {len(out['lakes'])} lake + {len(out['lodges'])} lodge photos", flush=True)

    def do_lake(lake):
        if lake["id"] in out["lakes"]:
            return (lake["name"], "skip")
        res = commons_search(lake["name"])
        if res:
            out["lakes"][lake["id"]] = res
            return (lake["name"], res["title"][:60])
        return (lake["name"], None)

    with ThreadPoolExecutor(max_workers=8) as ex:
        done = 0
        for name, res in ex.map(do_lake, lakes):
            done += 1
            if res and res != "skip":
                print(f"[lake {done}/{len(lakes)}] {name}: {res}", flush=True)
            if done % 25 == 0:
                save(out); print(f"... saved {len(out['lakes'])} lake photos", flush=True)
    save(out)
    print(f"lakes done: {len(out['lakes'])} photos", flush=True)

    def do_lodge(lodge):
        if lodge["id"] in out["lodges"]:
            return (lodge["name"], "skip")
        res = og_image(lodge.get("website") or "")
        if res:
            out["lodges"][lodge["id"]] = res
            return (lodge["name"], res["url"][:70])
        return (lodge["name"], None)

    with ThreadPoolExecutor(max_workers=10) as ex:
        done = 0
        for name, res in ex.map(do_lodge, lodges):
            done += 1
            if res and res != "skip":
                print(f"[lodge {done}/{len(lodges)}] {name}: {res}", flush=True)
            if done % 25 == 0:
                save(out); print(f"... saved {len(out['lodges'])} lodge photos", flush=True)
    save(out)
    print(f"DONE: {len(out['lakes'])} lake photos, {len(out['lodges'])} lodge photos", flush=True)

if __name__ == "__main__":
    main()
