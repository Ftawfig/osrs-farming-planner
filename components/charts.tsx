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
import { ItemKey, PatchKind } from '@/lib/gameData';
import { cropIcon, itemIconSrc } from '@/lib/icons';
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
  hardwood: '#c084fc',
  fruit: '#34d399',
  herb: '#60a5fa',
  cost: '#f87171',
  revenue: '#4ade80',
  level: '#fbbf24',
};

/** Series colours keyed by patch kind, so charts stay consistent. */
export const KIND_COLORS: Record<string, string> = {
  tree: COLORS.tree,
  hardwood: COLORS.hardwood,
  fruitTree: COLORS.fruit,
  herb: COLORS.herb,
};

/* ------------------------------------------------------------------ */
/* Icon axis ticks                                                     */
/* ------------------------------------------------------------------ */

const TICK_ICON = 16;
/** Gap between a sprite and the label it belongs to. */
const TICK_GAP = 5;
/** Breathing room at the outer edge of the axis gutter. */
const TICK_PAD = 2;

/**
 * Recharts nudges ticks away from the axis line by `tickSize + tickMargin` even
 * when the line itself is hidden, which would leave these ticks guessing where
 * the gutter actually starts. Zeroing both puts the tick exactly on the axis, so
 * the sprite can be placed from a known edge instead of an assumed one.
 */
const FLUSH_TICKS = { tickSize: 0, tickMargin: 0 } as const;

/** The slice of Recharts' tick props these renderers use. */
interface TickProps {
  x?: number | string;
  y?: number | string;
  /** `offset` is half the category's band, i.e. the room this tick has. */
  payload?: { value?: unknown; offset?: number };
}

/** Rough upper bound on a character at {@link AXIS.fontSize}, erring wide. */
const CHAR_PX = 6;

/**
 * Trim a category name to the band it has to sit in.
 *
 * Forcing every tick to draw — which the sprites require — also removes the
 * collision handling that would otherwise have dropped labels, so the fitting
 * has to happen here. Below about four characters even an ellipsis is noise, so
 * the sprite carries the tick alone and the full name stays on hover.
 */
function fitLabel(label: string, band: number): string {
  const maxChars = Math.floor(Math.max(0, band - 6) / CHAR_PX);
  if (label.length <= maxChars) return label;
  return maxChars >= 4 ? `${label.slice(0, maxChars - 1).trimEnd()}…` : '';
}

type IconMap = Record<string, string | undefined>;

function TickSprite({ src, x, y }: { src: string; x: number; y: number }) {
  return (
    <image
      href={src}
      x={x}
      y={y}
      width={TICK_ICON}
      height={TICK_ICON}
      preserveAspectRatio="xMidYMid meet"
      // Sprites sit inside the axis gutter; swallowing pointer events there
      // would put a dead patch over the chart's own hover handling.
      pointerEvents="none"
    />
  );
}

/**
 * Category tick for a horizontal bar chart's Y axis.
 *
 * Recharts right-aligns category labels against the axis, which would leave the
 * sprites in a ragged column. Anchoring both to the outer edge of the gutter
 * instead keeps the icons in line and the names reading left to right.
 */
const leftIconTick = (icons: IconMap, axisWidth: number) =>
  function LeftIconTick({ x, y, payload }: TickProps) {
    const label = String(payload?.value ?? '');
    const src = icons[label];
    const left = num(x) - axisWidth + TICK_PAD;
    return (
      <g>
        {src && <TickSprite src={src} x={left} y={num(y) - TICK_ICON / 2} />}
        <text
          x={src ? left + TICK_ICON + TICK_GAP : left}
          y={num(y)}
          dy={4}
          textAnchor="start"
          fill={AXIS.fill}
          fontSize={AXIS.fontSize}
        >
          {label}
        </text>
      </g>
    );
  };

/** Category tick for a vertical bar chart's X axis: sprite over the name. */
const bottomIconTick = (icons: IconMap) =>
  function BottomIconTick({ x, y, payload }: TickProps) {
    const label = String(payload?.value ?? '');
    const src = icons[label];
    const fitted = fitLabel(label, num(payload?.offset) * 2);
    return (
      <g>
        <title>{label}</title>
        {src && <TickSprite src={src} x={num(x) - TICK_ICON / 2} y={num(y) + 4} />}
        <text
          x={num(x)}
          y={num(y) + (src ? TICK_ICON + 10 : 10)}
          dy={6}
          textAnchor="middle"
          fill={AXIS.fill}
          fontSize={AXIS.fontSize}
        >
          {fitted}
        </text>
      </g>
    );
  };

/** Axis gutter wide enough for a sprite plus the longest crop or strategy name. */
const ICON_AXIS_WIDTH = 148;

const iconFor = (item: ItemKey | null | undefined) => (item ? itemIconSrc(item) : undefined);

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
        <Area
          type="monotone"
          dataKey="xp"
          stroke={COLORS.level}
          strokeWidth={2}
          fill="url(#xpFill)"
          dot={false}
        />
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
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtGp(v)}
          width={54}
        />
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

/** Days required to clear each remaining level. */
export function DaysPerLevelChart({ levelUps }: { levelUps: LevelUp[] }) {
  const data = levelUps.map((l) => ({ level: `${l.level}`, days: Math.round(l.daysForLevel * 10) / 10 }));

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
          formatter={(value: unknown): [string, string] => [
            `${num(value).toFixed(1)} days`,
            'For this level',
          ]}
        />
        <Bar dataKey="days" fill={COLORS.level} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StrategyChart({ rows, highlight }: { rows: StrategyRow[]; highlight: string }) {
  const data = rows.map((r) => ({ name: r.label, cost: Math.round(r.costToTarget), strategy: r.strategy }));
  // No protection has nothing to hand over, so that row stays iconless.
  const icons: IconMap = Object.fromEntries(rows.map((r) => [r.label, iconFor(r.item)]));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }} layout="vertical">
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtGp(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={leftIconTick(icons, ICON_AXIS_WIDTH)}
          tickLine={false}
          axisLine={false}
          width={ICON_AXIS_WIDTH}
          {...FLUSH_TICKS}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: unknown): [string, string] => [`${fmtGp(num(value))} gp`, 'Net cost to target']}
        />
        <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell
              key={d.strategy}
              fill={d.strategy === highlight ? COLORS.level : 'rgba(148,163,184,0.45)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function XpBreakdownChart({
  data,
}: {
  data: { label: string; kind: PatchKind; cropKey: string; xp: number }[];
}) {
  const icons: IconMap = Object.fromEntries(
    data.map((d) => [d.label, iconFor(cropIcon(d.kind, d.cropKey))]),
  );

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }} layout="vertical">
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtGp(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={leftIconTick(icons, ICON_AXIS_WIDTH)}
          tickLine={false}
          axisLine={false}
          width={ICON_AXIS_WIDTH}
          {...FLUSH_TICKS}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: unknown): [string, string] => [`${fmtNum(num(value))} xp`, 'Per day']}
        />
        <Bar dataKey="xp" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={KIND_COLORS[d.kind] ?? COLORS.tree} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CropEconomyChart({
  data,
}: {
  data: { label: string; kind: PatchKind; cropKey: string; cost: number; revenue: number }[];
}) {
  const icons: IconMap = Object.fromEntries(
    data.map((d) => [d.label, iconFor(cropIcon(d.kind, d.cropKey))]),
  );

  return (
    <ResponsiveContainer width="100%" height={248}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="label"
          tick={bottomIconTick(icons)}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          // Every crop gets a sprite, so none of the ticks may be dropped.
          interval={0}
          height={48}
          {...FLUSH_TICKS}
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtGp(v)}
          width={54}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: unknown, name: unknown): [string, string] => [
            `${fmtGp(num(value))} gp`,
            String(name),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar dataKey="cost" name="Cost" fill={COLORS.cost} radius={[4, 4, 0, 0]} />
        <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
