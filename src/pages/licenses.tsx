import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, KeyRound, Plus, Search } from 'lucide-react';
import type { IssuedLicenseDTO, LicenseDTO, LicenseQuery } from '@cipher/shared';
import { PageHead } from '../components/layout';
import { EVENT_COLOR, EVENT_LABEL, eventDetail, GenerateKeyModal, IssuedKeyModal } from '../components/keys';
import { Callout, ConfirmModal, Empty, ErrorState, Field, Menu, Modal, PageLoader, Pagination, Spinner, StatusBadge, useToast } from '../components/ui';
import { useStore } from '../context';
import { api, errorText, fmtDate, relTime, useAsync, useDebounced } from '../lib';

type Action = 'revoke' | 'suspend' | 'reinstate' | 'transfer' | 'reset' | 'rotate' | 'delete';

/** All license actions, shared by the table and the detail page. */
export function LicenseActions({ license, onDone, onDeleted }: { license: LicenseDTO; onDone: (l?: LicenseDTO) => void; onDeleted?: () => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const [issued, setIssued] = useState<IssuedLicenseDTO | null>(null);
  const [newOwner, setNewOwner] = useState('');
  const l = license;
  const live = l.status !== 'revoked' && l.status !== 'expired';
  return (
    <>
      <Menu
        items={[
          { label: 'Suspend', hidden: !can('licenses.revoke') || !['active', 'pending'].includes(l.status), onClick: () => setAction('suspend') },
          { label: 'Reinstate', hidden: !can('licenses.revoke') || l.status !== 'suspended', onClick: () => setAction('reinstate') },
          { label: 'Transfer to another account', hidden: !can('licenses.transfer') || !live || l.subject_type !== 'user', onClick: () => setAction('transfer') },
          { label: 'Reset experience binding', hidden: !can('licenses.transfer') || !live, onClick: () => setAction('reset') },
          { label: 'Replace key', hidden: !(can('licenses.create') && can('licenses.revoke')) || !live, onClick: () => setAction('rotate') },
          { label: '', divider: true, onClick: () => undefined },
          { label: 'Revoke', danger: true, hidden: !can('licenses.revoke') || l.status === 'revoked', onClick: () => setAction('revoke') },
          { label: 'Delete', danger: true, hidden: !can('licenses.revoke'), onClick: () => setAction('delete') },
        ]}
      />
      {action === 'revoke' && (
        <ConfirmModal title="Revoke license?" danger confirmLabel="Revoke license" askReason={true}
          body={<>New activations stop immediately. Running servers lose authorization at their next heartbeat (within the session lease). <strong>Revocation is permanent.</strong></>}
          onConfirm={async (reason) => { onDone(await api.revokeLicense(store.id, l.id, reason)); toast.success('License revoked'); }}
          onClose={() => setAction(null)} />
      )}
      {action === 'suspend' && (
        <ConfirmModal title="Suspend license?" confirmLabel="Suspend" askReason body="The license stops authorizing until you reinstate it. Running sessions end."
          onConfirm={async (reason) => { onDone(await api.suspendLicense(store.id, l.id, reason)); toast.success('License suspended'); }} onClose={() => setAction(null)} />
      )}
      {action === 'reinstate' && (
        <ConfirmModal title="Reinstate license?" confirmLabel="Reinstate" body="The license will authorize again."
          onConfirm={async () => { onDone(await api.reinstateLicense(store.id, l.id)); toast.success('License reinstated'); }} onClose={() => setAction(null)} />
      )}
      {action === 'reset' && (
        <ConfirmModal title="Reset experience binding?" confirmLabel="Reset binding" body="Clears the experience lock and ends every live session. The next verified activation re-binds the license (if the product binds on first use)."
          onConfirm={async () => { onDone(await api.resetBinding(store.id, l.id)); toast.success('Binding reset'); }} onClose={() => setAction(null)} />
      )}
      {action === 'rotate' && (
        <ConfirmModal title="Replace license key?" confirmLabel="Generate new key" body="The current key stops working immediately and running sessions end. The customer must update their Roblox Secret with the new key."
          onConfirm={async () => { const r = await api.rotateLicense(store.id, l.id); setIssued(r); onDone(r); }} onClose={() => setAction(null)} />
      )}
      {action === 'delete' && (
        <ConfirmModal title="Delete license?" danger confirmLabel="Delete license" askReason requireText="DELETE"
          body="The license is revoked and removed from lists. Its history remains in the audit log."
          onConfirm={async (reason) => { await api.deleteLicense(store.id, l.id, reason); toast.success('License deleted'); onDeleted ? onDeleted() : onDone(); }} onClose={() => setAction(null)} />
      )}
      {action === 'transfer' && (
        <ConfirmModal title="Transfer license" confirmLabel="Transfer license" askReason
          body={
            <div className="stack">
              <span>Move this license from Roblox user <strong>{l.roblox_username ?? l.roblox_user_id}</strong> to another account. The old binding is invalidated, live sessions end, and the new owner must activate again.</span>
              <Field label="New Roblox user ID"><input className="input" inputMode="numeric" value={newOwner} onChange={(e) => setNewOwner(e.target.value.replace(/\D/g, ''))} autoFocus /></Field>
              <span className="faint small">Transfers used: {l.transfer_count}</span>
            </div>
          }
          onConfirm={async (reason) => { if (!newOwner) throw new Error('Enter the new Roblox user ID.'); onDone(await api.transferLicense(store.id, l.id, newOwner, reason)); toast.success('License transferred'); setNewOwner(''); }}
          onClose={() => setAction(null)} />
      )}
      {issued && <IssuedKeyModal license={issued} title="New key generated" onClose={() => setIssued(null)} />}
    </>
  );
}

export function LicensesList() {
  const { store, can } = useStore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [gen, setGen] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounced(q);
  const status = (params.get('status') ?? '') as LicenseQuery['status'] | '';
  const productId = params.get('product_id') ?? '';
  const page = Number(params.get('page') ?? 1);
  const sort = (params.get('sort') ?? 'created_at') as NonNullable<LicenseQuery['sort']>;
  const order = (params.get('order') ?? 'desc') as 'asc' | 'desc';
  const products = useAsync(() => api.products(store.id), [store.id]);
  const list = useAsync(
    () => api.licenses(store.id, { q: dq || undefined, status: status || undefined, product_id: productId || undefined, page, page_size: 25, sort, order }),
    [store.id, dq, status, productId, page, sort, order],
  );
  const setParam = (k: string, v: string) => {
    if (v) params.set(k, v);
    else params.delete(k);
    if (k !== 'page') params.delete('page');
    setParams(params, { replace: true });
  };
  const sortBy = (col: string) => {
    if (sort === col) setParam('order', order === 'asc' ? 'desc' : 'asc');
    else { params.set('sort', col); params.set('order', 'desc'); setParams(params, { replace: true }); }
  };
  const SortIcon = ({ col }: { col: string }) => (sort === col ? (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null);

  return (
    <>
      <PageHead
        title="Keys"
        sub="Every license issued by your store. Keys are masked — full keys are only shown when generated."
        actions={can('licenses.create') && <button className="btn primary" onClick={() => setGen(true)}><Plus size={16} />Generate key</button>}
      />
      <div className="panel">
        <div className="toolbar">
          <div className="search-input"><Search size={15} /><input className="input" placeholder="License ID, Roblox user, username, key hint…" value={q} onChange={(e) => { setQ(e.target.value); setParam('q', e.target.value); }} /></div>
          <select className="select compact" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {['active', 'pending', 'suspended', 'revoked', 'expired'].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select className="select compact" value={productId} onChange={(e) => setParam('product_id', e.target.value)} aria-label="Product">
            <option value="">All products</option>
            {(products.data?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {list.loading && <Spinner size={16} />}
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <PageLoader /> : !list.data.items.length ? (
          <Empty icon={<KeyRound size={20} />} title={q || status || productId ? 'No matching keys' : 'No keys yet'} text={q || status || productId ? 'Try a different search or filter.' : 'Generate a key for a customer to let their experience run your product.'} action={can('licenses.create') && !q && !status ? <button className="btn primary" onClick={() => setGen(true)}><Plus size={16} />Generate key</button> : undefined} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>License</th><th>Product</th><th>Roblox customer</th>
                    <th className="sortable" onClick={() => sortBy('status')}>Status <SortIcon col="status" /></th>
                    <th className="sortable" onClick={() => sortBy('created_at')}>Created <SortIcon col="created_at" /></th>
                    <th className="sortable hide-sm" onClick={() => sortBy('last_validated_at')}>Activation / validation <SortIcon col="last_validated_at" /></th>
                    <th className="sortable hide-sm" onClick={() => sortBy('expires_at')}>Expires <SortIcon col="expires_at" /></th>
                    <th className="hide-sm">Xfers</th><th />
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((l) => (
                    <tr key={l.id} className="clickable" onClick={() => nav(`/app/s/${store.id}/licenses/${l.id}`)}>
                      <td><div className="cell-main mono">{l.token_hint}</div><div className="cell-sub mono">{l.id}</div></td>
                      <td>{l.product_name}</td>
                      <td>{l.subject_type === 'group' ? <>Group <span className="mono">{l.roblox_group_id}</span></> : <><div>{l.roblox_username ?? '—'}</div><div className="cell-sub mono">{l.roblox_user_id}</div></>}</td>
                      <td><StatusBadge status={l.status} />{l.active_sessions > 0 && <div className="cell-sub">{l.active_sessions} live</div>}</td>
                      <td className="faint">{fmtDate(l.created_at)}</td>
                      <td className="hide-sm"><div className="small">{l.activated_at ? `Activated ${relTime(l.activated_at)}` : <span className="faint">Never activated</span>}</div><div className="cell-sub">{l.last_validated_at ? `Validated ${relTime(l.last_validated_at)}` : '—'}</div></td>
                      <td className="faint hide-sm">{l.expires_at ? fmtDate(l.expires_at) : 'Never'}</td>
                      <td className="hide-sm">{l.transfer_count}</td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}><LicenseActions license={l} onDone={() => list.reload()} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onPage={(p) => setParam('page', String(p))} />
          </>
        )}
      </div>
      {gen && <GenerateKeyModal onClose={() => setGen(false)} onIssued={() => list.reload()} />}
    </>
  );
}

export function LicenseDetail() {
  const { licenseId } = useParams();
  const { store, can } = useStore();
  const nav = useNavigate();
  const lic = useAsync(() => api.license(store.id, licenseId!), [store.id, licenseId]);
  const hist = useAsync(() => api.licenseHistory(store.id, licenseId!), [store.id, licenseId]);
  const [lookup, setLookup] = useState(false);
  if (lic.error) return <ErrorState error={lic.error} onRetry={lic.reload} />;
  const l = lic.data;
  if (!l) return <PageLoader />;
  return (
    <>
      <PageHead
        crumbs={[{ to: `/app/s/${store.id}/licenses`, label: 'Keys' }, { to: '#', label: l.id }]}
        title={l.product_name ?? 'License'}
        sub={<span className="row wrap"><StatusBadge status={l.status} /><span className="mono">{l.token_hint}</span><span className="faint mono">{l.id}</span></span>}
        actions={<><button className="btn" onClick={() => setLookup(true)}>Verify a key</button><LicenseActions license={l} onDone={() => { lic.reload(); hist.reload(); }} onDeleted={() => nav(`/app/s/${store.id}/licenses`)} /></>}
      />
      <div className="grid g-7-5">
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Key history</span><span className="panel-sub">Immutable — entries can’t be edited or removed</span></div>
          <div className="feed">
            {hist.loading && !hist.data ? <div className="feed-item"><Spinner /></div> : (hist.data?.items ?? []).map((e) => (
              <div key={e.id} className="feed-item">
                <span className={`badge ${EVENT_COLOR[e.type] ?? 'gray'}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
                <div className="feed-main">
                  <div>{eventDetail(e) || <span className="faint">—</span>}</div>
                  <div className="faint small">{e.actor_type === 'runtime' ? 'Roblox server' : e.actor_type === 'bot' ? `Discord · ${e.actor_id}` : e.actor_type === 'user' ? `Dashboard · ${e.actor_id}` : e.actor_type}</div>
                </div>
                <span className="feed-time" title={fmtDate(e.created_at, true)}>{relTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stack">
          <div className="panel panel-pad">
            <dl className="kv">
              <dt>Product</dt><dd><Link to={`/app/s/${store.id}/products/${l.product_id}`} style={{ textDecoration: 'underline' }}>{l.product_name}</Link></dd>
              <dt>{l.subject_type === 'group' ? 'Roblox group' : 'Roblox user'}</dt>
              <dd>{l.subject_type === 'group' ? <span className="mono">{l.roblox_group_id}</span> : <>{l.roblox_username ?? 'Unknown'} <span className="mono faint">{l.roblox_user_id}</span></>}</dd>
              {l.customer_id && can('customers.view') && <><dt>Customer</dt><dd><Link to={`/app/s/${store.id}/customers/${l.customer_id}`} style={{ textDecoration: 'underline' }}>View customer</Link></dd></>}
              <dt>Type</dt><dd>{l.license_type}</dd>
              <dt>Created</dt><dd>{fmtDate(l.created_at, true)}</dd>
              <dt>Expires</dt><dd>{l.expires_at ? fmtDate(l.expires_at, true) : 'Never'}</dd>
              <dt>First activation</dt><dd>{fmtDate(l.activated_at, true)}</dd>
              <dt>Last validation</dt><dd>{fmtDate(l.last_validated_at, true)}</dd>
              <dt>Live servers</dt><dd>{l.active_sessions}</dd>
              <dt>Transfers</dt><dd>{l.transfer_count}</dd>
              <dt>Experience restriction</dt><dd>{l.experience_restriction ?? 'None'}</dd>
              <dt>Bound experience</dt><dd>{l.bound_universe_id ?? 'Not bound'}</dd>
              {l.notes && <><dt>Note</dt><dd>{l.notes}</dd></>}
            </dl>
          </div>
          {l.status === 'revoked' && <Callout kind="danger">This license is revoked. Revocation is permanent; issue a new key if needed.</Callout>}
        </div>
      </div>
      {lookup && <LookupModal onClose={() => setLookup(false)} />}
    </>
  );
}

/** Verify a full key a customer pasted (support workflow). The key is only hashed server-side. */
function LookupModal({ onClose }: { onClose: () => void }) {
  const { store } = useStore();
  const nav = useNavigate();
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Verify a license key" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || token.length < 20} onClick={async () => { setBusy(true); setErr(null); try { const l = await api.lookupLicense(store.id, token.trim()); onClose(); nav(`/app/s/${store.id}/licenses/${l.id}`); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); } }}>Look up</button></>}>
      <div className="stack">
        <Field label="Full license key"><input className="input mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cph_…" autoFocus /></Field>
        {err && <Callout kind="danger">{err === 'License not found.' ? 'No license in this store matches that key.' : err}</Callout>}
      </div>
    </Modal>
  );
}
