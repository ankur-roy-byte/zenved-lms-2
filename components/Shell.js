"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { me, logout, getCachedUser, getAccessToken, primaryRole, roleHome, onSessionExpired } from "@/lib/api";
import { IS_MOCK } from "@/lib/config";

const NAV = {
  ADMIN: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/courses", label: "Courses" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/enrollments", label: "Enrollments" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/certificates", label: "Certificates" },
    { href: "/admin/audit", label: "Audit log" },
  ],
  INSTRUCTOR: [{ href: "/instructor", label: "My courses" }],
  STUDENT: [{ href: "/student", label: "My learning" }],
};

/**
 * Authenticated frame. `role` is the minimum role for the page
 * (ADMIN | INSTRUCTOR | STUDENT). Session comes from ME — the
 * cached user renders instantly, then the server copy replaces it.
 */
export default function Shell({ role, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    const cached = getCachedUser();
    if (cached) setUser(cached);
    me()
      .then((data) => {
        if (cancelled) return;
        const u = data.user;
        if (role && !(u.roles || []).includes(role)) {
          router.replace(roleHome(u));
          return;
        }
        setUser(u);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    const off = onSessionExpired(() => router.replace("/login"));
    return () => { cancelled = true; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (!user) return null;
  if (role && !(user.roles || []).includes(role)) return null;

  const navRole = role || primaryRole(user);
  const items = NAV[navRole] || [];

  const signOut = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">Zen<span>Ved</span></div>
        {IS_MOCK && <span className="demo-badge" title="Running on seeded demo data — no backend">Demo mode</span>}
        {items.map((n) => (
          <Link key={n.href} href={n.href}
            className={pathname === n.href ? "active" : ""}>
            {n.label}
          </Link>
        ))}
        <Link href="/account" className={pathname === "/account" ? "active" : ""}>Account &amp; privacy</Link>
        <Link href="/verify">Verify a certificate</Link>
        <Link href="/">Public site</Link>
        <div className="spacer" />
        <div className="whoami">
          Signed in as <b style={{ color: "#fff" }}>{user.name}</b>
          <br />
          <span className="chip chip-amber" style={{ marginTop: 6 }}>
            {(user.roles || []).join(" · ") || "—"}
          </span>
        </div>
        <button className="navlink" onClick={signOut}>Sign out →</button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
