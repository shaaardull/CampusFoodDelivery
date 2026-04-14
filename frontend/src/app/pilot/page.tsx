"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { getOpenOrders, acceptOrder, advanceStatus, completeOrder } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/hooks/useToast";
import { useOrderWs, usePilotLocationBroadcast } from "@/hooks/useOrderWs";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Spinner, SkeletonCard } from "@/components/shared/Loaders";
import type { Order, OrderStatus } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  accepted: "Mark as Purchased",
  purchased: "Start Delivery",
  in_transit: "Arrived at Drop",
};

export default function PilotPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [pilotMode, setPilotMode] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  // Fetch open orders when in pilot mode
  const { data, isLoading } = useSWR(
    pilotMode ? "open-orders" : null,
    () => getOpenOrders(),
    { refreshInterval: 10000 }
  );

  // Push notifications when pilot mode is on
  usePushNotifications(pilotMode);

  // WebSocket for active order
  const { send, connected } = useOrderWs({
    orderId: activeOrder?.id || "none",
    role: "pilot",
  });

  // Broadcast GPS location whenever the pilot has an active, in-progress order.
  // Broadcasts from acceptance onwards so the requester can see the pilot's
  // position on the map from the moment someone picks up the order.
  usePilotLocationBroadcast(
    send,
    !!activeOrder &&
      ["accepted", "purchased", "in_transit", "arrived"].includes(activeOrder.status)
  );

  const orders = data?.orders || [];

  const handleAccept = async (orderId: string) => {
    setLoading(orderId);
    try {
      const res = await acceptOrder(orderId);
      setActiveOrder(res.order);
      addToast("Mission accepted! Head to the canteen.", "success");
      mutate("open-orders");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Could not accept order", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleAdvance = async () => {
    if (!activeOrder) return;
    setLoading("advance");
    try {
      const res = await advanceStatus(activeOrder.id);
      setActiveOrder(res.order);
      send({ type: "status", status: res.order.status });
      addToast(`Status updated: ${res.order.status.replace("_", " ")}`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to update status", "error");
    } finally {
      setLoading(null);
    }
  };

  const handleComplete = async () => {
    if (!activeOrder || !otpInput) return;
    setLoading("complete");
    try {
      const res = await completeOrder(activeOrder.id, otpInput);
      send({ type: "status", status: "completed" });
      addToast(
        `Delivery complete! You earned ₹${res.order.incentive}`,
        "success"
      );
      setActiveOrder(null);
      setOtpInput("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Invalid OTP", "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Campus Pilot</h1>
          <p className="text-gray-500 text-sm">
            {pilotMode ? "Looking for missions..." : "Toggle to start accepting"}
          </p>
        </div>
        <button
          onClick={() => setPilotMode(!pilotMode)}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            pilotMode ? "bg-green-500" : "bg-gray-300"
          }`}
        >
          <div
            className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              pilotMode ? "translate-x-7" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Active Order (Pilot is delivering) */}
      {activeOrder && (
        <div className="bg-white rounded-2xl border-2 border-brand-500 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">Active Mission</h2>
            {connected && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Live
              </span>
            )}
          </div>

          <div className="space-y-2 text-sm mb-4">
            <p>
              <span className="text-gray-500">Items:</span>{" "}
              {activeOrder.items_text}
            </p>
            <p>
              <span className="text-gray-500">Source:</span>{" "}
              {activeOrder.source === "upahar_ghar" ? "Upahar Ghar" : "Nescafe"}
            </p>
            <p>
              <span className="text-gray-500">Drop:</span>{" "}
              {activeOrder.drop_location_name}
              {activeOrder.floor_number && `, Floor ${activeOrder.floor_number}`}
            </p>
            <p>
              <span className="text-gray-500">Incentive:</span>{" "}
              <span className="text-green-600 font-bold">
                &#8377;{activeOrder.incentive}
              </span>
            </p>
            {activeOrder.special_instructions && (
              <p>
                <span className="text-gray-500">Note:</span>{" "}
                {activeOrder.special_instructions}
              </p>
            )}
            <p>
              <span className="text-gray-500">Status:</span>{" "}
              <span className="font-medium capitalize">
                {activeOrder.status.replace("_", " ")}
              </span>
            </p>
          </div>

          {/* Status Advance Button */}
          {activeOrder.status !== "arrived" && STATUS_LABELS[activeOrder.status] && (
            <button
              onClick={handleAdvance}
              disabled={loading === "advance"}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
            >
              {loading === "advance" ? <Spinner /> : STATUS_LABELS[activeOrder.status]}
            </button>
          )}

          {/* OTP Entry for Completion */}
          {activeOrder.status === "arrived" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                Ask the requester for the 4-digit OTP to complete delivery.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-xl tracking-widest"
              />
              <button
                onClick={handleComplete}
                disabled={loading === "complete" || otpInput.length !== 4}
                className="w-full py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading === "complete" ? <Spinner /> : "Complete Delivery"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mission Feed */}
      {pilotMode && !activeOrder && (
        <>
          <h2 className="font-bold text-lg mb-3">
            Available Missions ({orders.length})
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-1">No orders right now</p>
              <p className="text-sm">Check back in a few minutes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders
                .filter((o) => o.requester_uid !== user?.uid)
                .map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-gray-100 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">{order.items_text}</p>
                        <p className="text-xs text-gray-400">
                          {order.source === "upahar_ghar"
                            ? "Upahar Ghar"
                            : "Nescafe"}{" "}
                          → {order.drop_location_name}
                        </p>
                      </div>
                      <span className="text-green-600 font-bold text-lg">
                        +&#8377;{order.incentive}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Est. &#8377;{order.estimated_cost}
                      </span>
                      <button
                        onClick={() => handleAccept(order.id)}
                        disabled={loading === order.id}
                        className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        {loading === order.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          "Accept"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* Pilot Mode Off */}
      {!pilotMode && !activeOrder && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">&#x1F6E9;&#xFE0F;</div>
          <p className="text-lg mb-1">Pilot Mode Off</p>
          <p className="text-sm">
            Toggle the switch above when you&apos;re at the canteen area
          </p>
        </div>
      )}
    </div>
  );
}
