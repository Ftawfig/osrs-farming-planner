'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Planner' },
  { href: '/compare', label: 'Crop rates' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/10 bg-slate-950/40 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center gap-1 px-4 lg:px-6">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`border-b-2 px-3 py-2.5 text-xs font-medium transition ${
                active
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
