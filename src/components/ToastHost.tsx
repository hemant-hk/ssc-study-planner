"use client";

import { useState, useEffect } from "react";
import { subscribeToast } from "@/lib/toast";

export default function ToastHost() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"success" | "error">("success");

  useEffect(() => {
    return subscribeToast((msg, toastType) => {
      setMessage(msg);
      setType(toastType);
    });
  }, []);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate__animated animate__fadeInUp">
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm font-medium ${
          type === "success"
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "bg-red-600 text-white"
        }`}
      >
        {type === "success" ? (
          <svg className="w-4 h-4 text-emerald-400 dark:text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        {message}
      </div>
    </div>
  );
}