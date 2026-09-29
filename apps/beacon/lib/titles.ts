import type { TitleSlug } from '../theme/tokens';

export type TitleMeta = {
  slug: TitleSlug;
  name: string;
  tagline: string;
  formatType: 'battle_royale' | 'head_to_head';
  /** Whether a *-link-id edge function exists for this title yet. */
  verificationAvailable: boolean;
  /** Whether the admin console has real Schedule/Verify/Monitor screens for
   * this title yet — only battle_royale (Apex) does so far; head_to_head
   * titles get a "coming soon" admin panel until that build lands. */
  adminToolsAvailable: boolean;
  /** Required "not affiliated with/sponsored by" notice for the rights
   * holder — shown wherever a league of this title is displayed to
   * players. Titles without one yet render nothing. */
  disclaimer?: string;
};

// Mirrors the seeded rows in supabase/migrations/20260928150000_multi_game_foundation.sql
// — kept as a local constant so the game-picker/linking screens render
// instantly without a round trip, the same tradeoff titleColors() makes.
export const TITLES: TitleMeta[] = [
  { slug: 'apex', name: 'Apex Legends', tagline: 'Battle royale · trios · 20 teams', formatType: 'battle_royale', verificationAvailable: true, adminToolsAvailable: true },
  {
    slug: 'valorant',
    name: 'Valorant',
    tagline: '5v5 tactical shooter',
    formatType: 'head_to_head',
    verificationAvailable: true,
    adminToolsAvailable: false,
    disclaimer: 'This competition is not affiliated with or sponsored by Riot Games, Inc. or VALORANT Esports.',
  },
  { slug: 'cs2', name: 'CS2', tagline: '5v5 tactical shooter', formatType: 'head_to_head', verificationAvailable: false, adminToolsAvailable: false },
  { slug: 'rocket_league', name: 'Rocket League', tagline: '3v3 soccer, with cars', formatType: 'head_to_head', verificationAvailable: false, adminToolsAvailable: false },
];

export function titleMeta(slug: string): TitleMeta {
  return TITLES.find((t) => t.slug === slug) ?? TITLES[0];
}
