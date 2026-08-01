'use client';

import { useMemo, useState } from 'react';
import {
  BankChart,
  CropEconomyChart,
  DaysPerLevelChart,
  StrategyChart,
  XpBreakdownChart,
  XpProgressChart,
} from '@/components/charts';
import { Card, Field, NumberField, Select, Slider, Stat, Toggle } from '@/components/ui';
import {
  COMPOST,
  CompostTier,
  FARMING_CAPE_YIELD_BONUS_PCT,
  FRUIT_TREES,
  FRUIT_TREE_GROWTH_MINUTES,
  FruitTreeKey,
  HARDWOOD_TREES,
  HERBS,
  HERB_GROWTH_MINUTES,
  HardwoodKey,
  HerbKey,
  ITEM_NAMES,
  ItemKey,
  MAX_PATCHES,
  OUTFIT_ALL_WORN,
  OUTFIT_FULL_BONUS_PCT,
  OUTFIT_NONE_WORN,
  OUTFIT_PIECES,
  OutfitPiece,
  SECATEURS,
  SecateursKey,
  Strategy,
  TREES,
  TreeKey,
  defaultRunsPerDay,
  diseaseFreeHerbPatchNames,
  levelForXp,
  maxRunsPerDay,
  xpForLevel,
} from '@/lib/gameData';
import {
  Config,
  CropResult,
  DEFAULT_CONFIG,
  PriceMap,
  StrategyRow,
  compareStrategies,
  fmtGp,
  fmtNum,
  project,
} from '@/lib/model';
import type { Player } from '@/lib/hiscores';
import type { PricePayload } from '@/lib/prices';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'pay', label: 'Pay the gardener' },
  { value: 'ultracompost', label: 'Ultracompost' },
  { value: 'supercompost', label: 'Supercompost' },
  { value: 'compost', label: 'Compost' },
  { value: 'none', label: 'No protection' },
];

const COMPOST_OPTIONS = (Object.keys(COMPOST) as CompostTier[]).map((k) => ({
  value: k,
  label: COMPOST[k].label,
}));

const SECATEURS_OPTIONS = (Object.keys(SECATEURS) as SecateursKey[]).map((k) => ({
  value: k,
  label: SECATEURS[k].label,
}));

const OUTFIT_KEYS = Object.keys(OUTFIT_PIECES) as OutfitPiece[];

/** Seeds, produce and compost worth showing in the editable price list. */
const priceKeysFor = (cfg: Config): ItemKey[] => {
  const t = TREES[cfg.treeType];
  const w = HARDWOOD_TREES[cfg.hardwoodType];
  const f = FRUIT_TREES[cfg.fruitType];
  const h = HERBS[cfg.herbType];
  return [
    ...new Set<ItemKey>([
      t.seedItem, t.rootsItem, t.logsItem, t.payItem,
      w.seedItem, w.logsItem, w.payItem,
      f.seedItem, f.fruitItem, f.payItem,
      h.seedItem, h.productItem,
      'compost', 'supercompost', 'ultracompost',
    ]),
  ];
};

/** ISO string -> "HH:MM UTC". Avoids locale-dependent hydration mismatches. */
const utcTime = (iso: string) => `${iso.slice(11, 16)} UTC`;

const playerSummary = (p: Player) => `${p.name}: level ${p.level} (${fmtNum(p.xp)} xp)`;

export default function Planner({
  initial,
  defaultRsn,
  initialPlayer,
}: {
  initial: PricePayload;
  defaultRsn: string;
  initialPlayer: Player | null;
}) {
  // Seed straight from the server-loaded character so the first paint is already
  // that account's numbers, with DEFAULT_CONFIG as the fallback if the lookup failed.
  const [cfg, setCfg] = useState<Config>(() =>
    initialPlayer ? applyLevelGating({ ...DEFAULT_CONFIG, currentXp: initialPlayer.xp }) : DEFAULT_CONFIG,
  );
  const [live, setLive] = useState<PriceMap>(initial.prices);
  const [overrides, setOverrides] = useState<Partial<Record<ItemKey, number>>>({});
  const [meta, setMeta] = useState({ source: initial.source, fetchedAt: initial.fetchedAt });
  const [loading, setLoading] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  const [rsn, setRsn] = useState(defaultRsn);
  const [rsnStatus, setRsnStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>(
    initialPlayer ? { kind: 'ok', msg: playerSummary(initialPlayer) } : { kind: 'idle' },
  );

  const set = <K extends keyof Config>(key: K, value: Config[K]) => setCfg((c) => ({ ...c, [key]: value }));

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/prices', { cache: 'no-store' });
      const json: PricePayload = await res.json();
      setLive(json.prices);
      setMeta({ source: json.source, fetchedAt: json.fetchedAt });
    } catch {
      setMeta({ source: 'fallback', fetchedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  };

  const lookupPlayer = async () => {
    if (!rsn.trim()) return;
    setRsnStatus({ kind: 'loading' });
    try {
      const res = await fetch(`/api/hiscores?player=${encodeURIComponent(rsn.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setRsnStatus({ kind: 'error', msg: json.error ?? 'Lookup failed.' });
        return;
      }
      const player = json as Player;
      setCfg((c) => applyLevelGating({ ...c, currentXp: player.xp }));
      setRsnStatus({ kind: 'ok', msg: playerSummary(player) });
    } catch {
      setRsnStatus({ kind: 'error', msg: 'Lookup failed.' });
    }
  };

  const prices: PriceMap = useMemo(() => ({ ...live, ...overrides }), [live, overrides]);

  const proj = useMemo(() => project(cfg, prices), [cfg, prices]);
  const treeRows = useMemo(() => compareStrategies(cfg, prices, 'tree'), [cfg, prices]);
  const hardwoodRows = useMemo(() => compareStrategies(cfg, prices, 'hardwood'), [cfg, prices]);
  const fruitRows = useMemo(() => compareStrategies(cfg, prices, 'fruitTree'), [cfg, prices]);
  const herbRows = useMemo(() => compareStrategies(cfg, prices, 'herb'), [cfg, prices]);

  const level = levelForXp(cfg.currentXp);
  const lvlBase = xpForLevel(level);
  const lvlSpan = level < 99 ? xpForLevel(level + 1) - lvlBase : 1;
  const pctToNext = level >= 99 ? 0 : ((cfg.currentXp - lvlBase) / lvlSpan) * 100;

  const setLevel = (n: number) => {
    const base = xpForLevel(n);
    const span = n < 99 ? xpForLevel(n + 1) - base : 0;
    setCfg((c) => applyLevelGating({ ...c, currentXp: Math.round(base + (pctToNext / 100) * span) }));
  };
  const setPct = (p: number) => set('currentXp', Math.round(lvlBase + (p / 100) * lvlSpan));

  // Switching crop type re-derives that patch type's cadence from its growth time.
  const setTreeType = (v: TreeKey) =>
    setCfg((c) => ({ ...c, treeType: v, treeRunsPerDay: defaultRunsPerDay('tree', TREES[v].growthMinutes) }));
  const setHardwoodType = (v: HardwoodKey) =>
    setCfg((c) => ({
      ...c,
      hardwoodType: v,
      hardwoodRunsPerDay: defaultRunsPerDay('hardwood', HARDWOOD_TREES[v].growthMinutes),
    }));

  const gated = <K extends string>(all: K[], levelOf: (k: K) => number, name: (k: K) => string) =>
    all.filter((k) => levelOf(k) <= level).map((k) => ({ value: k, label: `${name(k)} (${levelOf(k)})` }));

  const treeOptions = gated(Object.keys(TREES) as TreeKey[], (k) => TREES[k].level, (k) => TREES[k].name);
  const hardwoodOptions = gated(
    Object.keys(HARDWOOD_TREES) as HardwoodKey[],
    (k) => HARDWOOD_TREES[k].level,
    (k) => HARDWOOD_TREES[k].name,
  );
  const fruitOptions = gated(
    Object.keys(FRUIT_TREES) as FruitTreeKey[],
    (k) => FRUIT_TREES[k].level,
    (k) => FRUIT_TREES[k].name,
  );
  const herbOptions = gated(Object.keys(HERBS) as HerbKey[], (k) => HERBS[k].level, (k) => HERBS[k].name);

  const cheapest = (rows: StrategyRow[]) => rows.reduce((a, b) => (b.costToTarget < a.costToTarget ? b : a));
  const fastest = (rows: StrategyRow[]) => rows.reduce((a, b) => (b.daysToTarget < a.daysToTarget ? b : a));
  const cur = (rows: StrategyRow[], s: Strategy) => rows.find((r) => r.strategy === s) ?? rows[0];

  const advice = [
    { name: `${TREES[cfg.treeType].name} trees`, rows: treeRows, current: cfg.treeStrategy },
    { name: `${HARDWOOD_TREES[cfg.hardwoodType].name} hardwood`, rows: hardwoodRows, current: cfg.hardwoodStrategy },
    { name: FRUIT_TREES[cfg.fruitType].name, rows: fruitRows, current: cfg.fruitStrategy },
    { name: `${HERBS[cfg.herbType].name} herbs`, rows: herbRows, current: cfg.herbCompost },
  ].map((a) => ({ ...a, cheapest: cheapest(a.rows), fastest: fastest(a.rows), now: cur(a.rows, a.current) }));

  const applyPlan = (pick: (rows: StrategyRow[]) => StrategyRow) =>
    setCfg((c) => ({
      ...c,
      treeStrategy: pick(treeRows).strategy,
      hardwoodStrategy: pick(hardwoodRows).strategy,
      fruitStrategy: pick(fruitRows).strategy,
      herbCompost: pick(herbRows).strategy as CompostTier,
    }));

  const matchesPlan = (pick: (rows: StrategyRow[]) => StrategyRow) =>
    pick(treeRows).strategy === cfg.treeStrategy &&
    pick(hardwoodRows).strategy === cfg.hardwoodStrategy &&
    pick(fruitRows).strategy === cfg.fruitStrategy &&
    pick(herbRows).strategy === cfg.herbCompost;

  const days = Number.isFinite(proj.daysNeeded) ? proj.daysNeeded : 0;
  const fullOutfit = OUTFIT_KEYS.every((k) => cfg.outfit[k]);
  const diseaseFreeNames = diseaseFreeHerbPatchNames(cfg.herbPatches);
  const tree = TREES[cfg.treeType];
  const hardwood = HARDWOOD_TREES[cfg.hardwoodType];
  const fruit = FRUIT_TREES[cfg.fruitType];
  const herb = HERBS[cfg.herbType];

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            OSRS Farming <span className="text-amber-400">99</span> Planner
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Tree, hardwood, fruit tree and herb runs modelled on their own cadence, with live GE prices.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="flex items-center justify-end gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  loading ? 'bg-amber-400' : meta.source === 'live' ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span className="text-slate-300">
                {loading ? 'Fetching prices…' : meta.source === 'live' ? 'Live GE prices' : 'Cached snapshot'}
              </span>
            </div>
            <div className="tabular-nums text-slate-500">{utcTime(meta.fetchedAt)}</div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* ---------------- Controls ---------------- */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <Card title="Your account">
            <div className="mb-3">
              <Field label="OSRS character name" hint="pulls Farming XP">
                <div className="flex gap-2">
                  <input
                    value={rsn}
                    onChange={(e) => setRsn(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void lookupPlayer();
                    }}
                    placeholder="e.g. Zezima"
                    maxLength={12}
                    className="w-full min-w-0 rounded-md border border-white/10 bg-slate-950/70 px-2.5 py-1.5 text-sm text-slate-100 outline-none transition focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30"
                  />
                  <button
                    onClick={() => void lookupPlayer()}
                    disabled={rsnStatus.kind === 'loading'}
                    className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
                  >
                    {rsnStatus.kind === 'loading' ? '…' : 'Load'}
                  </button>
                </div>
              </Field>
              {rsnStatus.msg && (
                <p className={`mt-1 text-[11px] ${rsnStatus.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {rsnStatus.msg}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Level">
                <NumberField value={level} onChange={setLevel} min={1} max={99} />
              </Field>
              <Field label="% to next">
                <NumberField value={Math.round(pctToNext * 10) / 10} onChange={setPct} min={0} max={99.9} step={0.1} />
              </Field>
              <Field label="Target">
                <NumberField value={cfg.targetLevel} onChange={(v) => set('targetLevel', v)} min={2} max={99} />
              </Field>
            </div>
            <p className="mt-2 text-[11px] tabular-nums text-slate-500">
              {fmtNum(cfg.currentXp)} xp &middot; {fmtNum(proj.xpNeeded)} xp to {cfg.targetLevel}
            </p>
          </Card>

          <Card title="Trees" subtitle={`${fmtNum(tree.checkXp, 1)} xp per check · ${growthLabel(tree.growthMinutes)}`}>
            <div className="space-y-3">
              <Field label="Tree type">
                <Select value={cfg.treeType} onChange={setTreeType} options={treeOptions} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Patches" hint={`0–${MAX_PATCHES.tree}`}>
                  <Slider value={cfg.treePatches} onChange={(v) => set('treePatches', v)} min={0} max={MAX_PATCHES.tree} />
                </Field>
                <RunsPerDayField
                  value={cfg.treeRunsPerDay}
                  onChange={(v) => set('treeRunsPerDay', v)}
                  growthMinutes={tree.growthMinutes}
                />
              </div>
              <Field label="Protection">
                <Select value={cfg.treeStrategy} onChange={(v) => set('treeStrategy', v)} options={STRATEGY_OPTIONS} />
              </Field>
              <Toggle
                checked={cfg.sellRoots}
                onChange={(b) => set('sellRoots', b)}
                label="Sell roots"
                hint={`${proj.day.rootsPerTree} per tree at level ${level}`}
              />
              <Toggle
                checked={cfg.sellLogs}
                onChange={(b) => set('sellLogs', b)}
                label="Sell logs"
                hint={`~${proj.day.logsPerTree} per tree when felled`}
              />
            </div>
          </Card>

          <Card
            title="Hardwood trees"
            subtitle={`${fmtNum(hardwood.checkXp, 1)} xp per check · ${growthLabel(hardwood.growthMinutes)}`}
          >
            <div className="space-y-3">
              <Field label="Hardwood type">
                <Select value={cfg.hardwoodType} onChange={setHardwoodType} options={hardwoodOptions} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Patches" hint={`0–${MAX_PATCHES.hardwood}`}>
                  <Slider
                    value={cfg.hardwoodPatches}
                    onChange={(v) => set('hardwoodPatches', v)}
                    min={0}
                    max={MAX_PATCHES.hardwood}
                  />
                </Field>
                <RunsPerDayField
                  value={cfg.hardwoodRunsPerDay}
                  onChange={(v) => set('hardwoodRunsPerDay', v)}
                  growthMinutes={hardwood.growthMinutes}
                />
              </div>
              <Field label="Protection">
                <Select
                  value={cfg.hardwoodStrategy}
                  onChange={(v) => set('hardwoodStrategy', v)}
                  options={STRATEGY_OPTIONS}
                />
              </Field>
              <Toggle
                checked={cfg.sellHardwoodLogs}
                onChange={(b) => set('sellHardwoodLogs', b)}
                label="Sell logs"
                hint="Hardwoods give no roots"
              />
            </div>
          </Card>

          <Card
            title="Fruit trees"
            subtitle={`${fmtNum(fruit.checkXp, 1)} xp per check · ${growthLabel(FRUIT_TREE_GROWTH_MINUTES)}`}
          >
            <div className="space-y-3">
              <Field label="Fruit tree type">
                <Select value={cfg.fruitType} onChange={(v) => set('fruitType', v)} options={fruitOptions} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Patches" hint={`0–${MAX_PATCHES.fruitTree}`}>
                  <Slider
                    value={cfg.fruitPatches}
                    onChange={(v) => set('fruitPatches', v)}
                    min={0}
                    max={MAX_PATCHES.fruitTree}
                  />
                </Field>
                <RunsPerDayField
                  value={cfg.fruitRunsPerDay}
                  onChange={(v) => set('fruitRunsPerDay', v)}
                  growthMinutes={FRUIT_TREE_GROWTH_MINUTES}
                />
              </div>
              <Field label="Protection">
                <Select value={cfg.fruitStrategy} onChange={(v) => set('fruitStrategy', v)} options={STRATEGY_OPTIONS} />
              </Field>
              <Toggle
                checked={cfg.sellSpareFruit}
                onChange={(b) => set('sellSpareFruit', b)}
                label="Sell spare produce"
                hint="Fruit left after protection payments"
              />
            </div>
          </Card>

          <Card title="Herbs" subtitle={`Herb patches cannot be paid for · ${growthLabel(HERB_GROWTH_MINUTES)}`}>
            <div className="space-y-3">
              <Field label="Herb">
                <Select value={cfg.herbType} onChange={(v) => set('herbType', v)} options={herbOptions} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Patches" hint={`0–${MAX_PATCHES.herb}`}>
                  <Slider value={cfg.herbPatches} onChange={(v) => set('herbPatches', v)} min={0} max={MAX_PATCHES.herb} />
                </Field>
                <RunsPerDayField
                  value={cfg.herbRunsPerDay}
                  onChange={(v) => set('herbRunsPerDay', v)}
                  growthMinutes={HERB_GROWTH_MINUTES}
                />
              </div>
              <Field label="Compost">
                <Select value={cfg.herbCompost} onChange={(v) => set('herbCompost', v)} options={COMPOST_OPTIONS} />
              </Field>
              <Toggle
                checked={cfg.sellHerbs}
                onChange={(b) => set('sellHerbs', b)}
                label="Sell herbs"
                hint="Off if you keep them for Herblore"
              />
              <p className="text-[11px] text-slate-500">
                <span className="tabular-nums">≈ {proj.day.herbYieldPerPatch.toFixed(2)}</span>{' '}
                {herb.name.toLowerCase()} per surviving patch ·{' '}
                <span className="tabular-nums">{proj.day.diseaseFreeHerbPatches}</span> disease-free
                {diseaseFreeNames.length > 0 && ` (${diseaseFreeNames.join(', ')})`}
              </p>
            </div>
          </Card>

          <Card title="Gear" subtitle={`+${proj.day.outfitBonusPct.toFixed(1)}% farming XP`}>
            <div className="space-y-2">
              <Toggle
                checked={fullOutfit}
                onChange={(b) => set('outfit', b ? OUTFIT_ALL_WORN : OUTFIT_NONE_WORN)}
                label="Full farmer's outfit"
                hint={`all four pieces · +${OUTFIT_FULL_BONUS_PCT}% xp`}
              />
              <div className="space-y-2 border-t border-white/10 pt-2">
                {OUTFIT_KEYS.map((k) => (
                  <Toggle
                    key={k}
                    checked={cfg.outfit[k]}
                    onChange={(b) => set('outfit', { ...cfg.outfit, [k]: b })}
                    label={OUTFIT_PIECES[k].label}
                    hint={`+${OUTFIT_PIECES[k].bonus}% xp`}
                  />
                ))}
              </div>
              <p className="px-0.5 text-[10px] text-slate-500">Wearing all four adds a further +0.5%.</p>
              <div className="pt-1">
                <Field label="Secateurs">
                  <Select value={cfg.secateurs} onChange={(v) => set('secateurs', v)} options={SECATEURS_OPTIONS} />
                </Field>
              </div>
              <p className="px-0.5 text-[10px] text-slate-500">
                +{proj.day.yieldBonusPct}% to the chance to save a harvest life
                {level >= 99 && `, including +${FARMING_CAPE_YIELD_BONUS_PCT}% for the Farming cape`}.
              </p>
            </div>
          </Card>

          <Card
            title="GE prices"
            actions={
              <button
                onClick={() => setShowPrices((s) => !s)}
                className="text-[11px] text-amber-300/80 transition hover:text-amber-300"
              >
                {showPrices ? 'Hide' : 'Edit'}
              </button>
            }
          >
            {!showPrices ? (
              <p className="text-xs leading-relaxed text-slate-400">
                {ITEM_NAMES[tree.seedItem]}{' '}
                <span className="tabular-nums text-slate-200">{fmtNum(prices[tree.seedItem] ?? 0)}</span> &middot;{' '}
                {ITEM_NAMES[hardwood.seedItem]}{' '}
                <span className="tabular-nums text-slate-200">{fmtNum(prices[hardwood.seedItem] ?? 0)}</span> &middot;
                Ultracompost <span className="tabular-nums text-slate-200">{fmtNum(prices.ultracompost ?? 0)}</span>
              </p>
            ) : (
              <div className="space-y-2">
                {priceKeysFor(cfg).map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs text-slate-400">{ITEM_NAMES[k]}</span>
                    <div className="w-24">
                      <NumberField
                        value={prices[k] ?? 0}
                        onChange={(v) => setOverrides((o) => ({ ...o, [k]: v }))}
                        min={0}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setOverrides({})}
                  className="w-full rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-slate-300 transition hover:border-amber-400/50 hover:text-amber-300"
                >
                  Reset to live prices
                </button>
              </div>
            )}
          </Card>
        </aside>

        {/* ---------------- Results ---------------- */}
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label={`Days to ${cfg.targetLevel}`}
              value={days > 0 ? days.toFixed(1) : '—'}
              sub={`${fmtNum(proj.hours, 1)} hrs of running`}
              tone="gold"
            />
            <Stat
              label="Days to next level"
              value={fmtNum(proj.daysToNextLevel, 1)}
              sub={level < 99 ? `level ${level + 1}` : 'maxed'}
            />
            <Stat
              label="Net cost"
              value={`${fmtGp(-proj.totalNet)} gp`}
              sub={`${fmtGp(proj.day.netPerDay)} gp/day`}
              tone={proj.totalNet >= 0 ? 'good' : 'bad'}
            />
            <Stat
              label="XP per day"
              value={fmtGp(proj.day.xpPerDay)}
              sub={`${fmtGp(proj.xpPerHour)} xp/hr`}
            />
          </div>

          <Card
            title="Protection verdict"
            subtitle="Cheapest and fastest protection per patch type, at current prices"
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {advice.map(({ name, cheapest: cheap, fastest: fast, now }) => (
                <div key={name} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                  <div className="mb-2 text-xs font-semibold text-slate-300">{name}</div>
                  <Recommendation
                    tag="Cheapest"
                    row={cheap}
                    now={now}
                    delta={now.costToTarget - cheap.costToTarget}
                    deltaKind="gp"
                  />
                  <Recommendation
                    tag="Fastest"
                    row={fast}
                    now={now}
                    delta={now.daysToTarget - fast.daysToTarget}
                    deltaKind="days"
                    extra={
                      fast.strategy !== cheap.strategy
                        ? `${fmtGp(fast.costToTarget - cheap.costToTarget)} gp more than cheapest`
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => applyPlan(cheapest)}
                disabled={matchesPlan(cheapest)}
                className="rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-default disabled:opacity-40"
              >
                Apply cheapest strategies
              </button>
              <button
                onClick={() => applyPlan(fastest)}
                disabled={matchesPlan(fastest)}
                className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-default disabled:opacity-40"
              >
                Apply fastest strategies
              </button>
            </div>
          </Card>

          <Card title="Per-crop metrics" subtitle="Each patch type on its own cadence, after disease and the outfit bonus">
            <CropTable crops={proj.day.crops} />
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="XP over time" subtitle="Green dots mark level-ups">
              <XpProgressChart data={proj.timeline} levelUps={proj.levelUps} />
            </Card>
            <Card title="Profit / loss over time" subtitle={`${fmtGp(proj.day.netPerDay)} gp per day`}>
              <BankChart data={proj.timeline} />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Days per level" subtitle={`${fmtNum(proj.daysNeeded, 1)} days to ${cfg.targetLevel}`}>
              <DaysPerLevelChart levelUps={proj.levelUps} />
            </Card>
            <Card title="XP per day by source">
              <XpBreakdownChart
                data={proj.day.crops.map((c) => ({ label: c.label, kind: c.kind, xp: c.xpPerDay }))}
              />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Economy per day" subtitle="Cost vs revenue by patch type">
              <CropEconomyChart
                data={proj.day.crops.map((c) => ({
                  label: c.label,
                  cost: Math.round(c.costPerDay),
                  revenue: Math.round(c.revenuePerDay),
                }))}
              />
            </Card>
            <Card
              title="Per-day breakdown"
              subtitle={`${fmtGp(proj.day.costPerDay)} out, ${fmtGp(proj.day.revenuePerDay)} in`}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <LineItems title="Costs" items={proj.day.costItems} tone="text-rose-400" />
                <LineItems title="Revenue" items={proj.day.revenueItems} tone="text-emerald-400" />
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title={`${tree.name} tree strategies`} subtitle="Whole-day totals, everything else held equal">
              <StrategyChart rows={treeRows} highlight={cfg.treeStrategy} />
              <StrategyTable rows={treeRows} current={cfg.treeStrategy} />
            </Card>
            <Card title={`${hardwood.name} strategies`} subtitle="Whole-day totals, everything else held equal">
              <StrategyChart rows={hardwoodRows} highlight={cfg.hardwoodStrategy} />
              <StrategyTable rows={hardwoodRows} current={cfg.hardwoodStrategy} />
            </Card>
            <Card title={`${fruit.name} strategies`} subtitle="Whole-day totals, everything else held equal">
              <StrategyChart rows={fruitRows} highlight={cfg.fruitStrategy} />
              <StrategyTable rows={fruitRows} current={cfg.fruitStrategy} />
            </Card>
            <Card title="Produce flow" subtitle="Home-grown produce settled against gardener payments, per day">
              {proj.day.produceFlow.filter((p) => p.needed > 0 || p.produced > 0).length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No gardener payments owed.</p>
              ) : (
                <div className="space-y-2">
                  {proj.day.produceFlow
                    .filter((p) => p.needed > 0 || p.produced > 0)
                    .map((p) => (
                      <p
                        key={p.item}
                        className="rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400"
                      >
                        <span className="text-slate-200">{ITEM_NAMES[p.item]}</span>: {fmtNum(p.produced, 1)}/day
                        grown, {fmtNum(p.needed, 1)}/day owed &rarr;{' '}
                        {p.bought > 0 ? (
                          <span className="text-rose-400">{fmtNum(p.bought, 1)} bought</span>
                        ) : p.spare > 0 ? (
                          <span className="text-emerald-400">{fmtNum(p.spare, 1)} spare</span>
                        ) : (
                          <span className="text-emerald-400">exactly covered</span>
                        )}{' '}
                        at {fmtNum(prices[p.item] ?? 0)} gp each.
                      </p>
                    ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Assumptions">
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-400">
              <li>
                Each patch type runs on its own cadence, so days — not runs — are the base unit. A cadence starts at one
                trip a day (two for herbs) and is capped by growth time, which is why hardwoods land below 1/day.
              </li>
              <li>
                Disease is rolled once per vulnerable growth cycle. The published figures are the{' '}
                <span className="text-slate-300">maximum roll</span>, and 0 also counts as diseased, so the real chance
                is (max + 1)/128. Compost divides the max roll by 50/80/90% and rounds down.
              </li>
              <li>
                That means nothing is ever disease-immune. Ultracompost takes a {tree.name.toLowerCase()} tree&apos;s
                max roll to 0, but the 0 outcome still lands — 1/128 a cycle over {tree.stages - 1} cycles. Player
                testing on the wiki&apos;s Talk:Disease page measured ~6.9% disease for ultracomposted herbs, which this
                reproduces; reading the figures as a plain chance predicts 4.6%.
              </li>
              <li>
                Only maple (13/128) and magic (9/128) tree rates are published. Oak, willow, yew and every hardwood use
                the <span className="text-slate-300">base = 20 − cycles</span> pattern those two define.
              </li>
              <li>
                A diseased tree you do not cure before your next visit dies: you lose the seed and all of its XP. Paying
                the gardener removes disease entirely.
              </li>
              <li>
                Herb yield is lives ÷ (1 − chance to save), +1 life per compost tier. Every herb reaches a 31.6% save
                chance at 99. Magic secateurs (+10%) and the Farming cape (+5%, assumed at 99) raise that save chance
                rather than the yield directly, and stack additively.
              </li>
              <li>
                Roots step every 8 Farming levels from the tree&apos;s requirement, capping at 4; felling a tree yields
                ~8 logs. Hardwood trees have no roots item, so logs are their only produce.
              </li>
              <li>Prices are the midpoint of the latest instant-buy and instant-sell from the OSRS Wiki price API.</li>
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}

/** One recommendation line: the pick, and what switching to it buys you. */
function Recommendation({
  tag,
  row,
  now,
  delta,
  deltaKind,
  extra,
}: {
  tag: string;
  row: StrategyRow;
  now: StrategyRow;
  delta: number;
  deltaKind: 'gp' | 'days';
  extra?: string;
}) {
  const active = row.strategy === now.strategy;
  const worthwhile = delta > (deltaKind === 'days' ? 0.05 : 1);

  return (
    <div className="border-t border-white/5 py-1.5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{tag}</span>
        {active && <span className="text-[10px] font-medium text-emerald-400">current</span>}
      </div>
      <div className="text-xs font-semibold text-amber-300">{row.label}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
        {fmtGp(row.costToTarget)} gp &middot; {fmtNum(row.daysToTarget, 1)} days
      </div>
      {!active && worthwhile && (
        <div className="text-[11px] text-emerald-400">
          {deltaKind === 'gp' ? `saves ${fmtGp(delta)} gp` : `saves ${delta.toFixed(1)} days`}
        </div>
      )}
      {extra && <div className="text-[11px] text-slate-500">{extra}</div>}
    </div>
  );
}

/** "8h" / "3.6d" — how long one crop of this type takes to grow. */
function growthLabel(minutes: number): string {
  if (minutes < 1440) return `${Math.round(minutes / 60)}h grow`;
  return `${(minutes / 1440).toFixed(1)}d grow`;
}

function RunsPerDayField({
  value,
  onChange,
  growthMinutes,
}: {
  value: number;
  onChange: (n: number) => void;
  growthMinutes: number;
}) {
  const ceiling = maxRunsPerDay(growthMinutes);
  return (
    <Field label="Runs / day" hint={`max ${ceiling < 1 ? ceiling.toFixed(2) : fmtNum(ceiling, 1)}`}>
      <NumberField value={value} onChange={onChange} min={0} max={Math.round(ceiling * 100) / 100} step={0.25} />
    </Field>
  );
}

/** Keep crop selections plantable when the level drops below their requirement. */
function applyLevelGating(cfg: Config): Config {
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
      treeType === cfg.treeType ? cfg.treeRunsPerDay : defaultRunsPerDay('tree', TREES[treeType].growthMinutes),
    hardwoodRunsPerDay:
      hardwoodType === cfg.hardwoodType
        ? cfg.hardwoodRunsPerDay
        : defaultRunsPerDay('hardwood', HARDWOOD_TREES[hardwoodType].growthMinutes),
    fruitType: bestFor(Object.keys(FRUIT_TREES) as FruitTreeKey[], (k) => FRUIT_TREES[k].level, cfg.fruitType),
    herbType: bestFor(Object.keys(HERBS) as HerbKey[], (k) => HERBS[k].level, cfg.herbType),
  };
}

/** Expected XP and P/L, broken out per patch type, per run and per day. */
function CropTable({ crops }: { crops: CropResult[] }) {
  const total = crops.reduce(
    (a, c) => ({
      xpPerDay: a.xpPerDay + c.xpPerDay,
      costPerDay: a.costPerDay + c.costPerDay,
      netPerDay: a.netPerDay + c.netPerDay,
      patches: a.patches + c.patches,
    }),
    { xpPerDay: 0, costPerDay: 0, netPerDay: 0, patches: 0 },
  );

  const cell = 'py-1.5 text-right';
  const money = (n: number) => (n >= 0 ? 'text-emerald-400' : 'text-rose-400');

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[11px] tabular-nums">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-1.5 text-left font-medium">Crop</th>
            <th className="pb-1.5 text-right font-medium">Patches</th>
            <th className="pb-1.5 text-right font-medium">Runs / day</th>
            <th className="pb-1.5 text-right font-medium">Survive</th>
            <th className="pb-1.5 text-right font-medium">XP / run</th>
            <th className="pb-1.5 text-right font-medium">XP / plant</th>
            <th className="pb-1.5 text-right font-medium">XP / day</th>
            <th className="pb-1.5 text-right font-medium">Cost / run</th>
            <th className="pb-1.5 text-right font-medium">Net / run</th>
            <th className="pb-1.5 text-right font-medium">Net / day</th>
          </tr>
        </thead>
        <tbody>
          {crops.map((c) => (
            <tr key={c.label} className="border-t border-white/5 text-slate-300">
              <td className="py-1.5 pr-2 text-left font-medium text-slate-200">{c.label}</td>
              <td className={cell}>{c.patches}</td>
              <td className={cell}>{c.runsPerDay < 1 ? c.runsPerDay.toFixed(2) : fmtNum(c.runsPerDay, 1)}</td>
              <td className={cell}>{(c.survival * 100).toFixed(1)}%</td>
              <td className={`${cell} text-amber-300`}>{fmtNum(c.xpPerRun)}</td>
              <td className={cell}>{fmtNum(c.patches > 0 ? c.xpPerRun / c.patches : 0)}</td>
              <td className={`${cell} text-amber-300`}>{fmtNum(c.xpPerDay)}</td>
              <td className={`${cell} text-rose-400`}>{fmtGp(c.costPerRun)}</td>
              <td className={`${cell} ${money(c.netPerRun)}`}>{fmtGp(c.netPerRun)}</td>
              <td className={`${cell} ${money(c.netPerDay)}`}>{fmtGp(c.netPerDay)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-white/15 font-semibold text-slate-100">
            <td className="py-1.5 pr-2 text-left">Overall</td>
            <td className={cell}>{total.patches}</td>
            <td className={cell}>—</td>
            <td className={cell}>—</td>
            <td className={cell}>—</td>
            <td className={cell}>—</td>
            <td className={`${cell} text-amber-300`}>{fmtNum(total.xpPerDay)}</td>
            <td className={`${cell} text-rose-400`}>{fmtGp(total.costPerDay)}</td>
            <td className={cell}>—</td>
            <td className={`${cell} ${money(total.netPerDay)}`}>{fmtGp(total.netPerDay)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function StrategyTable({ rows, current }: { rows: StrategyRow[]; current: Strategy }) {
  const best = rows.reduce((a, b) => (b.costToTarget < a.costToTarget ? b : a));
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pb-1 font-medium">Strategy</th>
            <th className="pb-1 text-right font-medium">Survive</th>
            <th className="pb-1 text-right font-medium">XP/day</th>
            <th className="pb-1 text-right font-medium">Days</th>
            <th className="pb-1 text-right font-medium">Net cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.strategy}
              className={`border-t border-white/5 ${
                r.strategy === current
                  ? 'text-amber-300'
                  : r.strategy === best.strategy
                    ? 'text-emerald-400'
                    : 'text-slate-300'
              }`}
            >
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right">{(r.survival * 100).toFixed(1)}%</td>
              <td className="py-1 text-right">{fmtGp(r.xpPerDay)}</td>
              <td className="py-1 text-right">{fmtNum(r.daysToTarget, 1)}</td>
              <td className="py-1 text-right">{fmtGp(r.costToTarget)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineItems({
  title,
  items,
  tone,
}: {
  title: string;
  items: { label: string; qty: number; unit: number; total: number }[];
  tone: string;
}) {
  const total = items.reduce((s, i) => s + i.total, 0);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold text-slate-300">{title}</h3>
        <span className={`text-xs font-semibold tabular-nums ${tone}`}>{fmtGp(total)} gp</span>
      </div>
      <table className="w-full text-[11px] tabular-nums">
        <tbody>
          {items.map((i) => (
            <tr key={i.label} className="border-t border-white/5 text-slate-400">
              <td className="py-1 pr-2">{i.label}</td>
              <td className="py-1 text-right text-slate-500">
                {fmtNum(i.qty, i.qty % 1 === 0 ? 0 : 1)} &times; {fmtNum(i.unit)}
              </td>
              <td className="py-1 pl-2 text-right text-slate-200">{fmtGp(i.total)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="py-1 text-slate-600">None</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
