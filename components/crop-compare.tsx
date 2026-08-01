'use client';

import { useMemo, useState } from 'react';
import { Card, Field, Select } from '@/components/ui';
import { PatchKind, Strategy, levelForXp } from '@/lib/gameData';
import { CropOption, DEFAULT_CONFIG, PriceMap, compareCrops, fmtGp, fmtNum } from '@/lib/model';
import type { Player } from '@/lib/hiscores';
import type { PricePayload } from '@/lib/prices';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'pay', label: 'Pay the gardener' },
  { value: 'ultracompost', label: 'Ultracompost' },
  { value: 'supercompost', label: 'Supercompost' },
  { value: 'compost', label: 'Compost' },
  { value: 'none', label: 'No protection' },
];

type SortKey = 'level' | 'xpPerDay' | 'netPerDay' | 'gpPerXp';

const SECTIONS: { kind: PatchKind; title: string; note: string }[] = [
  { kind: 'tree', title: 'Trees', note: 'One tree patch, replanted every run' },
  { kind: 'hardwood', title: 'Hardwood trees', note: 'One hardwood patch — logs only, no roots' },
  { kind: 'fruitTree', title: 'Fruit trees', note: 'One fruit tree patch, 6 fruit a cycle' },
  { kind: 'herb', title: 'Herbs', note: 'One herb patch — compost only, never paid for' },
];

export default function CropCompare({
  initial,
  initialPlayer,
}: {
  initial: PricePayload;
  initialPlayer: Player | null;
}) {
  const [strategy, setStrategy] = useState<Strategy>('pay');
  const [sort, setSort] = useState<SortKey>('gpPerXp');

  const cfg = useMemo(
    () => ({ ...DEFAULT_CONFIG, currentXp: initialPlayer?.xp ?? DEFAULT_CONFIG.currentXp }),
    [initialPlayer],
  );
  const prices: PriceMap = initial.prices;
  const level = levelForXp(cfg.currentXp);

  const tables = useMemo(
    () => SECTIONS.map((s) => ({ ...s, rows: compareCrops(cfg, prices, s.kind, strategy) })),
    [cfg, prices, strategy],
  );

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">Crop rates</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Every crop costed on its own — a single patch, run at the cadence its growth time allows. Figures
            are per patch, so they compare cleanly regardless of how many you actually farm.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Field label="Protection" hint="herbs use compost">
              <Select value={strategy} onChange={setStrategy} options={STRATEGY_OPTIONS} />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Sort by">
              <Select
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'gpPerXp' as SortKey, label: 'GP per XP' },
                  { value: 'xpPerDay' as SortKey, label: 'XP per day' },
                  { value: 'netPerDay' as SortKey, label: 'Profit per day' },
                  { value: 'level' as SortKey, label: 'Level' },
                ]}
              />
            </Field>
          </div>
        </div>
      </header>

      <p className="mb-4 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
        Rated at Farming level <span className="text-amber-300">{level}</span>
        {initialPlayer && ` (${initialPlayer.name})`}. Crops above your level are greyed out — they still show
        their rates so you can see what is worth training towards.{' '}
        <span className="text-slate-300">GP per XP</span> is the headline number: lower is cheaper, and
        negative means the crop pays for itself.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {tables.map((t) => (
          <Card key={t.kind} title={t.title} subtitle={t.note}>
            <CropTable rows={t.rows} sort={sort} />
          </Card>
        ))}
      </div>
    </main>
  );
}

function CropTable({ rows, sort }: { rows: CropOption[]; sort: SortKey }) {
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'level') return a.level - b.level;
    if (sort === 'xpPerDay') return b.xpPerDay - a.xpPerDay;
    if (sort === 'netPerDay') return b.netPerDay - a.netPerDay;
    return a.gpPerXp - b.gpPerXp;
  });

  // Rank only what the account can actually plant.
  const unlocked = sorted.filter((r) => r.unlocked);
  const bestGpPerXp = unlocked.length ? Math.min(...unlocked.map((r) => r.gpPerXp)) : null;
  const bestXpPerDay = unlocked.length ? Math.max(...unlocked.map((r) => r.xpPerDay)) : null;

  const cell = 'py-1.5 text-right';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[11px] tabular-nums">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-1.5 text-left font-medium">Crop</th>
            <th className="pb-1.5 text-right font-medium">Lvl</th>
            <th className="pb-1.5 text-right font-medium">Runs / day</th>
            <th className="pb-1.5 text-right font-medium">XP / run</th>
            <th className="pb-1.5 text-right font-medium">XP / day</th>
            <th className="pb-1.5 text-right font-medium">Net / day</th>
            <th className="pb-1.5 text-right font-medium">GP / XP</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const topXp = r.unlocked && r.xpPerDay === bestXpPerDay;
            const topValue = r.unlocked && r.gpPerXp === bestGpPerXp;
            return (
              <tr
                key={r.key}
                className={`border-t border-white/5 ${r.unlocked ? 'text-slate-300' : 'text-slate-600'}`}
              >
                <td className="py-1.5 pr-2 text-left font-medium">
                  <span className={r.unlocked ? 'text-slate-200' : ''}>{r.name}</span>
                  {!r.unlocked && <span className="ml-1 text-[10px] text-slate-600">locked</span>}
                </td>
                <td className={cell}>{r.level}</td>
                <td className={cell}>
                  {r.runsPerDay < 1 ? r.runsPerDay.toFixed(2) : fmtNum(r.runsPerDay, 1)}
                </td>
                <td className={cell}>{fmtNum(r.xpPerRun)}</td>
                <td className={`${cell} ${topXp ? 'font-semibold text-amber-300' : ''}`}>
                  {fmtNum(r.xpPerDay)}
                </td>
                <td className={`${cell} ${r.netPerDay >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmtGp(r.netPerDay)}
                </td>
                <td className={`${cell} ${topValue ? 'font-semibold text-emerald-400' : ''}`}>
                  {r.xpPerDay > 0 ? r.gpPerXp.toFixed(2) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-600">
        Gold = most XP a day. Green = cheapest XP. Both ignore crops above your level.
      </p>
    </div>
  );
}
