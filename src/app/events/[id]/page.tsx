'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Fight = {
  id: string;
  event_id: string;
  red_name: string;
  blue_name: string;
  scheduled_rounds: number;
  bout_order: number;
};

type League = {
  id: string;
  name: string;
  invite_code: string;
};

type PickRow = {
  id?: string;
  user_id: string;
  league_id: string;   // DB column shape
  event_id: string;
  fight_id: string;
  winner: 'red' | 'blue';
  method: string;      // enum label from DB ('KO' | 'SUB' | 'DEC')
  round: number | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function EventPicksPage() {
  const params = useParams();
  const eventId = String(params.id || '');
  const eventIdIsValid = UUID_RE.test(eventId);

  const [userId, setUserId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState<string>(''); // MUST be a pure UUID
  const [fights, setFights] = useState<Fight[]>([]);
  const [picks, setPicks] = useState<Record<string, PickRow>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [methods, setMethods] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // per‑fight debounce timers & latest-save tokens
  const timersRef = useRef<Record<string, number | undefined>>({});
  const saveTokenRef = useRef<Record<string, number>>({});

  // ---------- Load bootstrap data ----------
  useEffect(() => {
    (async () => {
      setError(null);

      if (!eventIdIsValid) {
        setError('This event URL is not valid. Open an event from the homepage list.');
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;

      // enum values (your enum is named 'method')
      const { data: enumVals, error: enumErr } = await supabase.rpc('enum_values', {
        enum_name: 'method',
      });
      if (enumErr) { setError(enumErr.message); return; }
      setMethods((enumVals ?? []) as string[]);

      // leagues the user belongs to
      const { data: lm, error: lmErr } = await supabase
        .from('league_members')
        .select('league_id');
      if (lmErr) { setError(lmErr.message); return; }

      const leagueIds = (lm ?? []).map(r => r.league_id);
      if (leagueIds.length) {
        const { data: leaguesData, error: lgErr } = await supabase
          .from('leagues')
          .select('id, name, invite_code')
          .in('id', leagueIds);
        if (lgErr) { setError(lgErr.message); return; }
        setLeagues(leaguesData ?? []);
        if (leaguesData && leaguesData[0]) setLeagueId(leaguesData[0].id);
      }

      // fights for this event
      const { data: fightsData, error: fErr } = await supabase
        .from('fights')
        .select('*')
        .eq('event_id', eventId)
        .order('bout_order', { ascending: true });
      if (fErr) { setError(fErr.message); return; }
      setFights((fightsData ?? []) as Fight[]);

      // existing picks by this user for this event
      const { data: picksData, error: pErr } = await supabase
        .from('picks')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', uid);
      if (pErr) { setError(pErr.message); return; }

      const byFight: Record<string, PickRow> = {};
      (picksData ?? []).forEach((row: any) => {
        byFight[row.fight_id] = {
          id: row.id,
          user_id: row.user_id,
          league_id: row.league_id,
          event_id: row.event_id,
          fight_id: row.fight_id,
          winner: row.winner,
          method: row.method,
          round: row.round,
        };
      });
      setPicks(byFight);
    })();

    // clear timers on unmount
    return () => {
      Object.values(timersRef.current).forEach(id => id && clearTimeout(id));
    };
  }, [eventId, eventIdIsValid]);

  // Map fight_id -> fight (for quick lookups/sorting)
  const fightsById = useMemo(() => {
    const map: Record<string, Fight> = {};
    for (const f of fights) map[f.id] = f;
    return map;
  }, [fights]);

  // Only the current league's picks
  const myPicksForLeague = useMemo(() => {
    return Object.values(picks).filter(p => p.league_id === leagueId);
  }, [picks, leagueId]);

  // ---------- Save to DB (selective merge; no full refetch) ----------
  async function savePickNow(fight: Fight) {
    if (!userId) { setError('Please sign in.'); return; }
    if (!eventIdIsValid) { setError('Invalid event URL.'); return; }
    if (!UUID_RE.test(leagueId)) { setError('Please select a league.'); return; }

    const current = picks[fight.id];
    if (!current) return;
    if (!methods.includes(current.method)) { setError('Invalid method selected.'); return; }

    setSaving(prev => ({ ...prev, [fight.id]: true }));
    setError(null);

    // per‑fight request token to ignore stale responses
    const token = Date.now();
    saveTokenRef.current[fight.id] = token;

    const payload = {
      user_id: userId,
      league_id: leagueId,
      event_id: eventId,
      fight_id: fight.id,
      winner: current.winner,
      method: current.method,
      round: current.method === 'DEC' ? null : (current.round ?? null),
    };

    const { data: saved, error: upErr } = await supabase
      .from('picks')
      .upsert(payload, { onConflict: 'user_id,league_id,fight_id' })
      .select()
      .single();

    // if a newer save started, ignore this response
    if (saveTokenRef.current[fight.id] !== token) {
      return;
    }

    if (upErr) {
      setError(upErr.message);
    } else if (saved) {
      // merge only this fight’s saved row
      setPicks(prev => ({
        ...prev,
        [fight.id]: {
          id: saved.id,
          user_id: saved.user_id,
          league_id: saved.league_id,
          event_id: saved.event_id,
          fight_id: saved.fight_id,
          winner: saved.winner,
          method: saved.method,
          round: saved.round,
        },
      }));
      setSavedAt(prev => ({ ...prev, [fight.id]: Date.now() }));
    }

    setSaving(prev => ({ ...prev, [fight.id]: false }));
  }

  // Debounce a save per fight (400ms)
  function scheduleAutoSave(fight: Fight) {
    const id = fight.id;
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
    }
    timersRef.current[id] = window.setTimeout(() => {
      savePickNow(fight);
      timersRef.current[id] = undefined;
    }, 400);
  }

  // ---------- Local state updates + schedule save ----------
  function updateLocalPick(fight: Fight, patch: Partial<PickRow>) {
    setPicks(prev => {
      const base: PickRow = prev[fight.id] ?? {
        user_id: userId!,
        league_id: leagueId,   // keep in sync with current selection
        event_id: fight.event_id,
        fight_id: fight.id,
        winner: 'red',
        method: methods[0] ?? 'DEC', // default from enum
        round: null,
      };
      const next: PickRow = { ...base, league_id: leagueId, ...patch };
      if (next.method === 'DEC') next.round = null; // ignore round for decisions
      return { ...prev, [fight.id]: next };
    });

    if (UUID_RE.test(leagueId)) {
      scheduleAutoSave(fight);
    }
  }

  // Optional: clear pending saves when switching leagues
  useEffect(() => {
    Object.values(timersRef.current).forEach(id => id && clearTimeout(id));
  }, [leagueId]);

  const roundsOptions = useMemo(() => [1, 2, 3, 4, 5], []);
  const currentLeague = leagues.find(l => l.id === leagueId);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Make Picks</h1>
        <Link href="/" className="text-sm underline">Back to events</Link>
      </div>

      {/* League selector */}
      <div className="border rounded-xl p-4">
        <label className="block text-sm mb-2">Pick for league</label>
        {leagues.length === 0 ? (
          <div className="text-sm">
            You’re not in any leagues yet.{' '}
            <Link href="/leagues/new" className="underline">Create one</Link> or{' '}
            <Link href="/leagues/join" className="underline">join with a code</Link>.
          </div>
        ) : (
          <select
            className="border rounded-lg p-2"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}  // value is pure UUID
          >
            {leagues.map(l => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.invite_code})
              </option>
            ))}
          </select>
        )}
        {!UUID_RE.test(leagueId) && (
          <p className="text-xs text-amber-600 mt-2">
            Select a league to enable auto‑save.
          </p>
        )}
      </div>

      {/* My Picks summary */}
      {leagueId && (
        <section className="border rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-3">
            My Picks {currentLeague ? `— ${currentLeague.name}` : ''}
          </h2>

          {myPicksForLeague.length === 0 ? (
            <p className="text-sm opacity-80">No picks saved yet for this league.</p>
          ) : (
            <ul className="space-y-2">
              {myPicksForLeague
                .sort((a, b) =>
                  (fightsById[a.fight_id]?.bout_order ?? 0) -
                  (fightsById[b.fight_id]?.bout_order ?? 0)
                )
                .map((p) => {
                  const f = fightsById[p.fight_id];
                  if (!f) return null;
                  const winnerName = p.winner === 'red' ? f.red_name : f.blue_name;
                  const roundText = p.method === 'DEC' ? '' : (p.round ? `, R${p.round}` : '');
                  const justSaved =
                    savedAt[p.fight_id] && Date.now() - savedAt[p.fight_id] < 1500;
                  return (
                    <li key={p.fight_id} className="text-sm">
                      <span className="font-medium">
                        {f.red_name} vs {f.blue_name}
                      </span>
                      <span className="opacity-80">
                        {' '}— {winnerName} via {p.method}{roundText}
                      </span>
                      {justSaved && <span className="ml-2 text-green-600">Saved</span>}
                    </li>
                  );
                })}
            </ul>
          )}
          <p className="text-xs opacity-60 mt-2">
            Changes are auto‑saved for the selected league.
          </p>
        </section>
      )}

      {/* Fights & inputs (auto‑save on change) */}
      <div className="space-y-4">
        {fights.map((f) => {
          const pick = picks[f.id];
          const isSaving = !!saving[f.id];

          return (
            <div key={f.id} className="border rounded-xl p-4">
              <div className="font-semibold mb-1">
                {f.red_name} vs {f.blue_name}
              </div>
              <div className="text-xs opacity-70 mb-3">
                Scheduled rounds: {f.scheduled_rounds}
              </div>

              {/* Winner */}
              <div className="mb-3">
                <div className="text-sm mb-1">Winner</div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`winner-${f.id}`}
                      checked={(pick?.winner ?? 'red') === 'red'}
                      onChange={() => updateLocalPick(f, { winner: 'red' })}
                      disabled={!UUID_RE.test(leagueId)}
                    />
                    {f.red_name}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`winner-${f.id}`}
                      checked={(pick?.winner ?? 'red') === 'blue'}
                      onChange={() => updateLocalPick(f, { winner: 'blue' })}
                      disabled={!UUID_RE.test(leagueId)}
                    />
                    {f.blue_name}
                  </label>
                </div>
              </div>

              {/* Method */}
              <div className="mb-3">
                <div className="text-sm mb-1">Method</div>
                <div className="flex flex-wrap gap-3">
                  {methods.map((m) => (
                    <label key={m} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`method-${f.id}`}
                        checked={(pick?.method ?? methods[0]) === m}
                        onChange={() => updateLocalPick(f, { method: m })}
                        disabled={!UUID_RE.test(leagueId)}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              {/* Round (ignored for DEC) */}
              <div className="mb-1">
                <div className="text-sm mb-1">Round (ignored for decisions)</div>
                <select
                  className="border rounded-lg p-2"
                  value={pick?.round ?? ''}
                  onChange={(e) =>
                    updateLocalPick(f, {
                      round: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  disabled={!UUID_RE.test(leagueId)}
                >
                  <option value="">—</option>
                  {roundsOptions.slice(0, f.scheduled_rounds).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Saving status */}
              <div className="text-xs opacity-70 h-5">
                {isSaving ? 'Saving…' : (savedAt[f.id] ? 'Saved' : '')}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-red-600">{error}</p>}
      {currentLeague && (
        <p className="text-xs opacity-70">
          Auto‑saving picks to league: <strong>{currentLeague.name}</strong> ({currentLeague.invite_code})
        </p>
      )}
    </main>
  );
}
