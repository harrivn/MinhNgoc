import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LeaderboardEntry } from "@/types/database";
import { Trophy, Medal } from "lucide-react";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { period?: string; deck?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const period =
    searchParams.period === "week" || searchParams.period === "month"
      ? searchParams.period
      : "all";
  const deckId = searchParams.deck || null;

  const { data: decks } = await supabase
    .from("decks")
    .select("id, name, hsk_level")
    .order("hsk_level", { ascending: true });

  // Gọi RPC get_leaderboard tính tổng điểm theo khoảng thời gian & bộ từ
  const { data: rows } = await supabase.rpc("get_leaderboard", {
    p_period: period,
    p_deck_id: deckId,
    p_limit: 100,
  });

  const entries = (rows || []) as LeaderboardEntry[];
  const myRankEntry = entries.find((e) => e.user_id === user?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <span>Bảng xếp hạng Học viên</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Điểm được xác thực tự động từ máy chủ sau mỗi lượt hoàn thành bài học
          </p>
        </div>

        {/* Bộ lọc Khoảng thời gian: Toàn thời gian / Tuần này / Tháng này */}
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
          {[
            { key: "all", label: "Toàn thời gian" },
            { key: "week", label: "Tuần này" },
            { key: "month", label: "Tháng này" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={`/leaderboard?period=${tab.key}${deckId ? `&deck=${deckId}` : ""}`}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${period === tab.key
                  ? "bg-red-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Bộ lọc theo Bộ từ (Deck) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Link
          href={`/leaderboard?period=${period}`}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${!deckId
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            }`}
        >
          Tất cả bộ từ
        </Link>
        {(decks || []).map((d) => (
          <Link
            key={d.id}
            href={`/leaderboard?period=${period}&deck=${d.id}`}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${deckId === d.id
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              }`}
          >
            {d.name}
          </Link>
        ))}
      </div>

      {/* Thẻ hiển thị vị trí của chính người dùng hiện tại */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-90">
            Thứ hạng của bạn trong bảng này
          </div>
          <div className="text-lg font-bold">
            {myRankEntry
              ? `Hạng #${myRankEntry.rank_position} — ${myRankEntry.total_score} điểm (${myRankEntry.sessions_count} lượt học)`
              : "Bạn chưa có lượt học nào trong khoảng thời gian / bộ từ này"}
          </div>
        </div>
        <Link
          href="/decks"
          className="px-4 py-2 rounded-xl bg-white text-red-600 text-sm font-bold hover:bg-red-50 transition"
        >
          Ôn tập ngay để tăng hạng
        </Link>
      </div>

      {/* Bảng danh sách xếp hạng */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500">
              <th className="py-3.5 px-4">Hạng</th>
              <th className="py-3.5 px-4">Học viên</th>
              <th className="py-3.5 px-4 text-right">Số lượt học</th>
              <th className="py-3.5 px-4 text-right">Tỉ lệ đúng</th>
              <th className="py-3.5 px-4 text-right">Tổng điểm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  Chưa có dữ liệu điểm trong khoảng thời gian này.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isMe = entry.user_id === user?.id;
                return (
                  <tr
                    key={entry.user_id}
                    className={
                      isMe
                        ? "bg-red-50/70 dark:bg-red-950/30 font-semibold"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }
                  >
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold">
                        {entry.rank_position <= 3 && (
                          <Medal
                            className={`w-4 h-4 ${entry.rank_position === 1
                                ? "text-amber-500"
                                : entry.rank_position === 2
                                  ? "text-slate-400"
                                  : "text-amber-700"
                              }`}
                          />
                        )}
                        #{entry.rank_position}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>{entry.display_name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">{entry.sessions_count}</td>
                    <td className="py-3.5 px-4 text-right">{entry.accuracy}%</td>
                    <td className="py-3.5 px-4 text-right font-bold text-red-600 dark:text-red-400">
                      {entry.total_score.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
