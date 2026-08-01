/**
 * Item and skill icons.
 *
 * The sprites are vendored into `public/icons` rather than hotlinked, so the UI
 * never waits on — or breaks with — a third party. Run `npm run icons` to
 * refresh them; see `scripts/fetch-icons.mjs` for the sources.
 *
 * Rights: these are Jagex's assets, not RuneLite's or the wiki's. RuneLite's
 * BSD licence covers its own code, and static.runelite.net carries no licence at
 * all — it mirrors the game cache. The wiki likewise holds its copies "used with
 * permission", which is permission granted to the wiki, and its CC BY-NC-SA
 * terms cover text only. What actually permits this app is Jagex's Fan Content
 * Policy, which the footer carries the required notice for. Two consequences
 * worth remembering: monetising this would need a separate licence from Jagex,
 * and the notice has to stay put.
 */

import {
  FRUIT_TREES,
  FruitTreeKey,
  HARDWOOD_TREES,
  HERBS,
  HardwoodKey,
  HerbKey,
  ITEMS,
  ItemKey,
  OutfitPiece,
  PatchKind,
  SecateursKey,
  TREES,
  TreeKey,
} from './gameData';

/**
 * Items that only ever appear as pictures. They are untradeable — or, for
 * coins, not an inventory item at all — so they have no GE price and stay out
 * of `ITEMS`, which the price fetcher walks.
 */
export const ICON_ONLY_ITEMS = {
  strawhat: 13646,
  jacket: 13642,
  trousers: 13640,
  boots: 13644,
  secateurs: 5329,
  magicSecateurs: 7409,
  farmingCape: 9810,
  coins: 995,
} as const;

export type IconOnlyKey = keyof typeof ICON_ONLY_ITEMS;

/** Every icon in `public/icons/items`, by the id its file is named after. */
export const ICON_IDS: Record<ItemKey | IconOnlyKey, number> = { ...ITEMS, ...ICON_ONLY_ITEMS };

export type IconKey = keyof typeof ICON_IDS;

export const itemIconSrc = (key: IconKey): string => `/icons/items/${ICON_IDS[key]}.png`;

/** Skill icon, taken from the Farming tab. */
export const FARMING_ICON = '/icons/farming.png';

/** Intrinsic pixel sizes, so icons can reserve their space before they load. */
export const ITEM_ICON_SIZE = { width: 36, height: 32 } as const;
export const SKILL_ICON_SIZE = { width: 25, height: 23 } as const;

const mapValues = <K extends string, T>(obj: Record<K, T>, pick: (v: T) => ItemKey) =>
  Object.fromEntries(
    (Object.keys(obj) as K[]).map((k) => [k, pick(obj[k])]),
  ) as Record<K, ItemKey>;

/**
 * The item that stands in for a crop.
 *
 * Produce rather than seed: at 20px a magic seed and a yew seed are two similar
 * specks, while magic logs and yew logs read instantly.
 */
export const CROP_ICONS: {
  tree: Record<TreeKey, ItemKey>;
  hardwood: Record<HardwoodKey, ItemKey>;
  fruitTree: Record<FruitTreeKey, ItemKey>;
  herb: Record<HerbKey, ItemKey>;
} = {
  tree: mapValues(TREES, (t) => t.logsItem),
  hardwood: mapValues(HARDWOOD_TREES, (t) => t.logsItem),
  fruitTree: mapValues(FRUIT_TREES, (t) => t.fruitItem),
  herb: mapValues(HERBS, (h) => h.productItem),
};

/** Icon for one crop of a patch kind, or undefined if the key is unknown. */
export function cropIcon(kind: PatchKind, key: string): ItemKey | undefined {
  return (CROP_ICONS[kind] as Record<string, ItemKey | undefined>)[key];
}

export const OUTFIT_ICONS: Record<OutfitPiece, IconOnlyKey> = {
  strawhat: 'strawhat',
  jacket: 'jacket',
  trousers: 'trousers',
  boots: 'boots',
};

/** No secateurs means no picture — the field still needs a stable slot. */
export const SECATEURS_ICONS: Record<SecateursKey, IconOnlyKey | null> = {
  none: null,
  normal: 'secateurs',
  magic: 'magicSecateurs',
};
