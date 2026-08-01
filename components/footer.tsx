const FAN_CONTENT_POLICY = 'https://legal.jagex.com/docs/policies/fan-content-policy';
const PRICES_API = 'https://prices.runescape.wiki/';
const WIKI = 'https://oldschool.runescape.wiki/';
const RUNELITE = 'https://runelite.net/';
const PORTFOLIO = 'https://portfolio.faditawfig.com';

const linkClass = 'text-slate-400 underline underline-offset-2 transition hover:text-amber-300';

/** Opens away from the planner, which holds a lot of unsaved in-page state. */
function Outbound({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

/**
 * Every sprite and figure here is Jagex's intellectual property, used under
 * their Fan Content Policy — which requires this exact wording, prominently
 * placed. Keep the sentence verbatim: the link around the policy's name leaves
 * the text itself unchanged.
 *
 * The policy also rules out commercial gain without a separate licence from
 * Jagex, so putting ads or a subscription on this would need one.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-slate-950/40 px-4 py-5 backdrop-blur lg:px-6">
      <div className="mx-auto max-w-[1500px] space-y-2 text-[11px] leading-relaxed text-slate-500">
        <p>
          Created using intellectual property belonging to Jagex Limited under the terms of Jagex&apos;s{' '}
          <Outbound href={FAN_CONTENT_POLICY}>Fan Content Policy</Outbound>. This content is not endorsed by
          or affiliated with Jagex.
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p>
            Prices from the <Outbound href={PRICES_API}>OSRS Wiki real-time prices API</Outbound>. Item
            sprites via <Outbound href={RUNELITE}>RuneLite</Outbound>&apos;s cache mirror; skill icon and
            game data from the <Outbound href={WIKI}>OSRS Wiki</Outbound>.
          </p>
          <p className="shrink-0">
            Built by <Outbound href={PORTFOLIO}>Fadi Tawfig</Outbound>
          </p>
        </div>
      </div>
    </footer>
  );
}
