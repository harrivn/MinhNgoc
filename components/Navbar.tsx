"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import ThemeToggle from "./ThemeToggle";
import { BookOpen, Trophy, User, Shield, LogOut } from "lucide-react";

export default function Navbar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { href: "/decks", label: "Bộ từ HSK", icon: BookOpen },
    { href: "/leaderboard", label: "Bảng xếp hạng", icon: Trophy },
    { href: "/profile", label: "Hồ sơ", icon: User },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/decks" className="flex items-center gap-2.5 font-bold text-lg">
          <span className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-hanzi text-xl shadow-sm">
            汉
          </span>
          <span className="text-slate-900 dark:text-white">HSK Master</span>
        </Link>

        {profile && (
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}

            {profile.role === "admin" && (
              <Link
                href="/admin/import"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith("/admin")
                    ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300"
                    : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Quản trị</span>
              </Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {profile && (
            <button
              type="button"
              onClick={handleSignOut}
              title="Đăng xuất"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Đăng xuất</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
