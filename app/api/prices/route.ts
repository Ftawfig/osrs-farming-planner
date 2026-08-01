import { NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/prices';

/** Literal required by Next's segment config validation; matches PRICE_REVALIDATE. */
export const revalidate = 300;

export async function GET() {
  return NextResponse.json(await fetchPrices());
}
