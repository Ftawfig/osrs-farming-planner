/**
 * Vendors the item and skill sprites the UI draws into `public/icons`.
 *
 * Item icons come from RuneLite's cache mirror, which serves the game's own
 * 36x32 inventory sprite for any item id — the same ids `lib/gameData.ts`
 * already keeps for the GE price lookup. The Farming icon is the skill tab
 * sprite from the OSRS wiki.
 *
 * Run with `npm run icons`. It only fetches what is missing, so re-running is
 * cheap; pass --force to refetch everything.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITEM_DIR = join(ROOT, 'public', 'icons', 'items');
const FARMING_PATH = join(ROOT, 'public', 'icons', 'farming.png');

const ITEM_ICON = (id) => `https://static.runelite.net/cache/item/icon/${id}.png`;
const FARMING_ICON = 'https://oldschool.runescape.wiki/images/Farming_icon.png';

/** The wiki asks for a descriptive User-Agent; RuneLite's mirror is happy with one too. */
const USER_AGENT = 'osrs-farming-calc/1.0 (icon vendoring script)';

const force = process.argv.includes('--force');

/**
 * Pull the ids out of the two `key: id,` blocks rather than importing them —
 * these are TypeScript modules, and a regex over a hand-maintained literal is
 * less machinery than a loader.
 */
async function iconIds() {
  const ids = new Map();
  const sources = [
    { file: 'lib/gameData.ts', name: 'ITEMS' },
    { file: 'lib/icons.ts', name: 'ICON_ONLY_ITEMS' },
  ];

  for (const { file, name } of sources) {
    const src = await readFile(join(ROOT, file), 'utf8');
    const block = src.match(new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\n\\} as const;`));
    if (!block) throw new Error(`could not find ${name} in ${file}`);
    for (const [, key, id] of block[1].matchAll(/^\s*(\w+):\s*(\d+),/gm)) ids.set(Number(id), key);
  }
  return ids;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body = Buffer.from(await res.arrayBuffer());
  // A 404 page saved as a .png is worse than no file at all.
  if (body.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error('response was not a PNG');
  await writeFile(dest, body);
  return body.length;
}

const ids = await iconIds();
await mkdir(ITEM_DIR, { recursive: true });

let fetched = 0;
let skipped = 0;
const failed = [];

for (const [id, key] of ids) {
  const dest = join(ITEM_DIR, `${id}.png`);
  if (!force && existsSync(dest)) {
    skipped++;
    continue;
  }
  try {
    await download(ITEM_ICON(id), dest);
    fetched++;
  } catch (err) {
    failed.push(`${key} (${id}): ${err.message}`);
  }
}

if (force || !existsSync(FARMING_PATH)) {
  try {
    await download(FARMING_ICON, FARMING_PATH);
    fetched++;
  } catch (err) {
    failed.push(`farming icon: ${err.message}`);
  }
} else {
  skipped++;
}

console.log(`${fetched} fetched, ${skipped} already present, ${failed.length} failed`);
if (failed.length) {
  console.error(failed.map((f) => `  ${f}`).join('\n'));
  process.exitCode = 1;
}
