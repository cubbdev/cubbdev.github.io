import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/layout';
import { Callout } from '../components/ui';

const SECTIONS = ['Getting started', 'Protection types', 'Roblox integration', 'Discord commands', 'Provider runtime', 'REST API'] as const;
type Section = (typeof SECTIONS)[number];

const COMMANDS: [string, string][] = [
  ['/newkey', 'Generate a license (product, Roblox user, type, expiry, experience restriction). Replies privately with the key.'],
  ['/deletekey', 'Revoke and delete a license after an explicit confirmation button.'],
  ['/revoke', 'Revoke a license immediately.'],
  ['/transferkey', 'Move a license to another Roblox account (with confirmation).'],
  ['/resetkey', 'Clear a license’s experience binding and end its sessions.'],
  ['/keyinfo · /keyhistory', 'License details and immutable history.'],
  ['/licensecheck', 'Look up a license from the full key a customer sends you.'],
  ['/userinfo · /customer', 'Verified Roblox identity, purchases, licenses, activity and security events.'],
  ['/suspenduser · /restoreuser', 'Suspend or restore every license a customer holds.'],
  ['/products · /productinfo · /productstats', 'Product catalogue and statistics.'],
  ['/createproduct', 'Create a draft product (files are uploaded on the dashboard).'],
  ['/storeinfo · /storeadmins · /permissions', 'Store details, permission groups and your own permissions.'],
  ['/auditlogs · /stats · /activations · /securityevents', 'Audit log, statistics and recent activity.'],
];

export function Docs() {
  const [s, setS] = useState<Section>('Getting started');
  return (
    <div className="mk">
      <nav className="mk-nav"><Link to="/" className="row" style={{ gap: 10 }}><Logo /><span className="brand-name">Cipher</span><span className="faint">Docs</span></Link><Link className="btn primary" to="/app">Dashboard</Link></nav>
      <div className="mk-section" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: 32, paddingTop: 16 }}>
        <div className="stack" style={{ gap: 2 }}>
          {SECTIONS.map((x) => <button key={x} className={`nav-item ${x === s ? 'active' : ''}`} style={{ border: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => setS(x)}>{x}</button>)}
        </div>
        <article className="panel panel-pad stack" style={{ lineHeight: 1.75, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{s}</h2>
          {s === 'Getting started' && (
            <ol className="muted" style={{ paddingLeft: 18 }}>
              <li><strong>Sign in with Discord.</strong> Your account is created automatically.</li>
              <li><strong>Create a store</strong> and add the Cipher bot to a server you own. Cipher verifies with Discord that you are the owner.</li>
              <li><strong>Upload a product.</strong> Choose a name, icon, description and files, and pick where each file goes. Cipher generates the product ID, loader, version and integration guide.</li>
              <li><strong>Generate a key</strong> for the buyer’s Roblox account — from the dashboard, <code>/newkey</code> in Discord, or your shop via an API key.</li>
              <li><strong>Send the key.</strong> The customer redeems it at <Link to="/redeem" style={{ textDecoration: 'underline' }}>/redeem</Link>, inserts the loader and stores the key as a Roblox Secret.</li>
              <li><strong>Or sell for Robux.</strong> Connect Roblox on the <strong>Sales</strong> page, open a product’s <strong>Sell for Robux</strong> tab and create a game pass. Buyers use your store page: they sign in with Discord, link Roblox, buy the pass, and Cipher issues their key and loader automatically.</li>
              <li><strong>Manage</strong> revocations, transfers and support from the dashboard or Discord.</li>
            </ol>
          )}
          {s === 'Protection types' && (
            <>
              <h3 style={{ marginBottom: 0 }}>STRICT_PRIVATE <span className="badge orange">Under development</span></h3>
              <p className="muted">The proprietary implementation lives on infrastructure you control (your runtime endpoint). The experience receives a public loader and adapter. When the game needs functionality, the server asks Cipher to run a predefined operation (e.g. <code>vehicle.spawn</code>). Cipher verifies the license session, operation name, payload schema and rate limits, then forwards a signed request to your runtime. Only structured results return to Roblox. Arbitrary code is never accepted or executed.</p>
              <h3 style={{ marginBottom: 0 }}>SERVER_PROTECTED</h3>
              <p className="muted">You upload Roblox models (<code>.rbxmx</code>) and scripts (<code>.lua</code>/<code>.luau</code>) and choose where each goes. Cipher packs them into one loader package — the only thing anyone can ever download. Scripts ship disabled and are placed and enabled only after the license is verified, and removed if it is revoked.</p>
              <h3 style={{ marginBottom: 0 }}>Advanced Security</h3>
              <p className="muted">An optional switch per product. When the game is running in Roblox Studio, the loader destroys itself and every product file from that session before anything is placed, and Cipher refuses Studio activations server-side. The product only runs on live Roblox servers.</p>
              <Callout kind="info">Advanced Security stops the product from <em>running</em> in Studio. The package file itself can still be opened in Studio’s editor by the buyer, so treat it as an anti-testing and anti-leak deterrent, not encryption.</Callout>
              <Callout kind="warn"><strong>Honest disclosure:</strong> the experience owner controls their own place and can read SERVER_PROTECTED files. It deters casual redistribution and enforces licensing at runtime, but it does not make source code inaccessible. STRICT_PRIVATE, for logic that must stay confidential, is under development.</Callout>
              <Callout kind="info">Client-side (LocalScript) code is always visible to players. The generated client adapter is public by design and only handles UI and input.</Callout>
            </>
          )}
          {s === 'Roblox integration' && (
            <>
              <ol className="muted" style={{ paddingLeft: 18 }}>
                <li>Insert the generated <code>Cipher_&lt;Product&gt;.rbxmx</code> into <strong>ServerScriptService</strong>.</li>
                <li>Game Settings → Security → enable <strong>Allow HTTP Requests</strong>.</li>
                <li>Creator Dashboard → Experience → <strong>Secrets</strong>: add <code>cipher_&lt;productId&gt;</code> with the license key as its value and the Cipher API host as its domain. Add the same secret locally in Studio for play-testing.</li>
                <li>Start a server. You should see <code>[CIPHER] License authorized.</code></li>
              </ol>
              <pre className="code-block">{`local Cipher = require(game.ServerScriptService.Cipher_VehicleKit.CipherCore)

if Cipher.WaitForAuthorization(30) then
\tlocal ok, result = Cipher.Invoke("vehicle.spawn", { vehicle_id = "vehicle_01" }, player)
end

Cipher.OnRevoked(function(reason)
\twarn("Licensing ended:", reason)
end)`}</pre>
              <p className="muted">Identity: Roblox attaches a <code>Roblox-Id</code> header (the place ID) to HTTP requests from live servers. Cipher resolves the owning user or group from Roblox’s own APIs and compares it with the license — values reported by scripts are not trusted.</p>
            </>
          )}
          {s === 'Discord commands' && (
            <table className="table"><tbody>{COMMANDS.map(([c, d]) => <tr key={c}><td className="mono" style={{ whiteSpace: 'nowrap' }}>{c}</td><td className="muted">{d}</td></tr>)}</tbody></table>
          )}
          {s === 'Provider runtime' && (
            <>
              <p className="muted">Deploy a small HTTPS service (a Cloudflare Worker works well) that verifies Cipher’s Ed25519 signature and implements your operations. The repository includes <code>@cipher/provider-sdk</code> and a complete example.</p>
              <pre className="code-block">{`import { createRuntimeHandler } from '@cipher/provider-sdk';

export default {
  fetch: createRuntimeHandler({
    publicKey: CIPHER_PUBLIC_JWK,          // GET /v1/runtime/public-key
    productId: 'prod_…',
    operations: {
      'vehicle.spawn': (payload, ctx) => ({ spawned: payload.vehicle_id }),
    },
  }),
};`}</pre>
            </>
          )}
          {s === 'REST API' && (
            <>
              <p className="muted">All endpoints are versioned under <code>/v1</code> and return structured errors <code>{'{ error: { code, message, request_id } }'}</code>. Store API keys (<code>Authorization: Bearer cphk_…</code>) are scoped to one store and a subset of permissions.</p>
              <pre className="code-block">{`POST /v1/stores/{storeId}/licenses
Authorization: Bearer cphk_…
Content-Type: application/json

{ "product_id": "prod_…", "roblox_user_id": "261", "license_type": "perpetual" }`}</pre>
              <p className="muted">The complete endpoint reference is in <code>docs/API.md</code> in the repository.</p>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
