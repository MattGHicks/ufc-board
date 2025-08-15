// src/data/picks.ts (create this if you don't have it)
import { createClient } from '@/lib/supabaseClient'; // your client

export async function fetchPicksForLeague({
  userId,
  leagueId,
  fightIds,
}: {
  userId: string;
  leagueId: string;
  fightIds?: (string|number)[];
}) {
  const supabase = createClient();
  let q = supabase
    .from('picks')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

  if (fightIds?.length) q = q.in('fight_id', fightIds);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}
