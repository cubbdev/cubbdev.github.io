import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Link2, Package, Unlink } from 'lucide-react';
import type { SalesDTO, StoreRobloxDTO } from '@cipher/shared';
import { PageHead } from '../components/layout';
import { connectStoreRoblox, Robux, RobuxIcon } from '../components/sale';
import { Callout, ConfirmModal, CopyField, Empty, ErrorState, PageLoader, useToast } from '../components/ui';
import { useStore } from '../context';
import { api, relTime, useAsync } from '../lib';

const ROBLOX_ERRORS: Record<string, string> = {
  access_denied: 'You cancelled the Roblox authorization.',
  invalid_state: 'The Roblox sign-in expired or was opened in a different browser. Try again.',
  roblox_error: 'Roblox could not complete the connection. Try again in a minute.',
  expired: 'That Roblox link expired. Try again.',
};

/** Bucket dates are UTC calendar days; label them without shifting into the viewer's timezone. */
function dayLabel(date: string | undefined): string {
  return date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

function RevenueChart({ daily }: { daily: SalesDTO['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.net_robux));
  const [hover, setHover] = useState<number | null>(null);
  const h = hover === null ? null : daily[hover];
  return (
    <div className="rev">
      <div className="rev-tip">
        {h ? <><strong>{dayLabel(h.date)}</strong> · <Robux value={h.net_robux} /> earned · {h.sales} sale{h.sales === 1 ? '' : 's'}</> : <span className="faint">Hover a day to see its revenue</span>}
      </div>
      <div className="rev-bars" onMouseLeave={() => setHover(null)}>
        {daily.map((d, i) => (
          <div key={d.date} className={`rev-col ${hover === i ? 'on' : ''}`} onMouseEnter={() => setHover(i)} title={`${d.date}: R$ ${d.net_robux}`}>
            <div className="rev-bar" style={{ height: `${d.net_robux ? Math.max(4, (d.net_robux / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="rev-axis"><span>{dayLabel(daily[0]?.date)}</span><span>{dayLabel(daily[daily.length - 1]?.date)}</span></div>
    </div>
  );
}

function RobloxConnection({ rb, onChange }: { rb: StoreRobloxDTO; onChange: () => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  if (!rb.configured) return <div className="panel panel-pad"><Callout kind="info">Robux sales are not switched on for this Cipher deployment yet.</Callout></div>;
  if (!rb.connected) {
    return (
      <div className="panel panel-pad stack">
        <div className="panel-title">Connect Roblox to sell for Robux</div>
        <p className="muted" style={{ margin: 0 }}>Sign in with the Roblox account that manages your group. On the Roblox screen, choose your group and tick the experience whose game passes you want to sell. Cipher only gets access to game passes — never your Robux, password or group settings.</p>
        {can('settings.manage') ? <div><button className="btn primary" onClick={() => connectStoreRoblox(store.id, `/app/s/${store.id}/sales`).catch(toast.error)}><Link2 size={16} />Connect Roblox</button></div> : <span className="faint small">Only members with “Manage settings” can connect Roblox.</span>}
      </div>
    );
  }
  return (
    <div className="panel panel-pad stack">
      <div className="row between wrap">
        <div>
          <div className="panel-title">Roblox</div>
          <div className="muted small">Connected as <strong>{rb.roblox_username ?? rb.roblox_user_id}</strong></div>
        </div>
        {can('settings.manage') && (
          <div className="row">
            <button className="btn sm" onClick={() => connectStoreRoblox(store.id, `/app/s/${store.id}/sales`).catch(toast.error)}>Reconnect</button>
            <button className="btn sm danger" onClick={() => setConfirm(true)}><Unlink size={14} />Disconnect</button>
          </div>
        )}
      </div>
      <div>
        <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Sell from</div>
        <div className="row wrap">
          {rb.owners.map((o) => {
            const on = rb.selected?.type === o.type && rb.selected?.id === o.id;
            return (
              <button
                key={`${o.type}:${o.id}`}
                className={`btn sm ${on ? 'primary' : ''}`}
                disabled={!can('settings.manage')}
                aria-pressed={on}
                onClick={async () => { if (on) return; try { await api.selectRobloxOwner(store.id, o.type, o.id); toast.success(`Selling from ${o.name}`); onChange(); } catch (e) { toast.error(e); } }}
              >
                {o.type === 'Group' ? 'Group' : 'Account'}: {o.name} <span style={{ opacity: 0.7 }}>· {o.universes.length} experience{o.universes.length === 1 ? '' : 's'}</span>
              </button>
            );
          })}
          {!rb.owners.length && <span className="muted small">Roblox didn’t share any groups or experiences. Reconnect and pick your group on the Roblox screen.</span>}
        </div>
      </div>
      <div>
        <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Your store page</div>
        <CopyField value={rb.shop_url} />
      </div>
      {confirm && (
        <ConfirmModal
          title="Disconnect Roblox?"
          body="Cipher can no longer create or read game passes. Products already on sale stay on sale and purchases are still detected, because buyers prove ownership with their own Roblox account."
          confirmLabel="Disconnect"
          danger
          onConfirm={async () => { await api.disconnectStoreRoblox(store.id); toast.success('Roblox disconnected'); onChange(); }}
          onClose={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

export function SalesPage() {
  const { store, can } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useState(30);
  const rb = useAsync(() => api.storeRoblox(store.id), [store.id]);
  const sales = useAsync(() => (can('analytics.view') ? api.sales(store.id, days) : Promise.resolve(null)), [store.id, days]);
  const products = useAsync(() => api.products(store.id), [store.id]);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const err = params.get('roblox_error');
    if (params.get('roblox') === 'connected') toast.success('Roblox connected');
    else if (err) toast.error(ROBLOX_ERRORS[err] ?? 'Roblox could not be connected.');
    if (params.get('roblox') || err) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSale = useMemo(() => (products.data?.items ?? []).filter((p) => p.sale), [products.data]);
  const s = sales.data;

  return (
    <>
      <PageHead
        title="Sales"
        sub="Sell products for Robux with Roblox game passes. Buyers get their key and loader automatically."
        actions={rb.data?.connected && <a className="btn light" href={rb.data.shop_url} target="_blank" rel="noreferrer"><ExternalLink size={15} />View store page</a>}
      />
      {rb.error ? <ErrorState error={rb.error} onRetry={rb.reload} /> : !rb.data ? <PageLoader /> : (
        <div className="stack" style={{ gap: 18 }}>
          {s && (
            <div className="grid g4">
              <div className="panel stat feature">
                <span className="stat-label">Earned ({days} days)</span>
                <div className="stat-body"><div className="stat-value"><RobuxIcon size={26} />{s.period.net_robux.toLocaleString()}</div></div>
                <span className="faint small">After Roblox’s 30% fee</span>
              </div>
              <div className="panel stat">
                <span className="stat-label">Sales ({days} days)</span>
                <div className="stat-body"><div className="stat-value">{s.period.sales.toLocaleString()}</div></div>
                <span className="faint small">Gross <Robux value={s.period.gross_robux} /></span>
              </div>
              <div className="panel stat">
                <span className="stat-label">All-time earned</span>
                <div className="stat-body"><div className="stat-value"><RobuxIcon size={26} />{s.totals.net_robux.toLocaleString()}</div></div>
                <span className="faint small">{s.totals.sales.toLocaleString()} sales · gross <Robux value={s.totals.gross_robux} /></span>
              </div>
              <div className="panel stat">
                <span className="stat-label">Products on sale</span>
                <div className="stat-body"><div className="stat-value">{onSale.filter((p) => p.sale?.for_sale).length}</div></div>
                <span className="faint small">{onSale.length} linked to game passes</span>
              </div>
            </div>
          )}

          <div className="grid g-7-5">
            <div className="panel">
              <div className="panel-head">
                <span className="panel-title">Revenue</span>
                <select className="select compact" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
                  <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last year</option>
                </select>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                {sales.error ? <ErrorState error={sales.error} /> : !can('analytics.view') ? <span className="muted small">You need “View analytics” to see revenue.</span> : s ? <RevenueChart daily={s.daily} /> : <PageLoader />}
              </div>
            </div>
            <RobloxConnection rb={rb.data} onChange={() => { rb.reload(); products.reload(); }} />
          </div>

          <div className="grid g2">
            <div className="panel">
              <div className="panel-head"><span className="panel-title">Products</span></div>
              {products.data && !onSale.length ? (
                <Empty icon={<Package size={20} />} title="Nothing on sale yet" text="Open a product and use the “Sell for Robux” tab to create its game pass." action={<Link className="btn" to={`/app/s/${store.id}/products`}>Go to products</Link>} />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Product</th><th>Price</th><th>Sales</th><th>Earned</th></tr></thead>
                    <tbody>
                      {onSale.map((p) => {
                        const row = s?.by_product.find((b) => b.product_id === p.id);
                        return (
                          <tr key={p.id}>
                            <td><Link to={`/app/s/${store.id}/products/${p.id}?tab=sale`} className="cell-main">{p.name}</Link>{!p.sale?.for_sale && <span className="badge gray" style={{ marginLeft: 8 }}>paused</span>}</td>
                            <td><Robux value={p.sale?.price_robux} /></td>
                            <td>{row?.sales ?? 0}</td>
                            <td><Robux value={row?.net_robux ?? 0} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="panel">
              <div className="panel-head"><span className="panel-title">Recent sales</span></div>
              <div className="feed">
                {s?.recent.map((r) => (
                  <div key={r.id} className="feed-item">
                    <span className="badge green"><Robux value={r.net_robux} /></span>
                    <div className="feed-main">
                      <div>{r.product_name}</div>
                      <div className="faint small">
                        {r.roblox_username ?? 'Roblox user'} <span className="mono">({r.roblox_user_id})</span>
                        {r.license_id && can('licenses.view') && <> · <Link to={`/app/s/${store.id}/licenses/${r.license_id}`}>key</Link></>}
                      </div>
                    </div>
                    <span className="feed-time">{relTime(r.completed_at)}</span>
                  </div>
                ))}
                {s && !s.recent.length && <div className="feed-item faint">No sales yet. Share your store page to get your first one.</div>}
              </div>
            </div>
          </div>
          <p className="faint small" style={{ margin: 0 }}>Revenue counts purchases verified through Cipher. Roblox pays out game pass Robux to the group or account that owns the experience; Cipher never holds your Robux.</p>
        </div>
      )}
    </>
  );
}
