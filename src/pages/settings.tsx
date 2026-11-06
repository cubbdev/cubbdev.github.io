import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import type { ApiKeyDTO, Permission, PermissionGroupDTO, StoreSettings } from '@cipher/shared';
import { OWNER_ONLY_GRANTS, PERMISSION_INFO, PERMISSIONS, SUGGESTED_GROUPS } from '@cipher/shared';
import { PageHead } from '../components/layout';
import { PolicyEditor } from '../components/product-forms';
import { Avatar, Callout, ConfirmModal, CopyField, Empty, ErrorState, Field, Modal, PageLoader, Spinner, Tabs, Toggle, useToast } from '../components/ui';
import { useAuth, useStore } from '../context';
import { api, API_URL, errorText, fmtDate, relTime, useAsync } from '../lib';

type Tab = 'profile' | 'discord' | 'admins' | 'policies' | 'notifications' | 'api' | 'danger';

export function SettingsPage() {
  const { can, isOwner } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? (can('settings.manage') ? 'profile' : can('admins.manage') ? 'admins' : 'discord');
  return (
    <>
      <PageHead title="Settings" sub="Store profile, Discord server, administrators, policies and integrations." />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => { params.set('tab', t); params.delete('error'); params.delete('relinked'); setParams(params, { replace: true }); }}
        tabs={[
          { id: 'profile', label: 'Store profile', hidden: !can('settings.manage') },
          { id: 'discord', label: 'Discord server' },
          { id: 'admins', label: 'Administrators', hidden: !can('admins.manage') },
          { id: 'policies', label: 'License policies', hidden: !can('settings.manage') },
          { id: 'notifications', label: 'Notifications', hidden: !can('settings.manage') },
          { id: 'api', label: 'API & security', hidden: !can('settings.manage') },
          { id: 'danger', label: 'Danger zone', hidden: !isOwner },
        ]}
      />
      {tab === 'profile' && <Profile />}
      {tab === 'discord' && <DiscordTab />}
      {tab === 'admins' && <Admins />}
      {tab === 'policies' && <Policies />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'api' && <ApiTab />}
      {tab === 'danger' && <Danger />}
    </>
  );
}

function useSaveSettings() {
  const { store, reload } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async save(input: { name?: string; description?: string | null; settings?: Partial<StoreSettings> }) {
      setBusy(true);
      try {
        await api.updateStore(store.id, input);
        toast.success('Settings saved');
        reload();
      } catch (e) {
        toast.error(e);
      } finally {
        setBusy(false);
      }
    },
  };
}

function Profile() {
  const { store } = useStore();
  const { busy, save } = useSaveSettings();
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description ?? '');
  const [support, setSupport] = useState(store.settings.support_url ?? '');
  const [reason, setReason] = useState(store.settings.require_reason_for_revoke);
  return (
    <div className="panel panel-pad stack" style={{ maxWidth: 760 }}>
      <Field label="Store name"><input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Description"><textarea className="textarea" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Customer support URL" hint="Shown to customers whose license is suspended or revoked. Must be https://."><input className="input" value={support} onChange={(e) => setSupport(e.target.value.trim())} placeholder="https://discord.gg/yourstore" /></Field>
      <div className="row"><Toggle on={reason} onChange={setReason} label="Require revoke reason" /><span>Require a reason when revoking licenses</span></div>
      <div><button className="btn primary" disabled={busy} onClick={() => save({ name, description: description || null, settings: { support_url: support || null, require_reason_for_revoke: reason } })}>Save profile</button></div>
    </div>
  );
}

function DiscordTab() {
  const { store, isOwner } = useStore();
  const [params] = useSearchParams();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      {params.get('relinked') && <Callout kind="info">The store is now linked to the new Discord server. Re-assign roles to your permission groups — role assignments from the previous server were cleared.</Callout>}
      {params.get('error') && <Callout kind="danger">Relinking failed ({params.get('error')!.replace(/_/g, ' ')}). Nothing was changed.</Callout>}
      <div className="panel panel-pad row" style={{ gap: 16 }}>
        <Avatar src={store.guild_icon_url} name={store.guild_name ?? store.name} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{store.guild_name ?? 'Discord server'}</div>
          <div className="faint small mono">{store.discord_guild_id}</div>
        </div>
        <span className="badge green">Bot installed</span>
      </div>
      <div className="panel panel-pad">
        <dl className="kv">
          <dt>Store owner</dt><dd>{store.owner.username ?? store.owner.discord_id} <span className="faint mono">{store.owner.discord_id}</span></dd>
          <dt>Verified</dt><dd>Ownership was verified with Discord when the bot was installed.</dd>
        </dl>
      </div>
      {isOwner && (
        <div className="panel panel-pad stack">
          <div className="panel-title">Change linked server</div>
          <p className="muted small" style={{ margin: 0 }}>Move this store to another Discord server you own. You’ll authorize the bot in the new server; ownership is verified again. Role assignments are cleared because roles belong to a server.</p>
          <div><button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { const { url } = await api.relinkIntent(store.id); window.location.assign(url); } catch (e) { toast.error(e); setBusy(false); } }}><RefreshCw size={16} />Link a different server</button></div>
        </div>
      )}
    </div>
  );
}

function GroupModal({ group, onClose, onSaved }: { group: PermissionGroupDTO | null; onClose: () => void; onSaved: () => void }) {
  const { store, isOwner, can } = useStore();
  const roles = useAsync(() => api.discordRoles(store.id), [store.id]);
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(group?.permissions ?? []));
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set(group?.role_ids ?? []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const grantable = (p: Permission) => isOwner || (!OWNER_ONLY_GRANTS.includes(p) && can(p));
  const categories = [...new Set(PERMISSIONS.map((p) => PERMISSION_INFO[p].category))];
  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };
  return (
    <Modal title={group ? `Edit ${group.name}` : 'New permission group'} onClose={onClose} wide footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || name.trim().length < 2} onClick={async () => {
          setBusy(true); setErr(null);
          try {
            const body = { name: name.trim(), description: description.trim() || null, permissions: [...perms], role_ids: [...roleIds] };
            if (group) await api.updatePermissionGroup(store.id, group.id, body); else await api.createPermissionGroup(store.id, body);
            onSaved(); onClose();
          } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
        }}>{busy && <Spinner size={14} />}Save group</button>
      </>
    }>
      <div className="stack">
        <div className="form-grid">
          <Field label="Group name"><input className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><input className="input" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        </div>
        <Field label="Discord roles" hint="Members with any of these roles receive this group's permissions. Checked live against Discord.">
          {roles.loading ? <Spinner /> : roles.error ? <Callout kind="danger">{errorText(roles.error)}</Callout> : (
            <div className="row wrap">
              {roles.data!.items.map((r) => (
                <button type="button" key={r.id} className={`chip ${roleIds.has(r.id) ? 'light' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setRoleIds(toggle(roleIds, r.id))}>
                  <span className="dot" style={{ background: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : 'var(--text-3)' }} />{r.name}
                </button>
              ))}
              {!roles.data!.items.length && <span className="faint small">No assignable roles in your server.</span>}
            </div>
          )}
        </Field>
        {categories.map((cat) => (
          <div key={cat}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>{cat}</div>
            <div className="grid g2" style={{ gap: 8 }}>
              {PERMISSIONS.filter((p) => PERMISSION_INFO[p].category === cat).map((p) => (
                <label key={p} className={`check-row ${perms.has(p) ? 'selected' : ''}`} style={{ opacity: grantable(p) ? 1 : 0.5 }}>
                  <input type="checkbox" disabled={!grantable(p)} checked={perms.has(p)} onChange={() => setPerms(toggle(perms, p))} />
                  <div><div style={{ fontWeight: 500 }}>{PERMISSION_INFO[p].label}</div><div className="faint small">{PERMISSION_INFO[p].description}{OWNER_ONLY_GRANTS.includes(p) ? ' Owner-only grant.' : ''}</div></div>
                </label>
              ))}
            </div>
          </div>
        ))}
        {err && <Callout kind="danger">{err}</Callout>}
      </div>
    </Modal>
  );
}

function Admins() {
  const { store, isOwner, can } = useStore();
  const toast = useToast();
  const groups = useAsync(() => api.permissionGroups(store.id), [store.id]);
  const roles = useAsync(() => api.discordRoles(store.id), [store.id]);
  const [edit, setEdit] = useState<PermissionGroupDTO | null | 'new'>(null);
  const [del, setDel] = useState<PermissionGroupDTO | null>(null);
  const roleName = (id: string) => roles.data?.items.find((r) => r.id === id)?.name ?? id;
  if (groups.error) return <ErrorState error={groups.error} onRetry={groups.reload} />;
  if (!groups.data) return <PageLoader />;
  const existing = new Set(groups.data.items.map((g) => g.name));
  return (
    <div className="stack">
      <Callout kind="info">The store owner always holds every permission. Administrators can only grant permissions they hold themselves, and only the owner can grant <code>admins.manage</code> or <code>settings.manage</code>. Every permission is enforced by the API.</Callout>
      <div className="row between wrap">
        <div className="row wrap">
          {SUGGESTED_GROUPS.filter((s) => !existing.has(s.name) && (isOwner || s.permissions.every((p) => can(p)))).map((s) => (
            <button key={s.name} className="btn sm" onClick={async () => { try { await api.createPermissionGroup(store.id, { ...s, role_ids: [] }); toast.success(`${s.name} added — assign Discord roles to it`); groups.reload(); } catch (e) { toast.error(e); } }}><Plus size={14} />{s.name}</button>
          ))}
        </div>
        <button className="btn primary" onClick={() => setEdit('new')}><Plus size={16} />New group</button>
      </div>
      <div className="panel">
        {!groups.data.items.length ? <Empty icon={<Shield size={20} />} title="No permission groups" text="Create groups such as Support or License Manager and map Discord roles to them." /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Group</th><th>Discord roles</th><th>Permissions</th><th>Updated</th><th /></tr></thead>
              <tbody>
                {groups.data.items.map((g) => (
                  <tr key={g.id}>
                    <td><div className="cell-main">{g.name}</div>{g.description && <div className="cell-sub">{g.description}</div>}</td>
                    <td className="wrap-ok"><div className="row wrap" style={{ gap: 6 }}>{g.role_ids.length ? g.role_ids.map((r) => <span key={r} className="chip">@{roleName(r)}</span>) : <span className="faint small">No roles assigned</span>}</div></td>
                    <td className="small">{g.permissions.length} · <span className="faint">{g.permissions.slice(0, 3).join(', ')}{g.permissions.length > 3 ? '…' : ''}</span></td>
                    <td className="faint">{relTime(g.updated_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn sm" onClick={() => setEdit(g)}>Edit</button>
                        <button className="icon-btn" aria-label="Delete group" onClick={() => setDel(g)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {edit && <GroupModal group={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { groups.reload(); toast.success('Permission group saved'); }} />}
      {del && <ConfirmModal title={`Delete ${del.name}?`} danger confirmLabel="Delete group" body="Members who only had access through this group lose it within a minute." onConfirm={async () => { await api.deletePermissionGroup(store.id, del.id); groups.reload(); }} onClose={() => setDel(null)} />}
    </div>
  );
}

function Policies() {
  const { store } = useStore();
  const { busy, save } = useSaveSettings();
  const [policy, setPolicy] = useState(store.settings.default_policy);
  return (
    <div className="panel panel-pad stack" style={{ maxWidth: 900 }}>
      <Callout kind="info">Defaults applied to new products. Each product can override them on its License policy tab.</Callout>
      <PolicyEditor value={policy} onChange={setPolicy} />
      <div><button className="btn primary" disabled={busy} onClick={() => save({ settings: { default_policy: policy } })}>Save defaults</button></div>
    </div>
  );
}

function Notifications() {
  const { store } = useStore();
  const toast = useToast();
  const { busy, save } = useSaveSettings();
  const channels = useAsync(() => api.discordChannels(store.id), [store.id]);
  const [channel, setChannel] = useState(store.settings.notification_channel_id ?? '');
  const [notify, setNotify] = useState(store.settings.notify_on);
  const [webhook, setWebhook] = useState(store.settings.webhook_url ?? '');
  return (
    <div className="panel panel-pad stack" style={{ maxWidth: 760 }}>
      <Field label="Discord notification channel" hint="The Cipher bot posts provider notifications here.">
        <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Disabled</option>
          {(channels.data?.items ?? []).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>
      </Field>
      {!!channels.error && <Callout kind="warn">{errorText(channels.error)}</Callout>}
      {(['activation', 'revocation', 'transfer', 'security'] as const).map((k) => (
        <div key={k} className="row"><Toggle on={notify[k]} label={k} onChange={(v) => setNotify({ ...notify, [k]: v })} /><span>{{ activation: 'First activation of a license', revocation: 'Revocations and deletions', transfer: 'License transfers', security: 'Security events (medium severity and above)' }[k]}</span></div>
      ))}
      <Field label="Outbound webhook (optional)" hint="Cipher POSTs JSON events signed with Ed25519 (x-cipher-signature over `timestamp.nonce.body`). Verify with the public key on the API & security tab.">
        <input className="input mono" value={webhook} onChange={(e) => setWebhook(e.target.value.trim())} placeholder="https://yourstore.dev/hooks/cipher" />
      </Field>
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={() => save({ settings: { notification_channel_id: channel || null, notify_on: notify, webhook_url: webhook || null } })}>Save notifications</button>
        <button className="btn" onClick={async () => { try { await api.testNotification(store.id); toast.success('Test notification sent'); } catch (e) { toast.error(e); } }}>Send test</button>
      </div>
    </div>
  );
}

function ApiTab() {
  const { store, can, isOwner } = useStore();
  const toast = useToast();
  const keys = useAsync(() => api.apiKeys(store.id), [store.id]);
  const pk = useAsync(() => fetch(`${API_URL}/v1/runtime/public-key`).then((r) => r.json() as Promise<{ key_id: string; jwk: JsonWebKey }>), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(['licenses.view', 'licenses.create']));
  const [created, setCreated] = useState<(ApiKeyDTO & { key: string }) | null>(null);
  const [revoke, setRevoke] = useState<ApiKeyDTO | null>(null);
  const allowed = PERMISSIONS.filter((p) => !OWNER_ONLY_GRANTS.includes(p) && (isOwner || can(p)));
  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-head">
          <div><div className="panel-title">Store API keys</div><div className="panel-sub">Automate license issuance from your shop (e.g. after a purchase). Send as <code>Authorization: Bearer cphk_…</code>.</div></div>
          <button className="btn primary" onClick={() => setCreating(true)}><Plus size={16} />New API key</button>
        </div>
        {keys.error ? <ErrorState error={keys.error} /> : !keys.data ? <PageLoader /> : !keys.data.items.length ? <div className="panel-pad faint">No API keys.</div> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Prefix</th><th>Permissions</th><th>Last used</th><th>Status</th><th /></tr></thead>
            <tbody>
              {keys.data.items.map((k) => (
                <tr key={k.id}>
                  <td className="cell-main">{k.name}</td>
                  <td className="mono">{k.prefix}…</td>
                  <td className="small wrap-ok">{k.permissions.join(', ')}</td>
                  <td className="faint">{relTime(k.last_used_at)}</td>
                  <td>{k.revoked_at ? <span className="badge red">Revoked {fmtDate(k.revoked_at)}</span> : <span className="badge green">Active</span>}</td>
                  <td style={{ textAlign: 'right' }}>{!k.revoked_at && <button className="btn sm danger" onClick={() => setRevoke(k)}>Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel panel-pad stack">
        <div className="panel-title">Cipher signing key</div>
        <p className="muted small" style={{ margin: 0 }}>Runtime grants, provider runtime requests and webhooks are signed with this Ed25519 key. Pin it in your provider runtime.</p>
        {pk.data ? <CopyField value={JSON.stringify(pk.data.jwk)} /> : <Spinner />}
        <div className="faint small">Endpoint: <span className="mono">{API_URL}/v1/runtime/public-key</span></div>
      </div>
      {creating && (
        <Modal title="New API key" onClose={() => setCreating(false)} footer={<><button className="btn ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn primary" disabled={name.trim().length < 2 || !perms.size} onClick={async () => { try { setCreated(await api.createApiKey(store.id, name.trim(), [...perms])); setCreating(false); setName(''); keys.reload(); } catch (e) { toast.error(e); } }}>Create key</button></>}>
          <div className="stack">
            <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shop checkout" /></Field>
            <div className="grid g2" style={{ gap: 8 }}>
              {allowed.map((p) => (
                <label key={p} className={`check-row ${perms.has(p) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={perms.has(p)} onChange={() => { const n = new Set(perms); n.has(p) ? n.delete(p) : n.add(p); setPerms(n); }} />
                  <span className="small">{PERMISSION_INFO[p].label}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {created && (
        <Modal title="API key created" onClose={() => setCreated(null)} footer={<button className="btn primary" onClick={() => setCreated(null)}>Done</button>}>
          <div className="stack"><Callout kind="warn"><strong>Copy this key now.</strong> It won’t be shown again.</Callout><CopyField value={created.key} /></div>
        </Modal>
      )}
      {revoke && <ConfirmModal title={`Revoke ${revoke.name}?`} danger confirmLabel="Revoke key" body="Integrations using this key stop working immediately." onConfirm={async () => { await api.revokeApiKey(store.id, revoke.id); keys.reload(); }} onClose={() => setRevoke(null)} />}
    </div>
  );
}

function Danger() {
  const { store } = useStore();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="panel panel-pad stack" style={{ maxWidth: 760, borderColor: 'rgba(239,83,80,0.35)' }}>
      <div className="panel-title">Delete this store</div>
      <p className="muted" style={{ margin: 0 }}>All licenses are revoked, every running session ends, products are removed and API keys are destroyed. Audit history is retained. This cannot be undone.</p>
      <div><button className="btn danger" onClick={() => setOpen(true)}><Trash2 size={16} />Delete store</button></div>
      {open && <ConfirmModal title="Delete store permanently?" danger confirmLabel="Delete store" requireText={store.name} body={`This deletes ${store.name} and revokes every license it issued.`} onConfirm={async () => { await api.deleteStore(store.id, store.name); await refresh(); nav('/app'); }} onClose={() => setOpen(false)} />}
    </div>
  );
}
