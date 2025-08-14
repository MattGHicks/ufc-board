import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header"; // Header is a Client Component — that's fine.

export const metadata: Metadata = {
  title: "UFC Betting Board",
  description: "Make picks and track points",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
