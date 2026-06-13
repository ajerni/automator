"use client";

import { useState } from "react";
import type { Workflow } from "@/lib/types";

interface BotResult {
  workflowId: string | null;
  reasoning: string;
  variables: Record<string, string>;
  missing: string[];
}

export default function BotPanel({
  workflows,
  onRun,
}: {
  workflows: Workflow[];
  onRun: (
    workflow: Workflow,
    values: Record<string, string>,
    autoStart: boolean
  ) => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BotResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bot failed");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bot failed");
    } finally {
      setLoading(false);
    }
  }

  const chosen = result?.workflowId
    ? workflows.find((w) => w.id === result.workflowId)
    : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4M8 16h.01M16 16h.01" />
          </svg>
        </div>
        <div>
          <h2 className="font-bold">Automation Bot</h2>
          <p className="text-xs text-slate-400">
            Describe what you want done. I&apos;ll pick the workflow and fill the
            variables.
          </p>
        </div>
      </div>

      <form onSubmit={ask} className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Create a repack order for material 8123123, quantity 10, batch ABCD"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {result.reasoning}
          </p>
          {chosen ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                {chosen.name}
              </span>
              {result.missing.length > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Needs: {result.missing.join(", ")}
                </span>
              )}
              <button
                onClick={() =>
                  onRun(chosen, result.variables, result.missing.length === 0)
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                {result.missing.length === 0
                  ? "Run now"
                  : "Review & run"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              No matching workflow found.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
