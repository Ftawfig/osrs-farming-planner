'use client';

import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState } from 'react';
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
  const [cfg, setCfgState] = useState<Config>(() => {
    const base = initialPlayer ? { ...DEFAULT_CONFIG, currentXp: initialPlayer.xp } : DEFAULT_CONFIG;
    return applyLevelGating(base);
  });
  const [live, setLive] = useState<PriceMap>(initialPrices.prices);
  const [overrides, setOverrides] = useState<PriceMap>({});
  const [priceMeta, setPriceMeta] = useState({
    source: initialPrices.source as string,
    fetchedAt: initialPrices.fetchedAt,
  });
  const [rsn, setRsn] = useState(defaultRsn);
  const [rsnStatus, setRsnStatus] = useState<RsnStatus>(
    initialPlayer ? { kind: 'ok', msg: playerSummary(initialPlayer) } : { kind: 'idle' },
  );

  const prices: PriceMap = useMemo(() => ({ ...live, ...overrides }), [live, overrides]);

  const setCfg = (update: (c: Config) => Config) => setCfgState((c) => update(c));

  const chooseCrop = (kind: PatchKind, key: string) => {
    const selection: CropSelection =
      kind === 'tree'
        ? { treeType: key as TreeKey }
        : kind === 'hardwood'
          ? { hardwoodType: key as HardwoodKey }
          : kind === 'fruitTree'
            ? { fruitType: key as FruitTreeKey }
            : { herbType: key as HerbKey };
    setCfgState((c) => applyLevelGating(applyCropSelection(c, selection)));
  };

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
