import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  ChevronDown,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  Package,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { RobuxIcon } from './sale';
import type { OverviewDTO } from '@cipher/shared';
import { useAuth, useStore } from '../context';
import { api } from '../lib';
import { Avatar, Menu } from './ui';

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3.5l10.5 4.6v7.4c0 6.2-4.3 11.1-10.5 13.3C9.8 26.6 5.5 21.7 5.5 15.5V8.1z" fill="#4545ff" />
      <path d="M16 3.5l10.5 4.6v7.4c0 6.2-4.3 11.1-10.5 13.3z" fill="#2f2fd0" />
      <path d="M19.6 12.6a4.6 4.6 0 1 0 0 6.6" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Brand() {
  return (
    <Link to="/" className="row" style={{ gap: 10 }}>
      <Logo />
      <span className="brand-name">Cipher</span>
    </Link>
  );
}

export function DevBanner() {
  const { me } = useAuth();
  if (me?.environment !== 'development') return null;
  return <div className="dev-banner">Development mode — Discord and Roblox may be simulated by local test adapters. Nothing here is production data.</div>;
}

function useCounts(storeId: string, enabled: boolean) {
  const [o, setO] = useState<OverviewDTO['totals'] | null>(null);
  const loc = useLocation();
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    api.overview(storeId).then((r) => live && setO(r.totals)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [storeId, enabled, loc.pathname]);
  return o;
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { store, can } = useStore();
  const { logout } = useAuth();
  const nav = useNavigate();
  const base = `/app/s/${store.id}`;
  const counts = useCounts(store.id, can('analytics.view'));
  const [params] = useSearchParams();
  const loc = useLocation();
  const onLicenses = loc.pathname.startsWith(`${base}/licenses`);
  const status = params.get('status');
  const cls = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`;
  const subs: { key: string; label: string; color: string; n?: number }[] = [
    { key: 'active', label: 'Active', color: '#6cc417', n: counts?.active_licenses },
    { key: 'pending', label: 'Pending', color: '#a1a5ad', n: counts?.pending_licenses },
    { key: 'suspended', label: 'Suspended', color: '#e07b0a', n: counts?.suspended_licenses },
    { key: 'revoked', label: 'Revoked', color: '#ef5350', n: counts?.revoked_licenses },
  ];
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate()}>
      <div className="brand">
        <Brand />
      </div>
      <div className="nav-label">Main menu</div>
      <NavLink to={`${base}/overview`} className={cls}><LayoutGrid size={18} />Overview</NavLink>
      {can('products.view') && (
        <NavLink to={`${base}/products`} className={cls}><Package size={18} />Products{counts && <span className="count">{counts.products}</span>}</NavLink>
      )}
      {can('licenses.view') && (
        <>
          <NavLink to={`${base}/licenses`} className={() => `nav-item ${onLicenses && !status ? 'active' : ''}`} end><KeyRound size={18} />Keys</NavLink>
          <div className="nav-sub">
            {subs.map((s) => (
              <Link key={s.key} to={`${base}/licenses?status=${s.key}`} className={`nav-item ${onLicenses && status === s.key ? 'active' : ''}`}>
                <span className="dot" style={{ background: s.color }} />
                {s.label}
                {s.n !== undefined && <span className="count">{s.n}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
      {can('customers.view') && (
        <NavLink to={`${base}/customers`} className={cls}><Users size={18} />Customers{counts && <span className="count">{counts.customers}</span>}</NavLink>
      )}
      {can('products.view') && <NavLink to={`${base}/sales`} className={cls}><RobuxIcon size={18} />Sales</NavLink>}
      <div className="nav-label" style={{ marginTop: 10 }}>Management</div>
      {(can('audit.view') || can('analytics.view')) && (
        <NavLink to={`${base}/activity`} className={cls}><Activity size={18} />Activity & security</NavLink>
      )}
      <NavLink to={`${base}/settings`} className={cls}><Settings size={18} />Settings</NavLink>
      <div className="sidebar-foot">
        <Link className="nav-item" to="/docs"><BookOpen size={18} />Documentation</Link>
        <button
          className="nav-item"
          style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%' }}
          onClick={async () => {
            await logout();
            nav('/login');
          }}
        >
          <LogOut size={18} />Log out
        </button>
      </div>
    </aside>
  );
}

export function StoreSwitcher() {
  const { me } = useAuth();
  const { store } = useStore();
  const nav = useNavigate();
  return (
    <Menu
      trigger={
        <button className="row" style={{ background: 'none', border: 0, cursor: 'pointer', gap: 10 }}>
          <Avatar src={store.guild_icon_url} name={store.name} />
          <span className="hide-sm" style={{ textAlign: 'left', lineHeight: 1.25 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>{store.name}</span>
            <span className="faint small">{store.role === 'owner' ? 'Owner' : 'Administrator'} · {store.guild_name ?? 'Discord server'}</span>
          </span>
          <ChevronDown size={16} className="faint" />
        </button>
      }
      items={[
        ...(me?.stores ?? []).map((s) => ({ label: s.name, icon: <Avatar src={s.guild_icon_url} name={s.name} size="sm" />, onClick: () => nav(`/app/s/${s.id}/overview`) })),
        { label: '', divider: true, onClick: () => undefined },
        { label: 'Create a store', icon: <Plus size={16} />, onClick: () => nav('/app/stores/new') },
      ]}
    />
  );
}

export function UserMenu() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  if (!me) return null;
  return (
    <Menu
      trigger={
        <button className="row" style={{ background: 'none', border: 0, cursor: 'pointer' }} aria-label="Account menu">
          <Avatar src={me.user.avatar_url} name={me.user.display_name ?? me.user.username} />
        </button>
      }
      items={[
        { label: me.user.display_name ?? me.user.username, onClick: () => nav('/app/account') },
        { label: 'Account & sessions', onClick: () => nav('/app/account') },
        { label: 'My purchases', icon: <ShoppingBag size={16} />, onClick: () => nav('/purchases') },
        { label: 'Platform admin', hidden: !me.user.is_platform_admin, icon: <ShieldAlert size={16} />, onClick: () => nav('/admin') },
        { label: '', divider: true, onClick: () => undefined },
        {
          label: 'Log out',
          danger: true,
          icon: <LogOut size={16} />,
          onClick: async () => {
            await logout();
            nav('/login');
          },
        },
      ]}
    />
  );
}

export function StoreLayout() {
  const { store } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  return (
    <div className="shell">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div className="main">
        <DevBanner />
        <header className="topbar">
          <button className="icon-btn mobile-only" aria-label="Open navigation" onClick={() => setOpen((o) => !o)}><MenuIcon size={20} /></button>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) nav(`/app/s/${store.id}/licenses?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search keys, Roblox users, products…" aria-label="Search" />
          </form>
          <div className="topbar-right">
            <StoreSwitcher />
            <div className="vsep hide-sm" />
            <UserMenu />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Minimal chrome for account-level pages (store selection, creation, account, admin). */
export function PlainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mk" style={{ background: 'var(--bg)' }}>
      <DevBanner />
      <div className="mk-nav" style={{ borderBottom: '1px solid var(--border)', maxWidth: 'none' }}>
        <Brand />
        <UserMenu />
      </div>
      <div className="content" style={{ margin: '0 auto', maxWidth: 1080 }}>{children}</div>
    </div>
  );
}

export function PageHead({ title, sub, actions, crumbs }: { title: string; sub?: ReactNode; actions?: ReactNode; crumbs?: { to: string; label: string }[] }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {crumbs && (
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <span key={c.to} className="row" style={{ gap: 8 }}>
                <Link to={c.to}>{c.label}</Link>
                {i < crumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
