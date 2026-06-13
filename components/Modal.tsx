"use client";

import { useState } from "react";

export default function Modal({
  title,
  children,
  onClose,
  wide,
  allowFullscreen,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  allowFullscreen?: boolean;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-auto bg-black/50 backdrop-blur-sm ${
        fullscreen ? "p-0" : "items-start p-4"
      }`}
    >
      <div
        className={
          fullscreen
            ? "flex h-screen w-screen flex-col border-0 bg-white p-6 dark:bg-slate-900"
            : `my-8 w-full ${
                wide ? "max-w-5xl" : "max-w-lg"
              } rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900`
        }
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="flex items-center gap-1">
            {allowFullscreen && (
              <button
                onClick={() => setFullscreen((f) => !f)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
                title={fullscreen ? "Exit full screen" : "Full screen"}
              >
                {fullscreen ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                  </svg>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className={fullscreen ? "min-h-0 flex-1 overflow-auto" : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}
