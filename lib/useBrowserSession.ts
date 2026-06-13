"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WorkerStatus = "idle" | "connecting" | "ready" | "closed" | "error";

interface Options {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onEvent?: (msg: any) => void;
}

// Manages the WebSocket connection to the streaming worker, draws incoming
// screencast frames onto the provided canvas, and exposes a send() helper.
export function useBrowserSession({ canvasRef, onEvent }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<WorkerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const drawFrame = useCallback(
    (b64: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!imgRef.current) imgRef.current = new Image();
      const img = imgRef.current;
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.drawImage(img, 0, 0);
      };
      img.src = `data:image/jpeg;base64,${b64}`;
    },
    [canvasRef]
  );

  const connect = useCallback(async (): Promise<WebSocket> => {
    setStatus("connecting");
    setError(null);
    const res = await fetch("/api/worker-token");
    if (!res.ok) throw new Error("Could not authorize with worker");
    const { token, workerUrl } = await res.json();
    const wsUrl =
      workerUrl.replace(/^http/, "ws") + "/ws?token=" + encodeURIComponent(token);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {};
      ws.onmessage = (e) => {
        let msg: any;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === "frame") {
          drawFrame(msg.data);
          return;
        }
        if (msg.type === "ready") {
          setStatus("ready");
          resolve(ws);
        }
        if (msg.type === "error") {
          setError(msg.error);
          if (msg.error === "unauthorized") {
            setStatus("error");
            reject(new Error(msg.error));
          }
        }
        onEventRef.current?.(msg);
      };
      ws.onerror = () => {
        setStatus("error");
        setError("Connection to worker failed. Is the worker running?");
        reject(new Error("worker connection failed"));
      };
      ws.onclose = () => setStatus("closed");
    });
  }, [drawFrame]);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const close = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  return { status, error, connect, send, close };
}
