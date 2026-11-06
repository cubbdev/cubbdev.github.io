import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHead } from '../components/layout';
import { EVENT_COLOR, EVENT_LABEL, eventDetail } from '../components/keys';
import { Empty, ErrorState, PageLoader, Pagination, Tabs, useToast } from '../components/ui';
import { useStore } from '../context';
import { api, fmtDate, relTime, useAsync } from '../lib';

type Tab = 'security' | 'licenses' | 'audit';

export function ActivityPage() {
  const { store, can } = useStore();
  const initial: Tab = can('analytics.view') ? 'security' : can('licenses.view') ? 'licenses' : 'audit';
  const [tab, setTab] = useState<Tab>(initial);
  return (
    <>
      <PageHead title="Activity & security" sub="Security events are detected automatically. License history and the audit log are append-only." />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'security', label: 'Security events', hidden: !can('analytics.view') },
          { id: 'licenses', label: 'License events', hidden: !can('licenses.view') },
          { id: 'audit', label: 'Audit log', hidden: !can('audit.view') },
        ]}
      />
      {tab === 'security' && <Security storeId={store.id} />}
      {tab === 'licenses' && <LicenseEvents storeId={store.id} />}
      {tab === 'audit' && <Audit storeId={store.id} />}
    </>
  );
}

const SEV: Record<string, string> = { info: 'gray', low: 'gray', medium: 'orange', high: 'red', critical: 'red' };

function Security({ storeId }: { storeId: string }) {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const toast = useToast();
  const list = useAsync(() => api.securityEvents(storeId, { page, page_size: 25, severity: severity || undefined }), [storeId, page, severity]);
  return (
    <div className="panel">
      <div className="toolbar">
        <select className="select compact" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} aria-label="Severity">
          <option value="">All severities</option>{['critical', 'high', 'medium', 'low', 'info'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <PageLoader /> : !list.data.items.length ? (
        <Empty icon={<ShieldCheck size={20} />} title="No security events" text="Wrong-account activations, invalid keys, replayed requests and unauthorized runtime operations are recorded here." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Severity</th><th>Event</th><th>License</th><th>Details</th><th>When</th><th /></tr></thead>
              <tbody>
                {list.data.items.map((s) => (
                  <tr key={s.id} style={{ opacity: s.acknowledged_at ? 0.55 : 1 }}>
                    <td><span className={`badge ${SEV[s.severity]}`}>{s.severity}</span></td>
                    <td className="mono">{s.type}</td>
                    <td className="mono small">{s.license_id ?? '—'}</td>
                    <td className="small faint wrap-ok" style={{ maxWidth: 340 }}>{Object.entries(s.details).slice(0, 4).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || '—'}</td>
                    <td className="faint" title={fmtDate(s.created_at, true)}>{relTime(s.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!s.acknowledged_at && <button className="btn sm" onClick={async () => { try { await api.acknowledgeSecurityEvent(storeId, s.id); list.reload(); } catch (e) { toast.error(e); } }}>Acknowledge</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={25} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function LicenseEvents({ storeId }: { storeId: string }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const list = useAsync(() => api.activations(storeId, { page, page_size: 25, type: type || undefined }), [storeId, page, type]);
  return (
    <div className="panel">
      <div className="toolbar">
        <select className="select compact" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Event type">
          <option value="">All events</option>
          {Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <PageLoader /> : (
        <>
          <div className="feed">
            {list.data.items.map((e) => (
              <div key={e.id} className="feed-item">
                <span className={`badge ${EVENT_COLOR[e.type] ?? 'gray'}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
                <div className="feed-main"><div>{e.product_name} <span className="mono faint small">{e.license_id}</span></div><div className="faint small">{eventDetail(e)}</div></div>
                <span className="feed-time" title={fmtDate(e.created_at, true)}>{relTime(e.created_at)}</span>
              </div>
            ))}
            {!list.data.items.length && <div className="feed-item faint">No events.</div>}
          </div>
          <Pagination page={page} pageSize={25} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function Audit({ storeId }: { storeId: string }) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const list = useAsync(() => api.auditLogs(storeId, { page, page_size: 50, action: action || undefined }), [storeId, page, action]);
  return (
    <div className="panel">
      <div className="toolbar">
        <select className="select compact" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Area">
          <option value="">All actions</option>
          {['license', 'product', 'customer', 'permissions', 'api_key', 'store', 'platform'].map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
        </select>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <PageLoader /> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Details</th><th>When</th></tr></thead>
              <tbody>
                {list.data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.action}</td>
                    <td><div>{a.actor_name ?? a.actor_type}</div><div className="cell-sub">{a.actor_type}{a.actor_id ? ` · ${a.actor_id}` : ''}</div></td>
                    <td className="mono small">{a.target_id ?? '—'}</td>
                    <td className="small faint wrap-ok" style={{ maxWidth: 360 }}>{Object.entries(a.details).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') || '—'}</td>
                    <td className="faint" title={fmtDate(a.created_at, true)}>{relTime(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={50} total={list.data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
