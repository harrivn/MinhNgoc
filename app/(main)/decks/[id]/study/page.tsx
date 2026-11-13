import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StudyWorkspace from "@/components/StudyWorkspace";
import { Word, UserProgress } from "@/types/database";

export default async function DeckStudyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { filter?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deck } = await supabase
    .from("decks")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!deck) {
    notFound();
  }

  const { data: words } = await supabase
    .from("words")
    .select("*")
    .eq("deck_id", deck.id)
    .order("created_at", { ascending: true });

  const allWords = (words || []) as Word[];

  const { data: progresses } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user!.id)
    .in(
      "word_id",
      allWords.length > 0 ? allWords.map((w) => w.id) : ["00000000-0000-0000-0000-000000000000"]
    );

  const progressList = (progresses || []) as UserProgress[];

  return (
    <StudyWorkspace
      deck={deck}
      words={allWords}
      initialProgress={progressList}
      initialFilter={searchParams.filter === "difficult" ? "difficult" : "all"}
    />
  );
}
