import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Link2, RefreshCw, Store as StoreIcon } from 'lucide-react';
import type { GamePassDTO, ProductDTO } from '@cipher/shared';
import { useStore } from '../context';
import { api, useAsync } from '../lib';
import { Callout, ConfirmModal, CopyField, ErrorState, Field, PageLoader, Spinner, Toggle, useToast } from './ui';

export function RobuxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export function Robux({ value }: { value: number | null | undefined }) {
  return <span className="robux"><RobuxIcon />{value === null || value === undefined ? '—' : value.toLocaleString()}</span>;
}

/** Starts Roblox OAuth for the store and navigates there (top-level, required for the consent screen). */
export async function connectStoreRoblox(storeId: string, redirect: string) {
  const { url } = await api.robloxConnect('store', { storeId, redirect });
  window.location.assign(url);
}

export function SaleTab({ p, onChange }: { p: ProductDTO; onChange: () => void }) {
  const { store, can } = useStore();
  const toast = useToast();
  const rb = useAsync(() => api.storeRoblox(store.id), [store.id]);
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [universe, setUniverse] = useState('');
  const [price, setPrice] = useState('100');
  const [passName, setPassName] = useState(p.name.slice(0, 50));
  const [passes, setPasses] = useState<GamePassDTO[] | null>(null);
  const [passId, setPassId] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const owner = rb.data?.owners.find((o) => o.type === rb.data?.selected?.type && o.id === rb.data?.selected?.id) ?? null;
  useEffect(() => {
    if (owner && !universe && owner.universes[0]) setUniverse(owner.universes[0].id);
  }, [owner, universe]);
  useEffect(() => {
    if (mode !== 'link' || !universe) return;
    setPasses(null);
    api.gamePasses(store.id, universe).then((r) => setPasses(r.items)).catch((e) => { toast.error(e); setPasses([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, universe, store.id]);

  if (rb.error) return <ErrorState error={rb.error} onRetry={rb.reload} />;
  if (!rb.data) return <PageLoader />;
  const data = rb.data;
  const productUrl = `${data.shop_url}/${p.id}`;

  if (!data.configured) return <Callout kind="info">Robux sales are not switched on for this Cipher deployment yet.</Callout>;
  if (!data.connected) {
    return (
      <div className="panel panel-pad stack" style={{ maxWidth: 760 }}>
        <div className="panel-title">Sell {p.name} for Robux</div>
        <p className="muted" style={{ margin: 0 }}>Connect the Roblox account that manages your group. Cipher then creates a game pass for this product, checks Roblox when someone buys it and hands the buyer their key and loader automatically.</p>
        {can('settings.manage') ? (
          <div><button className="btn primary" onClick={() => connectStoreRoblox(store.id, `/app/s/${store.id}/products/${p.id}?tab=sale`).catch(toast.error)}><Link2 size={16} />Connect Roblox</button></div>
        ) : (
          <Callout kind="info">Ask the store owner to connect Roblox on the <Link to={`/app/s/${store.id}/sales`}>Sales</Link> page.</Callout>
        )}
      </div>
    );
  }

  if (p.sale) {
    const sale = p.sale;
    return (
      <div className="grid g-7-5">
        <div className="panel panel-pad stack">
          <div className="row between">
            <div className="panel-title">On sale for <Robux value={sale.price_robux} /></div>
            <span className={`badge ${sale.for_sale ? 'green' : 'gray'}`}>{sale.for_sale ? 'Selling' : 'Paused'}</span>
          </div>
          <dl className="kv">
            <dt>Game pass</dt><dd><a href={sale.purchase_url} target="_blank" rel="noreferrer" className="row" style={{ gap: 6 }}>{sale.gamepass_id}<ExternalLink size={13} /></a></dd>
            <dt>Experience</dt><dd>{owner?.universes.find((u) => u.id === sale.universe_id)?.name ?? sale.universe_id ?? '—'}</dd>
            <dt>You receive</dt><dd><Robux value={sale.price_robux === null ? null : Math.floor(sale.price_robux * 0.7)} /> <span className="faint small">per sale, after Roblox’s 30%</span></dd>
          </dl>
          <Field label="Buyer link" hint="Share this. Buyers sign in with Discord, link Roblox, buy the pass and get their key and loader here.">
            <CopyField value={productUrl} />
          </Field>
          {can('products.edit') && (
            <div className="row wrap">
              <div className="row" style={{ gap: 10 }}>
                <Toggle on={sale.for_sale} label="Selling on Cipher" onChange={async (v) => { try { await api.updateSale(store.id, p.id, { for_sale: v }); toast.success(v ? 'Selling again' : 'Sales paused'); onChange(); } catch (e) { toast.error(e); } }} />
                <span className="small">Selling on Cipher</span>
              </div>
              <button className="btn" onClick={async () => { try { const r = await api.updateSale(store.id, p.id, {}); toast.success(`Price is R$ ${r.price_robux ?? '—'}`); onChange(); } catch (e) { toast.error(e); } }}><RefreshCw size={15} />Refresh price from Roblox</button>
              <button className="btn danger" onClick={() => setConfirmUnlink(true)}>Unlink game pass</button>
            </div>
          )}
        </div>
        <div className="panel panel-pad stack">
          <div className="panel-title">How buyers get it</div>
          <ol className="muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
            <li>They open your buyer link and sign in with Discord.</li>
            <li>They link their Roblox account (so Cipher knows who bought it).</li>
            <li>They click Buy, purchase the game pass on Roblox and come back.</li>
            <li>Cipher sees the purchase, issues a key bound to their Roblox account and gives them the loader.</li>
          </ol>
          <Callout kind="info">To change the price, edit the game pass on Roblox, then press <strong>Refresh price</strong>. Revenue shows on the <Link to={`/app/s/${store.id}/sales`}>Sales</Link> page.</Callout>
          <a className="btn light" href={productUrl} target="_blank" rel="noreferrer"><StoreIcon size={15} />Open the buyer page</a>
        </div>
        {confirmUnlink && (
          <ConfirmModal
            title="Unlink this game pass?"
            body="The product disappears from your store page and open checkouts are cancelled. Keys people already bought keep working. The game pass itself stays on Roblox."
            confirmLabel="Unlink"
            danger
            onConfirm={async () => { await api.removeSale(store.id, p.id); toast.success('Game pass unlinked'); onChange(); }}
            onClose={() => setConfirmUnlink(false)}
          />
        )}
      </div>
    );
  }

  const priceNum = Number(price);
  const ready = universe && (mode === 'create' ? Number.isInteger(priceNum) && priceNum >= 1 && passName.trim() : passId);
  return (
    <div className="panel panel-pad stack" style={{ maxWidth: 820 }}>
      <div className="panel-title">Sell {p.name} for Robux</div>
      <p className="muted" style={{ margin: 0 }}>Selling from <strong>{data.selected?.name ?? 'your Roblox account'}</strong>. Change the group on the <Link to={`/app/s/${store.id}/sales`}>Sales</Link> page.</p>
      {!owner?.universes.length ? (
        <Callout kind="warn">Cipher can’t see any experiences for {data.selected?.name ?? 'this owner'}. Reconnect Roblox and tick the experience you want to sell from on the Roblox consent screen.</Callout>
      ) : (
        <>
          <Field label="Experience" hint="Game passes belong to an experience. Buyers purchase it on that experience’s store page.">
            <select className="select" value={universe} onChange={(e) => setUniverse(e.target.value)}>
              {owner.universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <div className="seg">
            <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Create a new game pass</button>
            <button className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}>Use an existing one</button>
          </div>
          {mode === 'create' ? (
            <div className="form-grid">
              <Field label="Game pass name"><input className="input" maxLength={50} value={passName} onChange={(e) => setPassName(e.target.value)} /></Field>
              <Field label="Price (Robux)" hint={Number.isInteger(priceNum) && priceNum > 0 ? `You receive R$ ${Math.floor(priceNum * 0.7).toLocaleString()} per sale` : 'Whole number, at least 1'}>
                <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
              </Field>
            </div>
          ) : (
            <Field label="Game pass">
              {passes === null ? <div className="row"><Spinner size={14} /><span className="muted small">Loading game passes…</span></div> : !passes.length ? <span className="muted small">No game passes in this experience yet.</span> : (
                <select className="select" value={passId} onChange={(e) => setPassId(e.target.value)}>
                  <option value="">Choose a game pass</option>
                  {passes.map((g) => <option key={g.id} value={g.id} disabled={!!g.linked_product_id}>{g.name} · R$ {g.price_robux ?? '—'}{g.linked_product_id ? ' (already linked)' : ''}</option>)}
                </select>
              )}
            </Field>
          )}
          <div>
            <button className="btn primary" disabled={!ready || busy || !can('products.edit')} onClick={async () => {
              setBusy(true);
              try {
                if (mode === 'create') await api.createGamePassSale(store.id, p.id, universe, priceNum, passName.trim());
                else await api.linkGamePassSale(store.id, p.id, universe, passId);
                toast.success('Your product is on sale');
                onChange();
              } catch (e) {
                toast.error(e);
              } finally {
                setBusy(false);
              }
            }}>{busy ? <Spinner size={14} /> : <RobuxIcon size={16} />}{mode === 'create' ? 'Create game pass and start selling' : 'Link and start selling'}</button>
          </div>
        </>
      )}
    </div>
  );
}
