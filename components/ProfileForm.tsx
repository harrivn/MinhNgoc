"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/types/database";

export default function ProfileForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", profile.id);

    setSaving(false);
    if (!error) {
      setMsg("Đã lưu thông tin hồ sơ!");
      router.refresh();
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center font-bold text-xl">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="font-bold text-lg">{profile.display_name}</h1>
          <p className="text-xs text-slate-500">
            @{profile.username} • Quyền: {profile.role.toUpperCase()}
          </p>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
          {msg}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Email đăng nhập
        </label>
        <input
          type="email"
          disabled
          value={email}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-sm text-slate-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Tên hiển thị</label>
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">
          URL Ảnh đại diện (Tùy chọn)
        </label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.png"
          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
      >
        {saving ? "Đang lưu..." : "Cập nhật hồ sơ"}
      </button>
    </form>
  );
}
