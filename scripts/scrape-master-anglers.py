#!/usr/bin/env python3
"""Scrape Travel Manitoba Master Angler records for every lake in our directory.

Usage: python3 scripts/scrape-master-anglers.py [--lakes a,b,c] [--out file]
Fetches the official record book (anglers.travelmanitoba.com) list view,
paginates, and writes a JSON map: { lake_id: [ {species, inch, cm, date,
waterbody, angler, released} ] }.

Date format matches the existing trophy-records.json: "June 01, 2023".
inch/cm are null for pre-1990 "n/a" records.
"""
import json, re, sys, time, urllib.parse, urllib.request

BASE = "https://anglers.travelmanitoba.com/master_angler_search.asp"
MONTHS = {m: i for i, m in enumerate(
    ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"], 1)}
MONTH_NAMES = ["", "January","February","March","April","May","June","July",
               "August","September","October","November","December"]

def fetch(url, timeout=90, retries=4):
    import subprocess
    last_err = None
    for attempt in range(retries):
        try:
            r = subprocess.run(
                ["curl", "-sL", "--max-time", str(timeout),
                 "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                 url],
                capture_output=True, timeout=timeout + 10)
            if r.returncode == 0 and len(r.stdout) > 1000:
                return r.stdout.decode("utf-8", "replace")
            last_err = f"curl rc={r.returncode} bytes={len(r.stdout)} err={r.stderr[:100]}"
        except Exception as e:
            last_err = e
        wait = 5 * (attempt + 1)
        print(f"  fetch retry {attempt+1}/{retries} after {wait}s: {last_err}", flush=True)
        time.sleep(wait)
    raise Exception(f"fetch failed: {last_err}")

def div_text(html, cls):
    m = re.search(r'<div[^>]*class="%s"[^>]*>(.*?)</div>' % cls, html, re.S)
    if not m:
        return ""
    t = re.sub(r"<[^>]+>", "", m.group(1))
    return t.replace("&nbsp;", "").strip()

def parse_lake(lake_name):
    """Return list of record dicts for one lake name query."""
    records = []
    page_num = None  # first page has no pageNum; page 2+ use pageNum=2,3,...
    while True:
        params = {
            "angler_type": "master_angler",
            "lakeID": lake_name,
            "sortby": "date",
            "view": "list",
            "report": "advanced",
            "advanced": "1",
            "d": "search",
        }
        if page_num:
            params["pageNum"] = page_num
        q = urllib.parse.urlencode(params)
        html = fetch(BASE + "?" + q)
        rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S)
        data_rows = [r for r in rows if 'class="angler-name"' in r or "angler-name" in r]
        if not data_rows:
            break
        for r in data_rows:
            angler = div_text(r, "angler-name")
            if not angler or angler == "Master Angler":
                continue  # table header row
            waterbody = div_text(r, "angler-location")
            species = div_text(r, "angler-species")
            length = div_text(r, "angler-length")
            date_s = div_text(r, "angler-caught")
            released = div_text(r, "angler-released").upper() == "R"
            inch = cm = None
            mlen = re.match(r"([\d.]+)\s*/\s*([\d.]+)", length)
            if mlen:
                cm = float(mlen.group(1))
                inch = float(mlen.group(2))
            # "18 MAY 2026" -> "May 18, 2026" (existing file uses "June 01, 2023")
            date_out = date_s
            md = re.match(r"(\d+)\s+([A-Z]{3})\s+(\d{4})", date_s)
            if md:
                d, mon, y = int(md.group(1)), md.group(2), md.group(3)
                date_out = f"{MONTH_NAMES[MONTHS[mon]]} {d:02d}, {y}"
            records.append({
                "species": species,
                "inch": inch,
                "cm": cm,
                "date": date_out,
                "waterbody": waterbody,
                "angler": angler,
                "released": released,
            })
        # pagination: header says "Total Records: N"; we got 100/page
        mtot = re.search(r"Total Records:\s*(\d+)", html)
        total = int(mtot.group(1)) if mtot else len(data_rows)
        if len(records) >= total or len(data_rows) < 100:
            break
        page_num = 2 if page_num is None else page_num + 1
        time.sleep(0.7)
    return records

def main():
    lakes_filter = None
    out = "public/fishmb/trophy-records.json"
    partial_dir = None
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a == "--lakes":
            lakes_filter = set(args[i + 1].split(","))
        if a == "--out":
            out = args[i + 1]
        if a == "--partial-dir":
            partial_dir = args[i + 1]
    import os
    if partial_dir:
        os.makedirs(partial_dir, exist_ok=True)
    fish = json.load(open("public/fish-manitoba/data.json"))
    lakes = fish["lakes"]
    result = {}
    # resume: load already-scraped lakes from partial dir
    done = set()
    if partial_dir:
        for fn in os.listdir(partial_dir):
            if fn.endswith(".json"):
                done.add(fn[:-5])
                try:
                    result[fn[:-5]] = json.load(open(os.path.join(partial_dir, fn)))
                except Exception:
                    pass
    for li, l in enumerate(lakes):
        lid, name = l["id"], l["name"]
        if lakes_filter and lid not in lakes_filter:
            continue
        if lid in done:
            print(f"[{li+1}/{len(lakes)}] {lid}: {len(result[lid])} records (cached)", flush=True)
            continue
        try:
            recs = parse_lake(name)
        except Exception as e:
            print(f"ERROR {lid} ({name}): {e}", flush=True)
            continue
        if recs:
            result[lid] = recs
            if partial_dir:
                json.dump(recs, open(os.path.join(partial_dir, lid + ".json"), "w"))
        else:
            # record the miss so we don't refetch on resume
            if partial_dir:
                json.dump([], open(os.path.join(partial_dir, lid + ".json"), "w"))
        print(f"[{li+1}/{len(lakes)}] {lid}: {len(recs)} records", flush=True)
        time.sleep(2.5)
    json.dump(result, open(out, "w"), indent=2)
    total = sum(len(v) for v in result.values())
    print(f"Wrote {len(result)} lakes, {total} records -> {out}")

if __name__ == "__main__":
    main()
