"use client";

import { useEffect } from "react";
import { subscribePush } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const json = subscription.toJSON();
        if (json.endpoint && json.keys) {
          await subscribePush({
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh!,
            auth_key: json.keys.auth!,
          });
        }
      } catch {
        // Push registration is best-effort
      }
    })();
  }, [enabled]);
}
