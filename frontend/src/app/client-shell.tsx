"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import BottomNav from "@/components/shared/BottomNav";
import ToastContainer from "@/components/shared/ToastContainer";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const PUBLIC_PATHS = ["/auth"];

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (!stored && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/auth");
    }
  }, [pathname, router, token]);

  const showNav = !PUBLIC_PATHS.includes(pathname);

  return (
    <ErrorBoundary>
      <ToastContainer />
      <main className="max-w-lg mx-auto min-h-screen">
        {children}
      </main>
      {showNav && <BottomNav />}
    </ErrorBoundary>
  );
}
