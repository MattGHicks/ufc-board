// src/app/page.tsx
'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type EventRow = {
  id: string;
  name: string;
  date: string;
  status: string;
};

export default function HomePage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setEvents((data ?? []) as EventRow[]);
      }
    })();
  }, []);

  if (error) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">UFC Betting Board</h1>
        <p className="text-red-600">Error loading events: {error}</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upcoming Events</h1>
      <ul className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id} className="border rounded-xl p-4">
            <Link href={`/events/${ev.id}`} className="font-semibold hover:underline">
              {ev.name}
            </Link>
            <div className="text-sm opacity-80">
              {/* Client-side formatting avoids SSR/CSR mismatch */}
              {new Date(ev.date).toLocaleString()}
            </div>
            <div className="text-xs uppercase tracking-wide opacity-60">
              {ev.status}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
