import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type PendingJoinRequest = {
  id: string;
  profileId: string;
  name: string;
};

function displayName(p: { display_name: string | null; gamertag: string | null } | null | undefined): string {
  return p?.display_name || p?.gamertag || 'Player';
}

async function fetchPendingJoinRequests(teamId: string): Promise<PendingJoinRequest[]> {
  const { data, error } = await supabase
    .from('team_join_requests')
    .select('id, profile_id, profiles(display_name, gamertag)')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, profileId: r.profile_id, name: displayName(r.profiles as any) }));
}

/** Captain-only — team_join_requests_select already scopes this to the
 * requester themselves or the team's captain, so a non-captain calling
 * this just gets an empty list rather than an error. */
export function usePendingJoinRequests(teamId: string | undefined) {
  return useQuery({
    queryKey: ['pendingJoinRequests', teamId],
    queryFn: () => fetchPendingJoinRequests(teamId as string),
    enabled: !!teamId,
  });
}

/** Approving inserts into team_members directly — that table's own
 * captain-only insert policy is what actually gates this, the request
 * row is just the record of who asked and when. */
export function useDecideJoinRequest(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      profileId,
      approve,
      captainId,
    }: {
      requestId: string;
      profileId: string;
      approve: boolean;
      captainId: string;
    }) => {
      const { error: decideError } = await supabase
        .from('team_join_requests')
        .update({ status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString(), decided_by: captainId })
        .eq('id', requestId);
      if (decideError) throw decideError;

      if (approve) {
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({ team_id: teamId as string, profile_id: profileId, role: 'member' });
        if (memberError) throw memberError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingJoinRequests', teamId] });
      queryClient.invalidateQueries({ queryKey: ['teamLineup', teamId] });
    },
  });
}
