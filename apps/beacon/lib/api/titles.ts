import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

async function fetchTitleId(slug: string): Promise<string | null> {
  const { data } = await supabase.from('titles').select('id').eq('slug', slug).single();
  return data?.id ?? null;
}

/** Resolves a title's row id from its slug — titles are static/seeded, so
 * this is effectively cached forever once fetched. */
export function useTitleId(slug: string | undefined) {
  return useQuery({
    queryKey: ['titleId', slug],
    queryFn: () => fetchTitleId(slug as string),
    enabled: !!slug,
    staleTime: Infinity,
  });
}
