"use client";
import { useState } from "react";
import { INPUT, PRIMARY } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, login } from "@/lib/adminApi";

export function LoginForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(password);
      onDone();
    } catch (err) {
      setError(adminErrorMessage(err instanceof ApiError ? err.code : "server_error"));
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="block space-y-2">
        <span className="text-lg font-semibold">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
      </label>
      {error && (
        <p role="alert" className="text-lg font-semibold text-red-300">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || password.length === 0} className={`${PRIMARY} w-full`}>
        Log in
      </button>
    </form>
  );
}
