"use server";

import { createClient } from "@/lib/supabase/server";
import { VocabRowSchema, ValidatedVocabRow } from "@/lib/import/validator";
import { ImportMode, UserRole } from "@/types/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Helper kiểm tra nghiêm ngặt quyền Admin trên Server trước mọi thao tác quản trị
 */
async function requireAdminServer() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Chưa đăng nhập.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_locked")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin" || profile.is_locked) {
    throw new Error("Truy cập bị từ chối: Chỉ quản trị viên (Admin) mới có quyền thực hiện thao tác này.");
  }

  return { supabase, adminId: user.id };
}

/**
 * Server Action xử lý import từng lô (Batch) từ vựng từ trang /admin/import
 */
export async function importVocabBatchAction({
  rows,
  mode,
  isFirstBatch,
}: {
  rows: ValidatedVocabRow[];
  mode: ImportMode;
  isFirstBatch: boolean;
}): Promise<{
  insertedOrUpdated: number;
  failed: number;
  errorMessage?: string;
}> {
  try {
    const { supabase } = await requireAdminServer();

    // Validate lại từng dòng bằng Zod ở phía Server để đảm bảo an toàn tuyệt đối
    const validatedRows: ValidatedVocabRow[] = [];
    let failedValidation = 0;

    for (const r of rows) {
      const check = VocabRowSchema.safeParse(r);
      if (check.success) {
        validatedRows.push(check.data);
      } else {
        failedValidation++;
      }
    }

    if (validatedRows.length === 0) {
      return {
        insertedOrUpdated: 0,
        failed: failedValidation,
        errorMessage: "Không có dòng hợp lệ trong lô này.",
      };
    }

    // 1. Đảm bảo các bộ từ (decks) theo cột `topic` và `hsk_level` đã tồn tại
    const uniqueTopics = new Map<string, number>();
    for (const row of validatedRows) {
      if (!uniqueTopics.has(row.topic)) {
        uniqueTopics.set(row.topic, row.hsk_level);
      }
    }

    const deckPayloads = Array.from(uniqueTopics.entries()).map(
      ([name, hsk_level]) => ({
        name,
        hsk_level,
        description: `Bộ từ vựng chủ đề ${name} (HSK ${hsk_level})`,
      })
    );

    await supabase.from("decks").upsert(deckPayloads, {
      onConflict: "name",
      ignoreDuplicates: true,
    });

    // Lấy danh sách deck_id tương ứng
    const { data: decksData, error: deckErr } = await supabase
      .from("decks")
      .select("id, name")
      .in("name", Array.from(uniqueTopics.keys()));

    if (deckErr || !decksData) {
      return {
        insertedOrUpdated: 0,
        failed: rows.length,
        errorMessage: `Lỗi truy vấn bộ từ: ${deckErr?.message}`,
      };
    }

    const deckMap = new Map(decksData.map((d) => [d.name, d.id]));

    // Nếu chế độ là "replace" (thay thế toàn bộ bộ từ) và đây là lô đầu tiên:
    if (mode === "replace" && isFirstBatch) {
      const targetDeckIds = Array.from(deckMap.values());
      if (targetDeckIds.length > 0) {
        await supabase.from("words").delete().in("deck_id", targetDeckIds);
      }
    }

    // Chuẩn bị payload cho bảng words
    const wordPayloads = validatedRows
      .map((row) => {
        const deck_id = deckMap.get(row.topic);
        if (!deck_id) return null;
        return {
          deck_id,
          hanzi: row.hanzi,
          pinyin: row.pinyin,
          meaning_vi: row.meaning_vi,
          meaning_en: row.meaning_en,
          topic: row.topic,
          example_hanzi: row.example_hanzi,
          example_pinyin: row.example_pinyin,
          example_meaning: row.example_meaning,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (mode === "insert") {
      // Chỉ thêm mới, bỏ qua nếu trùng (deck_id, hanzi)
      const { data: inserted, error: insError } = await supabase
        .from("words")
        .upsert(wordPayloads, {
          onConflict: "deck_id,hanzi",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insError) {
        return {
          insertedOrUpdated: 0,
          failed: rows.length,
          errorMessage: insError.message,
        };
      }

      const count = inserted?.length ?? wordPayloads.length;
      return {
        insertedOrUpdated: count,
        failed: failedValidation + (wordPayloads.length - count),
      };
    } else {
      // Chế độ "upsert" (cập nhật theo hanzi) hoặc "replace"
      const { data: upserted, error: upsError } = await supabase
        .from("words")
        .upsert(wordPayloads, {
          onConflict: "deck_id,hanzi",
          ignoreDuplicates: false,
        })
        .select("id");

      if (upsError) {
        return {
          insertedOrUpdated: 0,
          failed: rows.length,
          errorMessage: upsError.message,
        };
      }

      const count = upserted?.length ?? wordPayloads.length;
      return {
        insertedOrUpdated: count,
        failed: failedValidation,
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return {
      insertedOrUpdated: 0,
      failed: rows.length,
      errorMessage: message,
    };
  }
}

/**
 * Ghi log lịch sử import sau khi hoàn thành các batch
 */
export async function finalizeImportLogAction({
  fileName,
  totalRows,
  successRows,
  errorRows,
}: {
  fileName: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
}) {
  const { supabase, adminId } = await requireAdminServer();

  await supabase.from("import_logs").insert({
    admin_id: adminId,
    file_name: fileName,
    total_rows: totalRows,
    success_rows: successRows,
    error_rows: errorRows,
  });

  revalidatePath("/admin/import");
  revalidatePath("/admin/words");
  revalidatePath("/decks");
}

/**
 * Sửa từ vựng trong trang /admin/words
 */
export async function updateWordAdminAction(
  wordId: string,
  payload: {
    hanzi: string;
    pinyin: string;
    meaning_vi: string;
    meaning_en?: string | null;
    example_hanzi?: string | null;
    example_pinyin?: string | null;
    example_meaning?: string | null;
  }
) {
  const { supabase } = await requireAdminServer();

  const { error } = await supabase
    .from("words")
    .update(payload)
    .eq("id", wordId);

  if (error) return { error: error.message };
  revalidatePath("/admin/words");
  revalidatePath("/decks");
  return { success: true };
}

/**
 * Xóa từ vựng trong trang /admin/words
 */
export async function deleteWordAdminAction(wordId: string) {
  const { supabase } = await requireAdminServer();

  const { error } = await supabase.from("words").delete().eq("id", wordId);
  if (error) return { error: error.message };
  revalidatePath("/admin/words");
  revalidatePath("/decks");
  return { success: true };
}

/**
 * Đổi quyền (role: user | admin) hoặc khóa/mở khóa tài khoản trong /admin/users
 */
export async function updateUserAccessAdminAction({
  targetUserId,
  role,
  isLocked,
}: {
  targetUserId: string;
  role: UserRole;
  isLocked: boolean;
}) {
  const { supabase, adminId } = await requireAdminServer();

  if (targetUserId === adminId && (role !== "admin" || isLocked)) {
    return {
      error: "Không thể tự hạ quyền hoặc tự khóa tài khoản Admin của chính bạn.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role, is_locked: isLocked })
    .eq("id", targetUserId);

  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { success: true };
}
