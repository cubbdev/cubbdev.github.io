import { API_URL } from '../lib';
import { CopyField } from './ui';

/** The exact host Roblox Secrets must allow, e.g. cipher-api.cipherkey.workers.dev */
export const SECRET_DOMAIN = (() => {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL;
  }
})();

/**
 * Step-by-step Roblox Secret instructions with every value ready to copy.
 * Pass `licenseKey` when the viewer may see it; otherwise they're told to paste their own key.
 */
export function SecretSetup({ secretName, licenseKey }: { secretName: string; licenseKey?: string | null }) {
  return (
    <div className="secret-setup">
      <div className="small" style={{ fontWeight: 600 }}>Add your key as a Roblox Secret</div>
      <div className="muted small">Creator Dashboard → your experience → <strong>Secrets</strong> → <strong>Create Secret</strong>, then paste these three values:</div>
      <div className="secret-grid">
        <span className="secret-label">Name</span>
        <CopyField value={secretName} />
        <span className="secret-label">Secret</span>
        {licenseKey ? <CopyField value={licenseKey} mask /> : <span className="muted small">your license key (starts with <code>cph_</code>)</span>}
        <span className="secret-label">Domain</span>
        <CopyField value={SECRET_DOMAIN} />
      </div>
      <div className="faint small">For play-testing in Studio, add the same three values under Game Settings → Security → Secrets.</div>
    </div>
  );
}
