import type { TitleSlug } from '../theme/tokens';

export type TitleMeta = {
  slug: TitleSlug;
  name: string;
  tagline: string;
  formatType: 'battle_royale' | 'head_to_head';
  /** Whether a *-link-id edge function exists for this title yet. */
  verificationAvailable: boolean;
};

// Mirrors the seeded rows in supabase/migrations/20260928150000_multi_game_foundation.sql
// — kept as a local constant so the game-picker/linking screens render
// instantly without a round trip, the same tradeoff titleColors() makes.
export const TITLES: TitleMeta[] = [
  { slug: 'apex', name: 'Apex Legends', tagline: 'Battle royale · trios · 20 teams', formatType: 'battle_royale', verificationAvailable: true },
  { slug: 'valorant', name: 'Valorant', tagline: '5v5 tactical shooter', formatType: 'head_to_head', verificationAvailable: true },
  { slug: 'cs2', name: 'CS2', tagline: '5v5 tactical shooter', formatType: 'head_to_head', verificationAvailable: false },
  { slug: 'rocket_league', name: 'Rocket League', tagline: '3v3 soccer, with cars', formatType: 'head_to_head', verificationAvailable: false },
];

export function titleMeta(slug: string): TitleMeta {
  return TITLES.find((t) => t.slug === slug) ?? TITLES[0];
}
