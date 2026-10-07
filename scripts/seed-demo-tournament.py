#!/usr/bin/env python3
"""Generate seed SQL for a demo tournament with demo users and entries.
Run the output in the Vercel Postgres query editor. Idempotent-ish: wipes
prior demo rows (google_sub LIKE 'demo-%') before inserting.
"""
import random

random.seed(42)

USERS = [
    "Gordie Sawchuk",
    "Marcy Desjarlais",
    "Big Jim Kozak",
    "Tammy Roulette",
    "Daryl Peters",
    "Shania Courchene",
    "Ole Bjornson",
    "Kevin Traverse",
]

# Real, resolving fishing photos (Unsplash IDs already used in the codebase).
PHOTOS = [
    "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?auto=format&fit=crop&w=800&q=60",
    "https://images.unsplash.com/photo-1609859682240-6860cf3d99d5?auto=format&fit=crop&w=800&q=60",
    "https://images.unsplash.com/photo-1516684732162-798a006aa609?auto=format&fit=crop&w=800&q=60",
    "https://images.unsplash.com/photo-1499242611767-cf8b9be02854?auto=format&fit=crop&w=800&q=60",
]

# South basin, Lake Winnipeg.
LAT_C, LNG_C = 50.42, -96.92

out = []
out.append("-- Demo tournament seed — generated, safe to re-run.")
out.append("DELETE FROM fm_tournament_entries WHERE user_id IN (SELECT id FROM fm_users WHERE google_sub LIKE 'demo-%');")
out.append("DELETE FROM fm_tournament_participants WHERE user_id IN (SELECT id FROM fm_users WHERE google_sub LIKE 'demo-%');")
out.append("DELETE FROM fm_tournaments WHERE name = 'Demo Derby — Walleye Shootout';")
out.append("DELETE FROM fm_users WHERE google_sub LIKE 'demo-%';")
out.append("")

for i, name in enumerate(USERS, 1):
    out.append(
        f"INSERT INTO fm_users (google_sub, name) VALUES ('demo-angler-{i}', '{name}');"
    )
out.append("")

out.append("""INSERT INTO fm_tournaments
  (name, description, organizer_id, lake_ids, species, starts_at, ends_at, rules, scoring, invite_code, status)
VALUES (
  'Demo Derby — Walleye Shootout',
  'Demo tournament to verify the leaderboard display. Not a real event.',
  (SELECT id FROM fm_users WHERE google_sub = 'demo-angler-1'),
  ARRAY['lake-winnipeg'],
  ARRAY['Walleye'],
  now() - interval '2 days',
  now() + interval '5 days',
  'Demo rules: longest walleye wins. All entries auto-approved for the demo.',
  'longest',
  'DEMO12',
  'active'
);""")
out.append("")

for i in range(1, 9):
    out.append(
        f"INSERT INTO fm_tournament_participants (tournament_id, user_id) VALUES "
        f"((SELECT id FROM fm_tournaments WHERE invite_code = 'DEMO12'), "
        f"(SELECT id FROM fm_users WHERE google_sub = 'demo-angler-{i}'));"
    )
out.append("")

# Entries: give each angler 2-4 fish; angler 3 gets the biggest (28.5").
lengths = {
    1: [24.0, 21.5, 19.0],
    2: [22.5, 20.0],
    3: [28.5, 25.0, 23.5, 21.0],
    4: [19.5, 18.0],
    5: [26.0, 24.5],
    6: [21.0, 20.5, 19.75],
    7: [23.0],
    8: [25.5, 22.0, 20.25],
}

for i, ls in lengths.items():
    for j, length in enumerate(ls):
        lat = round(LAT_C + random.uniform(-0.15, 0.15), 4)
        lng = round(LNG_C + random.uniform(-0.2, 0.2), 4)
        photo = PHOTOS[(i + j) % len(PHOTOS)]
        hours_ago = random.randint(2, 40)
        out.append(
            f"INSERT INTO fm_tournament_entries "
            f"(tournament_id, user_id, photo_url, species, length_inches, latitude, longitude, gps_accuracy, notes, status, captured_at) VALUES ("
            f"(SELECT id FROM fm_tournaments WHERE invite_code = 'DEMO12'), "
            f"(SELECT id FROM fm_users WHERE google_sub = 'demo-angler-{i}'), "
            f"'{photo}', 'Walleye', {length}, {lat}, {lng}, 12, 'Demo catch', 'approved', "
            f"now() - interval '{hours_ago} hours');"
        )

open("/home/hatch/workspace/wallyworld-store/seed-demo-tournament.sql", "w").write("\n".join(out) + "\n")
print(f"Wrote {len(out)} statements.")
