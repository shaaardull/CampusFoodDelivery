"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { getMe } from "@/lib/api";
import BottomNav from "@/components/shared/BottomNav";
import ToastContainer from "@/components/shared/ToastContainer";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

// Routes reachable without a token. Everything else redirects to /auth.
const PUBLIC_ROUTES = new Set(["/auth"]);

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { token, user, hydrate, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // Rehydrate token/user from localStorage on first render.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Gate every non-public route behind a token. Without this, the backend's
  // DEV_MODE fallback would silently sign us in as the dev user and /auth
  // would be unreachable.
  useEffect(() => {
    if (PUBLIC_ROUTES.has(pathname)) return;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!stored && !token) {
      router.replace("/auth");
    }
  }, [pathname, token, router]);

  // Once we have a token but no hydrated user yet, fetch /users/me. The
  // backend uses the JWT to resolve the real user (even in DEV_MODE the token
  // path is honored).
  useEffect(() => {
    if (!token || user) return;
    getMe()
      .then((res) => {
        if (res?.user) setUser(res.user);
      })
      .catch(() => {
        // Token invalid/expired — drop it and bounce to /auth.
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/auth");
      });
  }, [token, user, setUser, router]);

  const onPublicRoute = PUBLIC_ROUTES.has(pathname);

  return (
    <ErrorBoundary>
      <ToastContainer />
      <main className="max-w-lg mx-auto min-h-screen">
        {children}
      </main>
      {!onPublicRoute && <BottomNav />}
    </ErrorBoundary>
  );
}
