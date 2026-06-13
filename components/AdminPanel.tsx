"use client";

import { useCallback, useEffect, useState } from "react";

interface ColumnMeta {
  name: string;
  type: "text" | "uuid" | "timestamptz" | "json" | "password";
  editable: boolean;
  required?: boolean;
}

interface TableMeta {
  name: string;
  label: string;
  columns: ColumnMeta[];
  count: number;
}

type Row = Record<string, unknown>;

function fmt(val: unknown, type: string): string {
  if (val == null) return "";
  if (type === "json") {
    return typeof val === "string" ? val : JSON.stringify(val, null, 2);
  }
  if (type === "timestamptz") {
    return new Date(String(val)).toLocaleString();
  }
  return String(val);
}

function preview(val: unknown, type: string, max = 80): string {
  const s = fmt(val, type).replace(/\s+/g, " ");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [active, setActive] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/admin/meta");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (!res.ok) throw new Error("Failed to load admin meta");
    const data = await res.json();
    setTables(data.tables);
    setAuthed(true);
    if (!active && data.tables[0]) setActive(data.tables[0].name);
  }, [active]);

  const loadRows = useCallback(async (table: string) => {
    if (!table) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${table}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setRows(data.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta().catch(() => setAuthed(false));
  }, [loadMeta]);

  useEffect(() => {
    if (authed && active) loadRows(active);
  }, [authed, active, loadRows]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setLoginError("Invalid password");
      return;
    }
    setPassword("");
    await loadMeta();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setRows([]);
    setEditing(null);
    setCreating(false);
  }

  const meta = tables.find((t) => t.name === active);
  const listCols =
    meta?.columns.filter(
      (c) => c.type !== "password" && c.name !== "password_hash"
    ) ?? [];

  function openCreate() {
    if (!meta) return;
    const init: Record<string, string> = {};
    for (const col of meta.columns) {
      if (!col.editable) continue;
      if (col.type === "json") init[col.name] = col.name.includes("steps") || col.name.includes("variables") ? "[]" : "{}";
      else init[col.name] = "";
    }
    setForm(init);
    setCreating(true);
    setEditing(null);
  }

  function openEdit(row: Row) {
    if (!meta) return;
    const init: Record<string, string> = {};
    for (const col of meta.columns) {
      if (!col.editable) continue;
      init[col.name] = fmt(row[col.name], col.type);
    }
    setForm(init);
    setEditing(row);
    setCreating(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!meta) return;
    setError(null);
    const body: Record<string, unknown> = {};
    for (const col of meta.columns) {
      if (!col.editable) continue;
      const raw = form[col.name] ?? "";
      if (col.type === "json") {
        try {
          body[col.name] = JSON.parse(raw || (col.name.includes("steps") || col.name.includes("variables") ? "[]" : "{}"));
        } catch {
          setError(`Invalid JSON in ${col.name}`);
          return;
        }
      } else if (col.type === "password") {
        if (raw) body.password = raw;
      } else {
        body[col.name] = raw;
      }
    }

    const url = creating
      ? `/api/admin/${active}`
      : `/api/admin/${active}/${editing!.id}`;
    const res = await fetch(url, {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      return;
    }
    setCreating(false);
    setEditing(null);
    await loadRows(active);
    await loadMeta();
  }

  async function remove(row: Row) {
    if (!confirm(`Delete row ${String(row.id)}?`)) return;
    const res = await fetch(`/api/admin/${active}/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "Delete failed");
      return;
    }
    await loadRows(active);
    await loadMeta();
  }

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <h1 className="mb-1 text-xl font-bold">Automator Admin</h1>
          <p className="mb-4 text-sm text-slate-500">Database administration</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="mb-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
            required
          />
          {loginError && <p className="mb-2 text-sm text-red-500">{loginError}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Automator Admin</h1>
            <p className="text-xs text-slate-400">automator_* tables only</p>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-6">
        <aside className="w-48 shrink-0 space-y-1">
          {tables.map((t) => (
            <button
              key={t.name}
              onClick={() => {
                setActive(t.name);
                setEditing(null);
                setCreating(false);
              }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                active === t.name
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
              <span className="ml-1 opacity-70">({t.count})</span>
            </button>
          ))}
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{meta?.label}</h2>
            <button
              onClick={openCreate}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              + New row
            </button>
          </div>

          {error && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          {(creating || editing) && meta && (
            <form
              onSubmit={save}
              className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="mb-3 font-semibold">
                {creating ? "Create row" : `Edit ${String(editing!.id)}`}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {meta.columns
                  .filter((c) => c.editable)
                  .map((col) => (
                    <label key={col.name} className="block sm:col-span-2">
                      <span className="mb-1 block text-sm font-medium">
                        {col.name}
                        {col.required && <span className="text-red-500"> *</span>}
                      </span>
                      {col.type === "json" ? (
                        <textarea
                          value={form[col.name] ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [col.name]: e.target.value }))
                          }
                          rows={8}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      ) : (
                        <input
                          type={col.type === "password" ? "password" : "text"}
                          value={form[col.name] ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, [col.name]: e.target.value }))
                          }
                          placeholder={
                            col.type === "password" && editing
                              ? "Leave blank to keep current"
                              : undefined
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        />
                      )}
                    </label>
                  ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setEditing(null);
                  }}
                  className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-slate-500">Loading rows…</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    {listCols.slice(0, 6).map((c) => (
                      <th key={c.name} className="px-3 py-2 font-medium">
                        {c.name}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={listCols.length + 1}
                        className="px-3 py-6 text-center text-slate-400"
                      >
                        No rows
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={String(row.id)}
                        className="border-b border-slate-100 dark:border-slate-800"
                      >
                        {listCols.slice(0, 6).map((c) => (
                          <td key={c.name} className="max-w-[200px] truncate px-3 py-2">
                            {preview(row[c.name], c.type)}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2">
                          <button
                            onClick={() => openEdit(row)}
                            className="mr-2 text-indigo-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => remove(row)}
                            className="text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
