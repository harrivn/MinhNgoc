import { createClient } from "@/lib/supabase/server";
import AdminImportClient from "@/components/AdminImportClient";

export default async function AdminImportPage() {
  const supabase = createClient();

  const { data: logs } = await supabase
    .from("import_logs")
    .select("*, profiles(display_name, username)")
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="space-y-8">
      <AdminImportClient />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-bold mb-4">Lịch sử Import dữ liệu gần đây</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
                <th className="py-3 px-3">Tên file</th>
                <th className="py-3 px-3">Người thực hiện</th>
                <th className="py-3 px-3 text-right">Tổng dòng</th>
                <th className="py-3 px-3 text-right">Thành công</th>
                <th className="py-3 px-3 text-right">Lỗi / Bỏ qua</th>
                <th className="py-3 px-3 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(logs || []).map((log) => (
                <tr key={log.id}>
                  <td className="py-3 px-3 font-medium">{log.file_name}</td>
                  <td className="py-3 px-3">
                    {(log.profiles as { display_name?: string } | null)?.display_name ||
                      "Admin"}
                  </td>
                  <td className="py-3 px-3 text-right">{log.total_rows}</td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-semibold">
                    {log.success_rows}
                  </td>
                  <td className="py-3 px-3 text-right text-red-600 font-semibold">
                    {log.error_rows}
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-slate-400">
                    {new Date(log.created_at).toLocaleString("vi-VN")}
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
