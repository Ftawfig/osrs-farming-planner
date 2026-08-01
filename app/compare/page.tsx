import CropCompare from '@/components/crop-compare';
import { DEFAULT_RSN, fetchHiscores } from '@/lib/hiscores';
import { fetchPrices } from '@/lib/prices';

/** Same 5 minute window as the planner. Must be a literal for segment config. */
export const revalidate = 300;

export const metadata = {
  title: 'Crop rates · OSRS Farming Planner',
  description: 'XP and profit rates for every farmable tree, hardwood, fruit tree and herb.',
};

export default async function Page() {
  const [prices, hiscores] = await Promise.all([fetchPrices(), fetchHiscores(DEFAULT_RSN, 300)]);

  return <CropCompare initial={prices} initialPlayer={hiscores.ok ? hiscores.player : null} />;
}
