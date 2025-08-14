'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function createLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return setError('Please sign in first.');
    setCreating(true);
    setError(null);

    // 1) Create league with owner_id set to current user
    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .insert({ name, owner_id: userId })
      .select('*')
      .single();

    if (leagueErr || !league) {
      setError(leagueErr?.message ?? 'Failed to create league');
      setCreating(false);
      return;
    }

    // 2) Add creator as a member (role owner)
    const { error: memberErr } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: userId, role: 'owner' });

    if (memberErr) {
      setError(memberErr.message);
      setCreating(false);
      return;
    }

    // Go to a basic league page (we’ll build it later). For now, just route to home.
    router.push(`/`);
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Create a League</h1>
      <form onSubmit={createLeague} className="space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="League name"
          className="w-full border rounded-xl p-3"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="w-full border rounded-xl p-3"
        >
          {creating ? 'Creating…' : 'Create League'}
        </button>
        {error && <p className="text-red-600">{error}</p>}
      </form>
    </main>
  );
}
