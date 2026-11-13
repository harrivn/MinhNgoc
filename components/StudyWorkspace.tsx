"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Deck, StudyMode, UserProgress, Word } from "@/types/database";
import SpeakButton from "./SpeakButton";
import { speakChinese, normalizePinyin } from "@/lib/speech";
import {
  submitStudySessionAction,
  toggleDifficultWordAction,
} from "@/lib/actions/study-actions";
import {
  Star,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Flame,
  Trophy,
  ArrowLeft,
} from "lucide-react";

interface StudyWorkspaceProps {
  deck: Deck;
  words: Word[];
  initialProgress: UserProgress[];
  initialFilter: "all" | "difficult" | "srs";
}

export default function StudyWorkspace({
  deck,
  words,
  initialProgress,
  initialFilter,
}: StudyWorkspaceProps) {
  const [mode, setMode] = useState<StudyMode>("flashcard");
  const [quizTarget, setQuizTarget] = useState<"meaning_vi" | "pinyin">("meaning_vi");
  const [filterMode, setFilterMode] = useState<"all" | "difficult" | "srs">(initialFilter);

  const [difficultMap, setDifficultMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    initialProgress.forEach((p) => {
      map[p.word_id] = p.is_difficult;
    });
    return map;
  });

  const progressMap = useMemo(() => {
    const map = new Map<string, UserProgress>();
    initialProgress.forEach((p) => map.set(p.word_id, p));
    return map;
  }, [initialProgress]);

  // Lọc và sắp xếp danh sách từ theo chế độ lọc (Tất cả / Từ khó / Spaced Repetition ưu tiên từ chưa thuộc)
  const studyWords = useMemo(() => {
    const now = Date.now();
    let list = [...words];

    if (filterMode === "difficult") {
      list = list.filter((w) => difficultMap[w.id]);
    } else if (filterMode === "srs") {
      list.sort((a, b) => {
        const pa = progressMap.get(a.id);
        const pb = progressMap.get(b.id);
        const nextA = pa ? new Date(pa.next_review_at).getTime() : 0;
        const nextB = pb ? new Date(pb.next_review_at).getTime() : 0;
        return (nextA - now) - (nextB - now);
      });
    }

    return list;
  }, [words, filterMode, difficultMap, progressMap]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [typingInput, setTypingInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [streak, setStreak] = useState(0);
  const [startTime, setStartTime] = useState<number>(() => Date.now());

  const [answersLog, setAnswersLog] = useState<
    Array<{
      wordId: string;
      userResponse: string;
      questionType: "flashcard" | "meaning_vi" | "pinyin" | "typing";
      markedDifficult?: boolean;
    }>
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [sessionResult, setSessionResult] = useState<{
    score: number;
    correct: number;
    total: number;
    maxStreak: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentWord = studyWords[currentIndex];

  // Tạo 4 đáp án ngẫu nhiên cho chế độ Trắc nghiệm
  const quizOptions = useMemo(() => {
    if (!currentWord || words.length === 0) return [];
    const correctVal =
      quizTarget === "pinyin" ? currentWord.pinyin : currentWord.meaning_vi;
    const pool = words
      .filter((w) => w.id !== currentWord.id)
      .map((w) => (quizTarget === "pinyin" ? w.pinyin : w.meaning_vi));

    const shuffledDistractors = Array.from(new Set(pool))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    return [...shuffledDistractors, correctVal].sort(() => Math.random() - 0.5);
  }, [currentWord, words, quizTarget]);

  const resetSession = (newMode?: StudyMode) => {
    if (newMode) setMode(newMode);
    setCurrentIndex(0);
    setIsFlipped(false);
    setTypingInput("");
    setSelectedOption(null);
    setFeedback(null);
    setStreak(0);
    setAnswersLog([]);
    setSessionResult(null);
    setErrorMsg(null);
    setStartTime(Date.now());
  };

  useEffect(() => {
    resetSession();
  }, [filterMode]);

  const handleToggleDifficult = async (wordId: string) => {
    const nextVal = !difficultMap[wordId];
    setDifficultMap((prev) => ({ ...prev, [wordId]: nextVal }));
    await toggleDifficultWordAction(wordId, nextVal);
  };

  const advanceOrFinish = async (
    updatedAnswers: typeof answersLog
  ) => {
    if (currentIndex + 1 < studyWords.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setTypingInput("");
      setSelectedOption(null);
      setFeedback(null);
    } else {
      // Hoàn thành toàn bộ từ -> gửi lên Server Action để chấm điểm
      setSubmitting(true);
      setErrorMsg(null);
      const durationSeconds = Math.max(
        2,
        Math.round((Date.now() - startTime) / 1000)
      );
      const res = await submitStudySessionAction({
        deckId: deck.id,
        mode,
        durationSeconds,
        answers: updatedAnswers,
      });
      setSubmitting(false);

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.success) {
        setSessionResult({
          score: res.score!,
          correct: res.correct!,
          total: res.total!,
          maxStreak: res.maxStreak!,
        });
      }
    }
  };

  const handleFlashcardJudge = async (known: boolean) => {
    if (!currentWord) return;
    const nextStreak = known ? streak + 1 : 0;
    setStreak(nextStreak);

    const nextAnswers = [
      ...answersLog,
      {
        wordId: currentWord.id,
        userResponse: known ? "known" : "unknown",
        questionType: "flashcard" as const,
        markedDifficult: difficultMap[currentWord.id],
      },
    ];
    setAnswersLog(nextAnswers);
    await advanceOrFinish(nextAnswers);
  };

  const handleQuizSelect = (option: string) => {
    if (!currentWord || feedback !== null) return;
    setSelectedOption(option);

    const expected =
      quizTarget === "pinyin" ? currentWord.pinyin : currentWord.meaning_vi;
    const isCorrect = option.trim().toLowerCase() === expected.trim().toLowerCase();

    setFeedback(isCorrect ? "correct" : "wrong");
    setStreak((s) => (isCorrect ? s + 1 : 0));
    speakChinese(currentWord.hanzi);

    const nextAnswers = [
      ...answersLog,
      {
        wordId: currentWord.id,
        userResponse: option,
        questionType: quizTarget,
        markedDifficult: difficultMap[currentWord.id],
      },
    ];
    setAnswersLog(nextAnswers);

    setTimeout(() => {
      advanceOrFinish(nextAnswers);
    }, 900);
  };

  const handleTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord || !typingInput.trim() || feedback !== null) return;

    const val = typingInput.trim();
    const isCorrect =
      val === currentWord.hanzi.trim() ||
      val.toLowerCase() === currentWord.pinyin.trim().toLowerCase() ||
      normalizePinyin(val) === normalizePinyin(currentWord.pinyin);

    setFeedback(isCorrect ? "correct" : "wrong");
    setStreak((s) => (isCorrect ? s + 1 : 0));
    speakChinese(currentWord.hanzi);

    const nextAnswers = [
      ...answersLog,
      {
        wordId: currentWord.id,
        userResponse: val,
        questionType: "typing" as const,
        markedDifficult: difficultMap[currentWord.id],
      },
    ];
    setAnswersLog(nextAnswers);

    setTimeout(() => {
      advanceOrFinish(nextAnswers);
    }, 1100);
  };

  if (studyWords.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-400">
          Không có từ vựng nào khớp với bộ lọc hiện tại.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold"
          >
            Xem toàn bộ từ trong bộ
          </button>
          <Link
            href="/decks"
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium"
          >
            Quay lại danh sách bộ từ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Thanh điều hướng & chọn chế độ học */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/decks"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại danh sách bộ từ</span>
          </Link>
          <h1 className="text-xl font-bold">{deck.name}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["flashcard", "quiz", "typing"] as StudyMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => resetSession(m)}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                mode === m
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {m === "flashcard"
                ? "Thẻ ghi nhớ"
                : m === "quiz"
                ? "Trắc nghiệm"
                : "Điền từ"}
            </button>
          ))}
        </div>
      </div>

      {/* Bộ lọc chế độ lặp lại ngắt quãng / từ khó + chuỗi Streak */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-2.5 py-1.5 rounded-lg font-medium ${
              filterMode === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Tất cả ({words.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("srs")}
            className={`px-2.5 py-1.5 rounded-lg font-medium ${
              filterMode === "srs"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Ưu tiên SRS (Ngắt quãng)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("difficult")}
            className={`px-2.5 py-1.5 rounded-lg font-medium ${
              filterMode === "difficult"
                ? "bg-amber-500 text-white"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            Từ khó
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm font-semibold">
          <span className="inline-flex items-center gap-1 text-orange-500">
            <Flame className="w-4 h-4 fill-orange-500" />
            Streak: {streak}
          </span>
          <span className="text-slate-500">
            Câu {currentIndex + 1} / {studyWords.length}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-red-600 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Màn hình Kết quả sau khi hoàn thành lượt học */}
      {sessionResult ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 mx-auto flex items-center justify-center">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Hoàn thành lượt ôn tập!</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="text-xs text-slate-500">Điểm đạt được</div>
              <div className="text-2xl font-bold text-red-600">
                +{sessionResult.score}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="text-xs text-slate-500">Số câu đúng</div>
              <div className="text-2xl font-bold text-emerald-600">
                {sessionResult.correct}/{sessionResult.total}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="text-xs text-slate-500">Chuỗi Streak</div>
              <div className="text-2xl font-bold text-orange-500">
                {sessionResult.maxStreak}
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => resetSession()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Học lại bộ này</span>
            </button>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
            >
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Xem Bảng xếp hạng</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Nội dung bài học hiện tại */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header thẻ từ: Nút phát âm + Đánh dấu từ khó */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SpeakButton text={currentWord.hanzi} label="Phát âm từ" />
              {currentWord.example_hanzi && (
                <SpeakButton
                  text={currentWord.example_hanzi}
                  label="Đọc câu ví dụ"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => handleToggleDifficult(currentWord.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                difficultMap[currentWord.id]
                  ? "bg-amber-50 dark:bg-amber-950/70 border-amber-300 text-amber-700 dark:text-amber-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-500"
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  difficultMap[currentWord.id] ? "fill-amber-400 text-amber-500" : ""
                }`}
              />
              <span>{difficultMap[currentWord.id] ? "Đã đánh dấu Khó" : "Đánh dấu từ khó"}</span>
            </button>
          </div>

          {/* CHẾ ĐỘ 1: FLASHCARD (LẬT THẺ) */}
          {mode === "flashcard" && (
            <div className="space-y-6">
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="cursor-pointer select-none min-h-[260px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center transition hover:border-red-400"
              >
                {!isFlipped ? (
                  <>
                    <div className="font-hanzi text-6xl sm:text-7xl font-bold text-slate-900 dark:text-white mb-4">
                      {currentWord.hanzi}
                    </div>
                    <p className="text-xs uppercase tracking-wider text-slate-400">
                      Nhấn vào thẻ để lật xem Pinyin, Nghĩa & Câu ví dụ
                    </p>
                  </>
                ) : (
                  <div className="space-y-3 max-w-lg">
                    <div className="font-hanzi text-4xl font-bold text-red-600">
                      {currentWord.hanzi}
                    </div>
                    <div className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                      [{currentWord.pinyin}]
                    </div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {currentWord.meaning_vi}
                      {currentWord.meaning_en ? ` (${currentWord.meaning_en})` : ""}
                    </div>
                    {currentWord.example_hanzi && (
                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-sm space-y-1">
                        <div className="font-hanzi text-base font-medium">
                          {currentWord.example_hanzi}
                        </div>
                        <div className="text-slate-500">
                          {currentWord.example_pinyin}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 italic">
                          “{currentWord.example_meaning}”
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFlashcardJudge(false)}
                  className="py-3 px-4 rounded-xl border-2 border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/40 text-red-600 dark:text-red-300 font-semibold hover:bg-red-100 transition flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  <span>Chưa biết (Ôn lại sớm)</span>
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFlashcardJudge(true)}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Đã biết (+Điểm)</span>
                </button>
              </div>
            </div>
          )}

          {/* CHẾ ĐỘ 2: TRẮC NGHIỆM 4 ĐÁP ÁN */}
          {mode === "quiz" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Chọn loại câu hỏi trắc nghiệm:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setQuizTarget("meaning_vi")}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      quizTarget === "meaning_vi"
                        ? "bg-red-600 text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Chọn Nghĩa đúng
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuizTarget("pinyin")}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      quizTarget === "pinyin"
                        ? "bg-red-600 text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Chọn Pinyin đúng
                  </button>
                </div>
              </div>

              <div className="text-center py-6">
                <div className="font-hanzi text-6xl font-bold mb-2">
                  {currentWord.hanzi}
                </div>
                {quizTarget === "meaning_vi" && (
                  <div className="text-slate-500 text-base">
                    [{currentWord.pinyin}]
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quizOptions.map((option, idx) => {
                  const isExpected =
                    option ===
                    (quizTarget === "pinyin"
                      ? currentWord.pinyin
                      : currentWord.meaning_vi);
                  const isChosen = selectedOption === option;

                  let btnClass =
                    "border-slate-200 dark:border-slate-700 hover:border-red-400";
                  if (feedback !== null) {
                    if (isExpected) {
                      btnClass =
                        "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300";
                    } else if (isChosen) {
                      btnClass =
                        "border-red-500 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={feedback !== null || submitting}
                      onClick={() => handleQuizSelect(option)}
                      className={`p-4 rounded-xl border-2 text-left font-medium transition ${btnClass}`}
                    >
                      <span className="text-xs font-bold text-slate-400 mr-2">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CHẾ ĐỘ 3: ĐIỀN TỪ (TYPING HANZI HOẶC PINYIN) */}
          {mode === "typing" && (
            <form onSubmit={handleTypingSubmit} className="space-y-6">
              <div className="text-center py-6 space-y-2">
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  Nghĩa tiếng Việt
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  {currentWord.meaning_vi}
                </div>
                {currentWord.meaning_en && (
                  <div className="text-sm text-slate-500">
                    ({currentWord.meaning_en})
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Gõ Chữ Hán (ví dụ: {currentWord.hanzi}) hoặc Pinyin (có dấu hoặc không dấu):
                </label>
                <input
                  type="text"
                  value={typingInput}
                  onChange={(e) => setTypingInput(e.target.value)}
                  disabled={feedback !== null || submitting}
                  placeholder="Nhập chữ Hán hoặc Pinyin..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-lg font-hanzi focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {feedback && (
                <div
                  className={`p-3.5 rounded-xl text-sm font-medium ${
                    feedback === "correct"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300"
                  }`}
                >
                  {feedback === "correct"
                    ? `Chính xác! ${currentWord.hanzi} (${currentWord.pinyin})`
                    : `Đáp án đúng là: ${currentWord.hanzi} (${currentWord.pinyin})`}
                </div>
              )}

              <button
                type="submit"
                disabled={feedback !== null || submitting}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition"
              >
                Kiểm tra đáp án
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
