'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LevelUp, StrategyRow, TimelinePoint, fmtGp, fmtNum } from '@/lib/model';

const GRID = 'rgba(255,255,255,0.07)';
const AXIS = { fill: '#94a3b8', fontSize: 11 };

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(2,6,23,0.95)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#fbbf24', fontWeight: 600 },
  itemStyle: { color: '#e2e8f0' },
};

/** Recharts hands formatters loosely-typed values; coerce before formatting. */
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const COLORS = {
  tree: '#f0b429',
  fruit: '#34d399',
  herb: '#60a5fa',
  cost: '#f87171',
  revenue: '#4ade80',
  level: '#fbbf24',
};

/** Cumulative XP over time, with every level-up marked. */
export function XpProgressChart({ data, levelUps }: { data: TimelinePoint[]; levelUps: LevelUp[] }) {
  // Too many dots become noise; thin them out once the run is long.
  const stride = Math.ceil(levelUps.length / 8) || 1;
  const marks = levelUps.filter((_, i) => i % stride === 0 || i === levelUps.length - 1);

  return (
    <ResponsiveContainer width="100%" height={270}>
      <AreaChart data={data} margin={{ top: 12, right: 14, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.level} stopOpacity={0.4} />
            <stop offset="100%" stopColor={COLORS.level} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="day"
          type="number"
          domain={[0, 'dataMax']}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={(v: number) => `d${Math.round(v)}`}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={52}
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => fmtGp(v)}
        />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(v: unknown) => `Day ${num(v).toFixed(1)}`}
          formatter={(value: unknown): [string, string] => [`${fmtNum(num(value))} xp`, 'Total XP']}
        />
        <Area type="monotone" dataKey="xp" stroke={COLORS.level} strokeWidth={2} fill="url(#xpFill)" dot={false} />
        {marks.map((l) => (
          <ReferenceDot
            key={l.level}
            x={l.day}
            y={l.xp}
            r={4}
            fill="#22c55e"
            stroke="#052e16"
            strokeWidth={1.5}
            label={{ value: `${l.level}`, position: 'top', fill: '#4ade80', fontSize: 10, fontWeight: 600 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Cumulative profit/loss over time. */
export function BankChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <LineChart data={data} margin={{ top: 12, right: 14, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="day"
          type="number"
          domain={[0, 'dataMax']}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          tickFormatter={(v: number) => `d${Math.round(v)}`}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtGp(v)} width={54} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(v: unknown) => `Day ${num(v).toFixed(1)}`}
          formatter={(value: unknown): [string, string] => [`${fmtGp(num(value))} gp`, 'Cumulative P/L']}
        />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
        <Line type="monotone" dataKey="netGp" stroke={COLORS.cost} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Runs required to clear each remaining level. */
export function RunsPerLevelChart({ levelUps }: { levelUps: LevelUp[] }) {
  const data = levelUps.map((l) => ({
    level: `${l.level}`,
    runs: Math.round(l.runsForLevel * 10) / 10,
    cumulative: Math.round(l.run * 10) / 10,
  }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-500">Target already reached.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="level" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(v: unknown) => `Level ${String(v)}`}
          formatter={(value: unknown, name: unknown): [string, string] => [
            `${num(value).toFixed(1)} runs`,
            name === 'runs' ? 'For this level' : 'Cumulative',
          ]}
        />
        <Bar dataKey="runs" fill={COLORS.level} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StrategyChart({ rows, highlight }: { rows: StrategyRow[]; highlight: string }) {
  const data = rows.map((r) => ({ name: r.label, cost: Math.round(r.costToTarget), strategy: r.strategy }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }} layout="vertical">
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtGp(v)} />
        <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={124} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: unknown): [string, string] => [`${fmtGp(num(value))} gp`, 'Net cost to target']}
        />
        <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.strategy} fill={d.strategy === highlight ? COLORS.level : 'rgba(148,163,184,0.45)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function XpBreakdownChart({ data }: { data: { label: string; xp: number }[] }) {
  const colors = [COLORS.tree, COLORS.fruit, COLORS.herb];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }} layout="vertical">
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtGp(v)} />
        <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={104} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: unknown): [string, string] => [`${fmtNum(num(value))} xp`, 'Per run']}
        />
        <Bar dataKey="xp" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CropEconomyChart({ data }: { data: { label: string; cost: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtGp(v)} width={54} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: unknown, name: unknown): [string, string] => [`${fmtGp(num(value))} gp`, String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="cost" name="Cost" fill={COLORS.cost} radius={[4, 4, 0, 0]} />
        <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
