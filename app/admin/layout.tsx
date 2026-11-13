import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import { Upload, BookText, Users } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Kiểm tra kép quyền Admin ở Server Layout (cùng với Middleware & Server Actions)
  if (!profile || profile.role !== "admin" || profile.is_locked) {
    redirect("/decks?error=forbidden_admin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <div className="max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Khu vực Quản trị viên (Admin Only)
            </span>
            <h1 className="text-2xl font-bold">Bảng điều khiển Hệ thống</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/import"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:border-red-500 transition"
            >
              <Upload className="w-4 h-4 text-red-600" />
              <span>Import File</span>
            </Link>
            <Link
              href="/admin/words"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:border-red-500 transition"
            >
              <BookText className="w-4 h-4 text-emerald-600" />
              <span>Quản lý Từ vựng</span>
            </Link>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-semibold hover:border-red-500 transition"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>Quản lý Người dùng</span>
            </Link>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
