import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: sessions } = await supabase
    .from("study_sessions")
    .select("*, decks(name)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { count: learnedWordsCount } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .gt("correct_count", 0);

  const totalScore = (sessions || []).reduce((acc, s) => acc + s.score, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <ProfileForm profile={profile!} email={user!.email || ""} />

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="font-bold text-lg">Thống kê cá nhân</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="text-xs text-slate-500">Từ đã thuộc</div>
              <div className="text-2xl font-bold text-emerald-600">
                {learnedWordsCount ?? 0}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="text-xs text-slate-500">Điểm gần đây</div>
              <div className="text-2xl font-bold text-red-600">
                {totalScore.toLocaleString("vi-VN")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="font-bold text-lg mb-4">Lịch sử 20 phiên học gần nhất</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
                <th className="py-3 px-3">Bộ từ</th>
                <th className="py-3 px-3">Chế độ</th>
                <th className="py-3 px-3 text-right">Kết quả</th>
                <th className="py-3 px-3 text-right">Điểm</th>
                <th className="py-3 px-3 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(sessions || []).map((s) => (
                <tr key={s.id}>
                  <td className="py-3 px-3 font-medium">
                    {(s.decks as { name?: string } | null)?.name || "Bộ từ HSK"}
                  </td>
                  <td className="py-3 px-3 uppercase text-xs font-semibold text-slate-500">
                    {s.mode}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {s.correct}/{s.total}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-red-600">
                    +{s.score}
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-slate-400">
                    {new Date(s.created_at).toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
