"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { getMe, updateMe } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/hooks/useToast";
import { Spinner, PageLoader } from "@/components/shared/Loaders";

export default function ProfilePage() {
  const router = useRouter();
  const { setUser, logout } = useAuthStore();
  const { addToast } = useToastStore();

  const { data, isLoading } = useSWR("me", getMe);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [hostel, setHostel] = useState<"talpona" | "terekhol">("talpona");
  const [room, setRoom] = useState("");
  const [upi, setUpi] = useState("");
  const [saving, setSaving] = useState(false);

  const user = data?.user;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setHostel(user.hostel_block);
      setRoom(user.room_number || "");
      setUpi(user.upi_vpa || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (name !== user.name) updates.name = name;
      if (hostel !== user.hostel_block) updates.hostel_block = hostel;
      if (room !== (user.room_number || "")) updates.room_number = room;
      if (upi !== (user.upi_vpa || "")) updates.upi_vpa = upi;

      if (Object.keys(updates).length === 0) {
        setEditing(false);
        return;
      }

      const res = await updateMe(updates);
      setUser(res.user);
      setEditing(false);
      addToast("Profile updated", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace("/auth");
  };

  if (isLoading) return <PageLoader />;
  if (!user) return null;

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-brand-600">{user.deliveries_count}</p>
          <p className="text-xs text-gray-500">Deliveries</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            &#8377;{user.lifetime_earnings}
          </p>
          <p className="text-xs text-gray-500">Earned</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {user.reputation_score}
          </p>
          <p className="text-xs text-gray-500">Rating</p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Details</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-brand-600 font-medium"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-gray-500"
            >
              Cancel
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hostel</label>
              <div className="grid grid-cols-2 gap-2">
                {(["talpona", "terekhol"] as const).map((h) => (
                  <button
                    key={h}
                    onClick={() => setHostel(h)}
                    className={`py-2 rounded-lg border text-sm capitalize ${
                      hostel === h
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Room</label>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">UPI ID</label>
              <input
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                placeholder="yourname@upi"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-brand-500 text-white rounded-lg font-medium text-sm hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Spinner className="h-4 w-4" /> : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span>{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Hostel</span>
              <span className="capitalize">{user.hostel_block}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Room</span>
              <span>{user.room_number || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">UPI</span>
              <span>{user.upi_vpa || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Orders placed</span>
              <span>{user.lifetime_ordered}</span>
            </div>
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 border-2 border-red-200 text-red-500 rounded-xl font-medium hover:bg-red-50 transition"
      >
        Log Out
      </button>
    </div>
  );
}
