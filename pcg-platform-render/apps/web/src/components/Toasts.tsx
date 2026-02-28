"use client";

import { useStore } from "../store";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

export function Toasts() {
  const toasts      = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const config = {
          success: { icon: <CheckCircle className="w-4 h-4 text-gcp-green" />,  bg: "bg-green-50 border-gcp-green" },
          error:   { icon: <XCircle className="w-4 h-4 text-gcp-red" />,        bg: "bg-red-50 border-gcp-red" },
          info:    { icon: <Info className="w-4 h-4 text-gcp-blue" />,           bg: "bg-blue-50 border-gcp-blue" },
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border shadow-lg ${config.bg}
              ${toast.removing ? "animate-slide-out" : "animate-slide-in"}`}
          >
            <div className="mt-0.5 shrink-0">{config.icon}</div>
            <p className="text-sm text-gcp-text flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 mt-0.5 text-gcp-muted hover:text-gcp-text">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
