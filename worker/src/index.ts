import http from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { jwtVerify } from "jose";
import { chromium, Browser, BrowserContext, Page, CDPSession } from "playwright";
import { RECORDER_SOURCE } from "./recorder.js";

const PORT = Number(process.env.WORKER_PORT || 4000);
const VIEWPORT = { width: 1280, height: 800 };

interface Step {
  id: string;
  type: "goto" | "click" | "fill" | "select" | "press";
  selector?: string;
  label?: string;
  url?: string;
  value?: string;
  key?: string;
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

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

class Session {
  ws: WebSocket;
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;
  client: CDPSession | null = null;
  steps: Step[] = [];
  recording = false;
  lastUrl = "";

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  async launch() {
    if (this.browser) return;
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    this.context = await this.browser.newContext({ viewport: VIEWPORT });
    await this.context.exposeBinding(
      "__automator_record",
      (_source, payload: string) => {
        if (!this.recording) return;
        try {
          this.onRecorded(JSON.parse(payload));
        } catch {
          /* ignore */
        }
      }
    );
    await this.context.addInitScript(RECORDER_SOURCE);
    this.page = await this.context.newPage();

    this.page.on("framenavigated", (frame) => {
      if (frame !== this.page?.mainFrame()) return;
      const url = frame.url();
      if (!url || url === "about:blank") return;
      if (this.recording && url !== this.lastUrl) {
        this.lastUrl = url;
        this.pushStep({ type: "goto", url, label: url });
      }
    });

    this.client = await this.context.newCDPSession(this.page);
    await this.client.send("Page.enable");
    this.client.on("Page.screencastFrame", async (frame) => {
      send(this.ws, { type: "frame", data: frame.data });
      try {
        await this.client?.send("Page.screencastFrameAck", {
          sessionId: frame.sessionId,
        });
      } catch {
        /* page may be closing */
      }
    });
  }

  async startScreencast() {
    await this.client?.send("Page.startScreencast", {
      format: "jpeg",
      quality: 55,
      everyNthFrame: 1,
      maxWidth: VIEWPORT.width,
      maxHeight: VIEWPORT.height,
    });
  }

  pushStep(step: Omit<Step, "id">) {
    const full: Step = { id: randomUUID(), ...step };
    this.steps.push(full);
    send(this.ws, { type: "step", step: full });
  }

  onRecorded(action: {
    type: string;
    selector?: string;
    value?: string;
    label?: string;
    secret?: boolean;
  }) {
    if (action.type === "click") {
      // Avoid duplicate consecutive identical clicks.
      const last = this.steps[this.steps.length - 1];
      if (last && last.type === "click" && last.selector === action.selector) return;
      this.pushStep({ type: "click", selector: action.selector, label: action.label });
    } else if (action.type === "fill") {
      // Collapse repeated typing into the same field to a single step.
      const existing = [...this.steps]
        .reverse()
        .find((s) => s.type === "fill" && s.selector === action.selector);
      if (existing) {
        existing.value = action.value;
        send(this.ws, { type: "step:update", step: existing });
        return;
      }
      this.pushStep({
        type: "fill",
        selector: action.selector,
        value: action.value,
        label: action.label,
        secret: action.secret,
      });
    } else if (action.type === "select") {
      this.pushStep({
        type: "select",
        selector: action.selector,
        value: action.value,
        label: action.label,
      });
    }
  }

  async startRecording(url: string) {
    await this.launch();
    this.steps = [];
    this.recording = true;
    this.lastUrl = "";
    await this.startScreencast();
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    await this.page!.goto(target, { waitUntil: "domcontentloaded" }).catch(() => {});
  }

  deriveVariables(): { steps: Step[]; variables: Variable[] } {
    const variables: Variable[] = [];
    const bySelector = new Map<string, string>();
    let counter = 0;
    for (const step of this.steps) {
      if ((step.type === "fill" && !step.secret) || step.type === "select") {
        const sigKey = `${step.type}:${step.selector}`;
        let key = bySelector.get(sigKey);
        if (!key) {
          counter += 1;
          key = `var_${counter}`;
          bySelector.set(sigKey, key);
          variables.push({
            key,
            name: (step.label || `value ${counter}`)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "")
              .slice(0, 40) || `value_${counter}`,
            description: "",
            sampleValue: step.value ?? "",
            kind: step.type === "select" ? "select" : "text",
          });
        }
        step.variableKey = key;
      }
    }
    return { steps: this.steps, variables };
  }

  async stopRecording() {
    this.recording = false;
    try {
      await this.client?.send("Page.stopScreencast");
    } catch {
      /* ignore */
    }
    const result = this.deriveVariables();
    send(this.ws, {
      type: "record:done",
      steps: result.steps,
      variables: result.variables,
      startUrl: result.steps.find((s) => s.type === "goto")?.url ?? "",
    });
  }

  // ---- Playback ----
  async play(steps: Step[], variables: Record<string, string>, startUrl: string) {
    await this.launch();
    this.recording = false;
    await this.startScreencast();
    send(this.ws, { type: "play:start", total: steps.length });

    const resolve = (s: Step) =>
      s.variableKey && variables[s.variableKey] !== undefined
        ? variables[s.variableKey]
        : s.value ?? "";

    try {
      if (startUrl) {
        const target = /^https?:\/\//i.test(startUrl) ? startUrl : `https://${startUrl}`;
        await this.page!.goto(target, { waitUntil: "domcontentloaded" });
      }
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        send(this.ws, { type: "play:step", index: i, step, status: "running" });
        await this.runStep(step, resolve(step));
        await this.page!.waitForLoadState("domcontentloaded").catch(() => {});
        await this.page!.waitForTimeout(350);
        send(this.ws, { type: "play:step", index: i, step, status: "done" });
      }
      send(this.ws, { type: "play:done", status: "success" });
    } catch (err) {
      send(this.ws, {
        type: "play:done",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async runStep(step: Step, value: string) {
    const page = this.page!;
    const opts = { timeout: 15000 };
    switch (step.type) {
      case "goto":
        if (step.url) await page.goto(step.url, { waitUntil: "domcontentloaded" });
        break;
      case "click":
        if (step.selector) await page.click(step.selector, opts);
        break;
      case "fill":
        if (step.selector) await page.fill(step.selector, value, opts);
        break;
      case "select":
        if (step.selector) await page.selectOption(step.selector, value, opts);
        break;
      case "press":
        if (step.key) await page.keyboard.press(step.key);
        break;
    }
  }

  // ---- Raw input forwarding (used during recording) ----
  async handleInput(ev: any) {
    if (!this.client) return;
    try {
      if (ev.kind === "mousemove") {
        await this.client.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: ev.x,
          y: ev.y,
        });
      } else if (ev.kind === "mousedown" || ev.kind === "mouseup") {
        await this.client.send("Input.dispatchMouseEvent", {
          type: ev.kind === "mousedown" ? "mousePressed" : "mouseReleased",
          x: ev.x,
          y: ev.y,
          button: ev.button === 2 ? "right" : "left",
          clickCount: 1,
        });
      } else if (ev.kind === "wheel") {
        await this.client.send("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          x: ev.x,
          y: ev.y,
          deltaX: ev.deltaX || 0,
          deltaY: ev.deltaY || 0,
        });
      } else if (ev.kind === "keydown") {
        const printable = ev.key && ev.key.length === 1;
        // A keyDown event carrying `text` already inserts the character, so we
        // must NOT also dispatch a separate "char" event (that would double it).
        await this.client.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: ev.key,
          code: ev.code,
          text: printable ? ev.key : undefined,
          unmodifiedText: printable ? ev.key : undefined,
          windowsVirtualKeyCode: ev.keyCode,
        });
      } else if (ev.kind === "keyup") {
        await this.client.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: ev.key,
          code: ev.code,
          windowsVirtualKeyCode: ev.keyCode,
        });
      }
    } catch {
      /* ignore transient input errors */
    }
  }

  async dispose() {
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.client = null;
  }
}

async function authenticate(token: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return String(payload.sub);
  } catch {
    return null;
  }
}

const app = express();
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const token = url.searchParams.get("token");
  const userId = await authenticate(token);
  if (!userId) {
    send(ws, { type: "error", error: "unauthorized" });
    ws.close();
    return;
  }

  const session = new Session(ws);
  send(ws, { type: "ready", viewport: VIEWPORT });

  ws.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    try {
      switch (msg.type) {
        case "record:start":
          await session.startRecording(msg.url || "https://example.com");
          break;
        case "record:stop":
          await session.stopRecording();
          break;
        case "input":
          await session.handleInput(msg.event);
          break;
        case "play:start":
          await session.play(
            msg.steps || [],
            msg.variables || {},
            msg.startUrl || ""
          );
          break;
        default:
          break;
      }
    } catch (err) {
      send(ws, {
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  ws.on("close", () => session.dispose());
});

server.listen(PORT, () => {
  console.log(`[automator-worker] listening on http://localhost:${PORT}`);
});
