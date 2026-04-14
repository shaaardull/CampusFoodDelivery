"use client";

import { useToastStore } from "@/hooks/useToast";

const colorMap = {
  success: "bg-green-500",
  error: "bg-red-500",
  info: "bg-brand-500",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${colorMap[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg animate-slide-down cursor-pointer text-sm`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
