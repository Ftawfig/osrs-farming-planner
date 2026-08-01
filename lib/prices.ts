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
  willowSeed: 58,
  mapleSeed: 3413,
  yewSeed: 21284,
  magicSeed: 72892,
  oakRoots: 192,
  willowRoots: 14,
  mapleRoots: 15,
  yewRoots: 79,
  magicRoots: 6554,
  oakLogs: 36,
  willowLogs: 23,
  mapleLogs: 14,
  yewLogs: 116,
  magicLogs: 774,
  appleSeed: 12,
  bananaSeed: 28,
  orangeSeed: 8,
  currySeed: 24,
  pineappleSeed: 92,
  papayaSeed: 1527,
  palmSeed: 16614,
  dragonfruitSeed: 136320,
  cookingApple: 28,
  banana: 51,
  orange: 243,
  curryLeaf: 48,
  pineapple: 198,
  papaya: 1717,
  coconut: 1599,
  dragonfruit: 793,
  tomatoes5: 726,
  apples5: 480,
  oranges5: 2416,
  strawberries5: 537,
  bananas5: 630,
  cactusSpine: 1499,
  sweetcorn: 112,
  watermelon: 21,
  guamSeed: 13,
  marrentillSeed: 18,
  tarrominSeed: 12,
  harralanderSeed: 66,
  ranarrSeed: 28480,
  toadflaxSeed: 929,
  iritSeed: 110,
  avantoeSeed: 328,
  kwuarmSeed: 2180,
  snapdragonSeed: 46078,
  cadantineSeed: 5783,
  lantadymeSeed: 91,
  dwarfWeedSeed: 680,
  torstolSeed: 15371,
  grimyGuam: 173,
  grimyMarrentill: 169,
  grimyTarromin: 121,
  grimyHarralander: 296,
  grimyRanarr: 5203,
  grimyToadflax: 1943,
  grimyIrit: 1327,
  grimyAvantoe: 1329,
  grimyKwuarm: 1866,
  grimySnapdragon: 7086,
  grimyCadantine: 2266,
  grimyLantadyme: 1376,
  grimyDwarfWeed: 1358,
  grimyTorstol: 3144,
  compost: 18,
  supercompost: 40,
  ultracompost: 535,
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
