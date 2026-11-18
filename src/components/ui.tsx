import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./Icons";

/* ------------------------------------------------------------------ */
/* Toast + confirm provider                                            */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}
interface ConfirmOpts {
  title?: string;
  confirmText?: string;
  danger?: boolean;
}
interface UICtx {
  toast: (msg: string, type?: ToastType, ms?: number) => void;
  confirm: (msg: string, opts?: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<UICtx>({ toast: () => {}, confirm: async () => false });
export const useUI = () => useContext(Ctx);

const toastColor: Record<ToastType, string> = {
  success: "var(--ok)",
  error: "var(--err)",
  info: "var(--head)",
  warning: "var(--warn)",
};

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<{ msg: string; opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(
    null,
  );
  const idRef = useRef(0);

  const toast = useCallback((msg: string, type: ToastType = "info", ms = 3500) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, msg, type }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  const confirm = useCallback(
    (msg: string, opts: ConfirmOpts = {}) =>
      new Promise<boolean>((resolve) => setDialog({ msg, opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="sub-card px-4 py-3 text-[0.82rem] shadow-2xl"
            style={{
              borderLeft: `2px solid ${toastColor[t.type]}`,
              animation: "toastIn .35s cubic-bezier(.2,.7,.2,1) both",
              background: "var(--panel)",
              color: "var(--head)",
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
      {dialog && (
        <Modal title={dialog.opts.title ?? "Confirm"} onClose={() => close(false)} small>
          <p className="mb-6 text-[0.9rem]">{dialog.msg}</p>
          <div className="flex justify-end gap-3">
            <button className="btn btn-sm" onClick={() => close(false)}>
              Cancel
            </button>
            <button
              className={"btn btn-sm " + (dialog.opts.danger ? "btn-danger" : "btn-primary")}
              onClick={() => close(true)}
              autoFocus
            >
              {dialog.opts.confirmText ?? "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  title,
  onClose,
  children,
  small,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  small?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)", animation: "fadeIn .25s ease both" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={
          "card flex max-h-[88vh] w-full flex-col " + (small ? "max-w-md" : "max-w-2xl")
        }
        style={{ animation: "modalIn .35s cubic-bezier(.2,.7,.2,1) both" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--line)" }}>
          <h2 className="display text-[0.8rem]">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Form primitives                                                     */
/* ------------------------------------------------------------------ */

export function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <span className="toggle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="track" />
    </span>
  );
}

export function ToggleRow({
  id,
  label,
  checked,
  onChange,
  children,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="toggle-row">
        <label htmlFor={id}>{label}</label>
        <Toggle id={id} checked={checked} onChange={onChange} />
      </div>
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  note,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {note && <div className="mt-2 text-[0.72rem] leading-relaxed" style={{ color: "var(--muted)" }}>{note}</div>}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
  note,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  disabled?: boolean;
  note?: ReactNode;
}) {
  return (
    <Field label={label} htmlFor={id} note={note}>
      <select id={id} className="select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-2 border-l-2 px-3 py-2 text-[0.74rem] leading-relaxed"
      style={{ borderColor: "var(--warn)", color: "var(--warn)", background: "rgba(251,146,60,.06)" }}
    >
      {children}
    </div>
  );
}
