import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Fingerprint, KeyRound, Lock, Server, ShieldCheck, Terminal, Users } from 'lucide-react';
import type { RedeemResultDTO } from '@cipher/shared';
import { Logo } from '../components/layout';
import { SecretSetup } from '../components/secret-setup';
import { Callout, CopyField, Field, Spinner, StatusBadge, useToast } from '../components/ui';
import { useAuth } from '../context';
import { api, API_URL, errorText, fmtDate } from '../lib';

function DiscordGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7ZM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}

function MarketingNav() {
  const { me } = useAuth();
  return (
    <nav className="mk-nav">
      <Link to="/" className="row" style={{ gap: 10 }}>
        <Logo />
        <span className="brand-name">Cipher</span>
      </Link>
      <div className="row" style={{ gap: 6 }}>
        <Link className="btn ghost hide-sm" to="/docs">Docs</Link>
        <Link className="btn ghost hide-sm" to="/redeem">Redeem a key</Link>
        {me ? <Link className="btn primary" to="/app">Dashboard</Link> : <><Link className="btn ghost" to="/login">Log in</Link><Link className="btn primary" to="/login">Get started</Link></>}
      </div>
    </nav>
  );
}

const FLOW = [
  { t: '[CIPHER] Initializing product...', c: '#a3a7b1' },
  { t: '[CIPHER] Connecting to licensing service...', c: '#a3a7b1' },
  { t: '[CIPHER] Verifying authorization...', c: '#a3a7b1' },
  { t: '[CIPHER] License authorized.', c: '#6cc417' },
  { t: '[CIPHER] Product initialized successfully.', c: '#f1f2f4' },
];

export function Landing() {
  return (
    <div className="mk">
      <MarketingNav />
      <section className="mk-hero">
        <div>
          <span className="mk-eyebrow"><span className="badge blue" style={{ padding: '0 7px' }}>New</span>Licensing for Roblox asset stores</span>
          <h1>Sell Roblox assets.<br /><em>Keep them yours.</em></h1>
          <p className="mk-lead">
            Cipher issues licenses, binds them to verified Roblox accounts, distributes your products privately and runs your
            proprietary logic on protected infrastructure — managed from one dashboard or straight from Discord.
          </p>
          <div className="row wrap">
            <Link className="btn primary lg" to="/login">Start protecting assets <ArrowRight size={18} /></Link>
            <Link className="btn lg" to="/docs">How it works</Link>
          </div>
        </div>
        <div className="mk-window">
          <div className="mk-window-bar"><i /><i /><i /><span className="faint small" style={{ marginLeft: 8 }}>ServerScriptService · Output</span></div>
          <div style={{ padding: 22, fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 2 }}>
            <div className="faint">-- CIPHER · THE ASSET PROTECTION TOOL</div>
            <div className="faint">-- Product ID: prod_Vx82kQm1Lr7tN0aZ</div>
            <div style={{ height: 10 }} />
            {FLOW.map((l) => <div key={l.t} style={{ color: l.c }}>{l.t}</div>)}
            <div style={{ height: 14 }} />
            <div className="row" style={{ gap: 8, fontFamily: 'var(--font)' }}>
              <span className="chip light"><span className="chip-date">session</span>lease 300s · heartbeat 60s</span>
              <span className="chip"><Fingerprint size={14} />Roblox-Id verified</span>
            </div>
          </div>
        </div>
      </section>
      <section className="mk-section">
        <h2>Built for how asset stores actually work</h2>
        <p className="muted" style={{ margin: '0 0 28px' }}>Self-service from the first login. No tickets, no manual approvals.</p>
        <div className="grid g3">
          {[
            { i: <Lock size={18} />, t: 'Strict private (coming soon)', d: 'Secret logic that never enters the game. Experiences call predefined, validated operations and only ever receive results. Under development.' },
            { i: <Fingerprint size={18} />, t: 'Account-locked licenses', d: 'Keys are bound to a Roblox account. Experience ownership is resolved from the place ID Roblox attaches to each request — never from script-reported values.' },
            { i: <KeyRound size={18} />, t: '256-bit keys, hashed at rest', d: 'Credentials are shown once and stored only as SHA-256 hashes. Rotate, revoke, transfer or reset a binding in a click.' },
            { i: <Server size={18} />, t: 'Short-lived sessions', d: 'Servers hold leases that renew by heartbeat. Revocations take effect immediately for new servers and at the next renewal for running ones.' },
            { i: <Users size={18} />, t: 'Discord-native teams', d: 'Your store is your Discord server. Map roles to permissions, and let staff manage keys with slash commands.' },
            { i: <ShieldCheck size={18} />, t: 'Audit everything', d: 'Immutable license history, a store audit log and automatic security events for wrong-account, replay and abuse attempts.' },
          ].map((f) => (
            <div key={f.t} className="panel mk-feature">
              <div className="mk-icon">{f.i}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mk-section">
        <div className="panel panel-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {['Sign in with Discord', 'Add the Cipher bot to your server', 'Upload your first product', 'Issue a key and send the loader'].map((s, i) => (
            <div key={s}>
              <div className="faint small">Step {i + 1}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{s}</div>
            </div>
          ))}
        </div>
      </section>
      <footer className="mk-foot">
        <span>© {new Date().getFullYear()} Cipher — The Asset Protection Tool</span>
        <span className="row" style={{ gap: 16 }}><Link to="/docs">Documentation</Link><Link to="/redeem">Redeem a key</Link><Link to="/login">Log in</Link></span>
      </footer>
    </div>
  );
}

const LOGIN_ERRORS: Record<string, string> = {
  invalid_state: 'Your sign-in link expired or was opened in a different browser. Please try again.',
  access_denied: 'Discord authorization was cancelled.',
  discord_error: 'Discord could not complete the sign-in. Please try again.',
  account_suspended: 'This account is suspended. Contact Cipher support.',
  missing_code: 'Discord did not return an authorization code. Please try again.',
  discord_not_configured: 'Discord sign-in is not configured on this API. Use the development login below.',
};

export function Login() {
  const [params] = useSearchParams();
  const { me, loading } = useAuth();
  const nav = useNavigate();
  const [health, setHealth] = useState<{ discord_adapter: string; environment: string } | null>(null);
  const [devName, setDevName] = useState('developer');
  const redirect = params.get('redirect') ?? '/app';
  const err = params.get('error');
  useEffect(() => {
    if (!loading && me) nav(redirect, { replace: true });
  }, [me, loading, nav, redirect]);
  useEffect(() => {
    fetch(`${API_URL}/v1/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);
  return (
    <div className="mk" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="panel auth-card">
        <Link to="/" className="row" style={{ gap: 10, marginBottom: 26 }}><Logo /><span className="brand-name">Cipher</span></Link>
        <h1 style={{ fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Sign in to Cipher</h1>
        <p className="muted" style={{ margin: '0 0 22px' }}>Cipher uses your Discord account. New here? Signing in creates your account.</p>
        {err && <div style={{ marginBottom: 16 }}><Callout kind="danger">{LOGIN_ERRORS[err] ?? 'Sign-in failed. Please try again.'}</Callout></div>}
        {health?.discord_adapter !== 'dev' && (
          <a className="btn primary lg" style={{ width: '100%', background: '#5865F2', borderColor: '#6b77f5' }} href={api.loginUrl(redirect)}>
            <DiscordGlyph /> Continue with Discord
          </a>
        )}
        {health?.discord_adapter === 'dev' && (
          <div className="stack">
            <Callout kind="warn"><strong>Development login.</strong> This API is running with simulated Discord. This option does not exist in production.</Callout>
            <Field label="Developer username">
              <input className="input" value={devName} onChange={(e) => setDevName(e.target.value)} />
            </Field>
            <a className="btn primary lg" href={api.devLoginUrl(devName, redirect)}>Continue as {devName || 'developer'}</a>
          </div>
        )}
        {!health && <p className="faint small" style={{ marginTop: 14 }}>Checking the Cipher API at {API_URL}…</p>}
        <p className="faint small" style={{ marginTop: 22 }}>We only request your Discord identity and server list. We never see your password.</p>
      </div>
    </div>
  );
}

export function AuthComplete() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const ticket = hash.get('ticket');
    const redirect = hash.get('redirect') ?? '/app';
    // Remove the one-time ticket from the address bar and history immediately.
    window.history.replaceState(null, '', window.location.pathname);
    if (!ticket) {
      setError('Missing sign-in ticket.');
      return;
    }
    api
      .exchangeTicket(ticket)
      .then(async () => {
        await refresh();
        nav(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/app', { replace: true });
      })
      .catch((e) => setError(errorText(e)));
  }, [nav, refresh]);
  return (
    <div className="mk center-page" style={{ minHeight: '100vh' }}>
      {error ? (
        <div className="panel auth-card stack">
          <Callout kind="danger">{error}</Callout>
          <p className="faint small">If you use Safari or block third-party cookies, see the deployment notes on cookie modes.</p>
          <Link className="btn primary" to="/login">Back to sign in</Link>
        </div>
      ) : (
        <div className="row"><Spinner /> <span className="muted">Signing you in…</span></div>
      )}
    </div>
  );
}

export function Redeem() {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResultDTO | null>(null);
  const toast = useToast();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(await api.redeem(token.trim()));
    } catch (err) {
      toast.error(err);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mk">
      <MarketingNav />
      <div className="mk-section" style={{ maxWidth: 760 }}>
        <h2>Redeem your license</h2>
        <p className="muted" style={{ marginTop: 0 }}>Enter the key you received from your asset provider to download your Roblox integration package.</p>
        <form className="panel panel-pad stack" onSubmit={submit}>
          <Field label="License key" hint="Starts with cph_. Your key is sent over HTTPS and never stored by this page.">
            <input className="input mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="cph_…" autoComplete="off" spellCheck={false} />
          </Field>
          <div><button className="btn primary" disabled={busy || token.trim().length < 20}>{busy && <Spinner size={14} />}Look up key</button></div>
        </form>
        {result && (
          <div className="panel mt-16">
            <div className="panel-head">
              <div>
                <div className="panel-title">{result.product.name}</div>
                <div className="panel-sub">by {result.store.name} · v{result.product.version ?? '—'} · {result.product.distribution_type}</div>
              </div>
              <StatusBadge status={result.license.status} />
            </div>
            <div className="panel-pad stack" style={{ borderTop: '1px solid var(--border)' }}>
              <dl className="kv">
                <dt>Licensed to</dt><dd>{result.license.subject_type === 'group' ? `Roblox group ${result.license.roblox_group_id}` : `Roblox user ${result.license.roblox_user_id}`}</dd>
                <dt>Expires</dt><dd>{result.license.expires_at ? fmtDate(result.license.expires_at) : 'Never'}</dd>
              </dl>
              <SecretSetup secretName={result.secret_name} licenseKey={token.trim() || null} />
              {result.downloads.length ? (
                <div className="row wrap">
                  {result.downloads.map((d) => (
                    <a key={d.kind} className={`btn ${d.kind === 'loader' ? 'primary' : ''}`} href={d.url} rel="noreferrer"><Download size={16} />{d.label}</a>
                  ))}
                </div>
              ) : (
                <Callout kind="warn">This license is {result.license.status}. Downloads are unavailable — contact {result.store.name}{result.store.support_url ? <> at <a href={result.store.support_url} style={{ textDecoration: 'underline' }}>{result.store.support_url}</a></> : ''}.</Callout>
              )}
              <Callout kind="info">
                <strong>Install:</strong> insert the loader into ServerScriptService, turn on Allow HTTP Requests (Game Settings → Security), and add the Roblox Secret above. Download links expire after 5 minutes.
              </Callout>
              {result.product.distribution_type === 'SERVER_PROTECTED' && (
                <Callout kind="warn">This product is delivered as server-side files. As the experience owner you can read them — the license controls whether they run.</Callout>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mk center-page" style={{ minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Terminal size={28} className="faint" />
        <h1 style={{ fontSize: 26 }}>Page not found</h1>
        <Link className="btn" to="/">Go home</Link>
      </div>
    </div>
  );
}
