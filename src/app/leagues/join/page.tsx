'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function JoinLeaguePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function joinLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return setError('Please sign in first.');
    setJoining(true); setError(null);

    // Find league by invite_code (case-insensitive)
    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .select('*')
      .ilike('invite_code', code.trim())
      .single();

    if (leagueErr || !league) {
      setError('No league found with that code.');
      setJoining(false);
      return;
    }

    // Add membership (role member)
    const { error: memberErr } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: userId, role: 'member' });

    if (memberErr) {
      setError(memberErr.code === '23505'
        ? 'You are already in this league.'
        : memberErr.message);
      setJoining(false);
      return;
    }

    router.push(`/`);
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Join a League</h1>
      <form onSubmit={joinLeague} className="space-y-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code (8 characters)"
          className="w-full border rounded-xl p-3"
          required
        />
        <button
          type="submit"
          disabled={joining}
          className="w-full border rounded-xl p-3"
        >
          {joining ? 'Joining…' : 'Join League'}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </form>
    </main>
  );
}
