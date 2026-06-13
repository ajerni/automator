"use client";

import { useState } from "react";
import Modal from "./Modal";
import type { Workflow, WorkflowVariable } from "@/lib/types";

export default function EditModal({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: Workflow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const [variables, setVariables] = useState<WorkflowVariable[]>(
    workflow.variables
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, variables }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit workflow" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Variables</h3>
          {variables.length === 0 ? (
            <p className="text-sm text-slate-500">No variables.</p>
          ) : (
            <div className="space-y-2">
              {variables.map((v, i) => (
                <div
                  key={v.key}
                  className="grid gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-2 dark:border-slate-800"
                >
                  <input
                    value={v.name}
                    onChange={(e) =>
                      setVariables((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x
                        )
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    placeholder="name"
                  />
                  <input
                    value={v.description}
                    onChange={(e) =>
                      setVariables((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, description: e.target.value } : x
                        )
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    placeholder="description"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
