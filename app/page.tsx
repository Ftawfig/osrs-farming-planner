import Planner from '@/components/planner';
import { DEFAULT_RSN, fetchHiscores } from '@/lib/hiscores';
import { parseCropSelection } from '@/lib/model';
import { fetchPrices } from '@/lib/prices';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [prices, hiscores, sp] = await Promise.all([
    fetchPrices(),
    fetchHiscores(DEFAULT_RSN, 300),
    searchParams,
  ]);

  // Crop picks arrive from the rates page as ?herb=ranarr&hardwood=camphor etc.
  const selection = parseCropSelection({
    get: (name) => {
      const v = sp[name];
      return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
    },
  });

  return (
    <Planner
      initial={prices}
      defaultRsn={DEFAULT_RSN}
      initialPlayer={hiscores.ok ? hiscores.player : null}
      initialCrops={selection}
    />
  );
}
