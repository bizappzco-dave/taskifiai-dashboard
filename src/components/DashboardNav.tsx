'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/clients', label: 'Clients' },
  { href: '/crm', label: 'CRM' },
  { href: '/dashboard/ads', label: 'Reports' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/client', label: 'Client View' },
  { href: '/agency/health', label: 'Admin' },
];

interface DashboardNavProps {
  userEmail?: string | null;
  showSignOut?: boolean;
}

export default function DashboardNav({ userEmail, showSignOut = true }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.push('/auth/signin');
  }

  return (
    <header className="taskifi-topbar taskifi-shell-nav">
      <div className="taskifi-topbar-inner">
        <Link href="/" className="taskifi-brand" aria-label="TaskifiAI dashboard home">
          <img src="/taskifi-logo.svg" alt="TaskifiAI" className="taskifi-brand-logo" />
          <span className="taskifi-brand-subtitle">
            <small>Growth dashboard</small>
          </span>
        </Link>

        <nav className="taskifi-primary-nav" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'taskifi-primary-nav-link active' : 'taskifi-primary-nav-link'}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="taskifi-nav-actions taskifi-nav-actions-compact">
          <Link href="/clients/new" className="taskifi-nav-cta">+ Add Client</Link>
          {userEmail && <span className="taskifi-user-chip">{userEmail}</span>}
          {showSignOut && <button onClick={handleSignOut} className="taskifi-signout">Sign out</button>}
        </div>
      </div>
    </header>
  );
}
