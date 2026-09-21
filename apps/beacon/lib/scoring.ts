/** ALGS placement points (BUILD.md §2 scoring table), mirroring the
 * database's placement_points() SQL function (20260914113349) — this is a
 * read-only client-side preview; the database is the source of truth for
 * standings. */
export function placementPoints(placement: number): number {
  if (placement === 1) return 12;
  if (placement === 2) return 9;
  if (placement === 3) return 7;
  if (placement === 4) return 5;
  if (placement === 5) return 4;
  if (placement >= 6 && placement <= 7) return 3;
  if (placement >= 8 && placement <= 10) return 2;
  if (placement >= 11 && placement <= 15) return 1;
  return 0;
}
