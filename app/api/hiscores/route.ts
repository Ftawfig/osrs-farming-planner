import { NextResponse } from 'next/server';

/** Player lookups are per-name; don't cache them at the framework level. */
export const dynamic = 'force-dynamic';

const UPSTREAM = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json';

const USER_AGENT =
  process.env.PRICE_API_USER_AGENT ?? 'osrs-farming-calc/1.0 (personal farming calculator)';

interface HiscoreSkill {
  id: number;
  name: string;
  rank: number;
  level: number;
  xp: number;
}

export async function GET(request: Request) {
  const player = new URL(request.url).searchParams.get('player')?.trim();

  if (!player) {
    return NextResponse.json({ error: 'Enter a character name.' }, { status: 400 });
  }
  // OSRS names: 1-12 chars, letters/digits/space/underscore/hyphen.
  if (!/^[A-Za-z0-9 _-]{1,12}$/.test(player)) {
    return NextResponse.json({ error: 'That is not a valid OSRS name.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${UPSTREAM}?player=${encodeURIComponent(player)}`, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return NextResponse.json({ error: `No hiscore entry for "${player}".` }, { status: 404 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `Hiscores returned ${res.status}.` }, { status: 502 });
    }

    const json = (await res.json()) as { name?: string; skills?: HiscoreSkill[] };
    const farming = json.skills?.find((s) => s.name === 'Farming');

    if (!farming || farming.xp < 0) {
      return NextResponse.json({ error: 'No ranked Farming XP for that account.' }, { status: 404 });
    }

    return NextResponse.json({
      name: json.name ?? player,
      level: farming.level,
      xp: farming.xp,
      rank: farming.rank,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lookup failed.' },
      { status: 502 },
    );
  }
}
