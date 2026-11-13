"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Word } from "@/types/database";
import {
  updateWordAdminAction,
  deleteWordAdminAction,
} from "@/lib/actions/admin-actions";
import { Search, Pencil, Trash2, Check, X } from "lucide-react";

export default function AdminWordsClient({
  initialWords,
  initialQuery,
}: {
  initialWords: Word[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialQuery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    hanzi: "",
    pinyin: "",
    meaning_vi: "",
    example_hanzi: "",
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin/words?q=${encodeURIComponent(search.trim())}`);
  };

  const startEdit = (w: Word) => {
    setEditingId(w.id);
    setEditForm({
      hanzi: w.hanzi,
      pinyin: w.pinyin,
      meaning_vi: w.meaning_vi,
      example_hanzi: w.example_hanzi || "",
    });
  };

  const saveEdit = async (wordId: string) => {
    await updateWordAdminAction(wordId, editForm);
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (wordId: string) => {
    await deleteWordAdminAction(wordId);
    router.refresh();
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold">Quản lý Từ vựng (Tìm kiếm, Sửa, Xóa)</h2>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm chữ Hán, Pinyin, nghĩa..."
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold"
          >
            <Search className="w-4 h-4" />
            <span>Tìm</span>
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
              <th className="py-3 px-3">Chữ Hán</th>
              <th className="py-3 px-3">Pinyin</th>
              <th className="py-3 px-3">Nghĩa tiếng Việt</th>
              <th className="py-3 px-3">Câu ví dụ</th>
              <th className="py-3 px-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {initialWords.map((w) => {
              const isEditing = editingId === w.id;
              return (
                <tr key={w.id}>
                  <td className="py-3 px-3 font-hanzi text-lg font-bold">
                    {isEditing ? (
                      <input
                        value={editForm.hanzi}
                        onChange={(e) =>
                          setEditForm({ ...editForm, hanzi: e.target.value })
                        }
                        className="w-24 px-2 py-1 rounded border border-slate-300 dark:bg-slate-800"
                      />
                    ) : (
                      w.hanzi
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {isEditing ? (
                      <input
                        value={editForm.pinyin}
                        onChange={(e) =>
                          setEditForm({ ...editForm, pinyin: e.target.value })
                        }
                        className="w-28 px-2 py-1 rounded border border-slate-300 dark:bg-slate-800"
                      />
                    ) : (
                      w.pinyin
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {isEditing ? (
                      <input
                        value={editForm.meaning_vi}
                        onChange={(e) =>
                          setEditForm({ ...editForm, meaning_vi: e.target.value })
                        }
                        className="w-40 px-2 py-1 rounded border border-slate-300 dark:bg-slate-800"
                      />
                    ) : (
                      w.meaning_vi
                    )}
                  </td>
                  <td className="py-3 px-3 font-hanzi text-xs text-slate-500">
                    {isEditing ? (
                      <input
                        value={editForm.example_hanzi}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            example_hanzi: e.target.value,
                          })
                        }
                        className="w-48 px-2 py-1 rounded border border-slate-300 dark:bg-slate-800"
                      />
                    ) : (
                      w.example_hanzi || "—"
                    )}
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => saveEdit(w.id)}
                          className="p-1.5 rounded-lg bg-emerald-600 text-white"
                          title="Lưu"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700"
                          title="Hủy"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(w)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
                          title="Sửa từ này"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(w.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"
                          title="Xóa từ này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
