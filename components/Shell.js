"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { currentUser, logout } from "@/lib/store";

const NAV = {
  admin: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin?tab=videos", label: "Video library" },
    { href: "/admin?tab=students", label: "Student progress" },
  ],
  instructor: [{ href: "/instructor", label: "My courses" }],
  student: [{ href: "/student", label: "My learning" }],
};

export default function Shell({ role, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const u = currentUser();
    if (!u) router.replace("/login");
    else if (u.role !== role) router.replace(`/${u.role}`);
    else setUser(u);
  }, [role, router]);

  if (!user) return null;

  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          Zen<span>Ved</span>
        </div>
        {(NAV[role] || []).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={pathname === n.href.split("?")[0] && !n.href.includes("?") ? "active" : ""}
          >
            {n.label}
          </Link>
        ))}
        <Link href="/">Public site</Link>
        <div className="spacer" />
        <div className="whoami">
          Signed in as <b style={{ color: "#fff" }}>{user.name}</b>
          <br />
          <span className="chip chip-amber" style={{ marginTop: 6 }}>{role}</span>
        </div>
        <button
          className="navlink"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
        >
          Sign out →
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
