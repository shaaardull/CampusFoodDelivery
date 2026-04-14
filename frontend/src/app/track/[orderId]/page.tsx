"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { getOrder, cancelOrder, getPilotLocation } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useOrderWs } from "@/hooks/useOrderWs";
import { useToastStore } from "@/hooks/useToast";
import { Spinner, PageLoader } from "@/components/shared/Loaders";
import type { WsMessage, OrderStatus } from "@/types";

// Lazy load map (Leaflet needs window)
const LiveMap = dynamic(() => import("@/components/map/LiveMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-xl bg-gray-100 animate-pulse" />,
});

const STATUS_STEPS: OrderStatus[] = [
  "open",
  "accepted",
  "purchased",
  "in_transit",
  "arrived",
  "completed",
];

const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for pilot",
  accepted: "Pilot accepted",
  purchased: "Food purchased",
  in_transit: "On the way",
  arrived: "Pilot arrived",
  completed: "Delivered",
  cancelled: "Cancelled",
};

export default function TrackOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [pilotLat, setPilotLat] = useState<number | undefined>();
  const [pilotLng, setPilotLng] = useState<number | undefined>();
  const [chatMessages, setChatMessages] = useState<
    { text: string; role: string; timestamp: number }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const { data, isLoading, mutate: refreshOrder } = useSWR(
    orderId ? ["order", orderId] : null,
    () => getOrder(orderId),
    { refreshInterval: 15000 }
  );

  // Seed the map with the last known pilot location from the WS server's Redis
  // cache, so the marker shows even if we join after the pilot last broadcast.
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    getPilotLocation(orderId)
      .then((loc) => {
        if (cancelled) return;
        if (typeof loc.lat === "number" && typeof loc.lng === "number") {
          setPilotLat(loc.lat);
          setPilotLng(loc.lng);
        }
      })
      .catch(() => {
        // WS server down or no cached location — map will just have no pilot pin
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const onWsMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "location") {
        setPilotLat(msg.lat);
        setPilotLng(msg.lng);
      } else if (msg.type === "chat") {
        setChatMessages((prev) => [
          ...prev,
          { text: (msg as { text: string }).text, role: msg.role, timestamp: msg.timestamp },
        ]);
      } else if (msg.type === "status") {
        refreshOrder();
      }
    },
    [refreshOrder]
  );

  const { send, connected } = useOrderWs({
    orderId,
    role: "requester",
    onMessage: onWsMessage,
  });

  const order = data?.order;
  const isRequester = order?.requester_uid === user?.uid;

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    send({ type: "chat", text: chatInput });
    setChatMessages((prev) => [
      ...prev,
      { text: chatInput, role: "requester", timestamp: Date.now() / 1000 },
    ]);
    setChatInput("");
  };

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      await cancelOrder(order.id, "Cancelled by requester");
      addToast("Order cancelled", "info");
      refreshOrder();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to cancel", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!order) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>Order not found</p>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status as OrderStatus);

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <button
        onClick={() => router.push("/orders")}
        className="text-sm text-brand-600 mb-4 flex items-center gap-1"
      >
        ← Back to Orders
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Order Tracking</h1>
        {connected && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Live
          </span>
        )}
      </div>

      {/* Status Steps */}
      {order.status !== "cancelled" && (
        <div className="flex items-center gap-1 mb-6 overflow-x-auto no-scrollbar">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  i <= currentStep ? "bg-brand-500" : "bg-gray-200"
                }`}
              />
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={`w-6 h-0.5 ${
                    i < currentStep ? "bg-brand-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className={`text-center py-3 rounded-xl mb-4 font-medium ${
          order.status === "cancelled"
            ? "bg-red-50 text-red-600"
            : order.status === "completed"
            ? "bg-green-50 text-green-600"
            : "bg-brand-50 text-brand-700"
        }`}
      >
        {STATUS_LABEL[order.status] || order.status}
      </div>

      {/* Map (show from acceptance onwards so the requester can watch the pilot) */}
      {["accepted", "purchased", "in_transit", "arrived"].includes(order.status) && (
        <div className="mb-4">
          <LiveMap pilotLat={pilotLat} pilotLng={pilotLng} />
          {pilotLat === undefined && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              Waiting for pilot&apos;s location&hellip; (they may not have
              granted GPS permission yet)
            </p>
          )}
        </div>
      )}

      {/* Order Details */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 space-y-2 text-sm">
        <p>
          <span className="text-gray-500">Items:</span> {order.items_text}
        </p>
        <p>
          <span className="text-gray-500">Source:</span>{" "}
          {order.source === "upahar_ghar" ? "Upahar Ghar" : "Nescafe"}
        </p>
        <p>
          <span className="text-gray-500">Drop:</span>{" "}
          {order.drop_location_name}
          {order.floor_number && `, Floor ${order.floor_number}`}
        </p>
        <p>
          <span className="text-gray-500">Total (Cash):</span>{" "}
          <span className="font-bold">&#8377;{order.total_amount}</span>
        </p>
        {order.special_instructions && (
          <p>
            <span className="text-gray-500">Note:</span>{" "}
            {order.special_instructions}
          </p>
        )}
      </div>

      {/* OTP (visible only to requester, after acceptance) */}
      {isRequester &&
        order.handover_otp &&
        ["accepted", "purchased", "in_transit", "arrived"].includes(order.status) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-center">
            <p className="text-sm text-yellow-700 mb-1">
              Handover OTP — Share with pilot at delivery
            </p>
            <p className="text-3xl font-bold tracking-widest text-yellow-800">
              {order.handover_otp}
            </p>
          </div>
        )}

      {/* Chat */}
      {["accepted", "purchased", "in_transit", "arrived"].includes(order.status) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <h3 className="font-medium text-sm mb-2">Chat with Pilot</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
            {chatMessages.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                No messages yet
              </p>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm px-3 py-1.5 rounded-lg max-w-[80%] ${
                    msg.role === "requester"
                      ? "bg-brand-50 text-brand-800 ml-auto"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.text}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Cancel Button (only for requester, only if open/accepted) */}
      {isRequester && ["open", "accepted"].includes(order.status) && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full py-3 border-2 border-red-200 text-red-500 rounded-xl font-medium hover:bg-red-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {cancelling ? <Spinner className="h-4 w-4" /> : "Cancel Order"}
        </button>
      )}
    </div>
  );
}
