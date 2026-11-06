import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Download, FileCode2, ImagePlus, KeyRound, Lock, Package, Plus, Server, Upload } from 'lucide-react';
import type { DistributionType, ProductDTO, ProductPolicy, RuntimeOperation } from '@cipher/shared';
import { DEFAULT_PRODUCT_POLICY } from '@cipher/shared';
import { PageHead } from '../components/layout';
import { EVENT_COLOR, EVENT_LABEL, eventDetail, GenerateKeyModal } from '../components/keys';
import { FileDrop, OperationsEditor, PolicyEditor } from '../components/product-forms';
import { Callout, ConfirmModal, CopyField, Empty, ErrorState, Field, Menu, PageLoader, Spinner, StatusBadge, Tabs, useToast } from '../components/ui';
import { useStore } from '../context';
import { api, downloadAuthenticated, errorText, fmtBytes, fmtDate, relTime, useAsync, useDebounced } from '../lib';

const ACCEPT = '.rbxm,.rbxmx,.lua,.luau,.zip';

function ProductIcon({ p }: { p: ProductDTO }) {
  return <span className="product-icon">{p.icon_url ? <img src={p.icon_url} alt="" /> : p.distribution_type === 'STRICT_PRIVATE' ? <Lock size={18} /> : <Server size={18} />}</span>;
}

/* ================================================================== list */

export function ProductsList() {
  const { store, can } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDebounced(q);
  const list = useAsync(() => api.products(store.id, { q: dq, status }), [store.id, dq, status]);
  return (
    <>
      <PageHead
        title="Products"
        sub="Your protected Roblox products, their versions and licensing policies."
        actions={can('products.upload') && <Link className="btn primary" to={`/app/s/${store.id}/products/new`}><Plus size={16} />New product</Link>}
      />
      <div className="panel">
        <div className="toolbar">
          <div className="search-input"><Package size={15} /><input className="input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="select compact" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
          </select>
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <PageLoader /> : !list.data!.items.length ? (
          <Empty icon={<Package size={20} />} title={q || status ? 'No matching products' : 'No products yet'} text="Products hold your files, licensing policy and the generated Roblox loader." action={can('products.upload') && !q ? <Link className="btn primary" to={`/app/s/${store.id}/products/new`}><Plus size={16} />New product</Link> : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Product</th><th>Protection</th><th>Version</th><th>Licenses</th><th>Status</th><th>Updated</th><th /></tr></thead>
              <tbody>
                {list.data!.items.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => nav(`/app/s/${store.id}/products/${p.id}`)}>
                    <td><div className="row"><ProductIcon p={p} /><div><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.id}</div></div></div></td>
                    <td><span className={`badge ${p.distribution_type === 'STRICT_PRIVATE' ? 'blue' : 'gray'}`}>{p.distribution_type}</span></td>
                    <td>{p.current_version ? <>v{p.current_version.version} <span className="faint small">{p.current_version.file_size ? fmtBytes(p.current_version.file_size) : ''}</span></> : <span className="faint">—</span>}</td>
                    <td>{p.active_license_count} <span className="faint">/ {p.license_count}</span></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="faint">{relTime(p.updated_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Menu items={[
                        { label: 'Open', onClick: () => nav(`/app/s/${store.id}/products/${p.id}`) },
                        { label: 'Download loader', icon: <Download size={15} />, onClick: () => downloadAuthenticated(api.loaderDownloadUrl(store.id, p.id), 'loader.rbxmx').catch(toast.error) },
                        { label: 'View keys', icon: <KeyRound size={15} />, hidden: !can('licenses.view'), onClick: () => nav(`/app/s/${store.id}/licenses?product_id=${p.id}`) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ================================================================== create wizard */

const STEPS = ['Protection', 'Details', 'Source', 'Licensing', 'Review'];

export function ProductNew() {
  const { store } = useStore();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<DistributionType>('SERVER_PROTECTED');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('1.0.0');
  const [endpoint, setEndpoint] = useState('');
  const [ops, setOps] = useState<RuntimeOperation[]>([]);
  const [policy, setPolicy] = useState<ProductPolicy>(store.settings.default_policy ?? DEFAULT_PRODUCT_POLICY);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const stepValid = [
    true,
    name.trim().length >= 2,
    type === 'SERVER_PROTECTED' ? !!file && /^\d+\.\d+\.\d+/.test(version) : endpoint.startsWith('https://') && ops.length > 0 && ops.every((o) => o.name.length > 0),
    policy.heartbeat_interval_seconds * 2 <= policy.session_lease_seconds && policy.session_lease_seconds >= 120,
    true,
  ];

  async function publish() {
    setBusy(true);
    setErr(null);
    try {
      setProgress('Creating product…');
      const p = await api.createProduct(store.id, {
        name: name.trim(),
        description: description.trim() || null,
        distribution_type: type,
        policy,
        runtime_endpoint: type === 'STRICT_PRIVATE' ? endpoint.trim() : null,
        operations: type === 'STRICT_PRIVATE' ? ops : undefined,
      });
      if (icon) {
        setProgress('Uploading icon…');
        await api.uploadIcon(store.id, p.id, icon).catch(() => undefined);
      }
      if (file) {
        setProgress('Uploading and inspecting file…');
        const v = await api.uploadVersion(store.id, p.id, file, file.name, version, 'Initial release', true);
        if (v.scan_status === 'rejected') {
          nav(`/app/s/${store.id}/products/${p.id}?tab=versions`);
          return;
        }
      } else if (type === 'STRICT_PRIVATE') {
        setProgress('Publishing…');
        await api.uploadVersion(store.id, p.id, null, '', version, 'Initial release', true).catch(() => undefined);
        await api.updateProduct(store.id, p.id, { status: 'active' });
      }
      nav(`/app/s/${store.id}/products/${p.id}?created=1`);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <>
      <PageHead title="New product" sub="Cipher generates the product ID, loader, integration guide and version history automatically." crumbs={[{ to: `/app/s/${store.id}/products`, label: 'Products' }, { to: '#', label: 'New' }]} />
      <div className="steps">
        {STEPS.map((s, i) => (
          <span key={s} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}><span className="num">{i < step ? <Check size={12} /> : i + 1}</span>{s}</span>
        ))}
      </div>
      <div className="panel panel-pad" style={{ maxWidth: 860 }}>
        {step === 0 && (
          <div className="stack">
            <div className="panel-title">How should this product be protected?</div>
            {([
              ['STRICT_PRIVATE', <Lock key="l" size={18} />, 'Strict private', 'Your proprietary logic runs on infrastructure you control. Experiences only receive results of predefined operations — the source never leaves your server. Best for valuable systems.'],
              ['SERVER_PROTECTED', <Server key="s" size={18} />, 'Server protected', 'You upload server-side Roblox files that customers install. Cipher gates them at runtime with the license. The experience owner can read these files — this does not make source inaccessible.'],
            ] as const).map(([v, ic, t, d]) => (
              <label key={v} className={`check-row ${type === v ? 'selected' : ''}`}>
                <input type="radio" name="type" checked={type === v} onChange={() => setType(v)} />
                <div><div className="row" style={{ fontWeight: 600 }}>{ic}{t} <span className="badge mono">{v}</span></div><div className="muted small mt-8">{d}</div></div>
              </label>
            ))}
          </div>
        )}
        {step === 1 && (
          <div className="form-grid">
            <div className="span-2"><Field label="Product name"><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field></div>
            <div className="span-2"><Field label="Description"><textarea className="textarea" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
            <div className="span-2"><Field label="Icon (optional)" hint="PNG, JPEG or WebP up to 1 MB."><FileDrop file={icon} onFile={setIcon} accept="image/png,image/jpeg,image/webp" label="Choose an icon" hint="Shown on the redemption page" /></Field></div>
          </div>
        )}
        {step === 2 && type === 'SERVER_PROTECTED' && (
          <div className="stack">
            <FileDrop file={file} onFile={setFile} accept={ACCEPT} label="Drop your product file here" hint=".rbxmx (recommended), .rbxm, .lua, .luau or .zip · up to 25 MB" />
            <Field label="Version"><input className="input" style={{ maxWidth: 200 }} value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
            <Callout kind="info">Your model should contain a ModuleScript named <code>CipherEntry</code> that returns <code>{'{ start = function(cipher) … end, stop = function(reason) … end }'}</code>. Cipher starts it only after the license is authorized. Files are stored privately and inspected for backdoors before publishing.</Callout>
          </div>
        )}
        {step === 2 && type === 'STRICT_PRIVATE' && (
          <div className="stack">
            <Field label="Runtime endpoint" hint="A public https:// URL you control. Cipher signs every request with Ed25519; verify it with the Provider SDK.">
              <input className="input mono" value={endpoint} onChange={(e) => setEndpoint(e.target.value.trim())} placeholder="https://runtime.yourstore.dev/" />
            </Field>
            <Field label="Version"><input className="input" style={{ maxWidth: 200 }} value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
            <div className="panel-title">Operations</div>
            <p className="muted small" style={{ margin: 0 }}>Experiences can only request these operations, with payloads matching the fields you declare. Anything else is rejected and recorded as a security event.</p>
            <OperationsEditor value={ops} onChange={setOps} />
            <Field label="Public client assets (optional)" hint="Optional public UI package delivered to customers. Never upload proprietary code here — it would be visible to them.">
              <FileDrop file={file} onFile={setFile} accept={ACCEPT} label="Choose a file" hint="Delivered as-is to licensed customers" />
            </Field>
          </div>
        )}
        {step === 3 && <PolicyEditor value={policy} onChange={setPolicy} />}
        {step === 4 && (
          <div className="stack">
            <dl className="kv">
              <dt>Name</dt><dd>{name}</dd>
              <dt>Protection</dt><dd>{type}</dd>
              <dt>Version</dt><dd>{version}</dd>
              {type === 'SERVER_PROTECTED' && <><dt>File</dt><dd>{file?.name} ({file ? fmtBytes(file.size) : ''})</dd></>}
              {type === 'STRICT_PRIVATE' && <><dt>Runtime</dt><dd className="mono">{endpoint}</dd><dt>Operations</dt><dd>{ops.map((o) => o.name).join(', ')}</dd></>}
              <dt>Studio testing</dt><dd>{policy.allow_studio ? 'Allowed' : 'Blocked'}</dd>
              <dt>Groups</dt><dd>{policy.group_policy.replace('_', ' ')}</dd>
            </dl>
            {err && <Callout kind="danger">{err}</Callout>}
          </div>
        )}
        <div className="row between mt-24">
          <button className="btn ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>Back</button>
          {step < STEPS.length - 1 ? (
            <button className="btn primary" disabled={!stepValid[step]} onClick={() => setStep((s) => s + 1)}>Continue</button>
          ) : (
            <button className="btn primary" disabled={busy} onClick={publish}>{busy ? <><Spinner size={14} />{progress}</> : <><Upload size={16} />Publish product</>}</button>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================== detail */

type Tab = 'overview' | 'versions' | 'licensing' | 'runtime' | 'integration' | 'activity';

export function ProductDetail() {
  const { productId } = useParams();
  const { store, can } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'overview');
  const product = useAsync(() => api.product(store.id, productId!), [store.id, productId]);
  const [gen, setGen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p = product.data;
  if (product.error) return <ErrorState error={product.error} onRetry={product.reload} />;
  if (!p) return <PageLoader />;
  return (
    <>
      {params.get('created') && <div style={{ marginBottom: 16 }}><Callout kind="info"><strong>{p.name} is {p.status === 'active' ? 'live' : 'saved as a draft'}.</strong> Download the loader or generate a key for your first customer.</Callout></div>}
      <PageHead
        crumbs={[{ to: `/app/s/${store.id}/products`, label: 'Products' }, { to: '#', label: p.name }]}
        title={p.name}
        sub={<span className="row wrap"><StatusBadge status={p.status} /><span className={`badge ${p.distribution_type === 'STRICT_PRIVATE' ? 'blue' : 'gray'}`}>{p.distribution_type}</span><span className="mono faint">{p.id}</span></span>}
        actions={
          <>
            <button className="btn light" onClick={() => downloadAuthenticated(api.loaderDownloadUrl(store.id, p.id), 'loader.rbxmx').catch(toast.error)}><Download size={16} />Download loader</button>
            {can('licenses.create') && <button className="btn primary" onClick={() => setGen(true)}><KeyRound size={16} />Generate key</button>}
            <Menu items={[
              { label: p.status === 'archived' ? 'Restore to active' : 'Archive product', hidden: !can('products.edit'), onClick: async () => { try { await api.updateProduct(store.id, p.id, { status: p.status === 'archived' ? 'active' : 'archived' }); product.reload(); toast.success('Product updated'); } catch (e) { toast.error(e); } } },
              { label: 'Delete product', danger: true, hidden: !can('products.delete'), onClick: () => setConfirmDelete(true) },
            ]} />
          </>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'versions', label: 'Versions' },
          { id: 'licensing', label: 'License policy' },
          { id: 'runtime', label: 'Runtime operations', hidden: p.distribution_type !== 'STRICT_PRIVATE' },
          { id: 'integration', label: 'Integration' },
          { id: 'activity', label: 'Activity' },
        ]}
      />
      {tab === 'overview' && <ProductOverview p={p} onChange={product.reload} />}
      {tab === 'versions' && <Versions p={p} onChange={product.reload} />}
      {tab === 'licensing' && <PolicyTab p={p} onChange={(np) => product.setData(np)} />}
      {tab === 'runtime' && <RuntimeTab p={p} onChange={(np) => product.setData(np)} />}
      {tab === 'integration' && <Integration p={p} />}
      {tab === 'activity' && <ProductActivity p={p} />}
      {gen && <GenerateKeyModal productId={p.id} onClose={() => setGen(false)} onIssued={() => product.reload()} />}
      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${p.name}?`}
          body="The product is removed, all running sessions end and existing licenses stop authorizing. License history is preserved."
          confirmLabel="Delete product"
          danger
          requireText={p.name}
          onConfirm={async () => { await api.deleteProduct(store.id, p.id); toast.success('Product deleted'); nav(`/app/s/${store.id}/products`); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}

function ProductOverview({ p, onChange }: { p: ProductDTO; onChange: () => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description ?? '');
  const [busy, setBusy] = useState(false);
  const stats = useAsync(() => (can('analytics.view') ? api.productStats(store.id, p.id) : Promise.resolve(null)), [p.id]);
  return (
    <div className="grid g-7-5">
      <div className="panel panel-pad stack">
        <div className="panel-title">Details</div>
        <Field label="Name"><input className="input" disabled={!can('products.edit')} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><textarea className="textarea" disabled={!can('products.edit')} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {can('products.edit') && (
          <div className="row">
            <button className="btn primary" disabled={busy || name.trim().length < 2} onClick={async () => { setBusy(true); try { await api.updateProduct(store.id, p.id, { name: name.trim(), description: description.trim() || null }); toast.success('Saved'); onChange(); } catch (e) { toast.error(e); } finally { setBusy(false); } }}>Save changes</button>
            <label className="btn"><ImagePlus size={16} />Change icon<input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await api.uploadIcon(store.id, p.id, f); toast.success('Icon updated'); onChange(); } catch (err) { toast.error(err); } }} /></label>
          </div>
        )}
        {p.status === 'draft' && <Callout kind="warn">This product is a draft. {p.distribution_type === 'SERVER_PROTECTED' ? 'Publish a version to activate it.' : 'Configure the runtime endpoint and operations, then activate it.'} Keys can be issued now and will work once it is active.</Callout>}
      </div>
      <div className="panel panel-pad">
        <div className="panel-title" style={{ marginBottom: 14 }}>Licenses</div>
        {stats.data ? (
          <dl className="kv">
            {['active', 'pending', 'suspended', 'revoked', 'expired'].map((k) => <Fragment key={k}><dt>{k[0].toUpperCase() + k.slice(1)}</dt><dd>{stats.data!.by_status[k] ?? 0}</dd></Fragment>)}
            <dt>Live servers</dt><dd>{stats.data.live_sessions}</dd>
            <dt>Activations (14d)</dt><dd>{stats.data.activations_by_day.reduce((a, d) => a + d.activations, 0)}</dd>
          </dl>
        ) : (
          <dl className="kv"><dt>Total</dt><dd>{p.license_count}</dd><dt>Active</dt><dd>{p.active_license_count}</dd></dl>
        )}
        <dl className="kv mt-16">
          <dt>Current version</dt><dd>{p.current_version ? `v${p.current_version.version} · ${fmtDate(p.current_version.published_at)}` : '—'}</dd>
          <dt>Created</dt><dd>{fmtDate(p.created_at)}</dd>
        </dl>
      </div>
    </div>
  );
}

function Versions({ p, onChange }: { p: ProductDTO; onChange: () => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const versions = useAsync(() => api.versions(store.id, p.id), [p.id]);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const cur = p.current_version?.version;
    if (cur && !version) {
      const [a, b, c] = cur.split(/[.-]/).map(Number);
      setVersion(`${a}.${b}.${(c || 0) + 1}`);
    } else if (!cur && !version) setVersion('1.0.0');
  }, [p.current_version, version]);
  return (
    <div className="stack">
      {can('products.upload') && (
        <div className="panel panel-pad stack">
          <div className="panel-title">Publish a new version</div>
          <FileDrop file={file} onFile={setFile} accept={ACCEPT} label={p.distribution_type === 'STRICT_PRIVATE' ? 'Optional public assets' : 'Drop the updated product file'} hint=".rbxmx, .rbxm, .lua, .luau or .zip · up to 25 MB" />
          <div className="form-grid">
            <Field label="Version"><input className="input" value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
            <Field label="Changelog"><input className="input" value={changelog} maxLength={2000} onChange={(e) => setChangelog(e.target.value)} /></Field>
          </div>
          <div>
            <button className="btn primary" disabled={busy || !version || (p.distribution_type === 'SERVER_PROTECTED' && !file)} onClick={async () => {
              setBusy(true);
              try {
                const v = await api.uploadVersion(store.id, p.id, file, file?.name ?? '', version, changelog || undefined, true);
                if (v.scan_status === 'rejected') toast.error('This file failed security inspection and was not published. See the findings below.');
                else toast.success(`Version ${v.version} published`);
                setFile(null); setChangelog(''); setVersion('');
                versions.reload(); onChange();
              } catch (e) { toast.error(e); } finally { setBusy(false); }
            }}>{busy ? <Spinner size={14} /> : <Upload size={16} />}Upload & publish</button>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Upload history</span></div>
        {versions.loading && !versions.data ? <PageLoader /> : versions.error ? <ErrorState error={versions.error} /> : !versions.data!.items.length ? <Empty icon={<FileCode2 size={20} />} title="No versions yet" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Version</th><th>File</th><th>Inspection</th><th>Uploaded</th><th>Published</th><th /></tr></thead>
              <tbody>
                {versions.data!.items.map((v) => (
                  <tr key={v.id}>
                    <td className="wrap-ok"><div className="cell-main">v{v.version}{p.current_version?.id === v.id && <span className="badge blue" style={{ marginLeft: 8 }}>current</span>}</div>{v.changelog && <div className="cell-sub">{v.changelog}</div>}</td>
                    <td>{v.file_name ? <><div>{v.file_name}</div><div className="cell-sub mono" title={v.sha256}>{fmtBytes(v.file_size)} · sha256 {v.sha256.slice(0, 12)}…</div></> : <span className="faint">No file</span>}</td>
                    <td className="wrap-ok"><StatusBadge status={v.scan_status} />{v.scan_findings.filter((f) => f.severity !== 'info').slice(0, 3).map((f, i) => <div key={i} className="cell-sub" style={{ color: f.severity === 'critical' ? 'var(--red)' : undefined }}>{f.message}{f.location ? ` (${f.location})` : ''}</div>)}</td>
                    <td className="faint">{fmtDate(v.created_at, true)}</td>
                    <td className="faint">{v.published_at ? fmtDate(v.published_at) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {can('products.upload') && p.current_version?.id !== v.id && v.scan_status !== 'rejected' && (
                        <button className="btn sm" onClick={async () => { try { await api.publishVersion(store.id, p.id, v.id); toast.success(`v${v.version} is now current`); onChange(); versions.reload(); } catch (e) { toast.error(e); } }}>Make current</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyTab({ p, onChange }: { p: ProductDTO; onChange: (p: ProductDTO) => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const [policy, setPolicy] = useState(p.policy);
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel panel-pad stack" style={{ maxWidth: 900 }}>
      <PolicyEditor value={policy} onChange={setPolicy} disabled={!can('products.edit')} />
      {can('products.edit') && <div><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { onChange(await api.updateProduct(store.id, p.id, { policy })); toast.success('License policy saved'); } catch (e) { toast.error(e); } finally { setBusy(false); } }}>Save policy</button></div>}
    </div>
  );
}

function RuntimeTab({ p, onChange }: { p: ProductDTO; onChange: (p: ProductDTO) => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const [endpoint, setEndpoint] = useState(p.runtime_endpoint ?? '');
  const [ops, setOps] = useState(p.operations);
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack" style={{ maxWidth: 960 }}>
      <Callout kind="info">Cipher forwards only these operations to your endpoint, after verifying the license session, operation name, payload schema and rate limits. Requests are signed with Cipher’s Ed25519 key (<code>GET /v1/runtime/public-key</code>). Use <code>@cipher/provider-sdk</code> to verify them.</Callout>
      <div className="panel panel-pad stack">
        <Field label="Runtime endpoint"><input className="input mono" disabled={!can('products.edit')} value={endpoint} onChange={(e) => setEndpoint(e.target.value.trim())} /></Field>
        <OperationsEditor value={ops} onChange={setOps} disabled={!can('products.edit')} />
        {can('products.edit') && <div><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); try { onChange(await api.updateProduct(store.id, p.id, { runtime_endpoint: endpoint || null, operations: ops })); toast.success('Runtime saved. Customers must re-download the loader for new operations.'); } catch (e) { toast.error(e); } finally { setBusy(false); } }}>Save runtime</button></div>}
      </div>
    </div>
  );
}

function Integration({ p }: { p: ProductDTO }) {
  const { store } = useStore();
  const toast = useToast();
  const doc = useAsync(() => api.integration(store.id, p.id), [p.id]);
  const [file, setFile] = useState(0);
  if (doc.error) return <ErrorState error={doc.error} onRetry={doc.reload} />;
  if (!doc.data) return <PageLoader />;
  return (
    <div className="grid g-7-5">
      <div className="panel">
        <div className="panel-head">
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {doc.data.files.map((f, i) => <button key={f.name} className={`btn sm ${file === i ? '' : 'ghost'}`} onClick={() => setFile(i)}>{f.name}<span className="faint small">{f.class_name}</span></button>)}
          </div>
          <button className="btn sm" onClick={() => downloadAuthenticated(api.loaderDownloadUrl(store.id, p.id), 'loader.rbxmx').catch(toast.error)}><Download size={14} />.rbxmx</button>
        </div>
        <div style={{ padding: '0 16px 16px' }}><pre className="code-block">{doc.data.files[file]?.source}</pre></div>
      </div>
      <div className="panel panel-pad stack">
        <div className="panel-title">Customer setup</div>
        <Field label="Roblox Secret name"><CopyField value={doc.data.secret_name} /></Field>
        <ol className="muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
          <li>Send the customer their key (they download this loader at <code>/redeem</code>).</li>
          <li>They insert the folder into ServerScriptService.</li>
          <li>They enable HTTP requests and create the secret above.</li>
          <li>Servers authorize automatically on start.</li>
        </ol>
        <Callout kind="info">The loader contains no license key, no proprietary source and does not use <code>loadstring</code>.</Callout>
        <details>
          <summary className="small" style={{ cursor: 'pointer' }}>Full integration guide (Markdown)</summary>
          <pre className="code-block mt-8" style={{ whiteSpace: 'pre-wrap' }}>{doc.data.markdown}</pre>
        </details>
      </div>
    </div>
  );
}

function ProductActivity({ p }: { p: ProductDTO }) {
  const { store } = useStore();
  const act = useAsync(() => api.productActivity(store.id, p.id), [p.id]);
  if (act.error) return <ErrorState error={act.error} />;
  if (!act.data) return <PageLoader />;
  return (
    <div className="grid g2">
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Product changes</span></div>
        <div className="feed">
          {act.data.items.map((a) => <div key={a.id} className="feed-item"><div className="feed-main"><div>{a.action.replace('product.', '').replace(/_/g, ' ')}</div><div className="faint small">by {a.actor_name ?? a.actor_type}</div></div><span className="feed-time">{relTime(a.created_at)}</span></div>)}
          {!act.data.items.length && <div className="feed-item faint">No changes recorded.</div>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><span className="panel-title">License events</span></div>
        <div className="feed">
          {act.data.events.map((e) => <div key={e.id} className="feed-item"><span className={`badge ${EVENT_COLOR[e.type]}`}>{EVENT_LABEL[e.type]}</span><div className="feed-main"><div className="mono small">{e.license_id}</div><div className="faint small">{eventDetail(e)}</div></div><span className="feed-time">{relTime(e.created_at)}</span></div>)}
          {!act.data.events.length && <div className="feed-item faint">No license events yet.</div>}
        </div>
      </div>
    </div>
  );
}
