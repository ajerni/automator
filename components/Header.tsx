"use client";

import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import type { SessionUser } from "@/lib/types";

export default function Header({ user }: { user: SessionUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-black text-white shadow-md shadow-indigo-500/30">
            A
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Automator</h1>
            <p className="text-xs text-slate-400">Browser workflow automation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">
            {user.name || user.email}
          </span>
          <ThemeToggle />
          <button
            onClick={logout}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
