import { createClient } from "@/lib/supabase/server";
import AdminWordsClient from "@/components/AdminWordsClient";
import { Word } from "@/types/database";

export default async function AdminWordsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const q = searchParams.q?.trim() || "";

  let query = supabase
    .from("words")
    .select("*, decks(name, hsk_level)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(
      `hanzi.ilike.%${q}%,pinyin.ilike.%${q}%,meaning_vi.ilike.%${q}%`
    );
  }

  const { data: words } = await query;

  return <AdminWordsClient initialWords={(words || []) as Word[]} initialQuery={q} />;
}
