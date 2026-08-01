import {
  CLEAR_PATCH_FEE,
  COMPOST,
  ClearMethod,
  CompostTier,
  EXPECTED_LOGS_PER_TREE,
  MINUTES_TO_FELL_TREE,
  FRUIT_PER_CYCLE,
  FRUIT_TREES,
  FRUIT_TREE_DISEASE_BASE128,
  FRUIT_TREE_DISEASE_CYCLES,
  FRUIT_TREE_GROWTH_MINUTES,
  FruitTreeKey,
  HARDWOOD_TREES,
  HERBS,
  HERB_DISEASE_BASE128,
  HERB_DISEASE_CYCLES,
  HERB_GROWTH_MINUTES,
  HardwoodKey,
  HerbKey,
  ITEM_NAMES,
  ItemKey,
  MAX_XP,
  OutfitPiece,
  PatchKind,
  SecateursKey,
  Strategy,
  TREES,
  TreeKey,
  defaultRunsPerDay,
  diseaseFreeHerbPatches,
  expectedHerbYield,
  levelForXp,
  minutesPerRun,
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

  /**
   * How grown trees are removed so the patch can be replanted. Applies to every
   * tree patch type. Chopping yields logs and roots; paying costs 200 gp a patch
   * and yields neither.
   */
  clearMethod: ClearMethod;

  /** Per-crop switches, so a patch type can be dropped without losing its setup. */
  treeEnabled: boolean;
  hardwoodEnabled: boolean;
  fruitEnabled: boolean;
  herbEnabled: boolean;

  treeType: TreeKey;
  treePatches: number;
  treeStrategy: Strategy;
  treeRunsPerDay: number;
  /** Count roots towards P/L. Yield itself is derived from your Farming level. */
  sellRoots: boolean;
  /** Count the logs from felling each tree towards P/L. */
  sellLogs: boolean;

  fruitType: FruitTreeKey;
  fruitPatches: number;
  fruitStrategy: Strategy;
  fruitRunsPerDay: number;
  /** Sell fruit left over after protection payments. */
  sellSpareFruit: boolean;

  hardwoodType: HardwoodKey;
  hardwoodPatches: number;
  hardwoodStrategy: Strategy;
  hardwoodRunsPerDay: number;
  sellHardwoodLogs: boolean;

  herbType: HerbKey;
  herbPatches: number;
  /** Herb patches cannot be protected by payment — compost only. */
  herbCompost: CompostTier;
  herbRunsPerDay: number;
  /** Count harvested herbs towards P/L (off if you keep them for Herblore). */
  sellHerbs: boolean;

  outfit: Record<OutfitPiece, boolean>;
  secateurs: SecateursKey;
}

export interface LineItem {
  label: string;
  qty: number;
  unit: number;
  total: number;
}

export interface CropResult {
  kind: PatchKind;
  label: string;
  patches: number;
  survival: number;
  survived: number;
  runsPerDay: number;
  minutesPerRun: number;
  xpPerRun: number;
  xpPerDay: number;
  costPerRun: number;
  costPerDay: number;
  revenuePerRun: number;
  revenuePerDay: number;
  netPerRun: number;
  netPerDay: number;
}

export interface DayResult {
  xpPerDay: number;
  costPerDay: number;
  revenuePerDay: number;
  netPerDay: number;
  minutesPerDay: number;
  outfitBonusPct: number;
  crops: CropResult[];
  /** Line items are per day, so crops on different cadences stay comparable. */
  costItems: LineItem[];
  revenueItems: LineItem[];
  produceFlow: {
    item: ItemKey;
    produced: number;
    needed: number;
    bought: number;
    spare: number;
  }[];
  herbYieldPerPatch: number;
  yieldBonusPct: number;
  rootsPerTree: number;
  logsPerTree: number;
  diseaseFreeHerbPatches: number;
}

export interface TimelinePoint {
  day: number;
  xp: number;
  level: number;
  preciseLevel: number;
  netGp: number;
}

export interface LevelUp {
  level: number;
  day: number;
  xp: number;
  /** Days spent inside this level. */
  daysForLevel: number;
}

export interface Projection {
  xpNeeded: number;
  daysNeeded: number;
  daysToNextLevel: number;
  hours: number;
  totalCost: number;
  totalRevenue: number;
  totalNet: number;
  gpPerXp: number;
  xpPerHour: number;
  day: DayResult;
  timeline: TimelinePoint[];
  levelUps: LevelUp[];
}

const price = (prices: PriceMap, key: ItemKey): number => prices[key] ?? 0;

function compostCost(prices: PriceMap, tier: CompostTier): number {
  const item = COMPOST[tier].item;
  return item ? price(prices, item) : 0;
}

/** Everything one patch type contributes, before protection payments are settled. */
interface CropDraft {
  kind: PatchKind;
  label: string;
  patches: number;
  runsPerDay: number;
  survival: number;
  survived: number;
  xpPerRun: number;
  /** Seed, compost and clearing fees; produce payments are netted afterwards. */
  baseCostPerRun: number;
  revenuePerRun: number;
  /** Protection cost owed per day, valued at GE price. */
  demandValuePerDay: number;
  minutesPerRun: number;
}

export function computeDay(cfg: Config, prices: PriceMap): DayResult {
  const costItems: LineItem[] = [];
  const revenueItems: LineItem[] = [];

  /** Per-day quantities, so crops on different cadences net correctly. */
  const produced = new Map<ItemKey, number>();
  const demanded = new Map<ItemKey, number>();
  const add = (m: Map<ItemKey, number>, k: ItemKey, n: number) => m.set(k, (m.get(k) ?? 0) + n);

  const pushDaily = (arr: LineItem[], label: string, qtyPerDay: number, unit: number) => {
    if (qtyPerDay <= 0 || unit <= 0) return;
    arr.push({ label, qty: qtyPerDay, unit, total: qtyPerDay * unit });
  };

  const farmingLevel = levelForXp(cfg.currentXp);
  const drafts: CropDraft[] = [];
  const chopping = cfg.clearMethod === 'chop';

  /** Clearing cost and time for one run of a tree-style patch. */
  const clearing = (patches: number) => ({
    fee: chopping ? 0 : patches * CLEAR_PATCH_FEE,
    minutes: chopping ? patches * MINUTES_TO_FELL_TREE : 0,
  });

  // ---------- Trees ----------
  {
    const tree = TREES[cfg.treeType];
    const tier: CompostTier = cfg.treeStrategy === 'pay' ? 'none' : cfg.treeStrategy;
    const survival =
      cfg.treeStrategy === 'pay' ? 1 : survivalChance(tree.diseaseBase128, tree.stages - 1, tier);
    const patches = cfg.treeEnabled ? cfg.treePatches : 0;
    const survived = patches * survival;
    const runs = cfg.treeRunsPerDay;

    let cost = patches * price(prices, tree.seedItem);
    pushDaily(costItems, `${tree.name} seeds`, patches * runs, price(prices, tree.seedItem));

    let demandValue = 0;
    if (cfg.treeStrategy === 'pay') {
      const qtyPerDay = patches * tree.payQty * runs;
      add(demanded, tree.payItem, qtyPerDay);
      demandValue = qtyPerDay * price(prices, tree.payItem);
    } else if (tier !== 'none') {
      const unit = compostCost(prices, tier);
      cost += patches * unit;
      pushDaily(costItems, `${COMPOST[tier].label} (${tree.name.toLowerCase()})`, patches * runs, unit);
    }

    const clear = clearing(patches);
    cost += clear.fee;
    pushDaily(
      costItems,
      `Clearing (${tree.name.toLowerCase()})`,
      patches * runs,
      chopping ? 0 : CLEAR_PATCH_FEE,
    );

    // Felling is what produces logs and exposes the stump, so paying to clear
    // forfeits both.
    const rootsQty = chopping && cfg.sellRoots ? survived * rootsPerTree(tree, farmingLevel) : 0;
    const logsQty = chopping && cfg.sellLogs ? survived * EXPECTED_LOGS_PER_TREE : 0;
    pushDaily(revenueItems, `${tree.name} roots`, rootsQty * runs, price(prices, tree.rootsItem));
    pushDaily(revenueItems, `${tree.name} logs`, logsQty * runs, price(prices, tree.logsItem));

    drafts.push({
      kind: 'tree',
      label: `${tree.name} trees`,
      patches,
      runsPerDay: runs,
      survival,
      survived,
      xpPerRun: survived * (tree.plantXp + tree.checkXp),
      baseCostPerRun: cost,
      revenuePerRun: rootsQty * price(prices, tree.rootsItem) + logsQty * price(prices, tree.logsItem),
      demandValuePerDay: demandValue,
      minutesPerRun: minutesPerRun(patches) + clear.minutes,
    });
  }

  // ---------- Hardwood trees ----------
  {
    const hw = HARDWOOD_TREES[cfg.hardwoodType];
    const tier: CompostTier = cfg.hardwoodStrategy === 'pay' ? 'none' : cfg.hardwoodStrategy;
    const survival =
      cfg.hardwoodStrategy === 'pay' ? 1 : survivalChance(hw.diseaseBase128, hw.stages - 1, tier);
    const patches = cfg.hardwoodEnabled ? cfg.hardwoodPatches : 0;
    const survived = patches * survival;
    const runs = cfg.hardwoodRunsPerDay;

    let cost = patches * price(prices, hw.seedItem);
    pushDaily(costItems, `${hw.name} seeds`, patches * runs, price(prices, hw.seedItem));

    let demandValue = 0;
    if (cfg.hardwoodStrategy === 'pay') {
      const qtyPerDay = patches * hw.payQty * runs;
      add(demanded, hw.payItem, qtyPerDay);
      demandValue = qtyPerDay * price(prices, hw.payItem);
    } else if (tier !== 'none') {
      const unit = compostCost(prices, tier);
      cost += patches * unit;
      pushDaily(costItems, `${COMPOST[tier].label} (${hw.name.toLowerCase()})`, patches * runs, unit);
    }

    const clear = clearing(patches);
    cost += clear.fee;
    pushDaily(
      costItems,
      `Clearing (${hw.name.toLowerCase()})`,
      patches * runs,
      chopping ? 0 : CLEAR_PATCH_FEE,
    );

    // Hardwood trees have no roots item, so logs are all felling gives.
    const logsQty = chopping && cfg.sellHardwoodLogs ? survived * EXPECTED_LOGS_PER_TREE : 0;
    pushDaily(revenueItems, `${hw.name} logs`, logsQty * runs, price(prices, hw.logsItem));

    drafts.push({
      kind: 'hardwood',
      label: `${hw.name} hardwood`,
      patches,
      runsPerDay: runs,
      survival,
      survived,
      xpPerRun: survived * (hw.plantXp + hw.checkXp),
      baseCostPerRun: cost,
      revenuePerRun: logsQty * price(prices, hw.logsItem),
      demandValuePerDay: demandValue,
      minutesPerRun: minutesPerRun(patches) + clear.minutes,
    });
  }

  // ---------- Fruit trees ----------
  {
    const fruit = FRUIT_TREES[cfg.fruitType];
    const tier: CompostTier = cfg.fruitStrategy === 'pay' ? 'none' : cfg.fruitStrategy;
    const survival =
      cfg.fruitStrategy === 'pay'
        ? 1
        : survivalChance(FRUIT_TREE_DISEASE_BASE128, FRUIT_TREE_DISEASE_CYCLES, tier);
    const patches = cfg.fruitEnabled ? cfg.fruitPatches : 0;
    const survived = patches * survival;
    const runs = cfg.fruitRunsPerDay;

    let cost = patches * price(prices, fruit.seedItem);
    pushDaily(costItems, `${fruit.name} seeds`, patches * runs, price(prices, fruit.seedItem));

    let demandValue = 0;
    if (cfg.fruitStrategy === 'pay') {
      const qtyPerDay = patches * fruit.payQty * runs;
      add(demanded, fruit.payItem, qtyPerDay);
      demandValue = qtyPerDay * price(prices, fruit.payItem);
    } else if (tier !== 'none') {
      const unit = compostCost(prices, tier);
      cost += patches * unit;
      pushDaily(costItems, `${COMPOST[tier].label} (${fruit.name.toLowerCase()})`, patches * runs, unit);
    }

    // Fruit is picked before the tree comes out, so clearing costs time or gp
    // but never any produce.
    const clear = clearing(patches);
    cost += clear.fee;
    pushDaily(
      costItems,
      `Clearing (${fruit.name.toLowerCase()})`,
      patches * runs,
      chopping ? 0 : CLEAR_PATCH_FEE,
    );

    add(produced, fruit.fruitItem, survived * FRUIT_PER_CYCLE * runs);

    drafts.push({
      kind: 'fruitTree',
      label: fruit.name,
      patches,
      runsPerDay: runs,
      survival,
      survived,
      xpPerRun: survived * (fruit.plantXp + fruit.checkXp + FRUIT_PER_CYCLE * fruit.harvestXpPerFruit),
      baseCostPerRun: cost,
      revenuePerRun: 0, // produce is settled per day below
      demandValuePerDay: demandValue,
      minutesPerRun: minutesPerRun(patches) + clear.minutes,
    });
  }

  // ---------- Herbs ----------
  const herb = HERBS[cfg.herbType];
  const herbPatches = cfg.herbEnabled ? cfg.herbPatches : 0;
  const diseaseFree = diseaseFreeHerbPatches(herbPatches);
  const herbSurvival = survivalChance(HERB_DISEASE_BASE128, HERB_DISEASE_CYCLES, cfg.herbCompost);
  const herbSurvived = diseaseFree + (herbPatches - diseaseFree) * herbSurvival;
  const bonus = yieldBonusPct(cfg.secateurs, farmingLevel);
  const herbYieldPerPatch = expectedHerbYield(herb, farmingLevel, cfg.herbCompost, bonus);
  {
    const runs = cfg.herbRunsPerDay;
    const harvested = herbSurvived * herbYieldPerPatch;

    let cost = herbPatches * price(prices, herb.seedItem);
    pushDaily(costItems, `${herb.name} seeds`, herbPatches * runs, price(prices, herb.seedItem));
    if (cfg.herbCompost !== 'none') {
      const unit = compostCost(prices, cfg.herbCompost);
      cost += herbPatches * unit;
      pushDaily(costItems, `${COMPOST[cfg.herbCompost].label} (herbs)`, herbPatches * runs, unit);
    }

    const sold = cfg.sellHerbs ? harvested : 0;
    pushDaily(revenueItems, herb.name, sold * runs, price(prices, herb.productItem));

    drafts.push({
      kind: 'herb',
      label: herb.name,
      patches: herbPatches,
      runsPerDay: runs,
      survival: herbPatches > 0 ? herbSurvived / herbPatches : 1,
      survived: herbSurvived,
      xpPerRun: herbSurvived * herb.plantXp + harvested * herb.harvestXp,
      baseCostPerRun: cost,
      revenuePerRun: sold * price(prices, herb.productItem),
      demandValuePerDay: 0,
      minutesPerRun: minutesPerRun(herbPatches),
    });
  }

  // ---------- Settle protection payments against home-grown produce, per day ----------
  const produceFlow: DayResult['produceFlow'] = [];
  let paymentCostPerDay = 0;
  let spareRevenuePerDay = 0;

  for (const item of new Set<ItemKey>([...produced.keys(), ...demanded.keys()])) {
    const grown = produced.get(item) ?? 0;
    const needed = demanded.get(item) ?? 0;
    const bought = Math.max(0, needed - grown);
    const spare = Math.max(0, grown - needed);
    const unit = price(prices, item);

    if (bought > 0) {
      paymentCostPerDay += bought * unit;
      pushDaily(costItems, `${ITEM_NAMES[item]} bought (protection)`, bought, unit);
    }
    if (spare > 0 && cfg.sellSpareFruit) {
      spareRevenuePerDay += spare * unit;
      pushDaily(revenueItems, `${ITEM_NAMES[item]} sold`, spare, unit);
    }
    produceFlow.push({ item, produced: grown, needed, bought, spare });
  }

  const demandTotal = drafts.reduce((s, d) => s + d.demandValuePerDay, 0);
  const outfitBonusPct = outfitXpBonusPct(cfg.outfit);
  const multiplier = 1 + outfitBonusPct / 100;

  const crops: CropResult[] = drafts.map((d) => {
    // Bought produce is shared, so split it by each crop's share of the bill.
    const payment = demandTotal > 0 ? paymentCostPerDay * (d.demandValuePerDay / demandTotal) : 0;
    const costPerDay = d.baseCostPerRun * d.runsPerDay + payment;
    const revenuePerDay = d.revenuePerRun * d.runsPerDay + (d.kind === 'fruitTree' ? spareRevenuePerDay : 0);
    const xpPerRun = d.xpPerRun * multiplier;
    const perRun = (n: number) => (d.runsPerDay > 0 ? n / d.runsPerDay : 0);

    return {
      kind: d.kind,
      label: d.label,
      patches: d.patches,
      survival: d.survival,
      survived: d.survived,
      runsPerDay: d.runsPerDay,
      minutesPerRun: d.minutesPerRun,
      xpPerRun,
      xpPerDay: xpPerRun * d.runsPerDay,
      costPerRun: perRun(costPerDay),
      costPerDay,
      revenuePerRun: perRun(revenuePerDay),
      revenuePerDay,
      netPerRun: perRun(revenuePerDay - costPerDay),
      netPerDay: revenuePerDay - costPerDay,
    };
  });

  const costPerDay = crops.reduce((s, c) => s + c.costPerDay, 0);
  const revenuePerDay = crops.reduce((s, c) => s + c.revenuePerDay, 0);

  return {
    xpPerDay: crops.reduce((s, c) => s + c.xpPerDay, 0),
    costPerDay,
    revenuePerDay,
    netPerDay: revenuePerDay - costPerDay,
    minutesPerDay: crops.reduce((s, c) => s + c.minutesPerRun * c.runsPerDay, 0),
    outfitBonusPct,
    crops,
    costItems,
    revenueItems,
    produceFlow,
    herbYieldPerPatch,
    yieldBonusPct: bonus,
    rootsPerTree: rootsPerTree(TREES[cfg.treeType], farmingLevel),
    logsPerTree: EXPECTED_LOGS_PER_TREE,
    diseaseFreeHerbPatches: diseaseFree,
  };
}

/** One stretch of the grind spent at a single Farming level. */
interface LevelSegment {
  level: number;
  startDay: number;
  endDay: number;
  startXp: number;
  xpPerDay: number;
  netPerDay: number;
  /** Cumulative net GP at startDay. */
  startNet: number;
}

export function project(cfg: Config, prices: PriceMap): Projection {
  const targetXp = cfg.targetLevel >= 99 ? MAX_XP : Math.min(MAX_XP, xpForLevel(cfg.targetLevel));
  const xpNeeded = Math.max(0, targetXp - cfg.currentXp);
  const startLevel = levelForXp(cfg.currentXp);

  // Per-day figures depend on currentXp only through the level, so one
  // computeDay per level is exact and keeps this cheap even for long grinds.
  const cache = new Map<number, DayResult>();
  const dayAtLevel = (level: number): DayResult => {
    const hit = cache.get(level);
    if (hit) return hit;
    const fresh = computeDay({ ...cfg, currentXp: xpForLevel(level) }, prices);
    cache.set(level, fresh);
    return fresh;
  };

  const day = dayAtLevel(startLevel);

  const segments: LevelSegment[] = [];
  const levelUps: LevelUp[] = [];
  let xp = cfg.currentXp;
  let days = 0;
  let cost = 0;
  let revenue = 0;
  let stalled = false;

  while (xp < targetXp) {
    const level = levelForXp(xp);
    const d = dayAtLevel(level);
    if (d.xpPerDay <= 0) {
      stalled = true;
      break;
    }
    const boundary = level < 99 ? Math.min(targetXp, xpForLevel(level + 1)) : targetXp;
    const daysHere = (boundary - xp) / d.xpPerDay;

    segments.push({
      level,
      startDay: days,
      endDay: days + daysHere,
      startXp: xp,
      xpPerDay: d.xpPerDay,
      netPerDay: d.netPerDay,
      startNet: revenue - cost,
    });

    days += daysHere;
    cost += d.costPerDay * daysHere;
    revenue += d.revenuePerDay * daysHere;
    xp = boundary;

    if (xp >= xpForLevel(level + 1) && level + 1 <= cfg.targetLevel) {
      levelUps.push({
        level: level + 1,
        day: days,
        xp: xpForLevel(level + 1),
        daysForLevel: daysHere,
      });
    }
  }

  const daysNeeded = stalled ? Infinity : days;
  const hours = stalled ? Infinity : (daysNeeded * day.minutesPerDay) / 60;

  const nextLevelXp = startLevel < 99 ? xpForLevel(startLevel + 1) : MAX_XP;
  const daysToNextLevel =
    day.xpPerDay > 0 ? Math.max(0, nextLevelXp - cfg.currentXp) / day.xpPerDay : Infinity;

  // Nothing planted means nothing spent, rather than an infinite bill.
  const totalCost = stalled ? 0 : cost;
  const totalRevenue = stalled ? 0 : revenue;
  const totalNet = totalRevenue - totalCost;

  const pointAt = (t: number): TimelinePoint => {
    const seg = segments.find((s) => t >= s.startDay && t <= s.endDay) ?? segments[segments.length - 1];
    const atXp = seg ? Math.min(targetXp, seg.startXp + (t - seg.startDay) * seg.xpPerDay) : cfg.currentXp;
    const atNet = seg ? seg.startNet + (t - seg.startDay) * seg.netPerDay : 0;
    return {
      day: t,
      xp: atXp,
      level: levelForXp(atXp),
      preciseLevel: preciseLevel(atXp),
      netGp: atNet,
    };
  };

  const timeline: TimelinePoint[] = [];
  if (Number.isFinite(daysNeeded) && daysNeeded > 0) {
    const samples = 240;
    for (let i = 0; i <= samples; i++) timeline.push(pointAt((daysNeeded * i) / samples));
  } else {
    timeline.push(pointAt(0));
  }

  return {
    xpNeeded,
    daysNeeded,
    daysToNextLevel,
    hours,
    totalCost,
    totalRevenue,
    totalNet,
    gpPerXp: xpNeeded > 0 && Number.isFinite(totalNet) ? -totalNet / xpNeeded : 0,
    xpPerHour: day.minutesPerDay > 0 ? day.xpPerDay / (day.minutesPerDay / 60) : 0,
    day,
    timeline,
    levelUps,
  };
}

export interface StrategyRow {
  strategy: Strategy;
  label: string;
  survival: number;
  xpPerDay: number;
  netPerDay: number;
  gpPerXp: number;
  costToTarget: number;
  daysToTarget: number;
}

/**
 * Compare every protection strategy for one patch type, holding everything else
 * equal. Figures are whole-day totals, so knock-on effects — produce freed up
 * for sale when you stop paying a gardener — are included.
 */
export function compareStrategies(cfg: Config, prices: PriceMap, kind: PatchKind): StrategyRow[] {
  const strategies: Strategy[] =
    kind === 'herb'
      ? ['ultracompost', 'supercompost', 'compost', 'none']
      : ['pay', 'ultracompost', 'supercompost', 'compost', 'none'];

  const payLabel = () => {
    const def =
      kind === 'tree'
        ? TREES[cfg.treeType]
        : kind === 'hardwood'
          ? HARDWOOD_TREES[cfg.hardwoodType]
          : FRUIT_TREES[cfg.fruitType];
    return `Pay ${def.payQty} ${ITEM_NAMES[def.payItem].toLowerCase()}`;
  };

  return strategies.map((s) => {
    const variant: Config =
      kind === 'tree'
        ? { ...cfg, treeStrategy: s }
        : kind === 'hardwood'
          ? { ...cfg, hardwoodStrategy: s }
          : kind === 'fruitTree'
            ? { ...cfg, fruitStrategy: s }
            : { ...cfg, herbCompost: s as CompostTier };
    const p = project(variant, prices);
    const crop = p.day.crops.find((c) => c.kind === kind);
    return {
      strategy: s,
      label: s === 'pay' ? payLabel() : COMPOST[s as CompostTier].label,
      survival: crop?.survival ?? 1,
      xpPerDay: p.day.xpPerDay,
      netPerDay: p.day.netPerDay,
      gpPerXp: p.gpPerXp,
      costToTarget: -p.totalNet,
      daysToTarget: p.daysNeeded,
    };
  });
}

export interface CropOption {
  key: string;
  name: string;
  level: number;
  /** Whether the account can plant it yet. */
  unlocked: boolean;
  growthMinutes: number;
  runsPerDay: number;
  /** Everything below is per single patch, so patch counts don't skew it. */
  xpPerRun: number;
  xpPerDay: number;
  costPerDay: number;
  revenuePerDay: number;
  netPerDay: number;
  /** Cost of a point of XP. Negative means the crop turns a profit. */
  gpPerXp: number;
}

/** Every crop of one patch kind, listed with its level requirement and cadence. */
function candidates(kind: PatchKind) {
  if (kind === 'tree') {
    return (Object.keys(TREES) as TreeKey[]).map((k) => ({
      key: k as string,
      name: TREES[k].name,
      level: TREES[k].level,
      growthMinutes: TREES[k].growthMinutes,
    }));
  }
  if (kind === 'hardwood') {
    return (Object.keys(HARDWOOD_TREES) as HardwoodKey[]).map((k) => ({
      key: k as string,
      name: HARDWOOD_TREES[k].name,
      level: HARDWOOD_TREES[k].level,
      growthMinutes: HARDWOOD_TREES[k].growthMinutes,
    }));
  }
  if (kind === 'fruitTree') {
    return (Object.keys(FRUIT_TREES) as FruitTreeKey[]).map((k) => ({
      key: k as string,
      name: FRUIT_TREES[k].name,
      level: FRUIT_TREES[k].level,
      growthMinutes: FRUIT_TREE_GROWTH_MINUTES,
    }));
  }
  return (Object.keys(HERBS) as HerbKey[]).map((k) => ({
    key: k as string,
    name: HERBS[k].name,
    level: HERBS[k].level,
    growthMinutes: HERB_GROWTH_MINUTES,
  }));
}

/**
 * Rate every crop of one patch kind against each other.
 *
 * Each candidate is costed in isolation — only its own patch type enabled, a
 * single patch, and its own growth-derived cadence — so the figures compare
 * cleanly and are independent of how many patches you actually run.
 */
export function compareCrops(
  cfg: Config,
  prices: PriceMap,
  kind: PatchKind,
  strategy: Strategy,
): CropOption[] {
  const level = levelForXp(cfg.currentXp);

  return candidates(kind).map((c) => {
    const runsPerDay = defaultRunsPerDay(kind, c.growthMinutes);
    const solo: Config = {
      ...cfg,
      treeEnabled: kind === 'tree',
      hardwoodEnabled: kind === 'hardwood',
      fruitEnabled: kind === 'fruitTree',
      herbEnabled: kind === 'herb',
      treePatches: 1,
      hardwoodPatches: 1,
      fruitPatches: 1,
      herbPatches: 1,
      ...(kind === 'tree' && {
        treeType: c.key as TreeKey,
        treeRunsPerDay: runsPerDay,
        treeStrategy: strategy,
      }),
      ...(kind === 'hardwood' && {
        hardwoodType: c.key as HardwoodKey,
        hardwoodRunsPerDay: runsPerDay,
        hardwoodStrategy: strategy,
      }),
      ...(kind === 'fruitTree' && {
        fruitType: c.key as FruitTreeKey,
        fruitRunsPerDay: runsPerDay,
        fruitStrategy: strategy,
      }),
      ...(kind === 'herb' && {
        herbType: c.key as HerbKey,
        herbRunsPerDay: runsPerDay,
        // Herb patches take compost only; a 'pay' pick falls back to ultracompost.
        herbCompost: strategy === 'pay' ? 'ultracompost' : strategy,
      }),
    };

    const row = computeDay(solo, prices).crops.find((x) => x.kind === kind);
    const xpPerDay = row?.xpPerDay ?? 0;
    const netPerDay = row?.netPerDay ?? 0;

    return {
      key: c.key,
      name: c.name,
      level: c.level,
      unlocked: c.level <= level,
      growthMinutes: c.growthMinutes,
      runsPerDay,
      xpPerRun: row?.xpPerRun ?? 0,
      xpPerDay,
      costPerDay: row?.costPerDay ?? 0,
      revenuePerDay: row?.revenuePerDay ?? 0,
      netPerDay,
      gpPerXp: xpPerDay > 0 ? -netPerDay / xpPerDay : 0,
    };
  });
}

export interface CropSelection {
  treeType?: TreeKey;
  hardwoodType?: HardwoodKey;
  fruitType?: FruitTreeKey;
  herbType?: HerbKey;
}

/** Keep crop selections plantable when the level drops below their requirement. */
export function applyLevelGating(cfg: Config): Config {
  const level = levelForXp(cfg.currentXp);
  const bestFor = <K extends string>(keys: K[], levelOf: (k: K) => number, current: K): K => {
    if (levelOf(current) <= level) return current;
    const usable = keys.filter((k) => levelOf(k) <= level);
    if (usable.length === 0) return keys[0];
    return usable.reduce((a, b) => (levelOf(b) > levelOf(a) ? b : a));
  };

  const treeType = bestFor(Object.keys(TREES) as TreeKey[], (k) => TREES[k].level, cfg.treeType);
  const hardwoodType = bestFor(
    Object.keys(HARDWOOD_TREES) as HardwoodKey[],
    (k) => HARDWOOD_TREES[k].level,
    cfg.hardwoodType,
  );

  return {
    ...cfg,
    treeType,
    hardwoodType,
    // Cadence follows the crop, so re-derive it when gating swaps the type out.
    treeRunsPerDay:
      treeType === cfg.treeType
        ? cfg.treeRunsPerDay
        : defaultRunsPerDay('tree', TREES[treeType].growthMinutes),
    hardwoodRunsPerDay:
      hardwoodType === cfg.hardwoodType
        ? cfg.hardwoodRunsPerDay
        : defaultRunsPerDay('hardwood', HARDWOOD_TREES[hardwoodType].growthMinutes),
    fruitType: bestFor(
      Object.keys(FRUIT_TREES) as FruitTreeKey[],
      (k) => FRUIT_TREES[k].level,
      cfg.fruitType,
    ),
    herbType: bestFor(Object.keys(HERBS) as HerbKey[], (k) => HERBS[k].level, cfg.herbType),
  };
}

/** Apply crop picks, re-deriving each swapped crop's cadence from its growth time. */
export function applyCropSelection(cfg: Config, sel: CropSelection): Config {
  const next = { ...cfg };
  if (sel.treeType) {
    next.treeType = sel.treeType;
    next.treeRunsPerDay = defaultRunsPerDay('tree', TREES[sel.treeType].growthMinutes);
  }
  if (sel.hardwoodType) {
    next.hardwoodType = sel.hardwoodType;
    next.hardwoodRunsPerDay = defaultRunsPerDay('hardwood', HARDWOOD_TREES[sel.hardwoodType].growthMinutes);
  }
  if (sel.fruitType) next.fruitType = sel.fruitType;
  if (sel.herbType) next.herbType = sel.herbType;
  return next;
}

export const DEFAULT_CONFIG: Config = {
  currentXp: 7570122, // level 93, halfway to 94
  targetLevel: 99,
  clearMethod: 'chop',
  treeEnabled: true,
  hardwoodEnabled: true,
  fruitEnabled: true,
  herbEnabled: true,
  treeType: 'magic',
  treePatches: 6,
  treeStrategy: 'pay',
  treeRunsPerDay: defaultRunsPerDay('tree', TREES.magic.growthMinutes),
  sellRoots: true,
  sellLogs: false,
  fruitType: 'palm',
  fruitPatches: 5,
  fruitStrategy: 'pay',
  fruitRunsPerDay: defaultRunsPerDay('fruitTree', FRUIT_TREE_GROWTH_MINUTES),
  sellSpareFruit: true,
  hardwoodType: 'rosewood',
  hardwoodPatches: 3,
  hardwoodStrategy: 'pay',
  hardwoodRunsPerDay: defaultRunsPerDay('hardwood', HARDWOOD_TREES.rosewood.growthMinutes),
  sellHardwoodLogs: true,
  herbType: 'torstol',
  herbPatches: 7,
  herbCompost: 'ultracompost',
  herbRunsPerDay: defaultRunsPerDay('herb', HERB_GROWTH_MINUTES),
  sellHerbs: true,
  outfit: { strawhat: false, jacket: false, trousers: false, boots: false },
  secateurs: 'magic',
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
  Number.isFinite(n)
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      })
    : '—';
