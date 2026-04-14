"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { getMe } from "@/lib/api";
import BottomNav from "@/components/shared/BottomNav";
import ToastContainer from "@/components/shared/ToastContainer";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { user, hydrate, setUser } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // In DEV_MODE the backend auto-creates a dev user and returns it from
  // /users/me without requiring a JWT. Fetch it so the UI knows who the
  // current user is (needed e.g. for showing the handover OTP to the requester).
  useEffect(() => {
    if (user) return;
    getMe()
      .then((res) => {
        if (res?.user) setUser(res.user);
      })
      .catch(() => {
        // Not authenticated — fine in prod, user will hit the auth flow.
      });
  }, [user, setUser]);

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
