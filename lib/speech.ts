"use client";

/**
 * Phát âm tiếng Trung sử dụng Web Speech API (speechSynthesis, lang="zh-CN")
 * Hoàn toàn miễn phí, chạy trực tiếp trên trình duyệt không cần API bên ngoài.
 */
export function speakChinese(text: string, rate: number = 0.9): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    console.warn("Trình duyệt không hỗ trợ Web Speech API.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const zhVoice =
    voices.find((v) => v.lang === "zh-CN" || v.lang === "zh_CN") ||
    voices.find((v) => v.lang.startsWith("zh"));

  if (zhVoice) {
    utterance.voice = zhVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Chuẩn hóa Pinyin để so sánh khi người dùng nhập không dấu hoặc có dấu thanh điệu
 * Ví dụ: "nǐ hǎo" -> "nihao", "ni3 hao3" -> "nihao"
 */
export function normalizePinyin(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[1-5]/g, "")
    .replace(/[^a-z\u00fcv]/g, "")
    .replace(/v/g, "u")
    .trim();
}
