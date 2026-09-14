import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'beacon:activeTeamId';

/** The team whose context the rest of the app (lineup, standings, etc.)
 * currently reads from — a per-device preference, not server state. */
export function useActiveTeam(availableTeamIds: string[]) {
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((stored) => {
      setActiveTeamIdState(stored);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || availableTeamIds.length === 0) return;
    if (!activeTeamId || !availableTeamIds.includes(activeTeamId)) {
      setActiveTeam(availableTeamIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, availableTeamIds.join(',')]);

  function setActiveTeam(teamId: string) {
    setActiveTeamIdState(teamId);
    AsyncStorage.setItem(KEY, teamId).catch(() => {});
  }

  return { activeTeamId, setActiveTeam };
}
