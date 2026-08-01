import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Nav } from '@/components/nav';
import { PlannerProvider } from '@/components/planner-provider';
import { DEFAULT_RSN, fetchHiscores } from '@/lib/hiscores';
import { fetchPrices } from '@/lib/prices';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'OSRS Farming 99 Planner',
  description:
    'Model tree, hardwood, fruit tree and herb runs to 99 Farming in Old School RuneScape with live Grand Exchange prices.',
};

/**
 * Prices and stats are fetched here rather than per page so both routes share
 * one copy, and the provider below stays mounted across client-side navigation.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [prices, hiscores] = await Promise.all([fetchPrices(), fetchHiscores(DEFAULT_RSN, 300)]);

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PlannerProvider
          initialPrices={prices}
          initialPlayer={hiscores.ok ? hiscores.player : null}
          defaultRsn={DEFAULT_RSN}
        >
          <Nav />
          {children}
        </PlannerProvider>
      </body>
    </html>
  );
}
