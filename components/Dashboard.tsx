"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser, Workflow } from "@/lib/types";
import Header from "./Header";
import BotPanel from "./BotPanel";
import WorkflowList from "./WorkflowList";
import RecordModal from "./RecordModal";
import PlayModal from "./PlayModal";
import EditModal from "./EditModal";

interface PlayState {
  workflow: Workflow;
  values?: Record<string, string>;
  autoStart?: boolean;
}

export default function Dashboard({
  user,
  initialWorkflows,
}: {
  user: SessionUser;
  initialWorkflows: Workflow[];
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows);
  const [recording, setRecording] = useState(false);
  const [play, setPlay] = useState<PlayState | null>(null);
  const [editing, setEditing] = useState<Workflow | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workflows");
    if (res.ok) {
      const data = await res.json();
      setWorkflows(data.workflows);
    }
  }, []);

  const remove = useCallback(
    async (w: Workflow) => {
      if (!confirm(`Delete workflow "${w.name}"?`)) return;
      await fetch(`/api/workflows/${w.id}`, { method: "DELETE" });
      refresh();
    },
    [refresh]
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <BotPanel
          workflows={workflows}
          onRun={(workflow, values, autoStart) =>
            setPlay({ workflow, values, autoStart })
          }
        />

        <div className="mb-4 mt-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Your workflows</h2>
            <p className="text-sm text-slate-400">
              {workflows.length} recorded workflow
              {workflows.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => setRecording(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white shadow-md shadow-indigo-500/20 transition hover:bg-indigo-500"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            Record workflow
          </button>
        </div>

        <WorkflowList
          workflows={workflows}
          onPlay={(w) => setPlay({ workflow: w })}
          onEdit={(w) => setEditing(w)}
          onDelete={remove}
        />
      </main>

      <footer className="border-t border-slate-200 py-5 text-center text-sm text-slate-400 dark:border-slate-800">
        Automator — record once, replay anytime · Built with Next.js &amp;
        Playwright
      </footer>

      {recording && (
        <RecordModal
          onClose={() => setRecording(false)}
          onSaved={() => {
            setRecording(false);
            refresh();
          }}
        />
      )}
      {play && (
        <PlayModal
          workflow={play.workflow}
          initialValues={play.values}
          autoStart={play.autoStart}
          onClose={() => setPlay(null)}
        />
      )}
      {editing && (
        <EditModal
          workflow={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
