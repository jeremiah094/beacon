import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TitleSlug } from '../../theme/tokens';

const KEY = 'beacon:activeTitleSlug';

/** The game whose context the rest of the app (home, leagues, teams)
 * currently reads from — chosen on the game-picker screen after login, a
 * per-device preference, same pattern as useActiveTeam. */
export function useActiveTitle() {
  const [activeTitleSlug, setActiveTitleSlugState] = useState<TitleSlug | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((stored) => {
      setActiveTitleSlugState((stored as TitleSlug | null) ?? null);
      setLoaded(true);
    });
  }, []);

  function setActiveTitle(slug: TitleSlug) {
    setActiveTitleSlugState(slug);
    AsyncStorage.setItem(KEY, slug).catch(() => {});
  }

  return { activeTitleSlug, setActiveTitle, loaded };
}
