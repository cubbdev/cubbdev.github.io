import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { IssuedLicenseDTO, LicenseEventDTO } from '@cipher/shared';
import { useStore } from '../context';
import { api, errorText, useAsync } from '../lib';
import { Callout, CopyField, Field, Modal, Spinner } from './ui';

/** Issue a license. Product options come from the store; all validation is repeated server-side. */
export function GenerateKeyModal({ onClose, onIssued, productId }: { onClose: () => void; onIssued?: (l: IssuedLicenseDTO) => void; productId?: string }) {
  const { store } = useStore();
  const products = useAsync(() => api.products(store.id), [store.id]);
  const [form, setForm] = useState({
    product_id: productId ?? '',
    subject_type: 'user' as 'user' | 'group',
    roblox_user_id: '',
    roblox_group_id: '',
    license_type: 'perpetual' as 'perpetual' | 'subscription' | 'trial',
    expires_in_days: '',
    experience_restriction: '',
    discord_user_id: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLicenseDTO | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const usable = (products.data?.items ?? []).filter((p) => p.status !== 'archived');
  const selected = usable.find((p) => p.id === form.product_id);

  if (issued) return <IssuedKeyModal license={issued} onClose={onClose} />;

  return (
    <Modal
      title="Generate license key"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={busy || !form.product_id}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const l = await api.createLicense(store.id, {
                  product_id: form.product_id,
                  subject_type: form.subject_type,
                  roblox_user_id: form.roblox_user_id.trim() || null,
                  roblox_group_id: form.subject_type === 'group' ? form.roblox_group_id.trim() || null : null,
                  license_type: form.license_type,
                  expires_in_days: form.expires_in_days ? Number(form.expires_in_days) : null,
                  experience_restriction: form.experience_restriction.trim() || null,
                  discord_user_id: form.discord_user_id.trim() || null,
                  notes: form.notes.trim() || null,
                });
                setIssued(l);
                onIssued?.(l);
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner size={14} />}Generate key
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="span-2">
          <Field label="Product">
            <select className="select" value={form.product_id} onChange={(e) => set('product_id', e.target.value)}>
              <option value="">{products.loading ? 'Loading products…' : 'Select a product'}</option>
              {usable.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.distribution_type}{p.status === 'draft' ? ' (draft)' : ''}</option>)}
            </select>
          </Field>
        </div>
        {selected?.policy.group_policy === 'group_license' && (
          <Field label="Licensed to">
            <select className="select" value={form.subject_type} onChange={(e) => set('subject_type', e.target.value)}>
              <option value="user">Roblox user</option>
              <option value="group">Roblox group</option>
            </select>
          </Field>
        )}
        {form.subject_type === 'group' && (
          <Field label="Roblox group ID">
            <input className="input" inputMode="numeric" value={form.roblox_group_id} onChange={(e) => set('roblox_group_id', e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        <Field label={form.subject_type === 'group' ? 'Purchaser Roblox user ID (optional)' : 'Roblox user ID'} hint="The license only authorizes experiences owned by this account.">
          <input className="input" inputMode="numeric" value={form.roblox_user_id} onChange={(e) => set('roblox_user_id', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 261" />
        </Field>
        <Field label="License type">
          <select className="select" value={form.license_type} onChange={(e) => set('license_type', e.target.value)}>
            <option value="perpetual">Perpetual</option>
            <option value="subscription">Subscription</option>
            <option value="trial">Trial</option>
          </select>
        </Field>
        <Field label="Expires after (days)" hint={form.license_type === 'perpetual' ? `Leave empty for no expiry${selected?.policy.default_license_days ? ` (product default: ${selected.policy.default_license_days} days)` : ''}.` : 'Required for subscriptions; trials default to 7 days.'}>
          <input className="input" inputMode="numeric" value={form.expires_in_days} onChange={(e) => set('expires_in_days', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Restrict to experience (optional)" hint="Universe ID. Leave empty to allow any experience owned by the licensee.">
          <input className="input" inputMode="numeric" value={form.experience_restriction} onChange={(e) => set('experience_restriction', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Customer Discord ID (optional)">
          <input className="input" inputMode="numeric" value={form.discord_user_id} onChange={(e) => set('discord_user_id', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <div className="span-2">
          <Field label="Internal note (optional)">
            <input className="input" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Order #, marketplace, etc." />
          </Field>
        </div>
        {err && <div className="span-2"><Callout kind="danger">{err}</Callout></div>}
      </div>
    </Modal>
  );
}

export function IssuedKeyModal({ license, onClose, title = 'License key generated' }: { license: IssuedLicenseDTO; onClose: () => void; title?: string }) {
  const { store } = useStore();
  const redeemUrl = `${window.location.origin}/redeem`;
  const message = `Thanks for your purchase of ${license.product_name}!\n\nLicense key: ${license.token}\n\n1. Download your loader at ${redeemUrl}\n2. Insert it into ServerScriptService and enable HTTP requests\n3. Add a Roblox Secret named as shown on the redemption page with your key as the value`;
  return (
    <Modal title={title} onClose={onClose} wide footer={<><Link className="btn" to={`/app/s/${store.id}/licenses/${license.id}`} onClick={onClose}>View license</Link><button className="btn primary" onClick={onClose}>Done</button></>}>
      <div className="stack">
        <Callout kind="warn"><strong>Copy this key now.</strong> Cipher stores only a hash of it and cannot show it again. You can replace it later from the license page.</Callout>
        <Field label="License key"><CopyField value={license.token} /></Field>
        <Field label="Message for your customer" hint="Send it privately (DM or order email).">
          <CopyField value={message} />
        </Field>
        <dl className="kv">
          <dt>Product</dt><dd>{license.product_name}</dd>
          <dt>Licensed to</dt><dd>{license.subject_type === 'group' ? `Group ${license.roblox_group_id}` : `${license.roblox_username ?? 'Roblox user'} (${license.roblox_user_id})`}</dd>
          <dt>License ID</dt><dd className="mono">{license.id}</dd>
        </dl>
      </div>
    </Modal>
  );
}

export const EVENT_LABEL: Record<string, string> = {
  created: 'Key created',
  activated: 'Activated',
  activation_failed: 'Failed activation',
  validated: 'Validated',
  revoked: 'Revoked',
  suspended: 'Suspended',
  reinstated: 'Reinstated',
  transferred: 'Transferred',
  binding_reset: 'Binding reset',
  expired: 'Expired',
  session_terminated: 'Session ended',
  credential_rotated: 'Key replaced',
  deleted: 'Deleted',
};

export const EVENT_COLOR: Record<string, string> = {
  created: 'gray',
  activated: 'green',
  validated: 'green',
  activation_failed: 'red',
  revoked: 'red',
  deleted: 'red',
  suspended: 'orange',
  reinstated: 'blue',
  transferred: 'blue',
  binding_reset: 'blue',
  credential_rotated: 'blue',
  expired: 'gray',
  session_terminated: 'gray',
};

export function eventDetail(e: LicenseEventDTO): string {
  const d = e.details as Record<string, string | number | boolean | null>;
  if (e.type === 'activation_failed') return `Denied: ${String(d.code ?? 'unknown').replace(/_/g, ' ')}${d.place_id ? ` · place ${d.place_id}` : ''}`;
  if (e.type === 'activated' || e.type === 'validated') return d.universe_id ? `Experience ${d.universe_id}${d.verified === false ? ' · Studio (unverified)' : ''}` : String(d.action ?? '').replace(/_/g, ' ');
  if (e.type === 'transferred') return `${d.from_roblox_user_id} → ${d.to_roblox_user_id}`;
  if (e.type === 'session_terminated') return `${d.sessions ?? 1} session(s) · ${String(d.reason ?? '').replace(/_/g, ' ')}`;
  if (d.reason) return String(d.reason);
  return '';
}
