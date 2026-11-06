import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Search, Users } from 'lucide-react';
import { PageHead } from '../components/layout';
import { EVENT_COLOR, EVENT_LABEL, eventDetail } from '../components/keys';
import { Callout, ConfirmModal, Empty, ErrorState, Field, PageLoader, Pagination, StatusBadge, useToast } from '../components/ui';
import { useStore } from '../context';
import { api, fmtDate, relTime, useAsync, useDebounced } from '../lib';

export function CustomersList() {
  const { store } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useAsync(() => api.customers(store.id, { q: dq || undefined, status: status || undefined, page, page_size: 25 }), [store.id, dq, status, page]);
  return (
    <>
      <PageHead title="Customers" sub="Roblox accounts that hold licenses from your store. Customers are created automatically when you issue a key." />
      <div className="panel">
        <div className="toolbar">
          <div className="search-input"><Search size={15} /><input className="input" placeholder="Roblox username, user ID or Discord ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <select className="select compact" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
            <option value="">All customers</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <PageLoader /> : !list.data.items.length ? (
          <Empty icon={<Users size={20} />} title={q ? 'No matching customers' : 'No customers yet'} text="Customers appear when you generate a key for a Roblox account." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Roblox account</th><th>Discord</th><th>Licenses</th><th>Last activation</th><th>Status</th><th>Customer since</th></tr></thead>
                <tbody>
                  {list.data.items.map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => nav(`/app/s/${store.id}/customers/${c.id}`)}>
                      <td><div className="cell-main">{c.roblox_username ?? 'Unknown'}</div><div className="cell-sub mono">{c.roblox_user_id}</div></td>
                      <td className="mono faint">{c.discord_user_id ?? '—'}</td>
                      <td>{c.active_license_count} <span className="faint">active / {c.license_count}</span></td>
                      <td className="faint">{relTime(c.last_activation_at)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="faint">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}

export function CustomerDetail() {
  const { customerId } = useParams();
  const { store, can } = useStore();
  const toast = useToast();
  const c = useAsync(() => api.customer(store.id, customerId!), [store.id, customerId]);
  const [suspend, setSuspend] = useState(false);
  const [discord, setDiscord] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  if (c.error) return <ErrorState error={c.error} onRetry={c.reload} />;
  const cu = c.data;
  if (!cu) return <PageLoader />;
  return (
    <>
      <PageHead
        crumbs={[{ to: `/app/s/${store.id}/customers`, label: 'Customers' }, { to: '#', label: cu.roblox_username ?? cu.roblox_user_id }]}
        title={cu.roblox_username ?? `Roblox user ${cu.roblox_user_id}`}
        sub={<span className="row wrap"><StatusBadge status={cu.status} /><span className="mono faint">{cu.roblox_user_id}</span><a className="row small" style={{ gap: 4 }} href={`https://www.roblox.com/users/${cu.roblox_user_id}/profile`} target="_blank" rel="noreferrer">Roblox profile <ExternalLink size={12} /></a></span>}
        actions={can('customers.manage') && (cu.status === 'active'
          ? <button className="btn danger" onClick={() => setSuspend(true)}>Suspend customer</button>
          : <button className="btn" onClick={async () => { try { await api.restoreCustomer(store.id, cu.id); toast.success('Customer restored'); c.reload(); } catch (e) { toast.error(e); } }}>Restore customer</button>)}
      />
      {cu.status === 'suspended' && <div style={{ marginBottom: 16 }}><Callout kind="warn">This customer is suspended. None of their licenses authorize until you restore them.</Callout></div>}
      <div className="grid g-8-4">
        <div className="stack">
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Licenses</span></div>
            {!can('licenses.view') ? <div className="panel-pad faint">You don’t have permission to view licenses.</div> : !cu.licenses.length ? <div className="panel-pad faint">No licenses.</div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Key</th><th>Product</th><th>Status</th><th>Activated</th><th>Transfers</th></tr></thead>
                  <tbody>
                    {cu.licenses.map((l) => (
                      <tr key={l.id}>
                        <td><Link className="mono" to={`/app/s/${store.id}/licenses/${l.id}`} style={{ textDecoration: 'underline' }}>{l.token_hint}</Link></td>
                        <td>{l.product_name}</td>
                        <td><StatusBadge status={l.status} /></td>
                        <td className="faint">{relTime(l.activated_at)}</td>
                        <td>{l.transfer_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Activation & transfer history</span></div>
            <div className="feed">
              {cu.events.map((e) => (
                <div key={e.id} className="feed-item">
                  <span className={`badge ${EVENT_COLOR[e.type] ?? 'gray'}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
                  <div className="feed-main"><div>{e.product_name}</div><div className="faint small">{eventDetail(e)}</div></div>
                  <span className="feed-time">{relTime(e.created_at)}</span>
                </div>
              ))}
              {!cu.events.length && <div className="feed-item faint">No activity yet.</div>}
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="panel panel-pad stack">
            <dl className="kv">
              <dt>Customer ID</dt><dd className="mono">{cu.id}</dd>
              <dt>Since</dt><dd>{fmtDate(cu.created_at)}</dd>
              <dt>Licenses</dt><dd>{cu.active_license_count} active / {cu.license_count}</dd>
            </dl>
            <Field label="Linked Discord ID">
              <input className="input mono" disabled={!can('customers.manage')} value={discord ?? cu.discord_user_id ?? ''} onChange={(e) => setDiscord(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Notes">
              <textarea className="textarea" disabled={!can('customers.manage')} value={notes ?? cu.notes ?? ''} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            {can('customers.manage') && (discord !== null || notes !== null) && (
              <div><button className="btn primary sm" onClick={async () => {
                try {
                  await api.updateCustomer(store.id, cu.id, { ...(discord !== null ? { discord_user_id: discord || null } : {}), ...(notes !== null ? { notes: notes || null } : {}) });
                  toast.success('Customer updated'); setDiscord(null); setNotes(null); c.reload();
                } catch (e) { toast.error(e); }
              }}>Save</button></div>
            )}
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Security events</span></div>
            <div className="feed">
              {cu.security_events.map((s) => (
                <div key={s.id} className="feed-item"><span className={`badge ${s.severity === 'high' ? 'red' : s.severity === 'medium' ? 'orange' : 'gray'}`}>{s.severity}</span><div className="feed-main mono small">{s.type}</div><span className="feed-time">{relTime(s.created_at)}</span></div>
              ))}
              {!cu.security_events.length && <div className="feed-item faint">None recorded.</div>}
            </div>
          </div>
        </div>
      </div>
      {suspend && (
        <ConfirmModal title="Suspend customer?" danger confirmLabel="Suspend customer" askReason
          body="All of this customer’s licenses stop authorizing and their running servers lose access. You can restore them later."
          onConfirm={async (reason) => { await api.suspendCustomer(store.id, cu.id, reason); toast.success('Customer suspended'); c.reload(); }}
          onClose={() => setSuspend(false)} />
      )}
    </>
  );
}
