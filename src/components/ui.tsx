import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Info, MoreHorizontal, X, XCircle } from 'lucide-react';
import type { LicenseStatus } from '@cipher/shared';
import { copyText, errorText, initials } from '../lib';

/* ---------------------------------------------------------------- toasts */

interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string }
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-area" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'success' ? <CheckCircle2 size={18} /> : t.kind === 'error' ? <XCircle size={18} /> : <Info size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastCtx);
  return useMemo(
    () => ({
      success: (t: string) => push('success', t),
      error: (e: unknown) => push('error', typeof e === 'string' ? e : errorText(e)),
      info: (t: string) => push('info', t),
    }),
    [push],
  );
}

/* ---------------------------------------------------------------- primitives */

export function Spinner({ size = 18 }: { size?: number }) {
  return <div className="spinner" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="center-page">
      <Spinner size={24} />
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />;
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div className="empty-icon"><AlertTriangle size={20} /></div>
      <h3>Couldn’t load this</h3>
      <p>{errorText(error)}</p>
      {onRetry && <button className="btn sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Avatar({ src, name, size }: { src?: string | null; name?: string | null; size?: 'sm' }) {
  return <span className={`avatar ${size ?? ''}`}>{src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : initials(name)}</span>;
}

const STATUS: Record<string, { cls: string; label: string }> = {
  active: { cls: 'green', label: 'Active' },
  pending: { cls: 'gray', label: 'Pending' },
  suspended: { cls: 'orange', label: 'Suspended' },
  revoked: { cls: 'red', label: 'Revoked' },
  expired: { cls: 'gray', label: 'Expired' },
  draft: { cls: 'gray', label: 'Draft' },
  archived: { cls: 'gray', label: 'Archived' },
  clean: { cls: 'green', label: 'Clean' },
  warning: { cls: 'orange', label: 'Warnings' },
  rejected: { cls: 'red', label: 'Rejected' },
};

export const STATUS_COLORS: Record<LicenseStatus, string> = {
  pending: '#a1a5ad',
  active: '#6cc417',
  suspended: '#e07b0a',
  revoked: '#ef5350',
  expired: '#4b4f5a',
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { cls: 'gray', label: status };
  return <span className={`badge ${s.cls}`}><span className="dot" style={{ background: 'currentColor' }} />{s.label}</span>;
}

export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="delta flat">new</span>;
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return <span className={`delta ${cls}`}>{value > 0 ? '+' : ''}{value} %</span>;
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  const generated = useId();
  // Associate the label with a single native control so it is announced and clickable.
  const control = isValidElement(children) && typeof children.type === 'string' && ['input', 'select', 'textarea'].includes(children.type);
  const id = control ? ((children as ReactElement<{ id?: string }>).props.id ?? generated) : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function CopyField({ value, mask }: { value: string; mask?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy">
      <span>{mask ? value.replace(/./g, '•').slice(0, 32) : value}</span>
      <button
        className="icon-btn"
        type="button"
        aria-label="Copy"
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export function Callout({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  return (
    <div className={`callout ${kind}`}>
      {kind === 'info' ? <Info size={16} /> : <AlertTriangle size={16} />}
      <div>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- menu */

export interface MenuItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean; divider?: boolean }

export function Menu({ items, label = 'More actions', trigger }: { items: MenuItem[]; label?: string; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const dismiss = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);
  // Place the menu in the viewport: fixed positioning escapes clipping containers (tables, panels),
  // and it flips left/right and up/down so it is never cut off.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = ref.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const w = menu.offsetWidth;
    const hgt = menu.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    let left = anchor.right - w;
    if (left < 8) left = anchor.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = anchor.bottom + gap;
    if (top + hgt > vh - 8 && anchor.top - gap - hgt >= 8) top = anchor.top - gap - hgt;
    setPos({ position: 'fixed', left, top, right: 'auto' });
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div className="menu-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      ) : (
        <button className="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <MoreHorizontal size={18} />
        </button>
      )}
      {open &&
        createPortal(
        <div className="menu" role="menu" ref={menuRef} style={pos ?? { position: 'fixed', visibility: 'hidden', left: 0, top: 0, right: 'auto' }}>
          {visible.map((it, idx) =>
            it.divider ? (
              <hr key={idx} />
            ) : (
              <button
                key={idx}
                role="menuitem"
                className={it.danger ? 'danger' : ''}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.icon}
                {it.label}
              </button>
            ),
          )}
        </div>,
          document.body,
        )}
    </div>
  );
}

/* ---------------------------------------------------------------- modal */

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head row between">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for administrative actions. Optionally requires typing a phrase
 * and/or a reason before the action can proceed.
 */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  requireText,
  askReason,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  requireText?: string;
  askReason?: boolean;
  onConfirm: (reason: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = !requireText || text === requireText;
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await onConfirm(reason.trim() || null);
                onClose();
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner size={14} /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="muted">{body}</div>
        {askReason && (
          <Field label="Reason" hint="Recorded in the audit log and license history.">
            <input className="input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Chargeback, policy violation" />
          </Field>
        )}
        {requireText && (
          <Field label={`Type “${requireText}” to confirm`}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </Field>
        )}
        {err && <Callout kind="danger">{err}</Callout>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- pagination & tabs */

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pagination">
      <span>{from}–{to} of {total}</span>
      <div className="row">
        <button className="icon-btn boxed" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button>
        <span className="small">Page {page} of {pages}</span>
        <button className="icon-btn boxed" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; hidden?: boolean }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={`tab ${t.id === value ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
