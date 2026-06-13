// Shared types used across the web app and (mirrored in) the worker.

export type StepType = "goto" | "click" | "fill" | "select" | "press" | "waitFor";

export interface WorkflowStep {
  /** Stable id for the step within a workflow. */
  id: string;
  type: StepType;
  /** CSS selector the action targets (not used for "goto"). */
  selector?: string;
  /** Ordered candidate selectors (best/most stable first) tried at playback. */
  selectors?: string[];
  /** Human readable label describing the target element. */
  label?: string;
  /** For goto. */
  url?: string;
  /** Literal value captured during recording (default for variable steps). */
  value?: string;
  /** For press steps (e.g. "Enter"). */
  key?: string;
  /** If set, this step's value is driven by the variable with this key. */
  variableKey?: string;
  /** Recorded viewport click coordinates (positional / fallback clicks). */
  x?: number;
  y?: number;
  /** When true, replay this click by coordinates rather than by selector. */
  positional?: boolean;
}

export interface WorkflowVariable {
  /** Stable machine key referenced by steps, e.g. "var_1". */
  key: string;
  /** User facing name, e.g. "order_number". */
  name: string;
  /** Optional description to help the bot extract it. */
  description: string;
  /** Value captured during recording (used as default / example). */
  sampleValue: string;
  /** Whether it is a text entry or a selection. */
  kind: "text" | "select";
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description: string;
  startUrl: string;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}
