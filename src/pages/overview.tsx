import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Ban, Download, FolderClosed, KeyRound, Loader, Package, Plus, ShieldAlert, Upload, Users } from 'lucide-react';
import type { LicenseEventDTO, OverviewDTO, ProductDTO } from '@cipher/shared';
import { PageHead } from '../components/layout';
import { EVENT_COLOR, EVENT_LABEL, eventDetail, GenerateKeyModal } from '../components/keys';
import { Callout, Delta, Empty, ErrorState, Menu, Skeleton, STATUS_COLORS, useToast } from '../components/ui';
import { useStore } from '../context';
import { api, downloadAuthenticated, relTime, useAsync } from '../lib';

const DAY = 86_400_000;

function StatCard({ label, value, icon, delta, feature }: { label: string; value: number; icon: React.ReactNode; delta: number | null; feature?: boolean }) {
  return (
    <div className={`panel stat ${feature ? 'feature' : ''}`}>
      <div className="row between"><span className="stat-label">{label}</span></div>
      <div className="stat-body">
        <div className="stat-value">{icon}{value.toLocaleString()}</div>
        <div className="stat-meta"><Delta value={delta} /><span>From last month</span></div>
      </div>
    </div>
  );
}

/** Seven-day license timeline in the spirit of the reference "Project Timeline". */
function Timeline({ events }: { events: LicenseEventDTO[] }) {
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(today.getTime() - (5 - i) * DAY));
  }, []);
  const start = days[0].getTime();
  const span = 7 * DAY;
  const now = Date.now();
  const nowPct = ((now - start) / span) * 100;
  // One chip per (day, event type) so busy days stay readable.
  const groups = new Map<string, { e: LicenseEventDTO; day: number; count: number; products: Set<string> }>();
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    if (t < start) continue;
    const day = Math.min(6, Math.floor((t - start) / DAY));
    const key = `${day}:${e.type}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      if (e.product_name) g.products.add(e.product_name);
    } else groups.set(key, { e, day, count: 1, products: new Set(e.product_name ? [e.product_name] : []) });
  }
  const lanePerDay = new Map<number, number>();
  const chips = [...groups.values()].slice(0, 18).map((g) => {
    const lane = lanePerDay.get(g.day) ?? 0;
    lanePerDay.set(g.day, lane + 1);
    const pos: React.CSSProperties =
      g.day >= 4 ? { right: `${100 - ((g.day + 1) / 7) * 100 + 0.6}%` } : { left: `${(g.day / 7) * 100 + 0.6}%` };
    const label = g.count > 1 ? `${EVENT_LABEL[g.e.type]} ×${g.count}` : `${EVENT_LABEL[g.e.type]}${g.e.product_name ? ` · ${g.e.product_name}` : ''}`;
    return { key: `${g.day}:${g.e.type}`, e: g.e, pos: { ...pos, top: 16 + (lane % 6) * 44 }, label, today: g.day === 5, title: [...g.products].join(', ') };
  });
  return (
    <>
      <div className="timeline-head" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((d, i) => (
          <span key={i} className={i === 5 ? 'today' : ''}>{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        ))}
      </div>
      <div className="timeline">
        <div className="timeline-cols" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>{days.map((_, i) => <div key={i} className="timeline-col" />)}</div>
        <div className="timeline-now" style={{ left: `${nowPct}%` }} />
        {chips.length === 0 && <div className="center-page" style={{ minHeight: 280, color: 'var(--text-3)' }}>No license activity in the last week.</div>}
        {chips.map(({ key, e, pos, label, today, title }) => (
          <div key={key} className="timeline-chip" style={pos} title={title || eventDetail(e)}>
            <span className={`chip ${today ? 'light' : ''}`}>
              <span className="chip-date">{new Date(e.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              {label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function StatusPanel({ o }: { o: OverviewDTO }) {
  const rows = [
    { k: 'pending', label: 'Pending', n: o.totals.pending_licenses },
    { k: 'active', label: 'Active', n: o.totals.active_licenses },
    { k: 'suspended', label: 'Suspended', n: o.totals.suspended_licenses },
    { k: 'revoked', label: 'Revoked', n: o.totals.revoked_licenses },
  ] as const;
  const total = rows.reduce((a, r) => a + r.n, 0) + o.totals.expired_licenses;
  const max = Math.max(1, ...rows.map((r) => r.n));
  const cols = rows.map((r) => Math.max(1, r.n)).join('fr ') + 'fr';
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head"><span className="panel-title">License Status</span></div>
      <div className="row" style={{ padding: '4px 20px 22px', alignItems: 'flex-end', gap: 14 }}>
        <span style={{ fontSize: 48, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1 }}>{total}</span>
        <span className="muted small" style={{ paddingBottom: 6 }}>Licenses issued · {o.totals.live_sessions} live servers</span>
      </div>
      <div className="bars" style={{ gridTemplateColumns: cols, flex: 1 }}>
        {rows.map((r) => (
          <div key={r.k} className="bar-col" style={{ borderColor: STATUS_COLORS[r.k] }}>
            <span className="bar-label"><span className="dot" style={{ background: STATUS_COLORS[r.k] }} />{r.n} total</span>
            <div className="bar" style={{ background: STATUS_COLORS[r.k], width: `${Math.max(12, (r.n / max) * 100)}%`, opacity: r.n ? 1 : 0.35 }} />
          </div>
        ))}
      </div>
      <div className="legend">{rows.map((r) => <span key={r.k}><span className="dot" style={{ background: STATUS_COLORS[r.k] }} />{r.label}</span>)}</div>
    </div>
  );
}

function ProductCard({ p, storeId }: { p: ProductDTO; storeId: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const rate = p.license_count ? Math.round((p.active_license_count / p.license_count) * 100) : 0;
  return (
    <div className="card" role="link" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => nav(`/app/s/${storeId}/products/${p.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/app/s/${storeId}/products/${p.id}`)}>
      <div className="row between">
        <span className="chip">Updated {relTime(p.updated_at)}</span>
        <Menu
          items={[
            { label: 'Open product', onClick: () => nav(`/app/s/${storeId}/products/${p.id}`) },
            { label: 'View keys', onClick: () => nav(`/app/s/${storeId}/licenses?product_id=${p.id}`) },
            { label: 'Download package', icon: <Download size={15} />, onClick: () => downloadAuthenticated(api.loaderDownloadUrl(storeId, p.id), 'loader.rbxmx').catch(toast.error) },
          ]}
        />
      </div>
      <div className="card-title">{p.name}</div>
      <div className="muted">{p.distribution_type === 'STRICT_PRIVATE' ? 'Strict private runtime' : 'Server protected'}</div>
      <div className="row between mt-16 small"><span className="muted">Active licenses</span><span>{rate}%</span></div>
      <div className="progress mt-8"><div style={{ width: `${rate}%` }} /></div>
      <div className="card-foot">
        <span className="row" style={{ gap: 6 }}><Package size={14} />v{p.current_version?.version ?? '—'}</span>
        <span className="row" style={{ gap: 6 }}><KeyRound size={14} />{p.license_count}</span>
      </div>
    </div>
  );
}

function Feed({ items, empty }: { items: LicenseEventDTO[]; empty: string }) {
  if (!items.length) return <div className="feed-item faint">{empty}</div>;
  return (
    <>
      {items.map((e) => (
        <div key={e.id} className="feed-item">
          <span className={`badge ${EVENT_COLOR[e.type] ?? 'gray'}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
          <div className="feed-main">
            <div>{e.product_name ?? 'Product'} <span className="faint mono">{e.license_id}</span></div>
            <div className="faint small">{eventDetail(e)}</div>
          </div>
          <span className="feed-time">{relTime(e.created_at)}</span>
        </div>
      ))}
    </>
  );
}

export function Overview() {
  const { store, can } = useStore();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [genOpen, setGenOpen] = useState(false);
  const [feed, setFeed] = useState<'activations' | 'revocations' | 'security'>('activations');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const overview = useAsync(() => (can('analytics.view') ? api.overview(store.id) : Promise.resolve(null)), [store.id]);
  const products = useAsync(() => (can('products.view') ? api.products(store.id) : Promise.resolve({ items: [] as ProductDTO[] })), [store.id]);
  const o = overview.data;

  const columns = useMemo(() => {
    const list = (products.data?.items ?? []).filter((p) => typeFilter === 'all' || p.distribution_type === typeFilter);
    const cols = [
      { key: 'draft', label: 'Draft', color: '#a1a5ad' },
      { key: 'active', label: 'Active', color: '#6cc417' },
      { key: 'archived', label: 'Archived', color: '#4b4f5a' },
    ].filter((c) => statusFilter === 'all' || c.key === statusFilter);
    return cols.map((c) => ({ ...c, items: list.filter((p) => p.status === c.key) }));
  }, [products.data, statusFilter, typeFilter]);

  return (
    <>
      {params.get('created') && (
        <div style={{ marginBottom: 18 }}>
          <Callout kind="info">
            <strong>{store.name} is ready.</strong> Ownership of your Discord server was verified and the Cipher bot is installed. Next, <Link to={`/app/s/${store.id}/products/new`} style={{ textDecoration: 'underline' }}>upload your first product</Link>.{' '}
            <button className="btn sm ghost" onClick={() => { params.delete('created'); setParams(params, { replace: true }); }}>Dismiss</button>
          </Callout>
        </div>
      )}
      <PageHead
        title="Overview"
        sub={`Licensing, distribution and security activity for ${store.name}.`}
        actions={
          <>
            {can('products.upload') && <Link className="btn light" to={`/app/s/${store.id}/products/new`}><Upload size={16} />Upload asset</Link>}
            {can('licenses.create') && <button className="btn primary" onClick={() => setGenOpen(true)}><Plus size={16} />Generate key</button>}
          </>
        }
      />

      {!can('analytics.view') ? (
        <Callout kind="info">Your role does not include analytics. Use the navigation to manage the areas you have access to.</Callout>
      ) : overview.error ? (
        <div className="panel"><ErrorState error={overview.error} onRetry={overview.reload} /></div>
      ) : (
        <>
          <div className="grid g4">
            {o ? (
              <>
                <StatCard feature label="Products" value={o.totals.products} icon={<FolderClosed size={24} fill="currentColor" />} delta={o.deltas.products} />
                <StatCard label="Active Licenses" value={o.totals.active_licenses} icon={<Loader size={24} />} delta={o.deltas.active_licenses} />
                <StatCard label="Revoked Licenses" value={o.totals.revoked_licenses} icon={<Ban size={24} />} delta={o.deltas.revoked_licenses} />
                <StatCard label="Customers" value={o.totals.customers} icon={<Users size={24} />} delta={o.deltas.customers} />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <div key={i} className="panel stat"><Skeleton h={18} w="50%" /><Skeleton h={36} w="70%" /></div>)
            )}
          </div>

          <div className="grid g-7-5 mt-16">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">License Timeline</span>
                <Menu items={[{ label: 'Open full activity log', onClick: () => nav(`/app/s/${store.id}/activity`) }, { label: 'Refresh', onClick: overview.reload }]} />
              </div>
              {o ? <Timeline events={o.timeline} /> : <div className="panel-pad"><Skeleton h={280} /></div>}
            </div>
            {o ? <StatusPanel o={o} /> : <div className="panel panel-pad"><Skeleton h={320} /></div>}
          </div>
        </>
      )}

      {can('products.view') && (
        <>
          <div className="row between mt-24 wrap" style={{ marginBottom: 14 }}>
            <h2 className="section-title">Products</h2>
            <div className="row">
              <select className="select compact" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                <option value="all">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
              </select>
              <select className="select compact" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by protection">
                <option value="all">All protection types</option><option value="STRICT_PRIVATE">Strict private</option><option value="SERVER_PROTECTED">Server protected</option>
              </select>
              <Menu items={[{ label: 'Manage products', onClick: () => nav(`/app/s/${store.id}/products`) }, { label: 'New product', hidden: !can('products.upload'), onClick: () => nav(`/app/s/${store.id}/products/new`) }]} />
            </div>
          </div>
          {products.error ? (
            <div className="panel"><ErrorState error={products.error} onRetry={products.reload} /></div>
          ) : products.data && products.data.items.length === 0 ? (
            <div className="panel">
              <Empty icon={<Package size={20} />} title="No products yet" text="Upload a Roblox model or configure a protected runtime. Cipher generates the loader, product ID and integration guide automatically." action={can('products.upload') ? <Link className="btn primary" to={`/app/s/${store.id}/products/new`}><Plus size={16} />Upload asset</Link> : undefined} />
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
              {columns.map((c) => (
                <div key={c.key} className="stack" style={{ gap: 12 }}>
                  <div className="panel board-head">
                    <span className="count-box"><span className="dot" style={{ background: c.color }} />{c.items.length}</span>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{c.label}</span>
                    {can('products.upload') && c.key === 'draft' && <Link className="icon-btn" style={{ marginLeft: 'auto' }} to={`/app/s/${store.id}/products/new`} aria-label="New product"><Plus size={18} /></Link>}
                  </div>
                  {products.loading && !products.data ? <Skeleton h={180} /> : c.items.map((p) => <ProductCard key={p.id} p={p} storeId={store.id} />)}
                  {products.data && !c.items.length && <div className="faint small" style={{ padding: '8px 4px' }}>No {c.label.toLowerCase()} products.</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {o && (
        <div className="grid g-8-4 mt-24">
          <div className="panel">
            <div className="panel-head">
              <div className="row" style={{ gap: 4 }}>
                {(['activations', 'revocations', 'security'] as const).map((k) => (
                  <button key={k} className={`btn sm ${feed === k ? '' : 'ghost'}`} onClick={() => setFeed(k)}>{k === 'activations' ? 'Recent activations' : k === 'revocations' ? 'Revocations' : 'Security events'}</button>
                ))}
              </div>
              <Link className="btn sm ghost" to={`/app/s/${store.id}/activity`}>View all</Link>
            </div>
            <div className="feed">
              {feed === 'activations' && <Feed items={o.recent_activations} empty="No activations yet. They appear here when a customer’s server starts your product." />}
              {feed === 'revocations' && <Feed items={o.recent_revocations} empty="No revocations." />}
              {feed === 'security' && (o.security_events.length ? o.security_events.map((s) => (
                <div key={s.id} className="feed-item">
                  <span className={`badge ${s.severity === 'high' || s.severity === 'critical' ? 'red' : s.severity === 'medium' ? 'orange' : 'gray'}`}><ShieldAlert size={12} />{s.severity}</span>
                  <div className="feed-main"><div className="mono">{s.type}</div>{s.license_id && <div className="faint small mono">{s.license_id}</div>}</div>
                  <span className="feed-time">{relTime(s.created_at)}</span>
                </div>
              )) : <div className="feed-item faint">No security events. Wrong-account, replay and abuse attempts are recorded here automatically.</div>)}
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Activations · 14 days</span></div>
            <div className="panel-pad" style={{ paddingTop: 0 }}>
              <div className="spark" aria-label="Activations per day">
                {(() => {
                  const max = Math.max(1, ...o.activations_by_day.map((d) => d.activations + d.failures));
                  return o.activations_by_day.map((d) => (
                    <div key={d.date} className="col" title={`${d.date}: ${d.activations} authorized, ${d.failures} denied`}>
                      {d.failures > 0 && <div className="fail" style={{ height: `${(d.failures / max) * 100}%` }} />}
                      <div className="ok" style={{ height: `${(d.activations / max) * 100}%` }} />
                    </div>
                  ));
                })()}
              </div>
              <div className="legend" style={{ padding: '14px 0 0' }}>
                <span><span className="dot" style={{ background: 'var(--accent)' }} />Authorized</span>
                <span><span className="dot" style={{ background: 'var(--red)' }} />Denied</span>
              </div>
              <div className="row between mt-16 small"><span className="muted">Product changes</span></div>
              {o.product_activity.slice(0, 4).map((a) => (
                <div key={a.id} className="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <span>{a.action.replace('product.', '').replace(/_/g, ' ')}</span>
                  <span className="faint">{relTime(a.created_at)}</span>
                </div>
              ))}
              {!o.product_activity.length && <div className="faint small">No product changes yet.</div>}
            </div>
          </div>
        </div>
      )}
      {genOpen && <GenerateKeyModal onClose={() => setGenOpen(false)} onIssued={() => overview.reload()} />}
    </>
  );
}
