import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
};

async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, url, read_at, created_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, url: n.url, read: !!n.read_at, createdAt: n.created_at }));
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => fetchNotifications(userId as string),
    enabled: !!userId,
  });
}

async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Polls independently of the full list so the bell badge stays current
 * (e.g. after a match-notify trigger fires while the app is open)
 * without every screen needing to hold the whole notifications list in
 * memory — same polling pattern as useAdminGames. */
export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['unreadNotificationCount', userId],
    queryFn: () => fetchUnreadCount(userId as string),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount', userId] });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('profile_id', userId).is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
      queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount', userId] });
    },
  });
}
