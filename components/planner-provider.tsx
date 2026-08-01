'use client';

import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { FruitTreeKey, HardwoodKey, HerbKey, PatchKind, TreeKey, levelForXp } from '@/lib/gameData';
import {
  Config,
  CropSelection,
  DEFAULT_CONFIG,
  PriceMap,
  applyCropSelection,
  applyLevelGating,
  fmtNum,
} from '@/lib/model';
import { getServerSnapshot, getSnapshot, savePlan, subscribe, toSettings } from '@/lib/plan-store';
import type { Player } from '@/lib/hiscores';
import type { PricePayload } from '@/lib/prices';

export interface RsnStatus {
  kind: 'idle' | 'loading' | 'ok' | 'error';
  msg?: string;
}

interface PlannerState {
  cfg: Config;
  setCfg: (update: (c: Config) => Config) => void;
  /** Set one crop type, re-deriving its cadence and re-gating on level. */
  chooseCrop: (kind: PatchKind, key: string) => void;

  /** Live prices with any manual overrides applied. */
  prices: PriceMap;
  overrides: PriceMap;
  setOverrides: Dispatch<SetStateAction<PriceMap>>;
  setLive: Dispatch<SetStateAction<PriceMap>>;

  priceMeta: { source: string; fetchedAt: string };
  setPriceMeta: (next: { source: string; fetchedAt: string }) => void;

  rsn: string;
  setRsn: (next: string) => void;
  rsnStatus: RsnStatus;
  setRsnStatus: (next: RsnStatus) => void;
  defaultRsn: string;
}

const Ctx = createContext<PlannerState | null>(null);

export const playerSummary = (p: Player) => `${p.name}: level ${p.level} (${fmtNum(p.xp)} xp)`;

/**
 * Holds everything both pages share.
 *
 * This lives in the root layout, which Next keeps mounted across client-side
 * navigation — so flipping between the planner and the rates page no longer
 * throws the whole setup away.
 *
 * Selections and the character name are persisted to local storage and survive
 * a reload. XP is not: it is re-read from the hiscores each load, so the plan
 * never runs on a stale level.
 */
export function PlannerProvider({
  children,
  initialPrices,
  initialPlayer,
  defaultRsn,
}: {
  children: ReactNode;
  initialPrices: PricePayload;
  initialPlayer: Player | null;
  defaultRsn: string;
}) {
  // Settings come from the persisted store; SSR and hydration see the defaults,
  // then React re-renders with whatever local storage held.
  const plan = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const rsn = plan.rsn || defaultRsn;

  const [currentXp, setCurrentXp] = useState(initialPlayer?.xp ?? DEFAULT_CONFIG.currentXp);
  const [live, setLive] = useState<PriceMap>(initialPrices.prices);
  const [overrides, setOverrides] = useState<PriceMap>({});
  const [priceMeta, setPriceMeta] = useState({
    source: initialPrices.source as string,
    fetchedAt: initialPrices.fetchedAt,
  });
  const [rsnStatus, setRsnStatus] = useState<RsnStatus>(
    initialPlayer ? { kind: 'ok', msg: playerSummary(initialPlayer) } : { kind: 'idle' },
  );

  // Gated here so a plan saved at a higher level still resolves to something
  // plantable, while the stored choice returns once the level catches up.
  const cfg = useMemo(() => applyLevelGating({ ...plan.settings, currentXp }), [plan.settings, currentXp]);

  const prices: PriceMap = useMemo(() => ({ ...live, ...overrides }), [live, overrides]);

  const commit = (next: Config, nextRsn = rsn) => {
    setCurrentXp(next.currentXp);
    savePlan({ settings: toSettings(next), rsn: nextRsn });
  };

  const setCfg = (update: (c: Config) => Config) => commit(update(cfg));

  const setRsn = (next: string) => savePlan({ settings: toSettings(cfg), rsn: next });

  const chooseCrop = (kind: PatchKind, key: string) => {
    const selection: CropSelection =
      kind === 'tree'
        ? { treeType: key as TreeKey }
        : kind === 'hardwood'
          ? { hardwoodType: key as HardwoodKey }
          : kind === 'fruitTree'
            ? { fruitType: key as FruitTreeKey }
            : { herbType: key as HerbKey };
    commit(applyLevelGating(applyCropSelection(cfg, selection)));
  };

  // A restored character name the server did not look up needs its own fetch.
  // Nothing is set before the first await, so this does not cascade renders.
  useEffect(() => {
    if (!plan.rsn || plan.rsn === defaultRsn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/hiscores?player=${encodeURIComponent(plan.rsn)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setRsnStatus({ kind: 'error', msg: json.error ?? 'Lookup failed.' });
          return;
        }
        const player = json as Player;
        setCurrentXp(player.xp);
        setRsnStatus({ kind: 'ok', msg: playerSummary(player) });
      } catch {
        if (!cancelled) setRsnStatus({ kind: 'error', msg: 'Lookup failed.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan.rsn, defaultRsn]);

  const value: PlannerState = {
    cfg,
    setCfg,
    chooseCrop,
    prices,
    overrides,
    setOverrides,
    setLive,
    priceMeta,
    setPriceMeta,
    rsn,
    setRsn,
    rsnStatus,
    setRsnStatus,
    defaultRsn,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlanner(): PlannerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlanner must be used inside PlannerProvider');
  return ctx;
}

/** Current Farming level implied by the config. */
export function useLevel(): number {
  return levelForXp(usePlanner().cfg.currentXp);
}
