import { useEffect } from "react";

type ToastProps = {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
  durationMs?: number;
};

export function Toast({ message, tone, onClose, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onClose]);

  const toneClasses = tone === "success" ? "bg-emerald-600" : "bg-red-600";

  return (
    <div className={`fixed right-4 top-4 z-50 rounded px-4 py-3 text-sm text-white shadow ${toneClasses}`}>
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button type="button" className="text-white/90" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
