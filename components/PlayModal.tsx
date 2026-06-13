"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBrowserSession } from "@/lib/useBrowserSession";
import StreamCanvas from "./StreamCanvas";
import Modal from "./Modal";
import type { Workflow } from "@/lib/types";

type Phase = "variables" | "running" | "done";

export default function PlayModal({
  workflow,
  initialValues,
  autoStart,
  onClose,
}: {
  workflow: Workflow;
  initialValues?: Record<string, string>;
  autoStart?: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("variables");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const variable of workflow.variables) {
      v[variable.key] = initialValues?.[variable.key] ?? variable.sampleValue ?? "";
    }
    return v;
  });
  const [progress, setProgress] = useState<{ index: number; total: number }>({
    index: -1,
    total: workflow.steps.length,
  });
  const [result, setResult] = useState<{ status: string; error?: string } | null>(
    null
  );

  const onEvent = useCallback((msg: any) => {
    if (msg.type === "play:start") {
      setProgress({ index: -1, total: msg.total });
    } else if (msg.type === "play:step") {
      setProgress((p) => ({ ...p, index: msg.index }));
    } else if (msg.type === "play:done") {
      setResult({ status: msg.status, error: msg.error });
      setPhase("done");
    }
  }, []);

  const { status, error, connect, send, close } = useBrowserSession({
    canvasRef,
    onEvent,
  });

  const run = useCallback(async () => {
    setPhase("running");
    setResult(null);
    try {
      await connect();
      send({
        type: "play:start",
        steps: workflow.steps,
        variables: values,
        startUrl: workflow.startUrl,
      });
    } catch {
      /* surfaced via status */
    }
  }, [connect, send, values, workflow]);

  useEffect(() => {
    if (autoStart) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    close();
    onClose();
  }

  return (
    <Modal title={`Run: ${workflow.name}`} onClose={handleClose} wide allowFullscreen>
      {phase === "variables" && (
        <div className="space-y-4">
          {workflow.variables.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This workflow needs no variables. Click run to play it back.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Fill in the values for this run.
              </p>
              <div className="space-y-3">
                {workflow.variables.map((v) => (
                  <label key={v.key} className="block">
                    <span className="mb-1 block text-sm font-medium">
                      {v.name}
                      {v.description && (
                        <span className="ml-2 font-normal text-slate-400">
                          {v.description}
                        </span>
                      )}
                    </span>
                    <input
                      type={v.kind === "password" ? "password" : "text"}
                      autoComplete={v.kind === "password" ? "new-password" : "off"}
                      value={values[v.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [v.key]: e.target.value }))
                      }
                      placeholder={v.sampleValue}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            onClick={run}
            disabled={status === "connecting"}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {status === "connecting" ? "Starting browser…" : "Run workflow"}
          </button>
        </div>
      )}

      {(phase === "running" || phase === "done") && (
        <div className="space-y-3">
          <div className="sticky top-0 z-20 -mx-1 space-y-2 border-b border-slate-200/70 bg-white/95 px-1 pb-2 pt-1 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/95">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {phase === "done" ? (
                result?.status === "success" ? (
                  <span className="text-emerald-500">✓ Completed successfully</span>
                ) : (
                  <span className="text-red-500">✗ Failed: {result?.error}</span>
                )
              ) : (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                  Running step {progress.index + 1} / {progress.total}
                </span>
              )}
            </span>
            {phase === "done" && (
              <button
                onClick={handleClose}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Close
              </button>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${
                  progress.total
                    ? ((progress.index + 1) / progress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          </div>
          <StreamCanvas
            canvasRef={canvasRef}
            interactive
            send={send}
            hint={
              phase === "done"
                ? "Live browser — click and type to control it yourself"
                : "You can also take over: click and type in this browser"
            }
          />
        </div>
      )}
    </Modal>
  );
}
