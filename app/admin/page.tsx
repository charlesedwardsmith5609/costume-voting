"use client";
import { TimerControls } from "@/components/admin/TimerControls";
import { ADMIN_PAGE } from "@/components/admin/ui";

export default function AdminHome() {
  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Timer</h1>
      <TimerControls />
    </main>
  );
}
