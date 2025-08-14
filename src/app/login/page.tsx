'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle'|'sending'|'sent'|'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending'); setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'http://localhost:3000/auth/callback' },
    });
    if (error) { setError(error.message); setStatus('error'); }
    else setStatus('sent');
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/auth/callback' },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Sign in</h1>

      <button onClick={signInWithGoogle} className="w-full border rounded-xl p-3">
        Continue with Google
      </button>

      <div className="text-center opacity-60">or</div>

      <form onSubmit={sendMagicLink} className="space-y-4">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl p-3"
        />
        <button type="submit" disabled={status === 'sending'} className="w-full rounded-xl p-3 border">
          {status === 'sending' ? 'Sending…' : 'Send magic link'}
        </button>
        {status === 'sent' && <p className="text-green-600">Check your email for the link.</p>}
        {status === 'error' && <p className="text-red-600">{error}</p>}
      </form>
    </main>
  );
}
