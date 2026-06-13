"use client";

import { useCallback, useRef, useState } from "react";
import { useBrowserSession } from "@/lib/useBrowserSession";
import StreamCanvas from "./StreamCanvas";
import Modal from "./Modal";

interface Step {
  id: string;
  type: string;
  selector?: string;
  label?: string;
  url?: string;
  value?: string;
  variableKey?: string;
  secret?: boolean;
}
interface Variable {
  key: string;
  name: string;
  description: string;
  sampleValue: string;
  kind: "text" | "select";
}

type Phase = "config" | "recording" | "naming";

export default function RecordModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("config");
  const [startUrl, setStartUrl] = useState("https://");
  const [steps, setSteps] = useState<Step[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resolvedStartUrl, setResolvedStartUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const onEvent = useCallback((msg: any) => {
    if (msg.type === "step") {
      setSteps((prev) => [...prev, msg.step]);
    } else if (msg.type === "step:update") {
      setSteps((prev) => prev.map((s) => (s.id === msg.step.id ? msg.step : s)));
    } else if (msg.type === "record:done") {
      setSteps(msg.steps);
      setVariables(msg.variables);
      setResolvedStartUrl(msg.startUrl || "");
      setPhase("naming");
    }
  }, []);

  const { status, error, connect, send, close } = useBrowserSession({
    canvasRef,
    onEvent,
  });

  async function start() {
    try {
      await connect();
      setPhase("recording");
      send({ type: "record:start", url: startUrl });
    } catch {
      /* error surfaced via status */
    }
  }

  function stop() {
    send({ type: "record:stop" });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Untitled workflow",
          description,
          startUrl: resolvedStartUrl || startUrl,
          steps,
          variables,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      close();
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    close();
    onClose();
  }

  return (
    <Modal title="Record a workflow" onClose={handleClose} wide allowFullscreen>
      {phase === "config" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter the page where the workflow starts. A real browser will open in
            the panel below — just click and type to perform your steps.
          </p>
          <input
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder="https://example.com/login"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={start}
            disabled={status === "connecting"}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {status === "connecting" ? "Starting browser…" : "Start recording"}
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-red-500">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Recording — {steps.length} step{steps.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={stop}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Stop recording
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
            <StreamCanvas canvasRef={canvasRef} interactive send={send} />
            <StepList steps={steps} />
          </div>
        </div>
      )}

      {phase === "naming" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Workflow name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Create purchase order"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Description (helps the bot)
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When should this workflow be used?"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Name your variables ({variables.length})
            </h3>
            {variables.length === 0 ? (
              <p className="text-sm text-slate-500">
                No input variables were detected in this recording.
              </p>
            ) : (
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div
                    key={v.key}
                    className="grid items-center gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[1fr_1fr_auto] dark:border-slate-800"
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
                      placeholder="variable name"
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
                      placeholder="description (optional)"
                    />
                    <span className="px-2 text-xs text-slate-400">
                      e.g. “{v.sampleValue || "—"}” · {v.kind}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <summary className="cursor-pointer text-sm font-medium">
              Recorded steps ({steps.length})
            </summary>
            <div className="mt-2">
              <StepList steps={steps} />
            </div>
          </details>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Discard
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save workflow"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-900/50">
      {steps.length === 0 ? (
        <p className="p-2 text-slate-400">No steps yet…</p>
      ) : (
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className="flex gap-2 rounded-lg bg-white px-2 py-1.5 dark:bg-slate-800"
            >
              <span className="font-mono text-slate-400">{i + 1}</span>
              <span className="font-semibold text-indigo-500">{s.type}</span>
              <span className="truncate text-slate-600 dark:text-slate-300">
                {s.type === "goto"
                  ? s.url
                  : s.label || s.selector}
                {s.value && !s.secret ? ` = "${s.value}"` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
