import Planner from '@/components/planner';
import { fetchPrices } from '@/lib/prices';

/**
 * Re-render the page (and re-pull prices) every 5 minutes.
 * Must be a literal — Next refuses imported constants in segment config.
 */
export const revalidate = 300;

export default async function Page() {
  const initial = await fetchPrices();
  return <Planner initial={initial} />;
}
