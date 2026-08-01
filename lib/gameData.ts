/**
 * Static OSRS game data used by the farming model.
 * Sources: oldschool.runescape.wiki — individual seed pages, Tree patch,
 * Fruit tree patch, Herb patch, Disease (Farming), Farmer's outfit.
 */

/** Cumulative XP required for each level, index 1..99. */
export const XP_TABLE: number[] = (() => {
  const table = [0, 0];
  let points = 0;
  for (let lvl = 1; lvl < 99; lvl++) {
    points += Math.floor(lvl + 300 * Math.pow(2, lvl / 7));
    table[lvl + 1] = Math.floor(points / 4);
  }
  return table;
})();

export const MAX_XP = XP_TABLE[99];

export function xpForLevel(level: number): number {
  return XP_TABLE[Math.max(1, Math.min(99, Math.floor(level)))];
}

/** Level at a given total XP (capped at 99). */
export function levelForXp(xp: number): number {
  for (let lvl = 99; lvl >= 1; lvl--) {
    if (xp >= XP_TABLE[lvl]) return lvl;
  }
  return 1;
}

/** Fractional level, e.g. 93.5 = halfway from 93 to 94. Useful for charts. */
export function preciseLevel(xp: number): number {
  const lvl = levelForXp(xp);
  if (lvl >= 99) return 99;
  const span = XP_TABLE[lvl + 1] - XP_TABLE[lvl];
  return lvl + (xp - XP_TABLE[lvl]) / span;
}

/** GE item IDs, verified against the prices.runescape.wiki mapping endpoint. */
export const ITEMS = {
  // Tree seeds
  acorn: 5312,
  willowSeed: 5313,
  mapleSeed: 5314,
  yewSeed: 5315,
  magicSeed: 5316,
  // Tree roots
  oakRoots: 6043,
  willowRoots: 6045,
  mapleRoots: 6047,
  yewRoots: 6049,
  magicRoots: 6051,
  // Tree logs
  oakLogs: 1521,
  willowLogs: 1519,
  mapleLogs: 1517,
  yewLogs: 1515,
  magicLogs: 1513,
  // Fruit tree seeds
  appleSeed: 5283,
  bananaSeed: 5284,
  orangeSeed: 5285,
  currySeed: 5286,
  pineappleSeed: 5287,
  papayaSeed: 5288,
  palmSeed: 5289,
  dragonfruitSeed: 22877,
  // Fruit
  cookingApple: 1955,
  banana: 1963,
  orange: 2108,
  curryLeaf: 5970,
  pineapple: 2114,
  papaya: 5972,
  coconut: 5974,
  dragonfruit: 22929,
  // Protection payment items
  tomatoes5: 5968,
  apples5: 5386,
  oranges5: 5396,
  strawberries5: 5406,
  bananas5: 5416,
  cactusSpine: 6016,
  sweetcorn: 5986,
  watermelon: 5982,
  // Herb seeds
  guamSeed: 5291,
  marrentillSeed: 5292,
  tarrominSeed: 5293,
  harralanderSeed: 5294,
  ranarrSeed: 5295,
  toadflaxSeed: 5296,
  iritSeed: 5297,
  avantoeSeed: 5298,
  kwuarmSeed: 5299,
  snapdragonSeed: 5300,
  cadantineSeed: 5301,
  lantadymeSeed: 5302,
  dwarfWeedSeed: 5303,
  torstolSeed: 5304,
  // Grimy herbs
  grimyGuam: 199,
  grimyMarrentill: 201,
  grimyTarromin: 203,
  grimyHarralander: 205,
  grimyRanarr: 207,
  grimyToadflax: 3049,
  grimyIrit: 209,
  grimyAvantoe: 211,
  grimyKwuarm: 213,
  grimySnapdragon: 3051,
  grimyCadantine: 215,
  grimyLantadyme: 2485,
  grimyDwarfWeed: 217,
  grimyTorstol: 219,
  // Compost
  compost: 6032,
  supercompost: 6034,
  ultracompost: 21483,
  volcanicAsh: 21622,
} as const;

export type ItemKey = keyof typeof ITEMS;

export const ITEM_NAMES: Record<ItemKey, string> = {
  acorn: 'Acorn',
  willowSeed: 'Willow seed',
  mapleSeed: 'Maple seed',
  yewSeed: 'Yew seed',
  magicSeed: 'Magic seed',
  oakRoots: 'Oak roots',
  willowRoots: 'Willow roots',
  mapleRoots: 'Maple roots',
  yewRoots: 'Yew roots',
  magicRoots: 'Magic roots',
  oakLogs: 'Oak logs',
  willowLogs: 'Willow logs',
  mapleLogs: 'Maple logs',
  yewLogs: 'Yew logs',
  magicLogs: 'Magic logs',
  appleSeed: 'Apple tree seed',
  bananaSeed: 'Banana tree seed',
  orangeSeed: 'Orange tree seed',
  currySeed: 'Curry tree seed',
  pineappleSeed: 'Pineapple seed',
  papayaSeed: 'Papaya tree seed',
  palmSeed: 'Palm tree seed',
  dragonfruitSeed: 'Dragonfruit tree seed',
  cookingApple: 'Cooking apple',
  banana: 'Banana',
  orange: 'Orange',
  curryLeaf: 'Curry leaf',
  pineapple: 'Pineapple',
  papaya: 'Papaya fruit',
  coconut: 'Coconut',
  dragonfruit: 'Dragonfruit',
  tomatoes5: 'Tomatoes(5)',
  apples5: 'Apples(5)',
  oranges5: 'Oranges(5)',
  strawberries5: 'Strawberries(5)',
  bananas5: 'Bananas(5)',
  cactusSpine: 'Cactus spine',
  sweetcorn: 'Sweetcorn',
  watermelon: 'Watermelon',
  guamSeed: 'Guam seed',
  marrentillSeed: 'Marrentill seed',
  tarrominSeed: 'Tarromin seed',
  harralanderSeed: 'Harralander seed',
  ranarrSeed: 'Ranarr seed',
  toadflaxSeed: 'Toadflax seed',
  iritSeed: 'Irit seed',
  avantoeSeed: 'Avantoe seed',
  kwuarmSeed: 'Kwuarm seed',
  snapdragonSeed: 'Snapdragon seed',
  cadantineSeed: 'Cadantine seed',
  lantadymeSeed: 'Lantadyme seed',
  dwarfWeedSeed: 'Dwarf weed seed',
  torstolSeed: 'Torstol seed',
  grimyGuam: 'Grimy guam leaf',
  grimyMarrentill: 'Grimy marrentill',
  grimyTarromin: 'Grimy tarromin',
  grimyHarralander: 'Grimy harralander',
  grimyRanarr: 'Grimy ranarr weed',
  grimyToadflax: 'Grimy toadflax',
  grimyIrit: 'Grimy irit leaf',
  grimyAvantoe: 'Grimy avantoe',
  grimyKwuarm: 'Grimy kwuarm',
  grimySnapdragon: 'Grimy snapdragon',
  grimyCadantine: 'Grimy cadantine',
  grimyLantadyme: 'Grimy lantadyme',
  grimyDwarfWeed: 'Grimy dwarf weed',
  grimyTorstol: 'Grimy torstol',
  compost: 'Compost',
  supercompost: 'Supercompost',
  ultracompost: 'Ultracompost',
  volcanicAsh: 'Volcanic ash',
};

/* ------------------------------------------------------------------ */
/* Compost & disease                                                   */
/* ------------------------------------------------------------------ */

export const COMPOST = {
  none: { label: 'No compost', diseaseReduction: 0, extraLives: 0, item: null as ItemKey | null },
  compost: { label: 'Compost', diseaseReduction: 0.5, extraLives: 1, item: 'compost' as ItemKey | null },
  supercompost: { label: 'Supercompost', diseaseReduction: 0.8, extraLives: 2, item: 'supercompost' as ItemKey | null },
  ultracompost: { label: 'Ultracompost', diseaseReduction: 0.9, extraLives: 3, item: 'ultracompost' as ItemKey | null },
} as const;

export type CompostTier = keyof typeof COMPOST;

/** Protection strategy. `pay` is unavailable for herb patches. */
export type Strategy = CompostTier | 'pay';

export const STRATEGY_LABEL: Record<Strategy, string> = {
  pay: 'Pay the gardener',
  ultracompost: 'Ultracompost',
  supercompost: 'Supercompost',
  compost: 'Compost',
  none: 'No protection',
};

/**
 * Per-cycle disease chance out of 128, after compost.
 * Wiki: compost reduces disease "by 50%, 80% or 90%, rounded down to the
 * nearest 1/128th", to a minimum chance of 1/128 per growth cycle.
 */
export function diseaseChancePerCycle(base128: number, tier: CompostTier, floorAtOne = true): number {
  const reduction = COMPOST[tier].diseaseReduction;
  if (reduction === 0) return base128 / 128;
  const reduced = Math.floor(base128 * (1 - reduction));
  return (floorAtOne ? Math.max(1, reduced) : reduced) / 128;
}

/** Probability a crop survives every vulnerable growth cycle. */
export function survivalChance(base128: number, cycles: number, tier: CompostTier, floorAtOne = true): number {
  return Math.pow(1 - diseaseChancePerCycle(base128, tier, floorAtOne), cycles);
}

/* ------------------------------------------------------------------ */
/* Trees                                                               */
/* ------------------------------------------------------------------ */

export interface TreeDef {
  name: string;
  level: number;
  plantXp: number;
  checkXp: number;
  /** Growth stages; a tree is disease-vulnerable for stages - 1 cycles. */
  stages: number;
  growthMinutes: number;
  diseaseBase128: number;
  payItem: ItemKey;
  payQty: number;
  seedItem: ItemKey;
  rootsItem: ItemKey;
  logsItem: ItemKey;
}

/**
 * Disease base rates: maple (13/128 over 7 cycles) and magic (9/128 over 11)
 * are the only tree values the wiki publishes. Both fit base = 20 - cycles,
 * which is what oak/willow/yew use here.
 */
export const TREES = {
  oak: {
    name: 'Oak', level: 15, plantXp: 14, checkXp: 467.3, stages: 4, growthMinutes: 160,
    diseaseBase128: 17, payItem: 'tomatoes5', payQty: 1,
    seedItem: 'acorn', rootsItem: 'oakRoots', logsItem: 'oakLogs',
  },
  willow: {
    name: 'Willow', level: 30, plantXp: 25, checkXp: 1456.5, stages: 6, growthMinutes: 240,
    diseaseBase128: 15, payItem: 'apples5', payQty: 1,
    seedItem: 'willowSeed', rootsItem: 'willowRoots', logsItem: 'willowLogs',
  },
  maple: {
    name: 'Maple', level: 45, plantXp: 45, checkXp: 3403.4, stages: 8, growthMinutes: 320,
    diseaseBase128: 13, payItem: 'oranges5', payQty: 1,
    seedItem: 'mapleSeed', rootsItem: 'mapleRoots', logsItem: 'mapleLogs',
  },
  yew: {
    name: 'Yew', level: 60, plantXp: 81, checkXp: 7069.9, stages: 10, growthMinutes: 400,
    diseaseBase128: 11, payItem: 'cactusSpine', payQty: 10,
    seedItem: 'yewSeed', rootsItem: 'yewRoots', logsItem: 'yewLogs',
  },
  magic: {
    name: 'Magic', level: 75, plantXp: 145.5, checkXp: 13768.3, stages: 12, growthMinutes: 480,
    diseaseBase128: 9, payItem: 'coconut', payQty: 25,
    seedItem: 'magicSeed', rootsItem: 'magicRoots', logsItem: 'magicLogs',
  },
} as const satisfies Record<string, TreeDef>;

export type TreeKey = keyof typeof TREES;

/**
 * Roots from digging up a felled tree. The count is deterministic, stepping up
 * every 8 Farming levels from the tree's own requirement and capping at 4 —
 * yew gives 1/2/3/4 at 60/68/76/84, magic at 75/83/91/99.
 */
export const MAX_ROOTS_PER_TREE = 4;
export const ROOTS_LEVEL_STEP = 8;

export function rootsPerTree(tree: TreeDef, farmingLevel: number): number {
  if (farmingLevel < tree.level) return 0;
  return Math.min(MAX_ROOTS_PER_TREE, 1 + Math.floor((farmingLevel - tree.level) / ROOTS_LEVEL_STEP));
}

/**
 * Farmed trees have a 1/8 chance to deplete per log cut, so felling one to reach
 * the stump yields 8 logs on average.
 */
export const TREE_DEPLETE_CHANCE = 1 / 8;
export const EXPECTED_LOGS_PER_TREE = 1 / TREE_DEPLETE_CHANCE;

/* ------------------------------------------------------------------ */
/* Fruit trees                                                         */
/* ------------------------------------------------------------------ */

export interface FruitTreeDef {
  name: string;
  level: number;
  plantXp: number;
  checkXp: number;
  harvestXpPerFruit: number;
  payItem: ItemKey;
  payQty: number;
  seedItem: ItemKey;
  fruitItem: ItemKey;
}

/** Every fruit tree: 6 stages x 160 min, 4 disease-vulnerable cycles, 18/128, 6 fruit. */
export const FRUIT_TREE_STAGES = 6;
export const FRUIT_TREE_GROWTH_MINUTES = 960;
export const FRUIT_TREE_DISEASE_BASE128 = 18;
export const FRUIT_TREE_DISEASE_CYCLES = 4;
export const FRUIT_PER_CYCLE = 6;

export const FRUIT_TREES = {
  apple: {
    name: 'Apple', level: 27, plantXp: 22, checkXp: 1199.5, harvestXpPerFruit: 8.5,
    payItem: 'sweetcorn', payQty: 9, seedItem: 'appleSeed', fruitItem: 'cookingApple',
  },
  banana: {
    name: 'Banana', level: 33, plantXp: 28, checkXp: 1750.5, harvestXpPerFruit: 10.5,
    payItem: 'apples5', payQty: 4, seedItem: 'bananaSeed', fruitItem: 'banana',
  },
  orange: {
    name: 'Orange', level: 39, plantXp: 35.5, checkXp: 2470.2, harvestXpPerFruit: 13.5,
    payItem: 'strawberries5', payQty: 3, seedItem: 'orangeSeed', fruitItem: 'orange',
  },
  curry: {
    name: 'Curry', level: 42, plantXp: 40, checkXp: 2906.9, harvestXpPerFruit: 15,
    payItem: 'bananas5', payQty: 5, seedItem: 'currySeed', fruitItem: 'curryLeaf',
  },
  pineapple: {
    name: 'Pineapple', level: 51, plantXp: 57, checkXp: 4605.7, harvestXpPerFruit: 21.5,
    payItem: 'watermelon', payQty: 10, seedItem: 'pineappleSeed', fruitItem: 'pineapple',
  },
  papaya: {
    name: 'Papaya', level: 57, plantXp: 72, checkXp: 6146.6, harvestXpPerFruit: 27,
    payItem: 'pineapple', payQty: 10, seedItem: 'papayaSeed', fruitItem: 'papaya',
  },
  palm: {
    name: 'Palm (coconut)', level: 68, plantXp: 110.5, checkXp: 10150.1, harvestXpPerFruit: 41.5,
    payItem: 'papaya', payQty: 15, seedItem: 'palmSeed', fruitItem: 'coconut',
  },
  dragonfruit: {
    name: 'Dragonfruit', level: 81, plantXp: 140, checkXp: 17335, harvestXpPerFruit: 70,
    payItem: 'coconut', payQty: 15, seedItem: 'dragonfruitSeed', fruitItem: 'dragonfruit',
  },
} as const satisfies Record<string, FruitTreeDef>;

export type FruitTreeKey = keyof typeof FRUIT_TREES;

/* ------------------------------------------------------------------ */
/* Herbs                                                               */
/* ------------------------------------------------------------------ */

export interface HerbDef {
  name: string;
  level: number;
  plantXp: number;
  harvestXp: number;
  /** Chance to save a harvest life at level 1; every herb reaches 31.6% at 99. */
  ctsLow: number;
  seedItem: ItemKey;
  productItem: ItemKey;
}

/**
 * Herb patches in rough unlock order, with the disease-free ones flagged.
 * Used to derive how many of a player's N patches are immune to disease, rather
 * than making them count it themselves.
 */
export const HERB_PATCHES: { name: string; diseaseFree: boolean }[] = [
  { name: 'Falador', diseaseFree: false },
  { name: 'Catherby', diseaseFree: false },
  { name: 'Ardougne', diseaseFree: false },
  { name: 'Port Phasmatys', diseaseFree: false },
  { name: 'Farming Guild', diseaseFree: false },
  { name: 'Hosidius', diseaseFree: true },
  { name: 'Troll Stronghold', diseaseFree: true },
  { name: 'Weiss', diseaseFree: true },
  { name: 'Harmony Island', diseaseFree: true },
  { name: 'Civitas illa Fortis', diseaseFree: true },
];

/** How many of the first `count` patches in that order are disease-free. */
export function diseaseFreeHerbPatches(count: number): number {
  return HERB_PATCHES.slice(0, count).filter((p) => p.diseaseFree).length;
}

/** Names of the disease-free patches included at a given patch count. */
export function diseaseFreeHerbPatchNames(count: number): string[] {
  return HERB_PATCHES.slice(0, count)
    .filter((p) => p.diseaseFree)
    .map((p) => p.name);
}

export const HERB_CTS_HIGH = 0.316;
export const HERB_BASE_LIVES = 3;
export const HERB_DISEASE_BASE128 = 27;
export const HERB_DISEASE_CYCLES = 3;
export const HERB_GROWTH_MINUTES = 80;

export const HERBS = {
  guam: { name: 'Guam', level: 9, plantXp: 11, harvestXp: 12.5, ctsLow: 0.102, seedItem: 'guamSeed', productItem: 'grimyGuam' },
  marrentill: { name: 'Marrentill', level: 14, plantXp: 13.5, harvestXp: 15, ctsLow: 0.113, seedItem: 'marrentillSeed', productItem: 'grimyMarrentill' },
  tarromin: { name: 'Tarromin', level: 19, plantXp: 16, harvestXp: 18, ctsLow: 0.125, seedItem: 'tarrominSeed', productItem: 'grimyTarromin' },
  harralander: { name: 'Harralander', level: 26, plantXp: 21.5, harvestXp: 24, ctsLow: 0.145, seedItem: 'harralanderSeed', productItem: 'grimyHarralander' },
  ranarr: { name: 'Ranarr weed', level: 32, plantXp: 26.5, harvestXp: 30.5, ctsLow: 0.156, seedItem: 'ranarrSeed', productItem: 'grimyRanarr' },
  toadflax: { name: 'Toadflax', level: 38, plantXp: 34, harvestXp: 38.5, ctsLow: 0.172, seedItem: 'toadflaxSeed', productItem: 'grimyToadflax' },
  irit: { name: 'Irit', level: 44, plantXp: 43, harvestXp: 48.5, ctsLow: 0.184, seedItem: 'iritSeed', productItem: 'grimyIrit' },
  avantoe: { name: 'Avantoe', level: 50, plantXp: 54.5, harvestXp: 61.5, ctsLow: 0.199, seedItem: 'avantoeSeed', productItem: 'grimyAvantoe' },
  kwuarm: { name: 'Kwuarm', level: 56, plantXp: 69, harvestXp: 78, ctsLow: 0.215, seedItem: 'kwuarmSeed', productItem: 'grimyKwuarm' },
  snapdragon: { name: 'Snapdragon', level: 62, plantXp: 87.5, harvestXp: 98.5, ctsLow: 0.227, seedItem: 'snapdragonSeed', productItem: 'grimySnapdragon' },
  cadantine: { name: 'Cadantine', level: 67, plantXp: 106.5, harvestXp: 120, ctsLow: 0.238, seedItem: 'cadantineSeed', productItem: 'grimyCadantine' },
  lantadyme: { name: 'Lantadyme', level: 73, plantXp: 134.5, harvestXp: 151.5, ctsLow: 0.254, seedItem: 'lantadymeSeed', productItem: 'grimyLantadyme' },
  dwarfWeed: { name: 'Dwarf weed', level: 79, plantXp: 170.5, harvestXp: 192, ctsLow: 0.266, seedItem: 'dwarfWeedSeed', productItem: 'grimyDwarfWeed' },
  torstol: { name: 'Torstol', level: 85, plantXp: 199.5, harvestXp: 224.5, ctsLow: 0.281, seedItem: 'torstolSeed', productItem: 'grimyTorstol' },
} as const satisfies Record<string, HerbDef>;

export type HerbKey = keyof typeof HERBS;

/**
 * Expected herbs per surviving patch: lives / (1 - chance to save).
 *
 * Yield bonuses raise the *chance to save a harvest life*, not the expected
 * yield — the wiki's own figure (ultracompost + farming cape + magic secateurs
 * averaging ~9.5 herbs at 99) only reproduces when the bonus is applied here.
 */
export function expectedHerbYield(
  herb: HerbDef,
  farmingLevel: number,
  tier: CompostTier,
  yieldBonusPct: number,
): number {
  const lvl = Math.max(1, Math.min(99, farmingLevel));
  const base = herb.ctsLow + (HERB_CTS_HIGH - herb.ctsLow) * ((lvl - 1) / 98);
  const cts = Math.min(0.99, base * (1 + yieldBonusPct / 100));
  const lives = HERB_BASE_LIVES + COMPOST[tier].extraLives;
  return lives / (1 - cts);
}

/* ------------------------------------------------------------------ */
/* Gear                                                                */
/* ------------------------------------------------------------------ */

/** Farmer's outfit — XP bonus applies to all Farming XP. Full set adds 0.5%. */
export const OUTFIT_PIECES = {
  strawhat: { label: "Farmer's strawhat", bonus: 0.4 },
  jacket: { label: "Farmer's jacket", bonus: 0.8 },
  trousers: { label: "Farmer's boro trousers", bonus: 0.6 },
  boots: { label: "Farmer's boots", bonus: 0.2 },
} as const;

export type OutfitPiece = keyof typeof OUTFIT_PIECES;
export const OUTFIT_FULL_SET_BONUS = 0.5;

export function outfitXpBonusPct(worn: Record<OutfitPiece, boolean>): number {
  const keys = Object.keys(OUTFIT_PIECES) as OutfitPiece[];
  const sum = keys.reduce((s, k) => s + (worn[k] ? OUTFIT_PIECES[k].bonus : 0), 0);
  const full = keys.every((k) => worn[k]);
  return sum + (full ? OUTFIT_FULL_SET_BONUS : 0);
}

/** Only magic secateurs affect yield (+10%); the plain pair is just a tool. */
export const SECATEURS = {
  none: { label: 'No secateurs', yieldBonusPct: 0 },
  normal: { label: 'Secateurs', yieldBonusPct: 0 },
  magic: { label: 'Magic secateurs', yieldBonusPct: 10 },
} as const;

export type SecateursKey = keyof typeof SECATEURS;

/** A worn Farming cape adds 5%, stacking additively with magic secateurs. */
export const FARMING_CAPE_YIELD_BONUS_PCT = 5;

/** Total bonus to the chance to save a harvest life. Cape is assumed at 99. */
export function yieldBonusPct(secateurs: SecateursKey, farmingLevel: number): number {
  return SECATEURS[secateurs].yieldBonusPct + (farmingLevel >= 99 ? FARMING_CAPE_YIELD_BONUS_PCT : 0);
}

/** Patch counts available in game, used as slider maximums. */
export const MAX_PATCHES = { tree: 7, fruitTree: 7, herb: 10 } as const;
