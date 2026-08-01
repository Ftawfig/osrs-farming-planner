/** Character whose stats the planner loads on first paint. */
export const DEFAULT_RSN = process.env.DEFAULT_RSN ?? 'Grixwell';

const UPSTREAM = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json';

const USER_AGENT = process.env.PRICE_API_USER_AGENT ?? 'osrs-farming-calc/1.0 (personal farming calculator)';

/** OSRS names: 1-12 chars, letters/digits/space/underscore/hyphen. */
export const RSN_PATTERN = /^[A-Za-z0-9 _-]{1,12}$/;

export interface Player {
  name: string;
  level: number;
  xp: number;
  rank: number;
}

export type HiscoreResult = { ok: true; player: Player } | { ok: false; error: string; status: number };

interface HiscoreSkill {
  id: number;
  name: string;
  rank: number;
  level: number;
  xp: number;
}

/**
 * Look up a character's Farming XP.
 * Pass `revalidate` to cache the result (used by the page); omit it for a
 * live read (used by the API route, where the name varies per request).
 */
export async function fetchHiscores(player: string, revalidate?: number): Promise<HiscoreResult> {
  const name = player.trim();
  if (!name) return { ok: false, error: 'Enter a character name.', status: 400 };
  if (!RSN_PATTERN.test(name)) return { ok: false, error: 'That is not a valid OSRS name.', status: 400 };

  try {
    const res = await fetch(`${UPSTREAM}?player=${encodeURIComponent(name)}`, {
      headers: { 'User-Agent': USER_AGENT },
      ...(revalidate === undefined ? { cache: 'no-store' as const } : { next: { revalidate } }),
    });

    if (res.status === 404) return { ok: false, error: `No hiscore entry for "${name}".`, status: 404 };
    if (!res.ok) return { ok: false, error: `Hiscores returned ${res.status}.`, status: 502 };

    const json = (await res.json()) as { name?: string; skills?: HiscoreSkill[] };
    const farming = json.skills?.find((s) => s.name === 'Farming');

    if (!farming || farming.xp < 0) {
      return { ok: false, error: 'No ranked Farming XP for that account.', status: 404 };
    }

    return {
      ok: true,
      player: { name: json.name ?? name, level: farming.level, xp: farming.xp, rank: farming.rank },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Lookup failed.', status: 502 };
  }
}
