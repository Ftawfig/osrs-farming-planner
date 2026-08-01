'use client';

import { ReactNode, useState } from 'react';

export function Card({
  title,
  subtitle,
  children,
  className = '',
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-lg backdrop-blur ${className}`}
    >
      {(title || actions) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-wide text-amber-300/90 uppercase">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'bad' | 'gold';
}) {
  const toneClass = {
    default: 'text-slate-100',
    good: 'text-emerald-400',
    bad: 'text-rose-400',
    gold: 'text-amber-300',
  }[tone];
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5">
      <div className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-white/10 bg-slate-950/70 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums outline-none transition focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30';

/**
 * Number input that keeps its own string state so the field can be emptied or
 * partially typed without the parent clamping it mid-keystroke.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  // While focused the field owns its text; otherwise it just mirrors the prop.
  // That avoids syncing state in an effect entirely.
  const display = focused ? text : String(value);

  const clamp = (n: number) => {
    let c = n;
    if (min !== undefined) c = Math.max(min, c);
    if (max !== undefined) c = Math.min(max, c);
    return c;
  };

  return (
    <input
      type="number"
      className={inputClass}
      value={display}
      step={step}
      min={min}
      max={max}
      onFocus={() => {
        setText(String(value));
        setFocused(true);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && !Number.isNaN(n)) onChange(clamp(n));
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && !Number.isNaN(n)) onChange(clamp(n));
      }}
    />
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-amber-400"
      />
      <span className="w-11 shrink-0 rounded border border-white/10 bg-slate-950/70 px-1 py-0.5 text-center text-xs tabular-nums text-amber-300">
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-slate-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-2.5 rounded-md border border-white/10 bg-slate-950/70 px-2.5 py-2 text-left transition ${
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:border-white/20'
      }`}
    >
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition ${
          checked && !disabled ? 'bg-amber-400' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-slate-950 transition ${checked && !disabled ? 'left-3.5' : 'left-0.5'}`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-200">{label}</span>
        {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}
