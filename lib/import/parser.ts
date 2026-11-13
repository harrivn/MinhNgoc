import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "./validator";

export async function parseUploadedVocabFile(
  file: File
): Promise<Record<string, unknown>[]> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Dung lượng file vượt quá giới hạn cho phép (tối đa 5 MB).");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Định dạng .${ext} không được hỗ trợ. Vui lòng chọn file .csv, .xlsx hoặc .json.`
    );
  }

  if (ext === "csv") {
    const text = await file.text();
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        complete: (results) => {
          resolve(results.data);
        },
        error: (err: Error) => {
          reject(new Error(`Lỗi đọc file CSV: ${err.message}`));
        },
      });
    });
  }

  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("File Excel không có sheet dữ liệu nào.");
    }
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
    });
    // Chuẩn hóa tên cột về chữ thường
    return jsonRows.map((row) => {
      const normalized: Record<string, unknown> = {};
      Object.entries(row).forEach(([k, v]) => {
        normalized[k.trim().toLowerCase()] = v;
      });
      return normalized;
    });
  }

  if (ext === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("File JSON phải chứa một mảng (Array) các đối tượng từ vựng.");
    }
    return parsed as Record<string, unknown>[];
  }

  throw new Error("Không thể xử lý định dạng file này.");
}
