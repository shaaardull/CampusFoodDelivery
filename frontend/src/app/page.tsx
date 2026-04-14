"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { getMenu, getSurge, getDropLocations, placeOrder } from "@/lib/api";
import { useCartStore } from "@/lib/cart-store";
import { useToastStore } from "@/hooks/useToast";
import { Spinner, SkeletonCard } from "@/components/shared/Loaders";
import type { MenuItem, DropLocation } from "@/types";

const CATEGORIES = ["all", "snacks", "beverages", "meals", "desserts"] as const;

export default function HomePage() {
  const [source, setSource] = useState<"upahar_ghar" | "nescafe">("upahar_ghar");
  const [category, setCategory] = useState<string>("all");
  const [showCart, setShowCart] = useState(false);
  const [dropId, setDropId] = useState("");
  const [dropName, setDropName] = useState("");
  const [floor, setFloor] = useState("");
  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);

  const cart = useCartStore();
  const { addToast } = useToastStore();

  const { data: menuData, isLoading: menuLoading } = useSWR(
    ["menu", source, category === "all" ? undefined : category],
    () => getMenu(source, category === "all" ? undefined : category)
  );

  const { data: surgeData } = useSWR("surge", getSurge, {
    refreshInterval: 60000,
  });

  const { data: locData } = useSWR("locations", getDropLocations);

  const locations: DropLocation[] = locData?.locations || [];
  const items: MenuItem[] = menuData?.items || [];

  useEffect(() => {
    if (locations.length > 0 && !dropId) {
      setDropId(locations[0].id);
      setDropName(locations[0].name);
    }
  }, [locations, dropId]);

  const handleAdd = (item: MenuItem) => {
    cart.addItem({
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      source: item.source,
    });
  };

  const handlePlace = async () => {
    if (cart.items.length === 0) return;
    setPlacing(true);
    try {
      await placeOrder({
        source: cart.source!,
        items_text: cart.items.map((i) => `${i.quantity}x ${i.name}`).join(", "),
        estimated_cost: cart.totalCost(),
        incentive: cart.incentive,
        drop_location_id: dropId,
        drop_location_name: dropName,
        floor_number: floor || undefined,
        special_instructions: instructions || undefined,
      });
      addToast("Order placed! A Campus Pilot will pick it up soon.", "success");
      cart.clear();
      setShowCart(false);
      setInstructions("");
      setFloor("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to place order", "error");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Order Food</h1>
        <p className="text-gray-500 text-sm">Get it delivered to your hostel lift</p>
      </div>

      {/* Surge Banner */}
      {surgeData && surgeData.surge_multiplier > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm">
          <span className="font-semibold text-amber-800">
            {surgeData.is_raining ? "Rainy" : "High demand"}
          </span>
          <span className="text-amber-700"> — {surgeData.message}</span>
          <span className="text-xs text-amber-500 block mt-1">
            {surgeData.active_pilots} pilots active, {surgeData.open_orders} open orders
          </span>
        </div>
      )}

      {/* Source Toggle */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(["upahar_ghar", "nescafe"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`py-3 rounded-xl font-medium text-sm transition ${
              source === s
                ? "bg-brand-500 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            {s === "upahar_ghar" ? "Upahar Ghar" : "Nescafe"}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
              category === c
                ? "bg-brand-100 text-brand-700 font-medium"
                : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      {menuLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const inCart = cart.items.find((c) => c.menu_item_id === item.id);
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-100 p-3 flex flex-col"
              >
                <h3 className="font-medium text-sm">{item.name}</h3>
                <p className="text-brand-600 font-bold mt-1">
                  &#8377;{item.price}
                </p>
                <span className="text-xs text-gray-400 capitalize">
                  {item.category}
                </span>
                <div className="mt-auto pt-2">
                  {inCart ? (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() =>
                          cart.updateQuantity(item.id, inCart.quantity - 1)
                        }
                        className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold"
                      >
                        -
                      </button>
                      <span className="font-medium text-sm">
                        {inCart.quantity}
                      </span>
                      <button
                        onClick={() =>
                          cart.updateQuantity(item.id, inCart.quantity + 1)
                        }
                        className="w-8 h-8 rounded-full bg-brand-500 text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAdd(item)}
                      className="w-full py-1.5 text-sm bg-brand-50 text-brand-600 rounded-lg font-medium hover:bg-brand-100 transition"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart Floating Button */}
      {cart.items.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-brand-500 text-white px-6 py-3 rounded-full shadow-lg font-medium flex items-center gap-2 z-40"
        >
          Cart ({cart.items.reduce((s, i) => s + i.quantity, 0)}) —
          &#8377;{cart.totalWithIncentive()}
        </button>
      )}

      {/* Cart Sheet */}
      {showCart && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-5 pb-24 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Your Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                &times;
              </button>
            </div>

            {/* Cart Items */}
            <div className="space-y-3 mb-4">
              {cart.items.map((item) => (
                <div
                  key={item.menu_item_id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      &#8377;{item.price} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        cart.updateQuantity(item.menu_item_id, item.quantity - 1)
                      }
                      className="w-7 h-7 rounded-full bg-gray-100 text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="text-sm w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() =>
                        cart.updateQuantity(item.menu_item_id, item.quantity + 1)
                      }
                      className="w-7 h-7 rounded-full bg-brand-500 text-white text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Incentive Slider */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pilot Incentive: &#8377;{cart.incentive}
              </label>
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={cart.incentive}
                onChange={(e) => cart.setIncentive(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>&#8377;10</span>
                <span>&#8377;50</span>
              </div>
            </div>

            {/* Drop Location */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Drop Location
              </label>
              <select
                value={dropId}
                onChange={(e) => {
                  setDropId(e.target.value);
                  const loc = locations.find((l) => l.id === e.target.value);
                  if (loc) setDropName(loc.name);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Floor */}
            <input
              type="text"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="Floor number (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm mb-3"
            />

            {/* Special Instructions */}
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Special instructions (optional)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm mb-4 resize-none"
            />

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Food cost</span>
                <span>&#8377;{cart.totalCost()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pilot incentive</span>
                <span>&#8377;{cart.incentive}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200">
                <span>Total (Cash)</span>
                <span>&#8377;{cart.totalWithIncentive()}</span>
              </div>
            </div>

            {/* Place Order */}
            <button
              onClick={handlePlace}
              disabled={placing}
              className="w-full py-3 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {placing ? <Spinner /> : `Place Order — Cash &#8377;${cart.totalWithIncentive()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
