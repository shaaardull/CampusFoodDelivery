"use client";

import Link from "next/link";
import useSWR from "swr";
import { getMyOrders } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { SkeletonCard } from "@/components/shared/Loaders";
import type { Order } from "@/types";

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  accepted: "bg-yellow-100 text-yellow-700",
  purchased: "bg-orange-100 text-orange-700",
  in_transit: "bg-purple-100 text-purple-700",
  arrived: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function MyOrdersPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useSWR("my-orders", getMyOrders, {
    refreshInterval: 15000,
  });

  const orders: Order[] = data?.orders || [];

  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.status)
  );
  const pastOrders = orders.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  );

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No orders yet</p>
          <p className="text-sm">Place your first order from the home page</p>
        </div>
      ) : (
        <>
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">
                Active ({activeOrders.length})
              </h2>
              <div className="space-y-3">
                {activeOrders.map((order) => (
                  <OrderCard key={order.id} order={order} userId={user?.uid} />
                ))}
              </div>
            </div>
          )}

          {/* Past Orders */}
          {pastOrders.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">
                Past ({pastOrders.length})
              </h2>
              <div className="space-y-3">
                {pastOrders.map((order) => (
                  <OrderCard key={order.id} order={order} userId={user?.uid} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OrderCard({ order, userId }: { order: Order; userId?: string }) {
  const isRequester = order.requester_uid === userId;
  const role = isRequester ? "Requester" : "Pilot";

  return (
    <Link href={`/track/${order.id}`}>
      <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-brand-200 transition">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{order.items_text}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {order.source === "upahar_ghar" ? "Upahar Ghar" : "Nescafe"} →{" "}
              {order.drop_location_name}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-2 ${
              STATUS_COLOR[order.status] || "bg-gray-100 text-gray-700"
            }`}
          >
            {order.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>
            &#8377;{order.total_amount} &middot; {role}
          </span>
          <span>
            {new Date(order.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
