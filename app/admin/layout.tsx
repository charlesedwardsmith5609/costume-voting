"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminContext } from "@/components/admin/AdminContext";
import { AdminNav } from "@/components/admin/AdminNav";
import { LoginForm } from "@/components/admin/LoginForm";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { GENERIC_ERROR } from "@/lib/guestErrors";
import { hasSession, logout } from "@/lib/adminApi";

// Admin shell: checks the session cookie, shows the login form without one, and the nav with
// one. Every admin route also checks the cookie on the server; this only picks what to show.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<"checking" | "in" | "out" | "failed">("checking");

  const check = useCallback(() => {
    setSession("checking");
    hasSession()
      .then((ok) => setSession(ok ? "in" : "out"))
      .catch(() => setSession("failed"));
  }, []);
  useEffect(check, [check]);

  const expired = useCallback(() => setSession("out"), []);
  const signOut = useCallback(() => {
    logout()
      .catch(() => {})
      .finally(() => setSession("out"));
  }, []);

  if (session === "in") {
    return (
      <AdminContext.Provider value={{ expired }}>
        <AdminNav onSignOut={signOut} />
        {children}
      </AdminContext.Provider>
    );
  }
  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Host</h1>
      {session === "checking" && <p className="text-lg">Loading…</p>}
      {session === "failed" && (
        <p className="text-lg">
          {GENERIC_ERROR}{" "}
          <button type="button" onClick={check} className="text-pumpkin underline">
            Try again
          </button>
        </p>
      )}
      {session === "out" && <LoginForm onDone={() => setSession("in")} />}
    </main>
  );
}
