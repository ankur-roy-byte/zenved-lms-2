"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "@/lib/errors";

/** Data-loading hook: const {data, error, loading, reload} = useAsync(fn, [deps]) */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; // re-arm after StrictMode's simulated unmount
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => { if (!cancelled && alive.current) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (!cancelled && alive.current) setState({ data: null, error, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function Spinner({ label = "Loading…" }) {
  return <div className="loading-row"><span className="spin" aria-hidden />{label}</div>;
}

export function ErrorNotice({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="notice notice-error" role="alert">
      {errorText(error)}
      {onRetry && (
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 10 }} onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p style={{ color: "var(--ink-soft)", padding: "18px 4px" }}>{children}</p>;
}

/** Modal dialog. Renders nothing when closed. */
export function Modal({ open, title, onClose, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={"card modal" + (wide ? " modal-wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Pagination controls for the backend's {content,page,size,totalElements,totalPages} shape. */
export function Pager({ pageData, onPage }) {
  if (!pageData || pageData.totalPages <= 1) return null;
  const { page, totalPages, totalElements } = pageData;
  return (
    <div className="pager">
      <button className="btn btn-ghost btn-sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>← Prev</button>
      <span>Page {page + 1} of {totalPages} · {totalElements} total</span>
      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

const STATUS_STYLES = {
  // course
  DRAFT: "chip-gray", IN_REVIEW: "chip-amber", PUBLISHED: "chip-green",
  UNPUBLISHED: "chip-gray", ARCHIVED: "chip-gray",
  // enrollment
  ACTIVE: "chip-green", UNENROLLED: "chip-gray", EXPIRED: "chip-amber",
  // user
  DISABLED: "chip-gray", PENDING_APPROVAL: "chip-amber",
  DELETION_REQUESTED: "chip-amber", ANONYMIZED: "chip-gray",
  // video
  PENDING_UPLOAD: "chip-amber", READY: "chip-green", FAILED: "chip-gray",
  // misc
  FREE: "chip-green", PAID: "chip-amber",
};

export function StatusChip({ value }) {
  if (!value) return null;
  return <span className={"chip " + (STATUS_STYLES[value] || "chip-gray")}>{String(value).replace(/_/g, " ")}</span>;
}

/** Tiny toast — call toast("message") from anywhere client-side. */
export function toast(message, kind = "info") {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.className = "toast " + (kind === "error" ? "toast-error" : "toast-ok");
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3600);
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export function fmtDuration(totalSeconds) {
  if (totalSeconds == null) return "";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
