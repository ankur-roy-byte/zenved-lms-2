"use client";
import { useState } from "react";
import Shell from "@/components/Shell";
import { query, command } from "@/lib/api";
import { useAsync, Spinner, ErrorNotice, StatusChip, Pager, Modal, toast, fmtDate } from "@/components/ui";
import { errorText } from "@/lib/errors";

/** Admin user management: search/filter, create instructors, enable/disable accounts. */
export default function AdminUsersPage() {
  const [page, setPage] = useState(0);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, error, loading, reload } = useAsync(
    () => query("USERS", {
      filters: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      },
      pagination: { page, size: 20 },
    }), [page, role, status, search]);

  const setUserStatus = async (u, newStatus) => {
    const verb = newStatus === "DISABLED" ? "Disable" : "Activate";
    if (!confirm(`${verb} ${u.name} (${u.email})?`)) return;
    try {
      await command("UPDATE_USER_STATUS", { userId: u.userId, status: newStatus });
      toast(`${u.name} is now ${newStatus}.`);
      reload();
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <Shell role="ADMIN">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Students activate on first Google login; instructors are created here or via assignment.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Create instructor</button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search name or email…" value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchDraft.trim()); setPage(0); } }}
          style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1px solid var(--line)", borderRadius: 10 }} />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(0); }}
          style={{ padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 10 }}>
          <option value="">All roles</option>
          <option value="STUDENT">STUDENT</option>
          <option value="INSTRUCTOR">INSTRUCTOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          style={{ padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 10 }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING_APPROVAL">PENDING (invited)</option>
          <option value="DISABLED">DISABLED</option>
          <option value="DELETION_REQUESTED">DELETION REQUESTED</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(searchDraft.trim()); setPage(0); }}>Search</button>
      </div>

      {loading && <Spinner />}
      <ErrorNotice error={error} onRetry={reload} />

      {data && (
        <>
          <div className="card">
            <table className="data">
              <thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Joined</th><th /></tr></thead>
              <tbody>
                {data.content.map((u) => (
                  <tr key={u.userId}>
                    <td><b>{u.name}</b><br /><span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{u.email}{u.phone ? ` · ${u.phone}` : ""}</span></td>
                    <td style={{ fontSize: 13.5 }}>{u.roles.join(", ")}</td>
                    <td><StatusChip value={u.status} /></td>
                    <td style={{ fontSize: 13.5 }}>{fmtDate(u.createdAt)}</td>
                    <td>
                      {u.status === "DISABLED" ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => setUserStatus(u, "ACTIVE")}>Activate</button>
                      ) : u.status !== "ANONYMIZED" ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                          onClick={() => setUserStatus(u, "DISABLED")}>Disable</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {data.content.length === 0 && (
                  <tr><td colSpan={5} style={{ color: "var(--ink-soft)" }}>No users match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager pageData={data} onPage={setPage} />
        </>
      )}

      <CreateInstructorModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); reload(); }} />
    </Shell>
  );
}

function CreateInstructorModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast("Name and email are required.", "error");
    setBusy(true);
    try {
      await command("CREATE_INSTRUCTOR", {
        name: form.name.trim(), email: form.email.trim(),
        phone: form.phone || null, password: form.password || null,
      });
      toast("Instructor account created.");
      onCreated();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title="Create instructor" onClose={onClose}>
      <div className="field"><label>Full name</label><input value={form.name} onChange={set("name")} /></div>
      <div className="field"><label>Email (their Google account)</label><input value={form.email} onChange={set("email")} /></div>
      <div className="field"><label>Phone (optional)</label><input value={form.phone} onChange={set("phone")} /></div>
      <div className="field"><label>Password (optional — Google sign-in works without one)</label>
        <input type="password" value={form.password} onChange={set("password")} /></div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={create}>
          {busy ? "Creating…" : "Create instructor"}
        </button>
      </div>
    </Modal>
  );
}
