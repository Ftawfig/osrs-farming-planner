import { Config, DEFAULT_CONFIG } from './model';

/**
 * Everything about a plan except the account's XP.
 *
 * XP is deliberately excluded: it is a fact about the account, not a choice,
 * so it is re-read from the hiscores on every load rather than restored from a
 * stale copy. Selections and the character name are choices, so they persist.
 */
export type PlanSettings = Omit<Config, 'currentXp'>;

export interface PersistedPlan {
  settings: PlanSettings;
  /** Empty means "never set", so the caller falls back to DEFAULT_RSN. */
  rsn: string;
}

const KEY = 'osrs-farming-planner/plan/v1';

/** Strip the XP off a full config so only the persistable part is stored. */
export function toSettings(cfg: Config): PlanSettings {
  const copy: Partial<Config> = { ...cfg };
  delete copy.currentXp;
  return copy as PlanSettings;
}

export const DEFAULT_SETTINGS = toSettings(DEFAULT_CONFIG);

/** Stable object for SSR and the hydration pass, where storage is unavailable. */
const SERVER_PLAN: PersistedPlan = { settings: DEFAULT_SETTINGS, rsn: '' };

let cache: PersistedPlan | undefined;
const listeners = new Set<() => void>();

function read(): PersistedPlan {
  if (typeof window === 'undefined') return SERVER_PLAN;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return SERVER_PLAN;
    const parsed = JSON.parse(raw) as Partial<PersistedPlan>;
    return {
      // Merged over the defaults so a stored plan from an older build still
      // gets sensible values for fields added since.
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      rsn: typeof parsed.rsn === 'string' ? parsed.rsn : '',
    };
  } catch {
    return SERVER_PLAN;
  }
}

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Must return a stable reference between changes, so the value is cached. */
export function getSnapshot(): PersistedPlan {
  if (cache === undefined) cache = read();
  return cache;
}

export function getServerSnapshot(): PersistedPlan {
  return SERVER_PLAN;
}

export function savePlan(next: PersistedPlan): void {
  cache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private browsing or a full quota — keep working from memory.
    }
  }
  for (const l of listeners) l();
}
