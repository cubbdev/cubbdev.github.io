import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Bot, Plus, ShieldCheck, Store } from 'lucide-react';
import { PageHead, PlainLayout } from '../components/layout';
import { Avatar, Callout, ConfirmModal, Empty, ErrorState, Field, Pagination, PageLoader, Spinner, StatusBadge, useToast } from '../components/ui';
import { useAuth } from '../context';
import { api, errorText, fmtDate, relTime, useAsync } from '../lib';

export function StoreSelect() {
  const { me } = useAuth();
  if (!me) return null;
  if (me.stores.length === 1) return <Navigate to={`/app/s/${me.stores[0].id}/overview`} replace />;
  return (
    <PlainLayout>
      <PageHead title={`Welcome, ${me.user.display_name ?? me.user.username}`} sub="Choose a store to manage, or create a new one for your Discord server." actions={<Link className="btn primary" to="/app/stores/new"><Plus size={16} />Create store</Link>} />
      {me.stores.length === 0 ? (
        <div className="panel">
          <Empty
            icon={<Store size={20} />}
            title="Create your first store"
            text="A store is linked to a Discord server you own. Adding the Cipher bot verifies ownership automatically — it takes about a minute."
            action={<Link className="btn primary" to="/app/stores/new"><Plus size={16} />Create store</Link>}
          />
        </div>
      ) : (
        <div className="grid g3">
          {me.stores.map((s) => (
            <Link key={s.id} to={`/app/s/${s.id}/overview`} className="card">
              <div className="row between">
                <Avatar src={s.guild_icon_url} name={s.name} />
                <span className={`badge ${s.role === 'owner' ? 'blue' : 'gray'}`}>{s.role === 'owner' ? 'Owner' : 'Administrator'}</span>
              </div>
              <div className="card-title">{s.name}</div>
              <div className="faint small">{s.guild_name ?? 'Discord server'}</div>
              <div className="card-foot"><span>{s.permissions.length} permissions</span>{s.status === 'suspended' && <StatusBadge status="suspended" />}</div>
            </Link>
          ))}
        </div>
      )}
    </PlainLayout>
  );
}

const INSTALL_ERRORS: Record<string, string> = {
  not_guild_owner: 'Only the owner of a Discord server can create a store for it. Ask the server owner to sign in to Cipher and add the bot.',
  bot_not_in_guild: 'The Cipher bot is not in that server. Make sure you completed the “Authorize” step for the server you selected.',
  guild_already_linked: 'That Discord server is already linked to a Cipher store.',
  account_mismatch: 'The Discord account that authorized the bot is different from the one signed in to Cipher.',
  invalid_state: 'The installation link expired or was opened in a different browser. Start again.',
  intent_expired: 'The installation link expired. Start again.',
  access_denied: 'The bot installation was cancelled in Discord.',
  no_guild_selected: 'No Discord server was selected.',
  discord_unavailable: 'Discord is temporarily unavailable. Please try again in a few minutes.',
  discord_error: 'Discord could not complete the installation. Please try again.',
};

export function CreateStore() {
  const [params] = useSearchParams();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const err = params.get('error');
  async function start() {
    setBusy(true);
    try {
      const { url } = await api.installIntent(name.trim());
      window.location.assign(url);
    } catch (e) {
      toast.error(e);
      setBusy(false);
    }
  }
  return (
    <PlainLayout>
      <PageHead title="Create a store" sub="Link Cipher to a Discord server you own. Ownership is verified automatically with Discord." crumbs={[{ to: '/app', label: 'Stores' }, { to: '/app/stores/new', label: 'New' }]} />
      <div className="grid g-7-5">
        <div className="panel panel-pad stack">
          {err && <Callout kind="danger">{INSTALL_ERRORS[err] ?? 'Store creation failed. Please try again.'}</Callout>}
          <Field label="Store name" hint="Shown to your customers on the redemption page and in Discord.">
            <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nova Vehicle Systems" />
          </Field>
          <div>
            <button className="btn primary lg" disabled={busy || name.trim().length < 2} onClick={start}>
              {busy ? <Spinner size={16} /> : <Bot size={18} />}Add Cipher Bot
            </button>
          </div>
          <p className="faint small" style={{ margin: 0 }}>You’ll be sent to Discord to choose your server and authorize the bot, then returned here.</p>
        </div>
        <div className="panel panel-pad">
          <div className="panel-title" style={{ marginBottom: 12 }}>What happens next</div>
          {[
            'Discord asks you to pick a server and approve the Cipher bot.',
            'Cipher confirms the bot joined and that you are the server owner.',
            'Your store is created and linked to that server.',
            'Upload a product and issue your first key.',
          ].map((t, i) => (
            <div key={t} className="row" style={{ alignItems: 'flex-start', padding: '8px 0' }}>
              <span className="badge blue" style={{ minWidth: 26, justifyContent: 'center' }}>{i + 1}</span>
              <span className="muted">{t}</span>
            </div>
          ))}
          <div className="mt-16"><Callout kind="info">The bot requests only View Channels, Send Messages and Embed Links, plus slash commands.</Callout></div>
        </div>
      </div>
    </PlainLayout>
  );
}

export function Account() {
  const { me } = useAuth();
  const sessions = useAsync(() => api.sessions(), []);
  const toast = useToast();
  if (!me) return null;
  return (
    <PlainLayout>
      <PageHead title="Account" sub="Your Cipher identity comes from Discord." crumbs={[{ to: '/app', label: 'Stores' }, { to: '/app/account', label: 'Account' }]} />
      <div className="stack">
        <div className="panel panel-pad row" style={{ gap: 16 }}>
          <Avatar src={me.user.avatar_url} name={me.user.username} />
          <div>
            <div style={{ fontWeight: 600 }}>{me.user.display_name ?? me.user.username}</div>
            <div className="faint small">@{me.user.username} · Discord ID {me.user.discord_id} · joined {fmtDate(me.user.created_at)}</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><div className="panel-title">Active sessions</div></div>
          {sessions.loading ? <div className="panel-pad"><Spinner /></div> : sessions.error ? <ErrorState error={sessions.error} onRetry={sessions.reload} /> : (
            <table className="table">
              <thead><tr><th>Device</th><th>Signed in</th><th>Expires</th><th /></tr></thead>
              <tbody>
                {sessions.data!.items.map((s) => (
                  <tr key={s.id}>
                    <td><div className="cell-main">{s.user_agent?.slice(0, 70) || 'Unknown device'}</div>{s.current && <span className="badge blue">This browser</span>}</td>
                    <td>{relTime(s.created_at)}</td>
                    <td>{fmtDate(s.expires_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!s.current && (
                        <button className="btn sm danger" onClick={async () => {
                          try { await api.revokeSession(s.id); toast.success('Session signed out'); sessions.reload(); } catch (e) { toast.error(e); }
                        }}>Sign out</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PlainLayout>
  );
}

export function Admin() {
  const { me } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const stats = useAsync(() => api.adminStats(), []);
  const stores = useAsync(() => api.adminStores({ q, page }), [q, page]);
  const sec = useAsync(() => api.adminSecurityEvents({ page: 1 }), []);
  const [target, setTarget] = useState<{ id: string; name: string; status: string } | null>(null);
  const toast = useToast();
  if (!me?.user.is_platform_admin) return <Navigate to="/app" replace />;
  return (
    <PlainLayout>
      <PageHead title="Platform administration" sub="Incident response only. Administrators cannot see license keys, product files or store customer data." />
      {stats.data && (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          {Object.entries(stats.data).map(([k, v]) => (
            <div key={k} className="panel panel-pad"><div className="faint small">{k.replace(/_/g, ' ')}</div><div style={{ fontSize: 26, fontWeight: 500 }}>{v}</div></div>
          ))}
        </div>
      )}
      <div className="panel">
        <div className="toolbar"><input className="input" style={{ maxWidth: 320, height: 34 }} placeholder="Search stores, IDs, Discord IDs" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {stores.loading && !stores.data ? <PageLoader /> : stores.error ? <ErrorState error={stores.error} /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Store</th><th>Owner</th><th>Products</th><th>Licenses</th><th>Status</th><th>Created</th><th /></tr></thead>
                <tbody>
                  {stores.data!.items.map((s) => (
                    <tr key={s.id}>
                      <td><div className="cell-main">{s.name}</div><div className="cell-sub mono">{s.id}</div></td>
                      <td className="mono">{s.owner_discord_id}</td>
                      <td>{s.product_count}</td>
                      <td>{s.license_count}</td>
                      <td><StatusBadge status={s.status} /></td>
                      <td>{fmtDate(s.created_at)}</td>
                      <td style={{ textAlign: 'right' }}><button className={`btn sm ${s.status === 'active' ? 'danger' : ''}`} onClick={() => setTarget(s)}>{s.status === 'active' ? 'Suspend' : 'Restore'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={50} total={stores.data!.total} onPage={setPage} />
          </>
        )}
      </div>
      <div className="panel mt-16">
        <div className="panel-head"><div className="panel-title"><ShieldCheck size={16} /> Platform security events</div></div>
        <div className="feed">
          {(sec.data?.items ?? []).slice(0, 15).map((e) => (
            <div key={e.id} className="feed-item"><span className={`badge ${e.severity === 'high' || e.severity === 'critical' ? 'red' : e.severity === 'medium' ? 'orange' : 'gray'}`}>{e.severity}</span><div className="feed-main mono">{e.type}</div><span className="feed-time">{relTime(e.created_at)}</span></div>
          ))}
        </div>
      </div>
      {target && (
        <ConfirmModal
          title={target.status === 'active' ? `Suspend ${target.name}?` : `Restore ${target.name}?`}
          body={target.status === 'active' ? 'All runtime sessions end immediately and the store becomes read-only for its team.' : 'The store and its licenses resume normal operation.'}
          confirmLabel={target.status === 'active' ? 'Suspend store' : 'Restore store'}
          danger={target.status === 'active'}
          askReason
          onConfirm={async (reason) => {
            if (!reason || reason.length < 5) throw new Error('Enter a reason of at least 5 characters.');
            await api.adminSetStoreStatus(target.id, target.status === 'active' ? 'suspended' : 'active', reason);
            toast.success('Store updated');
            stores.reload();
          }}
          onClose={() => setTarget(null)}
        />
      )}
      {!!stats.error && <Callout kind="danger">{errorText(stats.error)}</Callout>}
    </PlainLayout>
  );
}
