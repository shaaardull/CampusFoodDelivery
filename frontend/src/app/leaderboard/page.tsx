"use client";

import useSWR from "swr";
import { getLeaderboard } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { SkeletonCard } from "@/components/shared/Loaders";

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useSWR("leaderboard", () => getLeaderboard(20));

  const entries = data?.leaderboard || [];

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold mb-2">Campus Pilot Rankings</h1>
      <p className="text-gray-500 text-sm mb-6">
        Top pilots by deliveries completed
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No pilots yet</p>
          <p className="text-sm">Be the first Campus Pilot!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => {
            const isMe = entry.uid === user?.uid;
            const medal =
              i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : i === 2 ? "bg-amber-600" : "bg-gray-100";

            return (
              <div
                key={entry.uid}
                className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${
                  isMe ? "border-brand-300 bg-brand-50" : "border-gray-100"
                }`}
              >
                {/* Rank Badge */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i < 3 ? `${medal} text-white` : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {i + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {entry.name} {isMe && "(You)"}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">
                    {entry.hostel_block} &middot; {entry.reputation_score}/5
                  </p>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <p className="font-bold text-brand-600">
                    {entry.deliveries_count}
                  </p>
                  <p className="text-xs text-gray-400">deliveries</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    &#8377;{entry.lifetime_earnings}
                  </p>
                  <p className="text-xs text-gray-400">earned</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
