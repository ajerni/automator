"use client";

import { useState } from "react";
import type { Workflow } from "@/lib/types";

export default function WorkflowList({
  workflows,
  onPlay,
  onEdit,
  onDelete,
}: {
  workflows: Workflow[];
  onPlay: (w: Workflow) => void;
  onEdit: (w: Workflow) => void;
  onDelete: (w: Workflow) => void;
}) {
  if (workflows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <p className="text-slate-500 dark:text-slate-400">
          No workflows yet. Click <span className="font-semibold">Record workflow</span> to
          create your first one.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workflows.map((w) => (
        <WorkflowCard
          key={w.id}
          workflow={w}
          onPlay={onPlay}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function WorkflowCard({
  workflow,
  onPlay,
  onEdit,
  onDelete,
}: {
  workflow: Workflow;
  onPlay: (w: Workflow) => void;
  onEdit: (w: Workflow) => void;
  onDelete: (w: Workflow) => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold leading-tight">{workflow.name}</h3>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menu && (
            <div
              className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              onMouseLeave={() => setMenu(false)}
            >
              <button
                onClick={() => {
                  setMenu(false);
                  onEdit(workflow);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Edit variables
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  onDelete(workflow);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">
        {workflow.description || "No description"}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge>{workflow.steps.length} steps</Badge>
        <Badge>{workflow.variables.length} variables</Badge>
      </div>
      {workflow.startUrl && (
        <p className="mt-2 truncate text-xs text-slate-400">{workflow.startUrl}</p>
      )}

      <button
        onClick={() => onPlay(workflow)}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        Play
      </button>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}
