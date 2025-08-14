'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();

  // Supabase reads the tokens from the URL and stores the session automatically.
  // We just give it a moment, then send the user home.
  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 600);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Signing you in…</h1>
      <p className="opacity-75">One moment while we finish authentication.</p>
    </main>
  );
}
