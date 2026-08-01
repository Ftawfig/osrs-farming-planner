import Planner from '@/components/planner';
import { DEFAULT_RSN, fetchHiscores } from '@/lib/hiscores';
import { fetchPrices } from '@/lib/prices';

/**
 * Re-render the page (and re-pull prices + stats) every 5 minutes.
 * Must be a literal — Next refuses imported constants in segment config.
 */
export const revalidate = 300;

export default async function Page() {
  const [prices, hiscores] = await Promise.all([fetchPrices(), fetchHiscores(DEFAULT_RSN, 300)]);

  return (
    <Planner
      initial={prices}
      defaultRsn={DEFAULT_RSN}
      initialPlayer={hiscores.ok ? hiscores.player : null}
    />
  );
}
