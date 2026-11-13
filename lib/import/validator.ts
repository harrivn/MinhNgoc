import { z } from "zod";

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // Giới hạn 5 MB
export const ALLOWED_EXTENSIONS = ["csv", "xlsx", "xls", "json"];

export const VocabRowSchema = z.object({
  hanzi: z
    .string({ required_error: "Thiếu chữ Hán (hanzi)" })
    .trim()
    .min(1, "Chữ Hán (hanzi) không được để trống")
    .max(50, "Chữ Hán tối đa 50 ký tự"),
  pinyin: z
    .string({ required_error: "Thiếu phiên âm (pinyin)" })
    .trim()
    .min(1, "Phiên âm (pinyin) không được để trống")
    .max(100, "Pinyin tối đa 100 ký tự"),
  meaning_vi: z
    .string({ required_error: "Thiếu nghĩa tiếng Việt (meaning_vi)" })
    .trim()
    .min(1, "Nghĩa tiếng Việt (meaning_vi) không được để trống"),
  meaning_en: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null),
  hsk_level: z.coerce
    .number({ invalid_type_error: "Cấp độ HSK phải là số từ 1 đến 6" })
    .int("Cấp độ HSK phải là số nguyên")
    .min(1, "HSK tối thiểu là 1")
    .max(6, "HSK tối đa là 6")
    .default(1),
  topic: z
    .string()
    .trim()
    .min(1, "Chủ đề (topic) không được để trống")
    .default("HSK 1 - Giao tiếp Cơ bản"),
  example_hanzi: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null),
  example_pinyin: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null),
  example_meaning: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || null),
});

export type ValidatedVocabRow = z.infer<typeof VocabRowSchema>;

export interface RowValidationResult {
  rowIndex: number; // Số thứ tự dòng (1-based)
  raw: Record<string, unknown>;
  data?: ValidatedVocabRow;
  errors: string[];
  isDuplicateInFile: boolean;
}

export function validateVocabRows(rawRows: Record<string, unknown>[]): {
  results: RowValidationResult[];
  validRows: ValidatedVocabRow[];
  errorCount: number;
} {
  const seenKeys = new Set<string>();
  const results: RowValidationResult[] = [];
  const validRows: ValidatedVocabRow[] = [];
  let errorCount = 0;

  rawRows.forEach((raw, idx) => {
    const rowIndex = idx + 1;
    const parsed = VocabRowSchema.safeParse(raw);
    const errors: string[] = [];
    let isDuplicateInFile = false;

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      });
    } else {
      const key = `${parsed.data.topic.toLowerCase()}__${parsed.data.hanzi}`;
      if (seenKeys.has(key)) {
        isDuplicateInFile = true;
        errors.push(`Trùng lặp chữ Hán "${parsed.data.hanzi}" trong cùng chủ đề "${parsed.data.topic}" ngay trong file`);
      } else {
        seenKeys.add(key);
      }
    }

    if (errors.length > 0) {
      errorCount++;
      results.push({ rowIndex, raw, errors, isDuplicateInFile });
    } else if (parsed.success) {
      validRows.push(parsed.data);
      results.push({
        rowIndex,
        raw,
        data: parsed.data,
        errors: [],
        isDuplicateInFile: false,
      });
    }
  });

  return { results, validRows, errorCount };
}
