import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BookOpen, Flame, Star, Clock } from "lucide-react";

export default async function DecksPage({
  searchParams,
}: {
  searchParams: { hsk?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const selectedHsk = searchParams.hsk ? Number(searchParams.hsk) : null;

  let query = supabase
    .from("decks")
    .select("*, words(count)")
    .order("hsk_level", { ascending: true })
    .order("name", { ascending: true });

  if (selectedHsk && selectedHsk >= 1 && selectedHsk <= 6) {
    query = query.eq("hsk_level", selectedHsk);
  }

  const { data: decks } = await query;

  // Đếm số từ khó và số từ đến hạn ôn tập Spaced Repetition của người dùng
  const { count: difficultCount } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("is_difficult", true);

  const { count: dueReviewCount } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .lte("next_review_at", new Date().toISOString());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Danh sách Bộ từ vựng HSK</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Chọn cấp độ HSK hoặc chủ đề để bắt đầu học với Flashcard, Trắc nghiệm hoặc Điền từ
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-700 dark:text-amber-300">
            <Star className="w-3.5 h-3.5" />
            <span>Từ khó đã lưu: {difficultCount ?? 0}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs font-medium text-red-700 dark:text-red-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Đến hạn ôn tập (SRS): {dueReviewCount ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Bộ lọc cấp độ HSK 1-6 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Link
          href="/decks"
          className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
            !selectedHsk
              ? "bg-red-600 text-white"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
          }`}
        >
          Tất cả
        </Link>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <Link
            key={level}
            href={`/decks?hsk=${level}`}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
              selectedHsk === level
                ? "bg-red-600 text-white"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
            }`}
          >
            HSK {level}
          </Link>
        ))}
      </div>

      {/* Lưới hiển thị các bộ từ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(decks || []).map((deck) => {
          const wordCount = Array.isArray(deck.words)
            ? deck.words[0]?.count ?? 0
            : 0;
          return (
            <div
              key={deck.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-950/70 text-red-600 dark:text-red-300">
                    HSK {deck.hsk_level}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {wordCount} từ vựng
                  </span>
                </div>
                <h2 className="text-lg font-bold mb-1.5">{deck.name}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                  {deck.description || "Bộ từ vựng chuẩn HSK kèm phiên âm, nghĩa và câu ví dụ."}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <Link
                  href={`/decks/${deck.id}/study`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Học & Kiểm tra</span>
                </Link>
                <Link
                  href={`/decks/${deck.id}/study?filter=difficult`}
                  title="Chỉ ôn tập các từ đã đánh dấu Khó trong bộ này"
                  className="inline-flex items-center justify-center p-2 rounded-xl border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 transition"
                >
                  <Flame className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
