import { NextResponse } from 'next/server';
import { fetchHiscores } from '@/lib/hiscores';

/** Player lookups vary per request, so don't cache them at the framework level. */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const player = new URL(request.url).searchParams.get('player') ?? '';
  const result = await fetchHiscores(player);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.player);
}
