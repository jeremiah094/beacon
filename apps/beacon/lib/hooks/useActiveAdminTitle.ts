import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TitleSlug } from '../../theme/tokens';

const KEY = 'beacon:activeAdminTitleSlug';

/** Non-hook read for call sites outside component render (e.g. an
 * explicit sign-in handler routing before any screen mounts). */
export async function getActiveAdminTitleSlug(): Promise<TitleSlug | null> {
  return ((await AsyncStorage.getItem(KEY)) as TitleSlug | null) ?? null;
}

/** Which game's admin console the operator is currently managing — kept
 * separate from the player-side useActiveTitle (own storage key) since an
 * admin account switching games shouldn't move a player context they might
 * also hold, and vice versa. */
export function useActiveAdminTitle() {
  const [activeAdminTitleSlug, setActiveAdminTitleSlugState] = useState<TitleSlug | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((stored) => {
      setActiveAdminTitleSlugState((stored as TitleSlug | null) ?? null);
      setLoaded(true);
    });
  }, []);

  function setActiveAdminTitle(slug: TitleSlug) {
    setActiveAdminTitleSlugState(slug);
    AsyncStorage.setItem(KEY, slug).catch(() => {});
  }

  return { activeAdminTitleSlug, setActiveAdminTitle, loaded };
}
