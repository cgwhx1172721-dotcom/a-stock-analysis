'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function SearchIcon({ active }: { active: boolean }) {
  const c = active ? '#f97316' : '#9A9A9E';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function StarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24"
      fill={active ? '#f97316' : 'none'} stroke={active ? '#f97316' : '#9A9A9E'} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function BriefcaseIcon({ active }: { active: boolean }) {
  const c = active ? '#f97316' : '#9A9A9E';
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

const tabs = [
  { href: '/', label: '搜索', Icon: SearchIcon },
  { href: '/watchlist', label: '自选', Icon: StarIcon },
  { href: '/portfolio', label: '持仓', Icon: BriefcaseIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-[#E5E5EA] flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${active ? 'text-orange-500' : 'text-[#9A9A9E]'}`}>
            <Icon active={active} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
