"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { me, command, query } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, StatusChip, Modal, toast, fmtDateTime } from "@/components/ui";
import { errorText } from "@/lib/errors";

/**
 * Account & privacy (any role): profile (ME), full data export
 * (MY_DATA_EXPORT), and the DPDP/GDPR deletion flow
 * (REQUEST_ACCOUNT_DELETION / CANCEL_ACCOUNT_DELETION with grace window).
 */
export default function AccountPage() {
  const { data, error, loading, reload } = useAsync(() => me(), []);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletionInfo, setDeletionInfo] = useState(null);

  const user = data?.user;

  const exportData = async () => {
    setBusy(true);
    try {
      const exportJson = await query("MY_DATA_EXPORT");
      const blob = new Blob([JSON.stringify(exportJson, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `my-lms-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Your data export has been downloaded.");
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = async () => {
    setBusy(true);
    try {
      const result = await command("REQUEST_ACCOUNT_DELETION", reason ? { reason } : {}, { reason: reason || undefined });
      setDeletionInfo(result);
      setDeleteOpen(false);
      toast("Deletion requested — you can cancel during the grace period.");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const cancelDeletion = async () => {
    setBusy(true);
    try {
      await command("CANCEL_ACCOUNT_DELETION", {});
      setDeletionInfo(null);
      toast("Deletion cancelled — your account stays active.");
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1 className="page-title">Account &amp; privacy</h1>
      <p className="page-sub">Your profile, your data, and your right to leave.</p>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {user && (
        <>
          <div className="card" style={{ padding: 24, marginBottom: 20, maxWidth: 640 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>Profile</h2>
            <div className="kv"><span>Name</span><b>{user.name}</b></div>
            <div className="kv"><span>Email</span><b>{user.email}</b></div>
            <div className="kv"><span>Roles</span><b>{(user.roles || []).join(", ")}</b></div>
            <div className="kv"><span>Status</span><b><StatusChip value={user.status} /></b></div>
          </div>

          <div className="card" style={{ padding: 24, marginBottom: 20, maxWidth: 640 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Export my data</h2>
            <p style={{ fontSize: 14.5, color: "var(--ink-soft)", marginBottom: 14 }}>
              Download everything the LMS stores about you — profile, enrollments, video
              progress, quiz attempts (with snapshots), certificates and your audit trail —
              as a single JSON document.
            </p>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={exportData}>
              ⬇ Download my data (JSON)
            </button>
          </div>

          <div className="card" style={{ padding: 24, maxWidth: 640 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Delete my account</h2>
            {user.status === "DELETION_REQUESTED" ? (
              <>
                <div className="notice">
                  Deletion is pending. Your account will be anonymized after the grace period
                  {deletionInfo?.deletionRequestedAt ? <> (requested {fmtDateTime(deletionInfo.deletionRequestedAt)})</> : null}.
                  Issued certificates are retained as immutable credentials.
                </div>
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={cancelDeletion}>
                  Cancel deletion request
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14.5, color: "var(--ink-soft)", marginBottom: 14 }}>
                  Requesting deletion starts a grace window (about a week). You can sign in and
                  cancel any time before it ends; afterwards your personal data is anonymized.
                  Issued certificates are kept as credentials — export your data first.
                </p>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                  disabled={busy} onClick={() => setDeleteOpen(true)}>
                  Request account deletion…
                </button>
              </>
            )}
          </div>
        </>
      )}

      <Modal open={deleteOpen} title="Request account deletion" onClose={() => setDeleteOpen(false)}>
        <p style={{ fontSize: 14.5, color: "var(--ink-soft)", marginBottom: 14 }}>
          Your account will be scheduled for anonymization after the grace period. You can
          cancel from this page while the window is open. Certificates already issued to you
          remain valid and verifiable.
        </p>
        <div className="field">
          <label>Reason (optional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us why you're leaving" />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDeleteOpen(false)}>Keep my account</button>
          <button className="btn btn-primary btn-sm" style={{ background: "var(--danger)" }}
            disabled={busy} onClick={requestDeletion}>
            {busy ? "Requesting…" : "Request deletion"}
          </button>
        </div>
      </Modal>
    </Shell>
  );
}
