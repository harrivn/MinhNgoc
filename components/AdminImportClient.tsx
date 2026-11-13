"use client";

import { useState } from "react";
import { parseUploadedVocabFile } from "@/lib/import/parser";
import {
  validateVocabRows,
  RowValidationResult,
  ValidatedVocabRow,
} from "@/lib/import/validator";
import {
  runBatchImportClient,
  BatchProgressState,
} from "@/lib/import/batch-importer";
import { ImportMode } from "@/types/database";
import { Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

export default function AdminImportClient() {
  const [fileName, setFileName] = useState<string>("");
  const [mode, setMode] = useState<ImportMode>("upsert");
  const [validationResults, setValidationResults] = useState<RowValidationResult[]>([]);
  const [validRows, setValidRows] = useState<ValidatedVocabRow[]>([]);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<BatchProgressState | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setProgress(null);
    setFileName(file.name);

    try {
      const rawRows = await parseUploadedVocabFile(file);
      const { results, validRows: vRows, errorCount: eCount } =
        validateVocabRows(rawRows);
      setValidationResults(results);
      setValidRows(vRows);
      setErrorCount(eCount);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : "Lỗi đọc file.");
      setValidationResults([]);
      setValidRows([]);
    }
  };

  const handleStartImport = async () => {
    if (validRows.length === 0 || importing) return;
    setImporting(true);

    try {
      await runBatchImportClient({
        fileName,
        totalRawRows: validationResults.length,
        initialInvalidCount: errorCount,
        validRows,
        mode,
        batchSize: 50,
        onProgress: (state) => setProgress({ ...state }),
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Import Từ vựng từ File (CSV, Excel .xlsx, JSON)</h2>
          <p className="text-xs text-slate-500">
            Hỗ trợ các cột: hanzi, pinyin, meaning_vi, meaning_en, hsk_level, topic, example_hanzi, example_pinyin, example_meaning (Tối đa 5 MB)
          </p>
        </div>

        <a
          href="/vocab-sample.csv"
          download="vocab-sample.csv"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition"
        >
          <Download className="w-4 h-4" />
          <span>Tải file CSV mẫu (40 từ HSK 1)</span>
        </a>
      </div>

      {/* Chọn file và chế độ Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
            1. Chọn file tải lên (.csv, .xlsx, .json)
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleFileChange}
            className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-600 hover:file:bg-red-100 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
            2. Chế độ xử lý khi trùng từ
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ImportMode)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="insert">Chỉ thêm mới (Bỏ qua nếu trùng hanzi trong bộ)</option>
            <option value="upsert">Cập nhật theo hanzi (Upsert nếu đã tồn tại)</option>
            <option value="replace">Thay thế toàn bộ bộ từ (Xóa từ cũ của chủ đề và nạp lại)</option>
          </select>
        </div>
      </div>

      {parseError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 text-red-600 text-sm">
          {parseError}
        </div>
      )}

      {/* Bảng Xem trước (Preview) 20 dòng đầu + Báo lỗi chi tiết theo từng dòng */}
      {validationResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-4 text-sm">
              <span>
                Tổng số dòng: <strong>{validationResults.length}</strong>
              </span>
              <span className="text-emerald-600 font-semibold">
                Hợp lệ: {validRows.length}
              </span>
              <span className="text-red-600 font-semibold">
                Lỗi: {errorCount}
              </span>
            </div>

            <button
              type="button"
              disabled={validRows.length === 0 || importing}
              onClick={handleStartImport}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              <Upload className="w-4 h-4" />
              <span>
                {importing
                  ? "Đang import theo lô..."
                  : `Thực hiện Import (${validRows.length} dòng hợp lệ)`}
              </span>
            </button>
          </div>

          {/* Thanh tiến độ Batch Import */}
          {progress && (
            <div className="space-y-2 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between text-xs font-semibold">
                <span>
                  Tiến độ: {progress.processedRows}/{progress.totalRows} dòng hợp lệ (Thành công:{" "}
                  {progress.successRows}, Lỗi: {progress.errorRows})
                </span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold mb-2">
              Xem trước 20 dòng đầu tiên (Kiểm tra bằng Zod Schema)
            </h3>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3">Dòng</th>
                    <th className="py-2.5 px-3">Hanzi</th>
                    <th className="py-2.5 px-3">Pinyin</th>
                    <th className="py-2.5 px-3">Nghĩa tiếng Việt</th>
                    <th className="py-2.5 px-3">HSK</th>
                    <th className="py-2.5 px-3">Chủ đề (Deck)</th>
                    <th className="py-2.5 px-3">Trạng thái / Chi tiết lỗi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {validationResults.slice(0, 20).map((r) => (
                    <tr
                      key={r.rowIndex}
                      className={
                        r.errors.length > 0
                          ? "bg-red-50/60 dark:bg-red-950/30"
                          : ""
                      }
                    >
                      <td className="py-2 px-3 font-mono">#{r.rowIndex}</td>
                      <td className="py-2 px-3 font-hanzi text-base font-bold">
                        {String(r.raw.hanzi || "")}
                      </td>
                      <td className="py-2 px-3">{String(r.raw.pinyin || "")}</td>
                      <td className="py-2 px-3">{String(r.raw.meaning_vi || "")}</td>
                      <td className="py-2 px-3">{String(r.raw.hsk_level || "")}</td>
                      <td className="py-2 px-3">{String(r.raw.topic || "")}</td>
                      <td className="py-2 px-3">
                        {r.errors.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {r.errors.join("; ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
