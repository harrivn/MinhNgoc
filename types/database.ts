export type UserRole = "user" | "admin";
export type StudyMode = "flashcard" | "quiz" | "typing";
export type ImportMode = "insert" | "upsert" | "replace";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_locked: boolean;
  created_at: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  hsk_level: number;
  created_at: string;
  word_count?: number;
}

export interface Word {
  id: string;
  deck_id: string;
  hanzi: string;
  pinyin: string;
  meaning_vi: string;
  meaning_en: string | null;
  topic: string | null;
  example_hanzi: string | null;
  example_pinyin: string | null;
  example_meaning: string | null;
  created_at: string;
}

export interface UserProgress {
  user_id: string;
  word_id: string;
  correct_count: number;
  wrong_count: number;
  last_reviewed_at: string;
  next_review_at: string;
  is_difficult: boolean;
}

export interface StudySession {
  id: string;
  user_id: string;
  deck_id: string;
  mode: StudyMode;
  score: number;
  correct: number;
  total: number;
  duration_seconds: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank_position: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_score: number;
  sessions_count: number;
  accuracy: number;
}

export interface ImportLog {
  id: string;
  admin_id: string;
  file_name: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  created_at: string;
}
