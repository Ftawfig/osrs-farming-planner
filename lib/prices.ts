import { ITEMS, ItemKey } from './gameData';

export interface PricePayload {
  prices: Record<ItemKey, number>;
  source: 'live' | 'fallback';
  fetchedAt: string;
  error?: string;
}

/** Cache the upstream call for 5 minutes — GE prices don't move faster than that. */
export const PRICE_REVALIDATE = 300;

const UPSTREAM = 'https://prices.runescape.wiki/api/v1/osrs/latest';

/**
 * The wiki asks for a descriptive User-Agent so they can contact you if your
 * client misbehaves. Override via PRICE_API_USER_AGENT in your Vercel env vars.
 */
const USER_AGENT =
  process.env.PRICE_API_USER_AGENT ?? 'osrs-farming-calc/1.0 (personal farming calculator)';

/** Snapshot taken 2026-07-31, used when the upstream API is unreachable. */
export const FALLBACK_PRICES: Record<ItemKey, number> = {
  acorn: 84,
  willowSeed: 53,
  mapleSeed: 3359,
  yewSeed: 21409,
  magicSeed: 72635,
  oakRoots: 46,
  willowRoots: 14,
  mapleRoots: 15,
  yewRoots: 78,
  magicRoots: 6515,
  oakLogs: 36,
  willowLogs: 23,
  mapleLogs: 14,
  yewLogs: 115,
  magicLogs: 772,
  teakSeed: 161,
  mahoganySeed: 206,
  camphorSeed: 3228,
  ironwoodSeed: 36317,
  rosewoodSeed: 158069,
  teakLogs: 127,
  mahoganyLogs: 166,
  camphorLogs: 378,
  ironwoodLogs: 98,
  rosewoodLogs: 495,
  limpwurtRoot: 234,
  yanillianHops: 854,
  whiteBerries: 676,
  appleSeed: 12,
  bananaSeed: 25,
  orangeSeed: 17,
  currySeed: 44,
  pineappleSeed: 72,
  papayaSeed: 1366,
  palmSeed: 16711,
  dragonfruitSeed: 137201,
  cookingApple: 28,
  banana: 51,
  orange: 240,
  curryLeaf: 49,
  pineapple: 210,
  papaya: 1717,
  coconut: 1529,
  dragonfruit: 793,
  tomatoes5: 850,
  apples5: 493,
  oranges5: 2306,
  strawberries5: 408,
  bananas5: 613,
  cactusSpine: 1499,
  sweetcorn: 112,
  watermelon: 21,
  guamSeed: 14,
  marrentillSeed: 17,
  tarrominSeed: 9,
  harralanderSeed: 65,
  ranarrSeed: 27947,
  toadflaxSeed: 929,
  iritSeed: 80,
  avantoeSeed: 349,
  kwuarmSeed: 1607,
  snapdragonSeed: 43819,
  cadantineSeed: 5254,
  lantadymeSeed: 90,
  dwarfWeedSeed: 587,
  torstolSeed: 15382,
  grimyGuam: 178,
  grimyMarrentill: 181,
  grimyTarromin: 113,
  grimyHarralander: 284,
  grimyRanarr: 5202,
  grimyToadflax: 1931,
  grimyIrit: 1352,
  grimyAvantoe: 1376,
  grimyKwuarm: 1826,
  grimySnapdragon: 7096,
  grimyCadantine: 2278,
  grimyLantadyme: 1308,
  grimyDwarfWeed: 1338,
  grimyTorstol: 3072,
  compost: 9,
  supercompost: 25,
  ultracompost: 559,
  volcanicAsh: 95,
};

interface LatestEntry {
  high: number | null;
  low: number | null;
}

export async function fetchPrices(): Promise<PricePayload> {
  try {
    const res = await fetch(UPSTREAM, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: PRICE_REVALIDATE },
    });
    if (!res.ok) throw new Error(`upstream responded ${res.status}`);

    const json = (await res.json()) as { data: Record<string, LatestEntry> };
    const prices = { ...FALLBACK_PRICES };

    for (const [key, id] of Object.entries(ITEMS) as [ItemKey, number][]) {
      const entry = json.data[String(id)];
      // Both instant-buy and instant-sell exist for these items; the midpoint is
      // the fairest single number for "what this costs me in practice".
      const high = entry?.high ?? entry?.low;
      const low = entry?.low ?? entry?.high;
      if (high == null || low == null) continue;
      prices[key] = Math.round((high + low) / 2);
    }

    return { prices, source: 'live', fetchedAt: new Date().toISOString() };
  } catch (err) {
    return {
      prices: FALLBACK_PRICES,
      source: 'fallback',
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}
