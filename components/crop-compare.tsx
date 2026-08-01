'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Field, Select } from '@/components/ui';
import { CropIcon, FarmingIcon } from '@/components/icon';
import { usePlanner } from '@/components/planner-provider';
import { PatchKind, Strategy, levelForXp } from '@/lib/gameData';
import { CropOption, compareCrops, fmtGp, fmtNum } from '@/lib/model';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'pay', label: 'Pay the gardener' },
  { value: 'ultracompost', label: 'Ultracompost' },
  { value: 'supercompost', label: 'Supercompost' },
  { value: 'compost', label: 'Compost' },
  { value: 'none', label: 'No protection' },
];

const SECTIONS: { kind: PatchKind; title: string; note: string }[] = [
  { kind: 'tree', title: 'Trees', note: 'One tree patch, replanted every run' },
  { kind: 'hardwood', title: 'Hardwood trees', note: 'One hardwood patch — logs only, no roots' },
  { kind: 'fruitTree', title: 'Fruit trees', note: 'One fruit tree patch, 6 fruit a cycle' },
  { kind: 'herb', title: 'Herbs', note: 'One herb patch — compost only, never paid for' },
];

type SortDir = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  align: 'left' | 'right';
  /** Which way to sort when this column is first clicked. */
  defaultDir: SortDir;
  sortValue: (r: CropOption) => number | string;
  render: (r: CropOption) => string;
}

const COLUMNS: Column[] = [
  {
    key: 'name',
    label: 'Crop',
    align: 'left',
    defaultDir: 'asc',
    sortValue: (r) => r.name,
    render: (r) => r.name,
  },
  {
    key: 'level',
    label: 'Lvl',
    align: 'right',
    defaultDir: 'asc',
    sortValue: (r) => r.level,
    render: (r) => String(r.level),
  },
  {
    key: 'runsPerDay',
    label: 'Runs / day',
    align: 'right',
    defaultDir: 'desc',
    sortValue: (r) => r.runsPerDay,
    render: (r) => (r.runsPerDay < 1 ? r.runsPerDay.toFixed(2) : fmtNum(r.runsPerDay, 1)),
  },
  {
    key: 'xpPerRun',
    label: 'XP / run',
    align: 'right',
    defaultDir: 'desc',
    sortValue: (r) => r.xpPerRun,
    render: (r) => fmtNum(r.xpPerRun),
  },
  {
    key: 'xpPerDay',
    label: 'XP / day',
    align: 'right',
    defaultDir: 'desc',
    sortValue: (r) => r.xpPerDay,
    render: (r) => fmtNum(r.xpPerDay),
  },
  {
    key: 'netPerDay',
    label: 'Net / day',
    align: 'right',
    defaultDir: 'desc',
    sortValue: (r) => r.netPerDay,
    render: (r) => fmtGp(r.netPerDay),
  },
  {
    key: 'gpPerXp',
    label: 'GP / XP',
    align: 'right',
    defaultDir: 'asc',
    sortValue: (r) => r.gpPerXp,
    render: (r) => (r.xpPerDay > 0 ? r.gpPerXp.toFixed(2) : '—'),
  },
];

export default function CropCompare() {
  const router = useRouter();
  const { cfg, prices, chooseCrop, rsnStatus } = usePlanner();
  const [strategy, setStrategy] = useState<Strategy>('pay');

  // Whatever the planner is currently set to, so the matching row reads as
  // selected and picks made here survive the trip back.
  const picks: Record<PatchKind, string> = {
    tree: cfg.treeType,
    hardwood: cfg.hardwoodType,
    fruitTree: cfg.fruitType,
    herb: cfg.herbType,
  };

  const choose = (kind: PatchKind, key: string) => {
    chooseCrop(kind, key);
    router.push('/');
  };

  const level = levelForXp(cfg.currentXp);

  const tables = useMemo(
    () => SECTIONS.map((s) => ({ ...s, rows: compareCrops(cfg, prices, s.kind, strategy) })),
    [cfg, prices, strategy],
  );

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-50">
            <FarmingIcon size={26} />
            Crop rates
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Every crop costed on its own — a single patch, run at the cadence its growth time allows. Figures
            are per patch, so they compare cleanly regardless of how many you actually farm.
          </p>
        </div>
        <div className="w-44">
          <Field label="Protection" hint="herbs use compost">
            <Select value={strategy} onChange={setStrategy} options={STRATEGY_OPTIONS} />
          </Field>
        </div>
      </header>

      <p className="mb-4 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
        Rated at Farming level <span className="text-amber-300">{level}</span>
        {rsnStatus.kind === 'ok' && rsnStatus.msg && ` — ${rsnStatus.msg.split(':')[0]}`}. Crops above your
        level are greyed out — they still show their rates so you can see what is worth training towards.{' '}
        <span className="text-slate-300">GP per XP</span> is the headline number: lower is cheaper, and
        negative means the crop pays for itself. Click a column heading to sort, or a row to load that crop
        into the planner.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {tables.map((t) => (
          <Card
            key={t.kind}
            title={t.title}
            subtitle={t.note}
            icon={<CropIcon kind={t.kind} cropKey={picks[t.kind]} size={22} />}
          >
            <CropTable
              kind={t.kind}
              rows={t.rows}
              selected={picks[t.kind]}
              onChoose={(key) => choose(t.kind, key)}
            />
          </Card>
        ))}
      </div>
    </main>
  );
}

function CropTable({
  kind,
  rows,
  selected,
  onChoose,
}: {
  kind: PatchKind;
  rows: CropOption[];
  selected: string;
  onChoose: (key: string) => void;
}) {
  const [sortKey, setSortKey] = useState('gpPerXp');
  const [dir, setDir] = useState<SortDir>('asc');

  const column = COLUMNS.find((c) => c.key === sortKey) ?? COLUMNS[COLUMNS.length - 1];

  const sorted = useMemo(() => {
    const factor = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue(a);
      const bv = column.sortValue(b);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * factor;
      }
      return (av - bv) * factor;
    });
  }, [rows, column, dir]);

  // Clicking the active column flips it; a new column starts in its own
  // natural direction, so cheapest-first and most-XP-first both come for free.
  const onSort = (c: Column) => {
    if (c.key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(c.key);
      setDir(c.defaultDir);
    }
  };

  // Rank only what the account can actually plant.
  const unlocked = rows.filter((r) => r.unlocked);
  const bestGpPerXp = unlocked.length ? Math.min(...unlocked.map((r) => r.gpPerXp)) : null;
  const bestXpPerDay = unlocked.length ? Math.max(...unlocked.map((r) => r.xpPerDay)) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px] tabular-nums">
        <thead>
          <tr className="text-slate-500">
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`pb-2 text-xs font-medium ${c.align === 'left' ? 'text-left' : 'text-right'}`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(c)}
                    className={`group inline-flex cursor-pointer items-center gap-0.5 transition hover:text-slate-200 ${
                      active ? 'text-amber-300' : ''
                    }`}
                  >
                    {c.label}
                    {/* Inactive arrows stay reserved but invisible, so the
                        heading doesn't shift when the sort column changes. */}
                    <span aria-hidden className={active ? '' : 'opacity-0 transition group-hover:opacity-60'}>
                      {active ? (dir === 'asc' ? '▲' : '▼') : c.defaultDir === 'asc' ? '▲' : '▼'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const topXp = r.unlocked && r.xpPerDay === bestXpPerDay;
            const topValue = r.unlocked && r.gpPerXp === bestGpPerXp;
            return (
              <tr
                key={r.key}
                onClick={() => onChoose(r.key)}
                tabIndex={0}
                role="button"
                aria-label={`Use ${r.name} in the planner`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChoose(r.key);
                  }
                }}
                className={`cursor-pointer border-t border-white/5 transition hover:bg-white/5 ${
                  r.unlocked ? 'text-slate-300' : 'text-slate-600'
                } ${r.key === selected ? 'bg-amber-400/10' : ''}`}
              >
                {COLUMNS.map((c) => {
                  const highlight =
                    (c.key === 'xpPerDay' && topXp) || (c.key === 'gpPerXp' && topValue)
                      ? c.key === 'xpPerDay'
                        ? 'font-semibold text-amber-300'
                        : 'font-semibold text-emerald-400'
                      : '';
                  const money =
                    c.key === 'netPerDay' ? (r.netPerDay >= 0 ? 'text-emerald-400' : 'text-rose-400') : '';

                  if (c.key === 'name') {
                    return (
                      <td key={c.key} className="py-2 pr-2 text-left font-medium">
                        <span className="flex items-center gap-2">
                          {/* Dimmed to match the row, so a locked crop still
                              reads as out of reach at a glance. */}
                          <CropIcon
                            kind={kind}
                            cropKey={r.key}
                            name={r.name}
                            size={20}
                            className={r.unlocked ? '' : 'opacity-40 grayscale'}
                          />
                          <span className={r.unlocked ? 'text-slate-200' : ''}>{r.name}</span>
                          {!r.unlocked && <span className="text-[11px] text-slate-600">locked</span>}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className={`py-2 text-right ${highlight} ${money}`}>
                      {c.render(r)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-600">
        Gold = most XP a day. Green = cheapest XP. Both ignore crops above your level.
      </p>
    </div>
  );
}
