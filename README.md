# OSRS Farming 99 Planner

A Next.js calculator that models tree, hardwood, fruit tree and herb runs to 99
Farming in Old School RuneScape, using live Grand Exchange prices.

## Runs are per patch type

Herbs cycle in 80 minutes and a rosewood takes four days, so a single "run" that
does everything is meaningless. Each patch type carries its own runs-per-day and
**days are the base unit** — the only one that composes across cadences.

Cadence defaults to `min(convention, 1440 / growthMinutes)`: one trip a day for
trees and fruit trees, two for herbs, capped by how fast the crop actually grows.
That puts hardwoods at 0.25–0.32 runs/day without anyone guessing, and the input
is clamped to the same growth ceiling.

Because tree and fruit runs no longer happen together, gardener payments are
settled against home-grown produce **per day** rather than per run.

## What it models

- **XP and time** — XP per run and per day for each patch type, days to the next
  level, days to your target, XP/hour and XP/day.
- **Profit and loss** — seed, compost and gardener-payment costs against produce
  revenue, per crop and overall, per run and cumulative to the target.
- **Disease** — per-cycle disease rolls, compost reduction, and the resulting
  expected losses when a tree dies before you get back to it.
- **Protection strategy** — pay the gardener vs each compost tier, compared on
  whole-run totals so knock-on effects (produce freed up for sale) are included.
- **Gear** — each farmer's outfit piece and the full-set bonus, plus secateurs.

## Live pricing

Prices come from the [OSRS Wiki price API](https://prices.runescape.wiki/api/v1/osrs/latest),
proxied server-side so the browser never hits a CORS wall and the request carries
a descriptive `User-Agent` as the wiki asks.

- `app/api/prices/route.ts` — cached for 5 minutes, falls back to a bundled
  snapshot if the upstream is unreachable.
- `app/api/hiscores/route.ts` — looks up a character's Farming XP from the
  official OSRS hiscores.

The page loads a default character's stats server-side, so the first paint is
already that account's numbers rather than a placeholder. Change who that is
with the `DEFAULT_RSN` env var (it falls back to `Grixwell`); typing any other
name and pressing Load still overrides it at runtime. If the lookup fails the
planner falls back to `DEFAULT_CONFIG` instead of blocking.

Set a contact string in `PRICE_API_USER_AGENT` so the wiki can reach you if the
app ever misbehaves:

```bash
vercel env add PRICE_API_USER_AGENT
```

## Running locally

```bash
npm run dev
```

## Deploying to Vercel

Push the repo and import it — no configuration needed. The price route is an ISR
route with a 5 minute revalidate; the hiscores route is dynamic.

## Data sources

Game constants live in `lib/gameData.ts`, each sourced from the OSRS Wiki:
individual seed pages for XP and yields, `Disease (Farming)` for disease rates,
and `Farmer's outfit` for the XP bonuses.

Yields are derived rather than entered by hand:

- **Roots** step up every 8 Farming levels from the tree's own requirement,
  capping at 4 (yew gives 1/2/3/4 at 60/68/76/84, magic at 75/83/91/99).
- **Logs** average 8 per tree — farmed trees have a 1/8 chance to deplete per log,
  and you have to fell the tree to reach the stump anyway.
- **Disease-free herb patches** come from the standard patch order in
  `HERB_PATCHES`, so 7 patches includes Hosidius and Troll Stronghold.
- **Herb yield** is computed from the herb, your Farming level, compost tier and
  secateurs.

The sell toggles decide whether roots, logs, herbs and spare fruit count towards
profit and loss; they never change XP.

The projection is level-aware. Because per-run figures depend on your XP only
through your level, `project()` solves each level as one analytic segment and
recomputes yields at every level-up — so rising herb save chance, root
thresholds and the Farming cape at 99 all land at the right point, at a cost of
at most 98 `computeRun` calls rather than one per run. Your selected crops are
held constant for the whole projection; it will not silently upgrade you from
willows to magics on the way to 99.

Two other values are worth knowing about:

- The wiki publishes tree disease rates only for maple (13/128 over 7 cycles) and
  magic (9/128 over 11). Oak, willow, yew and every hardwood use
  `base = 20 - cycles`, the pattern those two define.
- Hardwood trees (teak, mahogany, camphor, ironwood, rosewood) grow in the 3
  hardwood patches and have no roots item, so logs are their only produce.
- Fruit trees are treated as 4 disease-vulnerable cycles per the wiki's table,
  even though they have 6 growth stages.

Both are isolated in `lib/gameData.ts` if you want to change them.
