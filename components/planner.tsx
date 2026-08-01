'use client';

import { useMemo, useState } from 'react';
import {
  BankChart,
  CropEconomyChart,
  RunsPerLevelChart,
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
  FruitTreeKey,
  HERBS,
  HerbKey,
  ITEM_NAMES,
  ItemKey,
  MAX_PATCHES,
  OUTFIT_PIECES,
  OutfitPiece,
  SECATEURS,
  SecateursKey,
  Strategy,
  TREES,
  TreeKey,
  diseaseFreeHerbPatchNames,
  levelForXp,
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
  const f = FRUIT_TREES[cfg.fruitType];
  const h = HERBS[cfg.herbType];
  const keys: ItemKey[] = [
    t.seedItem, t.rootsItem, t.logsItem, t.payItem,
    f.seedItem, f.fruitItem, f.payItem,
    h.seedItem, h.productItem,
    'compost', 'supercompost', 'ultracompost',
  ];
  return [...new Set(keys)];
};

/** ISO string -> "HH:MM UTC". Avoids locale-dependent hydration mismatches. */
const utcTime = (iso: string) => `${iso.slice(11, 16)} UTC`;

export default function Planner({ initial }: { initial: PricePayload }) {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [live, setLive] = useState<PriceMap>(initial.prices);
  const [overrides, setOverrides] = useState<Partial<Record<ItemKey, number>>>({});
  const [meta, setMeta] = useState({ source: initial.source, fetchedAt: initial.fetchedAt });
  const [loading, setLoading] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  const [rsn, setRsn] = useState('');
  const [rsnStatus, setRsnStatus] = useState<{ kind: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({
    kind: 'idle',
  });

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
      setCfg((c) => applyLevelGating({ ...c, currentXp: json.xp }));
      setRsnStatus({ kind: 'ok', msg: `${json.name}: level ${json.level} (${fmtNum(json.xp)} xp)` });
    } catch {
      setRsnStatus({ kind: 'error', msg: 'Lookup failed.' });
    }
  };

  const prices: PriceMap = useMemo(() => ({ ...live, ...overrides }), [live, overrides]);

  const proj = useMemo(() => project(cfg, prices), [cfg, prices]);
  const treeRows = useMemo(() => compareStrategies(cfg, prices, 'tree'), [cfg, prices]);
  const fruitRows = useMemo(() => compareStrategies(cfg, prices, 'fruit'), [cfg, prices]);

  const level = levelForXp(cfg.currentXp);
  const lvlBase = xpForLevel(level);
  const lvlSpan = level < 99 ? xpForLevel(level + 1) - lvlBase : 1;
  // At 99 there is no next level; keeping this at 0 also stops a later level
  // change from inheriting a 100% carry and landing a level too high.
  const pctToNext = level >= 99 ? 0 : ((cfg.currentXp - lvlBase) / lvlSpan) * 100;

  const setLevel = (n: number) => {
    const base = xpForLevel(n);
    const span = n < 99 ? xpForLevel(n + 1) - base : 0;
    setCfg((c) => applyLevelGating({ ...c, currentXp: Math.round(base + (pctToNext / 100) * span) }));
  };
  const setPct = (p: number) => set('currentXp', Math.round(lvlBase + (p / 100) * lvlSpan));

  // Only offer crops the account can actually plant.
  const treeOptions = (Object.keys(TREES) as TreeKey[])
    .filter((k) => TREES[k].level <= level)
    .map((k) => ({ value: k, label: `${TREES[k].name} (${TREES[k].level})` }));
  const fruitOptions = (Object.keys(FRUIT_TREES) as FruitTreeKey[])
    .filter((k) => FRUIT_TREES[k].level <= level)
    .map((k) => ({ value: k, label: `${FRUIT_TREES[k].name} (${FRUIT_TREES[k].level})` }));
  const herbOptions = (Object.keys(HERBS) as HerbKey[])
    .filter((k) => HERBS[k].level <= level)
    .map((k) => ({ value: k, label: `${HERBS[k].name} (${HERBS[k].level})` }));

  const bestTree = treeRows.reduce((a, b) => (b.costToTarget < a.costToTarget ? b : a));
  const bestFruit = fruitRows.reduce((a, b) => (b.costToTarget < a.costToTarget ? b : a));
  const currentTree = treeRows.find((r) => r.strategy === cfg.treeStrategy) ?? treeRows[0];
  const currentFruit = fruitRows.find((r) => r.strategy === cfg.fruitStrategy) ?? fruitRows[0];

  const applyBest = () =>
    setCfg((c) => ({ ...c, treeStrategy: bestTree.strategy, fruitStrategy: bestFruit.strategy }));

  const days = Number.isFinite(proj.days) ? proj.days : 0;
  const diseaseFreeNames = diseaseFreeHerbPatchNames(cfg.herbPatches);
  const tree = TREES[cfg.treeType];
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
            Tree, fruit tree and herb run modelling with live Grand Exchange prices.
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Farming level">
                <NumberField value={level} onChange={setLevel} min={1} max={99} />
              </Field>
              <Field label="% to next">
                <NumberField value={Math.round(pctToNext * 10) / 10} onChange={setPct} min={0} max={99.9} step={0.1} />
              </Field>
              <Field label="Target level">
                <NumberField value={cfg.targetLevel} onChange={(v) => set('targetLevel', v)} min={2} max={99} />
              </Field>
              <Field label="Runs / day">
                <NumberField value={cfg.runsPerDay} onChange={(v) => set('runsPerDay', v)} min={0.1} step={0.5} />
              </Field>
            </div>
            <p className="mt-2 text-[11px] tabular-nums text-slate-500">
              {fmtNum(cfg.currentXp)} xp &middot; {fmtNum(proj.xpNeeded)} xp to {cfg.targetLevel}
            </p>
          </Card>

          <Card title="Trees" subtitle={`${fmtNum(tree.checkXp, 1)} xp per check`}>
            <div className="space-y-3">
              <Field label="Tree type">
                <Select value={cfg.treeType} onChange={(v) => set('treeType', v)} options={treeOptions} />
              </Field>
              <Field label="Patches" hint={`0–${MAX_PATCHES.tree}`}>
                <Slider
                  value={cfg.treePatches}
                  onChange={(v) => set('treePatches', v)}
                  min={0}
                  max={MAX_PATCHES.tree}
                />
              </Field>
              <Field label="Protection">
                <Select value={cfg.treeStrategy} onChange={(v) => set('treeStrategy', v)} options={STRATEGY_OPTIONS} />
              </Field>
              <Toggle
                checked={cfg.sellRoots}
                onChange={(b) => set('sellRoots', b)}
                label="Sell roots"
                hint={`${proj.run.rootsPerTree} per tree at level ${level}`}
              />
              <Toggle
                checked={cfg.sellLogs}
                onChange={(b) => set('sellLogs', b)}
                label="Sell logs"
                hint={`~${proj.run.logsPerTree} per tree when felled`}
              />
            </div>
          </Card>

          <Card title="Fruit trees" subtitle={`${fmtNum(fruit.checkXp, 1)} xp per check`}>
            <div className="space-y-3">
              <Field label="Fruit tree type">
                <Select value={cfg.fruitType} onChange={(v) => set('fruitType', v)} options={fruitOptions} />
              </Field>
              <Field label="Patches" hint={`0–${MAX_PATCHES.fruitTree}`}>
                <Slider
                  value={cfg.fruitPatches}
                  onChange={(v) => set('fruitPatches', v)}
                  min={0}
                  max={MAX_PATCHES.fruitTree}
                />
              </Field>
              <Field label="Protection">
                <Select
                  value={cfg.fruitStrategy}
                  onChange={(v) => set('fruitStrategy', v)}
                  options={STRATEGY_OPTIONS}
                />
              </Field>
              <Toggle
                checked={cfg.sellSpareFruit}
                onChange={(b) => set('sellSpareFruit', b)}
                label="Sell spare produce"
                hint="Fruit left after protection payments"
              />
            </div>
          </Card>

          <Card title="Herbs" subtitle="Herb patches cannot be paid for">
            <div className="space-y-3">
              <Field label="Herb">
                <Select value={cfg.herbType} onChange={(v) => set('herbType', v)} options={herbOptions} />
              </Field>
              <Field label="Patches" hint={`0–${MAX_PATCHES.herb}`}>
                <Slider
                  value={cfg.herbPatches}
                  onChange={(v) => set('herbPatches', v)}
                  min={0}
                  max={MAX_PATCHES.herb}
                />
              </Field>
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
                <span className="tabular-nums">≈ {proj.run.herbYieldPerPatch.toFixed(2)}</span>{' '}
                {herb.name.toLowerCase()} per surviving patch ·{' '}
                <span className="tabular-nums">{proj.run.diseaseFreeHerbPatches}</span> disease-free
                {diseaseFreeNames.length > 0 && ` (${diseaseFreeNames.join(', ')})`}
              </p>
            </div>
          </Card>

          <Card title="Gear" subtitle={`+${proj.run.outfitBonusPct.toFixed(1)}% farming XP`}>
            <div className="space-y-2">
              {OUTFIT_KEYS.map((k) => (
                <Toggle
                  key={k}
                  checked={cfg.outfit[k]}
                  onChange={(b) => set('outfit', { ...cfg.outfit, [k]: b })}
                  label={OUTFIT_PIECES[k].label}
                  hint={`+${OUTFIT_PIECES[k].bonus}% xp`}
                />
              ))}
              <p className="px-0.5 text-[10px] text-slate-500">Full set adds a further +0.5%.</p>
              <div className="pt-1">
                <Field label="Secateurs">
                  <Select value={cfg.secateurs} onChange={(v) => set('secateurs', v)} options={SECATEURS_OPTIONS} />
                </Field>
              </div>
              <p className="px-0.5 text-[10px] text-slate-500">
                +{proj.run.yieldBonusPct}% to the chance to save a harvest life
                {level >= 99 && `, including +${FARMING_CAPE_YIELD_BONUS_PCT}% for the Farming cape`}.
              </p>
            </div>
          </Card>

          <Card title="Run settings">
            <div className="space-y-3">
              <Field label="Minutes per run">
                <NumberField value={cfg.minutesPerRun} onChange={(v) => set('minutesPerRun', v)} min={1} />
              </Field>
              <Toggle
                checked={cfg.diseaseFloorAtOne}
                onChange={(b) => set('diseaseFloorAtOne', b)}
                label="1/128 disease floor"
                hint="Off = compost can reach 0% disease"
              />
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
                {ITEM_NAMES[tree.payItem]}{' '}
                <span className="tabular-nums text-slate-200">{fmtNum(prices[tree.payItem] ?? 0)}</span> &middot;
                Ultracompost{' '}
                <span className="tabular-nums text-slate-200">{fmtNum(prices.ultracompost ?? 0)}</span>
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
              sub={`${fmtNum(Math.ceil(proj.runsNeeded || 0))} runs total`}
              tone="gold"
            />
            <Stat
              label="Runs to next level"
              value={Number.isFinite(proj.runsToNextLevel) ? proj.runsToNextLevel.toFixed(1) : '—'}
              sub={level < 99 ? `level ${level + 1}` : 'maxed'}
            />
            <Stat
              label="Net cost"
              value={`${fmtGp(-proj.totalNet)} gp`}
              sub={`${fmtGp(proj.gpPerDay)} gp/day`}
              tone={proj.totalNet >= 0 ? 'good' : 'bad'}
            />
            <Stat
              label="XP per day"
              value={fmtGp(proj.xpPerDay)}
              sub={`${fmtNum(proj.run.xpPerRun)} per run`}
            />
          </div>

          <Card title="Protection verdict" subtitle="Cheapest way to keep your trees alive, at current prices">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: `${tree.name} trees`, best: bestTree, current: currentTree },
                { name: fruit.name, best: bestFruit, current: currentFruit },
              ].map(({ name, best, current }) => {
                const saving = current.costToTarget - best.costToTarget;
                const same = best.strategy === current.strategy;
                return (
                  <div key={name} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                    <div className="text-xs font-semibold text-slate-300">{name}</div>
                    {same ? (
                      <p className="mt-1.5 text-sm text-emerald-400">
                        <span className="font-semibold">{best.label}</span> is already optimal.
                      </p>
                    ) : (
                      <p className="mt-1.5 text-sm text-slate-200">
                        Switch to <span className="font-semibold text-amber-300">{best.label}</span> and save{' '}
                        <span className="font-semibold text-emerald-400">{fmtGp(saving)} gp</span> reaching{' '}
                        {cfg.targetLevel}.
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">
                      {(best.survival * 100).toFixed(1)}% survival &middot; {fmtNum(best.daysToTarget, 1)} days vs{' '}
                      {fmtNum(current.daysToTarget, 1)} now
                    </p>
                  </div>
                );
              })}
            </div>
            {(bestTree.strategy !== cfg.treeStrategy || bestFruit.strategy !== cfg.fruitStrategy) && (
              <button
                onClick={applyBest}
                className="mt-3 rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Apply cheapest strategies
              </button>
            )}
          </Card>

          <Card
            title="Per-crop metrics"
            subtitle="Expected values per run, after disease losses and the outfit bonus"
          >
            <CropTable crops={proj.run.crops} />
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="XP over time" subtitle="Green dots mark level-ups">
              <XpProgressChart data={proj.timeline} levelUps={proj.levelUps} />
            </Card>
            <Card title="Profit / loss over time" subtitle={`${fmtGp(proj.gpPerDay)} gp per day`}>
              <BankChart data={proj.timeline} />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Runs per level" subtitle={`${fmtNum(proj.runsNeeded, 1)} runs to ${cfg.targetLevel}`}>
              <RunsPerLevelChart levelUps={proj.levelUps} />
            </Card>
            <Card title="XP per run by source">
              <XpBreakdownChart data={proj.run.crops.map((c) => ({ label: c.label, xp: c.xp }))} />
              <div className="mt-3">
                <CropEconomyChart
                  data={proj.run.crops.map((c) => ({
                    label: c.label,
                    cost: Math.round(c.cost),
                    revenue: Math.round(c.revenue),
                  }))}
                />
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title={`${tree.name} tree strategies`} subtitle="Whole-run totals, everything else held equal">
              <StrategyChart rows={treeRows} highlight={cfg.treeStrategy} />
              <StrategyTable rows={treeRows} current={cfg.treeStrategy} />
            </Card>
            <Card title={`${fruit.name} strategies`} subtitle="Whole-run totals, everything else held equal">
              <StrategyChart rows={fruitRows} highlight={cfg.fruitStrategy} />
              <StrategyTable rows={fruitRows} current={cfg.fruitStrategy} />
            </Card>
          </div>

          <Card
            title="Per-run breakdown"
            subtitle={`${fmtGp(proj.run.costPerRun)} out, ${fmtGp(proj.run.revenuePerRun)} in`}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <LineItems title="Costs" items={proj.run.costItems} tone="text-rose-400" />
              <LineItems title="Revenue" items={proj.run.revenueItems} tone="text-emerald-400" />
            </div>
            {proj.run.produceFlow
              .filter((p) => p.needed > 0)
              .map((p) => (
                <p
                  key={p.item}
                  className="mt-3 rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400"
                >
                  {ITEM_NAMES[p.item]}: {fmtNum(p.produced, 1)} grown, {fmtNum(p.needed)} owed to gardeners &rarr;{' '}
                  {p.bought > 0 ? (
                    <span className="text-rose-400">{fmtNum(p.bought, 1)} bought</span>
                  ) : (
                    <span className="text-emerald-400">fully self-supplied</span>
                  )}{' '}
                  at {fmtNum(prices[p.item] ?? 0)} gp each.
                </p>
              ))}
          </Card>

          <Card title="Assumptions">
            <ul className="space-y-1 text-[11px] leading-relaxed text-slate-400">
              <li>
                Disease is rolled once per vulnerable growth cycle. {tree.name} tree {tree.diseaseBase128}/128 over{' '}
                {tree.stages - 1} cycles, fruit trees 18/128 over 4, herbs 27/128 over 3. Compost cuts that by
                50/80/90%, rounded down to the nearest 1/128.
              </li>
              <li>
                Only maple (13/128) and magic (9/128) tree rates are published; oak, willow and yew use the{' '}
                <span className="text-slate-300">base = 20 − cycles</span> pattern those two define.
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
                Roots are deterministic: 1 per tree at the tree&apos;s own level requirement, stepping up every 8
                Farming levels to a maximum of 4. You get {proj.run.rootsPerTree} per {tree.name.toLowerCase()} tree at
                level {level}.
              </li>
              <li>
                Felling a tree yields {proj.run.logsPerTree} logs on average (farmed trees have a 1/8 chance to deplete
                per log). Roots and logs both require chopping the tree down, so they arrive together.
              </li>
              <li>
                Disease-free patches are taken from the standard herb patch order, so {cfg.herbPatches} patches includes{' '}
                {proj.run.diseaseFreeHerbPatches}
                {diseaseFreeNames.length > 0 && `: ${diseaseFreeNames.join(', ')}`}.
              </li>
              <li>Prices are the midpoint of the latest instant-buy and instant-sell from the OSRS Wiki price API.</li>
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}

/** Keep crop selections plantable when the level drops below their requirement. */
function applyLevelGating(cfg: Config): Config {
  const level = levelForXp(cfg.currentXp);
  const best = <K extends string>(
    keys: K[],
    levelOf: (k: K) => number,
    current: K,
  ): K => {
    if (levelOf(current) <= level) return current;
    const usable = keys.filter((k) => levelOf(k) <= level);
    if (usable.length === 0) return keys[0];
    return usable.reduce((a, b) => (levelOf(b) > levelOf(a) ? b : a));
  };

  return {
    ...cfg,
    treeType: best(Object.keys(TREES) as TreeKey[], (k) => TREES[k].level, cfg.treeType),
    fruitType: best(Object.keys(FRUIT_TREES) as FruitTreeKey[], (k) => FRUIT_TREES[k].level, cfg.fruitType),
    herbType: best(Object.keys(HERBS) as HerbKey[], (k) => HERBS[k].level, cfg.herbType),
  };
}

/** Expected XP and P/L per run, broken out per crop and per individual plant. */
function CropTable({ crops }: { crops: CropResult[] }) {
  const total = crops.reduce(
    (a, c) => ({
      xp: a.xp + c.xp,
      cost: a.cost + c.cost,
      revenue: a.revenue + c.revenue,
      planted: a.planted + c.planted,
    }),
    { xp: 0, cost: 0, revenue: 0, planted: 0 },
  );

  const cell = 'py-1.5 text-right';
  const per = (n: number, planted: number) => (planted > 0 ? n / planted : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[11px] tabular-nums">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-1.5 text-left font-medium">Crop</th>
            <th className="pb-1.5 text-right font-medium">Patches</th>
            <th className="pb-1.5 text-right font-medium">Survive</th>
            <th className="pb-1.5 text-right font-medium">XP / run</th>
            <th className="pb-1.5 text-right font-medium">XP / plant</th>
            <th className="pb-1.5 text-right font-medium">Cost / run</th>
            <th className="pb-1.5 text-right font-medium">Revenue / run</th>
            <th className="pb-1.5 text-right font-medium">Net / run</th>
            <th className="pb-1.5 text-right font-medium">Net / plant</th>
          </tr>
        </thead>
        <tbody>
          {crops.map((c) => {
            const net = c.revenue - c.cost;
            return (
              <tr key={c.label} className="border-t border-white/5 text-slate-300">
                <td className="py-1.5 pr-2 text-left font-medium text-slate-200">{c.label}</td>
                <td className={cell}>{c.planted}</td>
                <td className={cell}>{(c.survival * 100).toFixed(1)}%</td>
                <td className={`${cell} text-amber-300`}>{fmtNum(c.xp)}</td>
                <td className={cell}>{fmtNum(per(c.xp, c.planted))}</td>
                <td className={`${cell} text-rose-400`}>{fmtGp(c.cost)}</td>
                <td className={`${cell} text-emerald-400`}>{fmtGp(c.revenue)}</td>
                <td className={`${cell} ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtGp(net)}</td>
                <td className={`${cell} ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtGp(per(net, c.planted))}
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-white/15 font-semibold text-slate-100">
            <td className="py-1.5 pr-2 text-left">Overall</td>
            <td className={cell}>{total.planted}</td>
            <td className={cell}>—</td>
            <td className={`${cell} text-amber-300`}>{fmtNum(total.xp)}</td>
            <td className={cell}>{fmtNum(per(total.xp, total.planted))}</td>
            <td className={`${cell} text-rose-400`}>{fmtGp(total.cost)}</td>
            <td className={`${cell} text-emerald-400`}>{fmtGp(total.revenue)}</td>
            <td
              className={`${cell} ${total.revenue - total.cost >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {fmtGp(total.revenue - total.cost)}
            </td>
            <td
              className={`${cell} ${total.revenue - total.cost >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {fmtGp(per(total.revenue - total.cost, total.planted))}
            </td>
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
            <th className="pb-1 text-right font-medium">XP/run</th>
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
              <td className="py-1 text-right">{fmtGp(r.runXp)}</td>
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
