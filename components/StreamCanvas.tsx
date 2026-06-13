"use client";

import { useEffect, useRef } from "react";

const VIEWPORT = { width: 1280, height: 800 };

export default function StreamCanvas({
  canvasRef,
  interactive,
  send,
  hint = "Click here, then interact with the page to record",
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  interactive: boolean;
  send: (msg: unknown) => void;
  hint?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;

    const toPage = (e: MouseEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * VIEWPORT.width;
      const y = ((e.clientY - rect.top) / rect.height) * VIEWPORT.height;
      return { x: Math.max(0, Math.min(VIEWPORT.width, x)), y: Math.max(0, Math.min(VIEWPORT.height, y)) };
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = toPage(e);
      send({ type: "input", event: { kind: "mousemove", x, y } });
    };
    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      const { x, y } = toPage(e);
      send({ type: "input", event: { kind: "mousedown", x, y, button: e.button } });
    };
    const onUp = (e: MouseEvent) => {
      const { x, y } = toPage(e);
      send({ type: "input", event: { kind: "mouseup", x, y, button: e.button } });
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toPage(e);
      send({
        type: "input",
        event: { kind: "wheel", x, y, deltaX: e.deltaX, deltaY: e.deltaY },
      });
    };
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      send({
        type: "input",
        event: { kind: "keydown", key: e.key, code: e.code, keyCode: e.keyCode },
      });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      send({
        type: "input",
        event: { kind: "keyup", key: e.key, code: e.code, keyCode: e.keyCode },
      });
    };

    let throttle = 0;
    const throttledMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - throttle < 30) return;
      throttle = now;
      onMove(e);
    };

    canvas.addEventListener("mousemove", throttledMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const wrap = wrapRef.current;
    wrap?.addEventListener("keydown", onKeyDown);
    wrap?.addEventListener("keyup", onKeyUp);

    return () => {
      canvas.removeEventListener("mousemove", throttledMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      wrap?.removeEventListener("keydown", onKeyDown);
      wrap?.removeEventListener("keyup", onKeyUp);
    };
  }, [canvasRef, interactive, send]);

  return (
    <div
      ref={wrapRef}
      tabIndex={interactive ? 0 : -1}
      className="relative w-full overflow-hidden rounded-xl bg-black outline-none ring-1 ring-slate-700 focus:ring-2 focus:ring-indigo-500"
      style={{ aspectRatio: `${VIEWPORT.width} / ${VIEWPORT.height}` }}
      onClick={() => interactive && wrapRef.current?.focus()}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ cursor: interactive ? "crosshair" : "default" }}
      />
      {interactive && hint && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
          {hint}
        </div>
      )}
    </div>
  );
}
