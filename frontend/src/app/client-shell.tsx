"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import BottomNav from "@/components/shared/BottomNav";
import ToastContainer from "@/components/shared/ToastContainer";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ErrorBoundary>
      <ToastContainer />
      <main className="max-w-lg mx-auto min-h-screen">
        {children}
      </main>
      <BottomNav />
    </ErrorBoundary>
  );
}
