import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, ExternalLink, KeyRound, Link2, LogIn, Package, ShieldCheck, ShoppingBag } from 'lucide-react';
import type { PurchaseDTO, RobloxLinkDTO, ShopProductDTO } from '@cipher/shared';
import { DevBanner, Logo, UserMenu } from '../components/layout';
import { Robux, RobuxIcon } from '../components/sale';
import { SecretSetup } from '../components/secret-setup';
import { Callout, Empty, ErrorState, PageLoader, Spinner, useToast } from '../components/ui';
import { useAuth } from '../context';
import { api, errorText, fmtDate, useAsync } from '../lib';

const ROBLOX_ERRORS: Record<string, string> = {
  access_denied: 'You cancelled the Roblox sign-in.',
  invalid_state: 'The Roblox sign-in expired or was opened in a different browser. Try again.',
  roblox_error: 'Roblox could not complete the sign-in. Try again in a minute.',
  expired: 'That Roblox link expired. Try again.',
};

function ShopLayout({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  return (
    <div className="mk" style={{ background: 'var(--bg)' }}>
      <DevBanner />
      <div className="mk-nav" style={{ borderBottom: '1px solid var(--border)', maxWidth: 'none' }}>
        <Link to="/" className="row" style={{ gap: 10 }}><Logo /><span className="brand-name">Cipher</span></Link>
        <div className="row">
          {me && <Link className="btn sm ghost" to="/purchases"><ShoppingBag size={15} />My purchases</Link>}
          {me ? <UserMenu /> : !loading && <Link className="btn sm" to={`/login?redirect=${encodeURIComponent(loc.pathname)}`}><LogIn size={15} />Sign in</Link>}
        </div>
      </div>
      <div className="content" style={{ margin: '0 auto', maxWidth: 1080 }}>{children}</div>
    </div>
  );
}

function ProductThumb({ p, size = 56 }: { p: { icon_url: string | null }; size?: number }) {
  return <span className="product-icon" style={{ width: size, height: size }}>{p.icon_url ? <img src={p.icon_url} alt="" /> : <Package size={size / 2.6} />}</span>;
}

/** Shows Roblox OAuth results passed back on the URL, then cleans the URL. */
function useRobloxReturn(onConnected: () => void) {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const err = params.get('roblox_error');
    if (params.get('roblox') === 'connected') {
      toast.success('Roblox account linked');
      onConnected();
    } else if (err) toast.error(ROBLOX_ERRORS[err] ?? 'Roblox could not be linked.');
    if (params.get('roblox') || err) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

async function linkRoblox(redirect: string) {
  const { url } = await api.robloxConnect('link', { redirect });
  window.location.assign(url);
}

/* ================================================================== storefront */

export function ShopPage() {
  const { slug } = useParams();
  const shop = useAsync(() => api.shop(slug!), [slug]);
  return (
    <ShopLayout>
      {shop.error ? <ErrorState error={shop.error} /> : !shop.data ? <PageLoader /> : (
        <>
          <div className="shop-hero">
            {shop.data.icon_url ? <img className="shop-logo" src={shop.data.icon_url} alt="" /> : <span className="shop-logo"><ShoppingBag size={24} /></span>}
            <div>
              <h1 className="page-title">{shop.data.name}</h1>
              <p className="page-sub">{shop.data.description ?? 'Protected Roblox assets, delivered by Cipher.'}</p>
            </div>
          </div>
          {!shop.data.products.length ? (
            <div className="panel"><Empty icon={<Package size={20} />} title="Nothing for sale yet" text="This store hasn’t put any products on sale. Check back soon." /></div>
          ) : (
            <div className="grid g3">
              {shop.data.products.map((p) => (
                <Link key={p.id} to={`/store/${slug}/${p.id}`} className="card shop-card">
                  <ProductThumb p={p} />
                  <div className="card-title">{p.name}</div>
                  <div className="muted small clamp-2">{p.description ?? 'Protected Roblox asset'}</div>
                  <div className="card-foot"><Robux value={p.price_robux} /><span className="btn sm primary">View</span></div>
                </Link>
              ))}
            </div>
          )}
          {shop.data.support_url && <p className="faint small mt-16">Need help? <a href={shop.data.support_url} target="_blank" rel="noreferrer">Contact the store</a></p>}
        </>
      )}
    </ShopLayout>
  );
}

/* ================================================================== product + checkout */

const POLL_MS = 5000;
const POLL_LIMIT_MS = 20 * 60 * 1000;

export function ShopProductPage() {
  const { slug, productId } = useParams();
  const loc = useLocation();
  const { me, loading: authLoading } = useAuth();
  const toast = useToast();
  const data = useAsync(() => api.shopProduct(slug!, productId!), [slug, productId]);
  const [link, setLink] = useState<RobloxLinkDTO | null>(null);
  const [purchase, setPurchase] = useState<PurchaseDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollStart = useRef(0);

  const loadBuyer = useCallback(async () => {
    if (!me) return;
    const [l, mine] = await Promise.all([api.robloxMe(), api.purchases()]);
    setLink(l);
    const existing = mine.items.find((x) => x.product.id === productId && (x.status === 'completed' || (x.status === 'pending' && x.roblox_user_id === l.roblox_user_id)));
    if (existing) {
      setPurchase(existing);
      pollStart.current = Date.now();
    }
  }, [me, productId]);

  useEffect(() => { loadBuyer().catch(() => undefined); }, [loadBuyer]);
  useRobloxReturn(() => loadBuyer().catch(() => undefined));

  const check = useCallback(async (manual = false) => {
    if (!purchase || purchase.status !== 'pending') return;
    setChecking(true);
    try {
      const r = await api.checkPurchase(purchase.id);
      setPurchase(r);
      if (r.status === 'completed') toast.success('Purchase confirmed — your key is ready');
      else if (manual) toast.error('Roblox doesn’t show the purchase yet. It can take a few seconds after buying.');
    } catch (e) {
      if (manual) toast.error(e);
    } finally {
      setChecking(false);
    }
  }, [purchase, toast]);

  // Poll Roblox while a checkout is open; also check as soon as the buyer comes back to this tab.
  useEffect(() => {
    if (purchase?.status !== 'pending') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - pollStart.current < POLL_LIMIT_MS) void check();
    }, POLL_MS);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [purchase?.status, check]);

  async function buy(p: ShopProductDTO) {
    // Open Roblox right away (inside the click) so popup blockers allow it.
    window.open(p.purchase_url, '_blank', 'noopener');
    setBusy(true);
    try {
      const r = await api.startPurchase(slug!, p.id);
      setPurchase(r);
      pollStart.current = Date.now();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  if (data.error) return <ShopLayout><ErrorState error={data.error} /></ShopLayout>;
  if (!data.data) return <ShopLayout><PageLoader /></ShopLayout>;
  const p = data.data.product;
  const here = loc.pathname;

  let action: ReactNode;
  if (purchase?.status === 'completed') action = <Delivered purchase={purchase} />;
  else if (authLoading) action = <Spinner />;
  else if (!me) {
    action = (
      <div className="stack">
        <Link className="btn primary lg" to={`/login?redirect=${encodeURIComponent(here)}`}><LogIn size={18} />Sign in with Discord to buy</Link>
        <span className="faint small">Your key and download stay in your Cipher account.</span>
      </div>
    );
  } else if (!link) action = <Spinner />;
  else if (!link.configured) action = <Callout kind="info">Robux checkout isn’t available right now.</Callout>;
  else if (!link.linked) {
    action = (
      <div className="stack">
        <button className="btn primary lg" onClick={() => linkRoblox(here).catch(toast.error)}><Link2 size={18} />Link your Roblox account</button>
        <span className="faint small">Cipher needs to know which Roblox account buys the game pass. Your key will be tied to that account.</span>
      </div>
    );
  } else if (purchase?.status === 'pending') {
    action = (
      <div className="stack">
        <div className="waiting">
          <Spinner size={18} />
          <div>
            <div style={{ fontWeight: 600 }}>Waiting for your purchase on Roblox…</div>
            <div className="muted small">Buy the game pass as <strong>{link.roblox_username}</strong>, then come back here. Cipher checks automatically.</div>
          </div>
        </div>
        <div className="row wrap">
          <a className="btn" href={p.purchase_url} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open the game pass again</a>
          <button className="btn primary" disabled={checking} onClick={() => check(true)}>{checking ? <Spinner size={14} /> : <CheckCircle2 size={15} />}I bought it — check now</button>
        </div>
      </div>
    );
  } else {
    action = (
      <div className="stack">
        <button className="btn primary lg" disabled={busy || p.price_robux === null} onClick={() => buy(p)}>{busy ? <Spinner size={16} /> : <RobuxIcon size={18} />}Buy for R$ {p.price_robux?.toLocaleString() ?? '—'}</button>
        <span className="faint small">Buying as <strong>{link.roblox_username ?? link.roblox_user_id}</strong> · <button className="linklike" onClick={() => linkRoblox(here).catch(toast.error)}>use a different Roblox account</button></span>
      </div>
    );
  }

  return (
    <ShopLayout>
      <div className="crumbs"><Link to={`/store/${slug}`}>{data.data.store.name}</Link><span>/</span><span>{p.name}</span></div>
      <div className="grid g-7-5 mt-16">
        <div className="panel panel-pad stack">
          <div className="row" style={{ gap: 16 }}>
            <ProductThumb p={p} size={72} />
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>{p.name}</h1>
              <div className="row wrap mt-8"><Robux value={p.price_robux} />{p.advanced_security && <span className="badge green"><ShieldCheck size={12} />Advanced Security</span>}</div>
            </div>
          </div>
          <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.description ?? 'A protected Roblox asset delivered by Cipher.'}</p>
          {action}
        </div>
        <div className="panel panel-pad stack">
          <div className="panel-title">How it works</div>
          <ol className="steps">
            <li className={me ? 'done' : ''}>Sign in with Discord</li>
            <li className={link?.linked ? 'done' : ''}>Link your Roblox account</li>
            <li className={purchase ? 'done' : ''}>Buy the game pass on Roblox</li>
            <li className={purchase?.status === 'completed' ? 'done' : ''}>Get your key and loader here</li>
          </ol>
          <Callout kind="info">Your key is tied to the Roblox account that bought it, and the asset only runs in games that key is licensed for{p.advanced_security ? ' — never inside Roblox Studio' : ''}.</Callout>
        </div>
      </div>
    </ShopLayout>
  );
}

function Delivered({ purchase }: { purchase: PurchaseDTO }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const active = purchase.license_status !== 'revoked' && purchase.license_status !== 'suspended' && purchase.license_status !== 'expired';
  return (
    <div className="stack">
      <Callout kind="info"><strong>You own this.</strong> Bought {fmtDate(purchase.completed_at)} with Roblox account {purchase.roblox_user_id}.</Callout>
      {!active && <Callout kind="danger">This license is {purchase.license_status}. Contact the store for help.</Callout>}
      <SecretSetup secretName={purchase.secret_name} licenseKey={purchase.license_key} />
      <button className="btn primary lg" disabled={busy || !active} onClick={async () => {
        setBusy(true);
        try {
          const d = await api.purchaseDownload(purchase.id);
          window.location.assign(d.url);
        } catch (e) {
          toast.error(errorText(e));
        } finally {
          setBusy(false);
        }
      }}>{busy ? <Spinner size={16} /> : <Download size={18} />}Download loader</button>
      <ol className="muted small" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
        <li>In Studio, drag the downloaded .rbxmx into <strong>ServerScriptService</strong>.</li>
        <li>Game Settings → Security → turn on <strong>Allow HTTP Requests</strong>.</li>
        <li>Add the Roblox Secret above (Name, Secret and Domain).</li>
        <li>Publish. The asset loads itself on live servers.</li>
      </ol>
    </div>
  );
}

/* ================================================================== my purchases */

export function PurchasesPage() {
  const toast = useToast();
  const list = useAsync(() => api.purchases(), []);
  const link = useAsync(() => api.robloxMe(), []);
  useRobloxReturn(() => link.reload());
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ShopLayout>
      <div className="page-head">
        <div>
          <h1 className="page-title">My purchases</h1>
          <p className="page-sub">Everything you bought through Cipher, with your keys and loader downloads.</p>
        </div>
        <div className="page-actions">
          {link.data?.linked ? (
            <span className="row small muted">Roblox: <strong>{link.data.roblox_username}</strong>
              <button className="btn sm ghost" onClick={async () => { try { await api.robloxUnlink(); link.reload(); toast.success('Roblox account unlinked'); } catch (e) { toast.error(e); } }}>Unlink</button>
            </span>
          ) : link.data?.configured ? (
            <button className="btn sm" onClick={() => linkRoblox('/purchases').catch(toast.error)}><Link2 size={14} />Link Roblox</button>
          ) : null}
        </div>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <PageLoader /> : !list.data.items.length ? (
        <div className="panel"><Empty icon={<ShoppingBag size={20} />} title="No purchases yet" text="When you buy a product from a Cipher store, your key and loader appear here." /></div>
      ) : (
        <div className="stack">
          {list.data.items.map((pu) => (
            <div key={pu.id} className="panel panel-pad stack">
              <div className="row between wrap">
                <div className="row" style={{ gap: 14 }}>
                  <ProductThumb p={pu.product} size={44} />
                  <div>
                    <div className="cell-main">{pu.product.name}</div>
                    <div className="faint small">{pu.store.name} · <Robux value={pu.price_robux} /> · {pu.status === 'completed' ? `bought ${fmtDate(pu.completed_at)}` : 'waiting for Roblox purchase'}</div>
                  </div>
                </div>
                <div className="row">
                  {pu.status === 'pending' ? (
                    <Link className="btn sm" to={`/store/${pu.store.slug}/${pu.product.id}`}>Continue checkout</Link>
                  ) : (
                    <button className="btn sm" onClick={() => setOpen(open === pu.id ? null : pu.id)}><KeyRound size={14} />{open === pu.id ? 'Hide' : 'Key & download'}</button>
                  )}
                </div>
              </div>
              {open === pu.id && <Delivered purchase={pu} />}
            </div>
          ))}
        </div>
      )}
    </ShopLayout>
  );
}
