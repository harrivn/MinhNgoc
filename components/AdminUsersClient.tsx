"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Profile, UserRole } from "@/types/database";
import { updateUserAccessAdminAction } from "@/lib/actions/admin-actions";
import { Lock, Unlock, ShieldAlert } from "lucide-react";

export default function AdminUsersClient({ users }: { users: Profile[] }) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleLock = async (u: Profile) => {
    setErrorMsg(null);
    const res = await updateUserAccessAdminAction({
      targetUserId: u.id,
      role: u.role,
      isLocked: !u.is_locked,
    });
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
  };

  const handleRoleChange = async (u: Profile, newRole: UserRole) => {
    setErrorMsg(null);
    const res = await updateUserAccessAdminAction({
      targetUserId: u.id,
      role: newRole,
      isLocked: u.is_locked,
    });
    if (res.error) setErrorMsg(res.error);
    else router.refresh();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
      <h2 className="text-lg font-bold">Danh sách Người dùng & Phân quyền</h2>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
              <th className="py-3 px-3">Tên hiển thị</th>
              <th className="py-3 px-3">Username</th>
              <th className="py-3 px-3">Quyền hạn (Role)</th>
              <th className="py-3 px-3">Trạng thái</th>
              <th className="py-3 px-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-3 px-3 font-semibold">{u.display_name}</td>
                <td className="py-3 px-3 text-slate-500">@{u.username}</td>
                <td className="py-3 px-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      handleRoleChange(u, e.target.value as UserRole)
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="py-3 px-3">
                  {u.is_locked ? (
                    <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-semibold">
                      Đã khóa
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      Hoạt động
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleLock(u)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      u.is_locked
                        ? "bg-emerald-600 text-white"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    {u.is_locked ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Mở khóa
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Khóa tài khoản
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
