// Shared stats builder: totals, biggest per species, species counts.
// Only aggregates — never returns individual private catches.

import { query } from "./db";

export interface UserStats {
  total_catches: number;
  species_count: number;
  biggest_overall_in: number | null;
  biggest_by_species: Array<{ species: string; best_in: number; count: number }>;
}

export async function buildStats(userId: string): Promise<UserStats> {
  const rows = await query<{ species: string; best_in: string; count: string }>(
    `SELECT species, MAX(length_in) AS best_in, COUNT(*) AS count
       FROM fm_catches
      WHERE user_id = $1
      GROUP BY species
      ORDER BY MAX(length_in) DESC`,
    [userId]
  );
  const total = rows.reduce((n, r) => n + Number(r.count), 0);
  const biggest = rows.length > 0 ? Number(rows[0].best_in) : null;
  return {
    total_catches: total,
    species_count: rows.length,
    biggest_overall_in: biggest,
    biggest_by_species: rows.map((r) => ({
      species: r.species,
      best_in: Number(r.best_in),
      count: Number(r.count),
    })),
  };
}
