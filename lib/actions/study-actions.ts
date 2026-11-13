"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizePinyin } from "@/lib/speech";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const AnswerItemSchema = z.object({
  wordId: z.string().uuid(),
  // Với flashcard: userResponse là "known" | "unknown"
  // Với quiz: userResponse là meaning_vi hoặc pinyin đã chọn
  // Với typing: userResponse là chuỗi chữ Hán hoặc Pinyin người dùng gõ
  userResponse: z.string(),
  questionType: z.enum(["flashcard", "meaning_vi", "pinyin", "typing"]).default("flashcard"),
  markedDifficult: z.boolean().optional(),
});

const SubmitStudySessionSchema = z.object({
  deckId: z.string().uuid(),
  mode: z.enum(["flashcard", "quiz", "typing"]),
  durationSeconds: z.number().int().min(1).max(7200),
  answers: z.array(AnswerItemSchema).min(1).max(200),
});

/**
 * SERVER ACTION CHỐNG SPAM BẢNG XẾP HẠNG:
 * - Client KHÔNG được phép tự gửi số điểm (score) lên.
 * - Server tải danh sách từ vựng gốc từ DB, chấm từng câu, tính chuỗi đúng liên tiếp (streak)
 *   và tính tổng điểm dựa trên công thức cố định trên Server:
 *   + Cơ bản: Flashcard = 5 điểm/từ thuộc, Quiz = 10 điểm/câu đúng, Typing = 15 điểm/câu đúng
 *   + Thưởng Streak: +2 * min(streak - 1, 5) điểm cho mỗi câu đúng liên tiếp
 *   + Chặn spam tốc độ: nếu thời gian trung bình < 0.8 giây/câu trong chế độ Quiz/Typing, từ chối ghi điểm.
 * - Đồng thời cập nhật bảng user_progress theo thuật toán Spaced Repetition (Lặp lại ngắt quãng).
 */
export async function submitStudySessionAction(
  rawInput: z.infer<typeof SubmitStudySessionSchema>
) {
  const parsed = SubmitStudySessionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: "Dữ liệu phiên học không hợp lệ." };
  }

  const { deckId, mode, durationSeconds, answers } = parsed.data;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Bạn cần đăng nhập để lưu kết quả học tập." };
  }

  // Kiểm tra chống gian lận tốc độ (Anti-bot / Anti-spam)
  if (mode !== "flashcard" && durationSeconds < Math.floor(answers.length * 0.8)) {
    return {
      error: "Tốc độ hoàn thành bài quá nhanh bất thường. Phiên học không được tính điểm.",
    };
  }

  // Lấy dữ liệu từ vựng chuẩn từ DB để chấm điểm trên Server
  const wordIds = Array.from(new Set(answers.map((a) => a.wordId)));
  const { data: wordsData, error: wordsError } = await supabase
    .from("words")
    .select("id, hanzi, pinyin, meaning_vi")
    .in("id", wordIds);

  if (wordsError || !wordsData) {
    return { error: "Không thể tải dữ liệu từ vựng để chấm điểm." };
  }

  const wordMap = new Map(wordsData.map((w) => [w.id, w]));

  // Lấy tiến độ hiện tại của người dùng cho các từ này
  const { data: existingProgress } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id)
    .in("word_id", wordIds);

  const progressMap = new Map(
    (existingProgress || []).map((p) => [p.word_id, p])
  );

  let correctCount = 0;
  let currentStreak = 0;
  let maxStreak = 0;
  let totalScore = 0;

  const basePoint = mode === "typing" ? 15 : mode === "quiz" ? 10 : 5;
  const now = new Date();
  const progressUpserts: Array<{
    user_id: string;
    word_id: string;
    correct_count: number;
    wrong_count: number;
    last_reviewed_at: string;
    next_review_at: string;
    is_difficult: boolean;
  }> = [];

  for (const item of answers) {
    const dbWord = wordMap.get(item.wordId);
    if (!dbWord) continue;

    let isCorrect = false;
    const trimmedResp = item.userResponse.trim();

    if (mode === "flashcard") {
      isCorrect = trimmedResp === "known";
    } else if (mode === "quiz") {
      if (item.questionType === "pinyin") {
        isCorrect = trimmedResp.toLowerCase() === dbWord.pinyin.trim().toLowerCase();
      } else {
        isCorrect = trimmedResp.toLowerCase() === dbWord.meaning_vi.trim().toLowerCase();
      }
    } else if (mode === "typing") {
      const matchHanzi = trimmedResp === dbWord.hanzi.trim();
      const matchPinyinExact =
        trimmedResp.toLowerCase() === dbWord.pinyin.trim().toLowerCase();
      const matchPinyinNormalized =
        normalizePinyin(trimmedResp) === normalizePinyin(dbWord.pinyin);
      isCorrect = matchHanzi || matchPinyinExact || matchPinyinNormalized;
    }

    const prev = progressMap.get(dbWord.id);
    const prevCorrect = prev?.correct_count ?? 0;
    const prevWrong = prev?.wrong_count ?? 0;

    let nextReviewDate = new Date(now);

    if (isCorrect) {
      correctCount++;
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      const streakBonus = Math.min(currentStreak - 1, 5) * 2;
      totalScore += basePoint + streakBonus;

      // Spaced Repetition (Lặp lại ngắt quãng):
      // Đúng càng nhiều lần, khoảng cách ôn lại càng giãn xa (12h -> 1 ngày -> 3 ngày -> 7 ngày -> 14 ngày -> 30 ngày)
      const newCorrectCount = prevCorrect + 1;
      const intervalsHours = [12, 24, 72, 168, 336, 720];
      const hoursToAdd =
        intervalsHours[Math.min(newCorrectCount - 1, intervalsHours.length - 1)];
      nextReviewDate = new Date(now.getTime() + hoursToAdd * 3600 * 1000);

      progressUpserts.push({
        user_id: user.id,
        word_id: dbWord.id,
        correct_count: newCorrectCount,
        wrong_count: prevWrong,
        last_reviewed_at: now.toISOString(),
        next_review_at: nextReviewDate.toISOString(),
        is_difficult: item.markedDifficult ?? prev?.is_difficult ?? false,
      });
    } else {
      currentStreak = 0;
      // Nếu "Chưa biết" hoặc trả lời sai: xuất hiện lại sớm sau 10 phút
      nextReviewDate = new Date(now.getTime() + 10 * 60 * 1000);

      progressUpserts.push({
        user_id: user.id,
        word_id: dbWord.id,
        correct_count: prevCorrect,
        wrong_count: prevWrong + 1,
        last_reviewed_at: now.toISOString(),
        next_review_at: nextReviewDate.toISOString(),
        is_difficult: item.markedDifficult ?? true,
      });
    }
  }

  // Ghi lịch sử phiên học vào bảng study_sessions
  const { data: sessionRecord, error: sessionError } = await supabase
    .from("study_sessions")
    .insert({
      user_id: user.id,
      deck_id: deckId,
      mode,
      score: totalScore,
      correct: correctCount,
      total: answers.length,
      duration_seconds: durationSeconds,
    })
    .select()
    .single();

  if (sessionError) {
    return { error: `Lỗi lưu phiên học: ${sessionError.message}` };
  }

  // Cập nhật bảng user_progress
  if (progressUpserts.length > 0) {
    await supabase.from("user_progress").upsert(progressUpserts, {
      onConflict: "user_id,word_id",
    });
  }

  revalidatePath("/decks");
  revalidatePath(`/decks/${deckId}/study`);
  revalidatePath("/leaderboard");
  revalidatePath("/profile");

  return {
    success: true,
    score: totalScore,
    correct: correctCount,
    total: answers.length,
    maxStreak,
    sessionId: sessionRecord.id,
  };
}

/**
 * Đánh dấu hoặc bỏ đánh dấu từ "Khó" (is_difficult)
 */
export async function toggleDifficultWordAction(wordId: string, isDifficult: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Chưa đăng nhập." };

  const { error } = await supabase.from("user_progress").upsert(
    {
      user_id: user.id,
      word_id: wordId,
      is_difficult: isDifficult,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,word_id" }
  );

  if (error) return { error: error.message };
  revalidatePath("/decks");
  revalidatePath("/profile");
  return { success: true };
}
