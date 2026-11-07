import { useEffect } from 'react';
import { Spinner } from '../components/ui';
import { API_URL } from '../lib';

/**
 * Roblox OAuth returns here (Roblox won't accept the API's workers.dev host as a redirect URL).
 * Forward the code and state to the API unchanged, as a top-level navigation so the API's
 * browser-binding cookie is sent and the flow can be verified.
 */
export function RobloxCallback() {
  useEffect(() => {
    window.location.replace(`${API_URL}/v1/roblox/oauth/callback${window.location.search}`);
  }, []);
  return (
    <div className="mk center-page" style={{ minHeight: '100vh' }}>
      <div className="row"><Spinner /> <span className="muted">Finishing Roblox sign-in…</span></div>
    </div>
  );
}
