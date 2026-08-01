import CropCompare from '@/components/crop-compare';

export const metadata = {
  title: 'Crop rates · OSRS Farming Planner',
  description: 'XP and profit rates for every farmable tree, hardwood, fruit tree and herb.',
};

/** Prices, stats and shared state all live in the layout's PlannerProvider. */
export default function Page() {
  return <CropCompare />;
}
