import {
  COMPOST,
  CompostTier,
  EXPECTED_LOGS_PER_TREE,
  FRUIT_PER_CYCLE,
  FRUIT_TREES,
  FRUIT_TREE_DISEASE_BASE128,
  FRUIT_TREE_DISEASE_CYCLES,
  FruitTreeKey,
  HERBS,
  HERB_DISEASE_BASE128,
  HERB_DISEASE_CYCLES,
  HerbKey,
  ITEM_NAMES,
  ItemKey,
  MAX_XP,
  OutfitPiece,
  SecateursKey,
  Strategy,
  TREES,
  TreeKey,
  diseaseFreeHerbPatches,
  expectedHerbYield,
  levelForXp,
  outfitXpBonusPct,
  preciseLevel,
  rootsPerTree,
  survivalChance,
  xpForLevel,
  yieldBonusPct,
} from './gameData';

export type PriceMap = Partial<Record<ItemKey, number>>;

export interface Config {
  currentXp: number;
  targetLevel: number;

  treeType: TreeKey;
  treePatches: number;
  treeStrategy: Strategy;
  /** Count roots towards P/L. Yield itself is derived from your Farming level. */
  sellRoots: boolean;
  /** Count the logs from felling each tree towards P/L. */
  sellLogs: boolean;

  fruitType: FruitTreeKey;
  fruitPatches: number;
  fruitStrategy: Strategy;
  /** Sell fruit left over after protection payments. */
  sellSpareFruit: boolean;

  herbType: HerbKey;
  herbPatches: number;
  /** Herb patches cannot be protected by payment — compost only. */
  herbCompost: CompostTier;
  /** Count harvested herbs towards P/L (off if you keep them for Herblore). */
  sellHerbs: boolean;

  outfit: Record<OutfitPiece, boolean>;
  secateurs: SecateursKey;

  minutesPerRun: number;
  runsPerDay: number;
  /** Apply the 1/128 floor to post-compost disease chance. */
  diseaseFloorAtOne: boolean;
}

export interface LineItem {
  label: string;
  qty: number;
  unit: number;
  total: number;
}

export interface CropResult {
  label: string;
  xp: number;
  cost: number;
  revenue: number;
  survival: number;
  planted: number;
  survived: number;
}

export interface RunResult {
  xpPerRun: number;
  /** XP before the farmer's outfit multiplier, for display. */
  baseXpPerRun: number;
  outfitBonusPct: number;
  costPerRun: number;
  revenuePerRun: number;
  netPerRun: number;
  crops: CropResult[];
  costItems: LineItem[];
  revenueItems: LineItem[];
  /** Produce grown this run that is consumed by protection payments. */
  produceFlow: { item: ItemKey; produced: number; needed: number; bought: number; spare: number }[];
  /** Derived yields, surfaced so the UI can explain what it assumed. */
  herbYieldPerPatch: number;
  /** Bonus to the chance to save a harvest life, from secateurs + cape. */
  yieldBonusPct: number;
  rootsPerTree: number;
  logsPerTree: number;
  diseaseFreeHerbPatches: number;
}

export interface TimelinePoint {
  run: number;
  day: number;
  xp: number;
  level: number;
  preciseLevel: number;
  netGp: number;
}

export interface LevelUp {
  level: number;
  run: number;
  day: number;
  xp: number;
  /** Runs spent inside this level. */
  runsForLevel: number;
}

export interface Projection {
  xpNeeded: number;
  runsNeeded: number;
  runsToNextLevel: number;
  days: number;
  hours: number;
  totalCost: number;
  totalRevenue: number;
  totalNet: number;
  gpPerXp: number;
  xpPerHour: number;
  xpPerDay: number;
  gpPerDay: number;
  run: RunResult;
  timeline: TimelinePoint[];
  levelUps: LevelUp[];
}

const price = (prices: PriceMap, key: ItemKey): number => prices[key] ?? 0;

function compostCost(prices: PriceMap, tier: CompostTier): number {
  const item = COMPOST[tier].item;
  return item ? price(prices, item) : 0;
}

export function computeRun(cfg: Config, prices: PriceMap): RunResult {
  const costItems: LineItem[] = [];
  const revenueItems: LineItem[] = [];
  const crops: CropResult[] = [];

  const push = (arr: LineItem[], label: string, qty: number, unit: number) => {
    if (qty <= 0 || unit <= 0) return;
    arr.push({ label, qty, unit, total: qty * unit });
  };

  /** Produce grown this run, and produce owed to gardeners. */
  const produced = new Map<ItemKey, number>();
  const demanded = new Map<ItemKey, number>();
  const add = (m: Map<ItemKey, number>, k: ItemKey, n: number) => m.set(k, (m.get(k) ?? 0) + n);

  // ---------- Trees ----------
  const tree = TREES[cfg.treeType];
  const treeTier: CompostTier = cfg.treeStrategy === 'pay' ? 'none' : cfg.treeStrategy;
  const treeSurvival =
    cfg.treeStrategy === 'pay'
      ? 1
      : survivalChance(tree.diseaseBase128, tree.stages - 1, treeTier, cfg.diseaseFloorAtOne);
  const treeSurvived = cfg.treePatches * treeSurvival;
  const treeXp = treeSurvived * (tree.plantXp + tree.checkXp);

  const treeSeedUnit = price(prices, tree.seedItem);
  let treeCost = cfg.treePatches * treeSeedUnit;
  push(costItems, `${tree.name} seeds`, cfg.treePatches, treeSeedUnit);

  if (cfg.treeStrategy === 'pay') {
    add(demanded, tree.payItem, cfg.treePatches * tree.payQty);
  } else if (treeTier !== 'none') {
    const unit = compostCost(prices, treeTier);
    treeCost += cfg.treePatches * unit;
    push(costItems, `${COMPOST[treeTier].label} (${tree.name.toLowerCase()})`, cfg.treePatches, unit);
  }

  // Roots and logs both require felling the tree, so they arrive together.
  const farmingLevel = levelForXp(cfg.currentXp);
  const rootsEach = rootsPerTree(tree, farmingLevel);
  const rootsQty = cfg.sellRoots ? treeSurvived * rootsEach : 0;
  const logsQty = cfg.sellLogs ? treeSurvived * EXPECTED_LOGS_PER_TREE : 0;
  const treeRevenue = rootsQty * price(prices, tree.rootsItem) + logsQty * price(prices, tree.logsItem);
  push(revenueItems, `${tree.name} roots`, rootsQty, price(prices, tree.rootsItem));
  push(revenueItems, `${tree.name} logs`, logsQty, price(prices, tree.logsItem));

  // ---------- Fruit trees ----------
  const fruit = FRUIT_TREES[cfg.fruitType];
  const fruitTier: CompostTier = cfg.fruitStrategy === 'pay' ? 'none' : cfg.fruitStrategy;
  const fruitSurvival =
    cfg.fruitStrategy === 'pay'
      ? 1
      : survivalChance(FRUIT_TREE_DISEASE_BASE128, FRUIT_TREE_DISEASE_CYCLES, fruitTier, cfg.diseaseFloorAtOne);
  const fruitSurvived = cfg.fruitPatches * fruitSurvival;
  const fruitXp =
    fruitSurvived * (fruit.plantXp + fruit.checkXp + FRUIT_PER_CYCLE * fruit.harvestXpPerFruit);

  const fruitSeedUnit = price(prices, fruit.seedItem);
  let fruitCost = cfg.fruitPatches * fruitSeedUnit;
  push(costItems, `${fruit.name} seeds`, cfg.fruitPatches, fruitSeedUnit);

  if (cfg.fruitStrategy === 'pay') {
    add(demanded, fruit.payItem, cfg.fruitPatches * fruit.payQty);
  } else if (fruitTier !== 'none') {
    const unit = compostCost(prices, fruitTier);
    fruitCost += cfg.fruitPatches * unit;
    push(costItems, `${COMPOST[fruitTier].label} (${fruit.name.toLowerCase()})`, cfg.fruitPatches, unit);
  }

  add(produced, fruit.fruitItem, fruitSurvived * FRUIT_PER_CYCLE);

  // ---------- Herbs ----------
  const herb = HERBS[cfg.herbType];
  const diseaseFree = diseaseFreeHerbPatches(cfg.herbPatches);
  const riskyPatches = cfg.herbPatches - diseaseFree;
  const herbSurvival = survivalChance(
    HERB_DISEASE_BASE128,
    HERB_DISEASE_CYCLES,
    cfg.herbCompost,
    cfg.diseaseFloorAtOne,
  );
  const herbSurvived = diseaseFree + riskyPatches * herbSurvival;
  const blendedHerbSurvival = cfg.herbPatches > 0 ? herbSurvived / cfg.herbPatches : 1;

  const yieldBonus = yieldBonusPct(cfg.secateurs, farmingLevel);
  const herbYieldPerPatch = expectedHerbYield(herb, farmingLevel, cfg.herbCompost, yieldBonus);
  const herbsHarvested = herbSurvived * herbYieldPerPatch;
  const herbXp = herbSurvived * herb.plantXp + herbsHarvested * herb.harvestXp;

  const herbSeedUnit = price(prices, herb.seedItem);
  let herbCost = cfg.herbPatches * herbSeedUnit;
  push(costItems, `${herb.name} seeds`, cfg.herbPatches, herbSeedUnit);
  if (cfg.herbCompost !== 'none') {
    const unit = compostCost(prices, cfg.herbCompost);
    herbCost += cfg.herbPatches * unit;
    push(costItems, `${COMPOST[cfg.herbCompost].label} (herbs)`, cfg.herbPatches, unit);
  }
  const soldHerbs = cfg.sellHerbs ? herbsHarvested : 0;
  const herbRevenue = soldHerbs * price(prices, herb.productItem);
  push(revenueItems, herb.name, soldHerbs, price(prices, herb.productItem));

  // ---------- Protection payments, netted against home-grown produce ----------
  const produceFlow: RunResult['produceFlow'] = [];
  const itemsInPlay = new Set<ItemKey>([...produced.keys(), ...demanded.keys()]);
  let paymentCost = 0;
  let spareRevenue = 0;

  for (const item of itemsInPlay) {
    const grown = produced.get(item) ?? 0;
    const needed = demanded.get(item) ?? 0;
    const bought = Math.max(0, needed - grown);
    const spare = Math.max(0, grown - needed);
    const unit = price(prices, item);

    if (bought > 0) {
      paymentCost += bought * unit;
      push(costItems, `${ITEM_NAMES[item]} bought (protection)`, bought, unit);
    }
    if (spare > 0 && cfg.sellSpareFruit) {
      spareRevenue += spare * unit;
      push(revenueItems, `${ITEM_NAMES[item]} sold`, spare, unit);
    }
    produceFlow.push({ item, produced: grown, needed, bought, spare });
  }

  // Payments belong to whichever crop demanded them; split proportionally.
  const treeDemandValue = cfg.treeStrategy === 'pay' ? cfg.treePatches * tree.payQty * price(prices, tree.payItem) : 0;
  const fruitDemandValue =
    cfg.fruitStrategy === 'pay' ? cfg.fruitPatches * fruit.payQty * price(prices, fruit.payItem) : 0;
  const demandTotal = treeDemandValue + fruitDemandValue;
  if (demandTotal > 0) {
    treeCost += paymentCost * (treeDemandValue / demandTotal);
    fruitCost += paymentCost * (fruitDemandValue / demandTotal);
  } else {
    fruitCost += paymentCost;
  }

  crops.push({
    label: `${tree.name} trees`,
    xp: treeXp,
    cost: treeCost,
    revenue: treeRevenue,
    survival: treeSurvival,
    planted: cfg.treePatches,
    survived: treeSurvived,
  });
  crops.push({
    label: `${fruit.name}`,
    xp: fruitXp,
    cost: fruitCost,
    revenue: spareRevenue,
    survival: fruitSurvival,
    planted: cfg.fruitPatches,
    survived: fruitSurvived,
  });
  crops.push({
    label: herb.name,
    xp: herbXp,
    cost: herbCost,
    revenue: herbRevenue,
    survival: blendedHerbSurvival,
    planted: cfg.herbPatches,
    survived: herbSurvived,
  });

  const baseXpPerRun = crops.reduce((s, c) => s + c.xp, 0);
  const outfitBonusPct = outfitXpBonusPct(cfg.outfit);
  const multiplier = 1 + outfitBonusPct / 100;
  for (const c of crops) c.xp *= multiplier;

  const costPerRun = crops.reduce((s, c) => s + c.cost, 0);
  const revenuePerRun = crops.reduce((s, c) => s + c.revenue, 0);

  return {
    xpPerRun: baseXpPerRun * multiplier,
    baseXpPerRun,
    outfitBonusPct,
    costPerRun,
    revenuePerRun,
    netPerRun: revenuePerRun - costPerRun,
    crops,
    costItems,
    revenueItems,
    produceFlow,
    herbYieldPerPatch,
    yieldBonusPct: yieldBonus,
    rootsPerTree: rootsEach,
    logsPerTree: EXPECTED_LOGS_PER_TREE,
    diseaseFreeHerbPatches: diseaseFree,
  };
}

/** One stretch of the grind spent at a single Farming level. */
interface LevelSegment {
  level: number;
  startRun: number;
  endRun: number;
  startXp: number;
  xpPerRun: number;
  netPerRun: number;
  /** Cumulative net GP at startRun. */
  startNet: number;
}

export function project(cfg: Config, prices: PriceMap): Projection {
  const targetXp = cfg.targetLevel >= 99 ? MAX_XP : Math.min(MAX_XP, xpForLevel(cfg.targetLevel));
  const xpNeeded = Math.max(0, targetXp - cfg.currentXp);
  const runsPerDay = Math.max(0.0001, cfg.runsPerDay);
  const startLevel = levelForXp(cfg.currentXp);

  // Per-run figures depend on currentXp only through the level, so one
  // computeRun per level is exact and keeps this cheap even for long grinds.
  const cache = new Map<number, RunResult>();
  const runAtLevel = (level: number): RunResult => {
    const hit = cache.get(level);
    if (hit) return hit;
    const fresh = computeRun({ ...cfg, currentXp: xpForLevel(level) }, prices);
    cache.set(level, fresh);
    return fresh;
  };

  const run = runAtLevel(startLevel);

  // Walk level by level, solving each stretch analytically.
  const segments: LevelSegment[] = [];
  const levelUps: LevelUp[] = [];
  let xp = cfg.currentXp;
  let runs = 0;
  let cost = 0;
  let revenue = 0;
  let stalled = false;

  while (xp < targetXp) {
    const level = levelForXp(xp);
    const r = runAtLevel(level);
    if (r.xpPerRun <= 0) {
      stalled = true;
      break;
    }
    // This stretch ends at the next level-up, or at the target, whichever comes first.
    const boundary = level < 99 ? Math.min(targetXp, xpForLevel(level + 1)) : targetXp;
    const runsHere = (boundary - xp) / r.xpPerRun;

    segments.push({
      level,
      startRun: runs,
      endRun: runs + runsHere,
      startXp: xp,
      xpPerRun: r.xpPerRun,
      netPerRun: r.netPerRun,
      startNet: revenue - cost,
    });

    runs += runsHere;
    cost += r.costPerRun * runsHere;
    revenue += r.revenuePerRun * runsHere;
    xp = boundary;

    if (xp >= xpForLevel(level + 1) && level + 1 <= cfg.targetLevel) {
      levelUps.push({
        level: level + 1,
        run: runs,
        day: runs / runsPerDay,
        xp: xpForLevel(level + 1),
        runsForLevel: runsHere,
      });
    }
  }

  const runsNeeded = stalled ? Infinity : runs;
  const days = runsNeeded / runsPerDay;
  const hours = (runsNeeded * cfg.minutesPerRun) / 60;

  // Measured against the next level specifically, not the first segment — the
  // target can land before the level-up, which would cut the segment short.
  const nextLevelXp = startLevel < 99 ? xpForLevel(startLevel + 1) : MAX_XP;
  const runsToNextLevel =
    run.xpPerRun > 0 ? Math.max(0, nextLevelXp - cfg.currentXp) / run.xpPerRun : Infinity;

  // Nothing planted means nothing spent, rather than an infinite bill.
  const totalCost = stalled ? 0 : cost;
  const totalRevenue = stalled ? 0 : revenue;
  const totalNet = totalRevenue - totalCost;

  // Timeline — XP and GP are piecewise linear across the segments.
  const pointAt = (r: number): TimelinePoint => {
    const seg =
      segments.find((s) => r >= s.startRun && r <= s.endRun) ?? segments[segments.length - 1];
    const atXp = seg ? Math.min(targetXp, seg.startXp + (r - seg.startRun) * seg.xpPerRun) : cfg.currentXp;
    const atNet = seg ? seg.startNet + (r - seg.startRun) * seg.netPerRun : 0;
    return {
      run: r,
      day: r / runsPerDay,
      xp: atXp,
      level: levelForXp(atXp),
      preciseLevel: preciseLevel(atXp),
      netGp: atNet,
    };
  };

  const timeline: TimelinePoint[] = [];
  if (Number.isFinite(runsNeeded) && runsNeeded > 0) {
    const samples = 240;
    for (let i = 0; i <= samples; i++) timeline.push(pointAt((runsNeeded * i) / samples));
  } else {
    timeline.push(pointAt(0));
  }

  return {
    xpNeeded,
    runsNeeded,
    runsToNextLevel,
    days,
    hours,
    totalCost,
    totalRevenue,
    totalNet,
    gpPerXp: xpNeeded > 0 && Number.isFinite(totalNet) ? -totalNet / xpNeeded : 0,
    xpPerHour: cfg.minutesPerRun > 0 ? run.xpPerRun / (cfg.minutesPerRun / 60) : 0,
    xpPerDay: run.xpPerRun * runsPerDay,
    gpPerDay: run.netPerRun * runsPerDay,
    run,
    timeline,
    levelUps,
  };
}

export interface StrategyRow {
  strategy: Strategy;
  label: string;
  survival: number;
  runXp: number;
  runNet: number;
  gpPerXp: number;
  costToTarget: number;
  daysToTarget: number;
}

/**
 * Compare every protection strategy for one patch type, holding everything else
 * equal. Figures are whole-run rather than per-crop: switching trees off gardener
 * payment frees up home-grown produce to sell, and that only shows in the total.
 */
export function compareStrategies(
  cfg: Config,
  prices: PriceMap,
  which: 'tree' | 'fruit' | 'herb',
): StrategyRow[] {
  const strategies: Strategy[] =
    which === 'herb'
      ? ['ultracompost', 'supercompost', 'compost', 'none']
      : ['pay', 'ultracompost', 'supercompost', 'compost', 'none'];

  const payLabel = () => {
    if (which === 'tree') {
      const t = TREES[cfg.treeType];
      return `Pay ${t.payQty} ${ITEM_NAMES[t.payItem].toLowerCase()}`;
    }
    const f = FRUIT_TREES[cfg.fruitType];
    return `Pay ${f.payQty} ${ITEM_NAMES[f.payItem].toLowerCase()}`;
  };

  return strategies.map((s) => {
    const variant: Config =
      which === 'tree'
        ? { ...cfg, treeStrategy: s }
        : which === 'fruit'
          ? { ...cfg, fruitStrategy: s }
          : { ...cfg, herbCompost: s as CompostTier };
    const p = project(variant, prices);
    const idx = which === 'tree' ? 0 : which === 'fruit' ? 1 : 2;
    const crop = p.run.crops[idx];
    return {
      strategy: s,
      label: s === 'pay' ? payLabel() : COMPOST[s as CompostTier].label,
      survival: crop.survival,
      runXp: p.run.xpPerRun,
      runNet: p.run.netPerRun,
      gpPerXp: p.gpPerXp,
      costToTarget: -p.totalNet,
      daysToTarget: p.days,
    };
  });
}

export const DEFAULT_CONFIG: Config = {
  currentXp: 7570122, // level 93, halfway to 94
  targetLevel: 99,
  treeType: 'magic',
  treePatches: 6,
  treeStrategy: 'pay',
  sellRoots: true,
  sellLogs: false,
  fruitType: 'palm',
  fruitPatches: 5,
  fruitStrategy: 'pay',
  sellSpareFruit: true,
  herbType: 'torstol',
  herbPatches: 7,
  herbCompost: 'ultracompost',
  sellHerbs: true,
  outfit: { strawhat: false, jacket: false, trousers: false, boots: false },
  secateurs: 'magic',
  minutesPerRun: 25,
  runsPerDay: 1,
  diseaseFloorAtOne: true,
};

export const fmtGp = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
};

export const fmtNum = (n: number, dp = 0): string =>
  Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
