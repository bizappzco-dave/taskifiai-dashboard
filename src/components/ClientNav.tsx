'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const clientNavItems = [
  { href: '/client', label: 'Home' },
  { href: '/client/ultra-marketing', label: 'Assistant' },
  { href: '/client/posting', label: 'Posting' },
  { href: '/client/reports', label: 'Reports' },
];

interface ClientNavProps {
  userEmail?: string | null;
}

export default function ClientNav({ userEmail }: ClientNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.push('/auth/signin');
  }

  return (
    <header className="taskifi-topbar taskifi-shell-nav taskifi-client-shell-nav">
      <div className="taskifi-topbar-inner">
        <Link href="/client" className="taskifi-brand" aria-label="TaskifiAI client dashboard home">
          <img src="/taskifi-logo.svg" alt="TaskifiAI" className="taskifi-brand-logo" />
          <span className="taskifi-brand-subtitle">
            <small>Client dashboard</small>
          </span>
        </Link>

        <nav className="taskifi-primary-nav" aria-label="Client dashboard navigation">
          {clientNavItems.map((item) => {
            const active = item.href === '/client' ? pathname === '/client' : pathname?.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'taskifi-primary-nav-link active' : 'taskifi-primary-nav-link'}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="taskifi-nav-actions taskifi-nav-actions-compact">
          {userEmail && <span className="taskifi-user-chip">{userEmail}</span>}
          <button onClick={handleSignOut} className="taskifi-signout">Sign out</button>
        </div>
      </div>
    </header>
  );
}
