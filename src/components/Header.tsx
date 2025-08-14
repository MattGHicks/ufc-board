'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Get current user on load
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    });

    // Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setEmail(session?.user?.email ?? null)
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <header className="border-b">
      {/* Top bar */}
      <div className="max-w-3xl mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="font-bold">UFC Betting Board</Link>

        {email ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="opacity-80">{email}</span>
            <button onClick={signOut} className="border rounded-lg px-3 py-1">
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-sm border rounded-lg px-3 py-1">
            Sign in
          </Link>
        )}
      </div>

      {/* Secondary nav (only when signed in) */}
      {email && (
        <nav className="border-t">
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-2">
            <Link href="/leagues/new" className="text-sm border rounded-lg px-3 py-1">
              New League
            </Link>
            <Link href="/leagues/join" className="text-sm border rounded-lg px-3 py-1">
              Join League
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
