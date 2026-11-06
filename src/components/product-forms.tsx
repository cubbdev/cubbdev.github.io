import { useRef, useState } from 'react';
import { FileBox, FileCode2, FileArchive, Plus, Trash2, UploadCloud } from 'lucide-react';
import type { OperationField, ProductPolicy, RuntimeOperation, ScriptType } from '@cipher/shared';
import { DESTINATIONS } from '@cipher/shared';
import { fmtBytes } from '../lib';
import { Field, Toggle } from './ui';

/* ---------------------------------------------------------------- multi-file picker */

export const ACCEPTED_FILES = '.rbxmx,.rbxm,.lua,.luau,.zip';
const ACCEPTED_EXT = ['rbxmx', 'rbxm', 'lua', 'luau', 'zip'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface FileRow {
  key: string;
  file: File;
  destination: string;
  scriptType: ScriptType | null;
}

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const isScript = (name: string) => ['lua', 'luau'].includes(ext(name));

/** Same defaults as the API: client scripts → StarterPlayerScripts, modules → ReplicatedStorage, scripts → ServerScriptService, models → ServerStorage. */
export function guessDestination(name: string): string {
  const n = name.toLowerCase();
  if (/\.client\.luau?$/.test(n)) return 'StarterPlayerScripts';
  if (/\.module\.luau?$/.test(n)) return 'ReplicatedStorage';
  if (/\.luau?$/.test(n)) return 'ServerScriptService';
  if (/(gui|ui|hud|screen)/.test(n)) return 'StarterGui';
  if (/(map|model|car|vehicle|build|terrain)/.test(n)) return 'Workspace';
  return 'ServerStorage';
}

export function FilesEditor({ value, onChange, disabled }: { value: FileRow[]; onChange: (rows: FileRow[]) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const rows: FileRow[] = [];
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      if (!ACCEPTED_EXT.includes(ext(f.name))) problems.push(`${f.name}: use .rbxmx, .rbxm, .lua, .luau or .zip`);
      else if (f.size > MAX_FILE_BYTES) problems.push(`${f.name}: larger than 25 MB`);
      else rows.push({ key: `${f.name}-${f.size}-${Math.random()}`, file: f, destination: guessDestination(f.name), scriptType: null });
    }
    setError(problems.length ? problems.join(' · ') : null);
    onChange([...value, ...rows].slice(0, 20));
  };
  const update = (key: string, patch: Partial<FileRow>) => onChange(value.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const total = value.reduce((a, r) => a + r.file.size, 0);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        style={{ padding: value.length ? 18 : 34 }}
        role="button"
        tabIndex={0}
        onClick={() => !disabled && ref.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) add(e.dataTransfer.files); }}
      >
        <input ref={ref} type="file" multiple hidden accept={ACCEPTED_FILES} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        <UploadCloud size={value.length ? 20 : 26} className="faint" />
        <div style={{ fontWeight: 500, marginTop: 6 }}>{value.length ? 'Add more files' : 'Drop your files here, or click to choose'}</div>
        <div className="faint small">Models (.rbxmx, .rbxm), scripts (.lua, .luau) or .zip · up to 20 files, 25 MB each</div>
      </div>
      {error && <div className="small" style={{ color: 'var(--red)' }}>{error}</div>}
      {value.map((r) => (
        <div key={r.key} className="file-row">
          <span className="product-icon" style={{ width: 34, height: 34 }}>
            {isScript(r.file.name) ? <FileCode2 size={16} /> : ext(r.file.name) === 'zip' ? <FileArchive size={16} /> : <FileBox size={16} />}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cell-main" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.file.name}</div>
            <div className="cell-sub">{fmtBytes(r.file.size)}{ext(r.file.name) === 'rbxm' || ext(r.file.name) === 'zip' ? ' · delivered as a separate download' : ''}</div>
          </div>
          <label className="file-field">
            <span className="faint small">Goes in</span>
            <select className="select compact" disabled={disabled} value={r.destination} onChange={(e) => update(r.key, { destination: e.target.value })}>
              {DESTINATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          {!isScript(r.file.name) && <div className="file-field-spacer" aria-hidden="true" />}
          {isScript(r.file.name) && (
            <label className="file-field">
              <span className="faint small">Runs as</span>
              <select className="select compact" disabled={disabled} value={r.scriptType ?? ''} onChange={(e) => update(r.key, { scriptType: (e.target.value || null) as ScriptType | null })}>
                <option value="">Auto</option>
                <option value="Script">Script (server)</option>
                <option value="LocalScript">LocalScript (client)</option>
                <option value="ModuleScript">ModuleScript</option>
              </select>
            </label>
          )}
          <button type="button" className="icon-btn" aria-label={`Remove ${r.file.name}`} disabled={disabled} onClick={() => onChange(value.filter((x) => x.key !== r.key))}><Trash2 size={15} /></button>
        </div>
      ))}
      {value.length > 0 && <div className="faint small">{value.length} file{value.length === 1 ? '' : 's'} · {fmtBytes(total)}{total > 50 * 1024 * 1024 ? ' — over the 50 MB total limit' : ''}</div>}
    </div>
  );
}

export function PolicyEditor({ value, onChange, disabled }: { value: ProductPolicy; onChange: (p: ProductPolicy) => void; disabled?: boolean }) {
  const set = <K extends keyof ProductPolicy>(k: K, v: ProductPolicy[K]) => onChange({ ...value, [k]: v });
  const num = (v: string, min: number) => Math.max(min, Number(v.replace(/\D/g, '') || min));
  return (
    <div className="form-grid">
      <Field label="Group-owned experiences" hint="How licenses apply when a Roblox group owns the experience.">
        <select className="select" disabled={disabled} value={value.group_policy} onChange={(e) => set('group_policy', e.target.value as ProductPolicy['group_policy'])}>
          <option value="owner_match">Allow if the licensed user owns the group</option>
          <option value="group_license">Require a license issued to the group</option>
          <option value="deny">Not allowed</option>
        </select>
      </Field>
      <Field label="Concurrent servers per license" hint="0 = unlimited. Each running server holds one session.">
        <input className="input" disabled={disabled} inputMode="numeric" value={value.max_concurrent_sessions} onChange={(e) => set('max_concurrent_sessions', num(e.target.value, 0))} />
      </Field>
      <Field label="Session lease (seconds)" hint="How long a server stays authorized without renewing. 120–1800.">
        <input className="input" disabled={disabled} inputMode="numeric" value={value.session_lease_seconds} onChange={(e) => set('session_lease_seconds', num(e.target.value, 0))} />
      </Field>
      <Field label="Heartbeat interval (seconds)" hint="Must be at most half the lease. Revocations reach running servers at the next heartbeat.">
        <input className="input" disabled={disabled} inputMode="numeric" value={value.heartbeat_interval_seconds} onChange={(e) => set('heartbeat_interval_seconds', num(e.target.value, 0))} />
      </Field>
      <Field label="Maximum transfers" hint="-1 = unlimited.">
        <input className="input" disabled={disabled} value={value.max_transfers} onChange={(e) => set('max_transfers', Number.isNaN(Number(e.target.value)) ? value.max_transfers : Number(e.target.value))} />
      </Field>
      <Field label="Default license length (days)" hint="Leave empty for perpetual licenses.">
        <input className="input" disabled={disabled} inputMode="numeric" value={value.default_license_days ?? ''} onChange={(e) => set('default_license_days', e.target.value ? num(e.target.value, 1) : null)} />
      </Field>
      <div className="check-row span-2" style={{ cursor: 'default' }}>
        <Toggle on={value.allow_studio} disabled={disabled} label="Allow Studio testing" onChange={(v) => set('allow_studio', v)} />
        <div><div style={{ fontWeight: 500 }}>Allow Roblox Studio testing</div><div className="faint small">Studio sessions cannot be verified by Roblox, so they rely on the reported owner and are marked unverified. Disable to require live servers.</div></div>
      </div>
      <div className="check-row span-2" style={{ cursor: 'default' }}>
        <Toggle on={value.bind_experience_on_first_use} disabled={disabled} label="Bind to first experience" onChange={(v) => set('bind_experience_on_first_use', v)} />
        <div><div style={{ fontWeight: 500 }}>Lock each license to its first experience</div><div className="faint small">After the first verified activation, the license only works in that experience until you reset the binding.</div></div>
      </div>
    </div>
  );
}

const EMPTY_OP: RuntimeOperation = { name: '', description: '', client_callable: false, rate_limit_per_minute: 120, fields: [] };

export function OperationsEditor({ value, onChange, disabled }: { value: RuntimeOperation[]; onChange: (v: RuntimeOperation[]) => void; disabled?: boolean }) {
  const update = (i: number, patch: Partial<RuntimeOperation>) => onChange(value.map((op, idx) => (idx === i ? { ...op, ...patch } : op)));
  const updateField = (i: number, fi: number, patch: Partial<OperationField>) => update(i, { fields: value[i].fields.map((f, idx) => (idx === fi ? { ...f, ...patch } : f)) });
  return (
    <div className="stack">
      {value.map((op, i) => (
        <div key={i} className="panel" style={{ background: 'var(--panel-2)' }}>
          <div className="panel-pad stack" style={{ gap: 12 }}>
            <div className="form-grid">
              <Field label="Operation name" hint="Dotted lowercase, e.g. vehicle.spawn">
                <input className="input mono" disabled={disabled} value={op.name} onChange={(e) => update(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '') })} />
              </Field>
              <Field label="Rate limit (calls / minute / server)">
                <input className="input" disabled={disabled} inputMode="numeric" value={op.rate_limit_per_minute} onChange={(e) => update(i, { rate_limit_per_minute: Math.max(1, Number(e.target.value.replace(/\D/g, '') || 1)) })} />
              </Field>
              <div className="span-2">
                <Field label="Description">
                  <input className="input" disabled={disabled} value={op.description ?? ''} maxLength={300} onChange={(e) => update(i, { description: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="row">
              <Toggle on={op.client_callable} disabled={disabled} label="Client callable" onChange={(v) => update(i, { client_callable: v })} />
              <span className="small">Callable from the public client adapter <span className="faint">(still validated on the server)</span></span>
            </div>
            <div>
              <div className="small" style={{ fontWeight: 500, marginBottom: 8 }}>Payload fields</div>
              {op.fields.map((f, fi) => (
                <div key={fi} className="row wrap" style={{ marginBottom: 8 }}>
                  <input className="input mono" style={{ maxWidth: 180 }} disabled={disabled} placeholder="name" value={f.name} onChange={(e) => updateField(i, fi, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} />
                  <select className="select" style={{ maxWidth: 130 }} disabled={disabled} value={f.type} onChange={(e) => updateField(i, fi, { type: e.target.value as OperationField['type'] })}>
                    <option value="string">string</option><option value="number">number</option><option value="integer">integer</option><option value="boolean">boolean</option>
                  </select>
                  <label className="row small"><input type="checkbox" disabled={disabled} checked={!!f.required} onChange={(e) => updateField(i, fi, { required: e.target.checked })} />required</label>
                  {f.type === 'string' && <input className="input" style={{ maxWidth: 120 }} disabled={disabled} placeholder="max length" inputMode="numeric" value={f.max_length ?? ''} onChange={(e) => updateField(i, fi, { max_length: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : undefined })} />}
                  <button className="icon-btn" disabled={disabled} aria-label="Remove field" onClick={() => update(i, { fields: op.fields.filter((_, x) => x !== fi) })}><Trash2 size={15} /></button>
                </div>
              ))}
              <button className="btn sm" disabled={disabled || op.fields.length >= 32} onClick={() => update(i, { fields: [...op.fields, { name: '', type: 'string', required: true, max_length: 64 }] })}><Plus size={14} />Add field</button>
            </div>
            <div><button className="btn sm danger" disabled={disabled} onClick={() => onChange(value.filter((_, x) => x !== i))}><Trash2 size={14} />Remove operation</button></div>
          </div>
        </div>
      ))}
      <div><button className="btn" disabled={disabled || value.length >= 64} onClick={() => onChange([...value, { ...EMPTY_OP }])}><Plus size={16} />Add operation</button></div>
    </div>
  );
}

export function FileDrop({ file, onFile, accept, label, hint }: { file: File | null; onFile: (f: File | null) => void; accept: string; label: string; hint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`dropzone ${drag ? 'drag' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0] ?? null); }}
    >
      <input ref={ref} type="file" hidden accept={accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <UploadCloud size={26} className="faint" />
      <div style={{ fontWeight: 500, marginTop: 8 }}>{file ? file.name : label}</div>
      <div className="faint small">{file ? fmtBytes(file.size) : hint}</div>
    </div>
  );
}
