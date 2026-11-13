import { ValidatedVocabRow } from "./validator";
import { ImportMode } from "@/types/database";
import { importVocabBatchAction, finalizeImportLogAction } from "@/lib/actions/admin-actions";

export interface BatchProgressState {
  processedRows: number;
  totalRows: number;
  successRows: number;
  errorRows: number;
  percentage: number;
  messages: string[];
}

/**
 * Chia nhỏ danh sách từ vựng hợp lệ thành từng lô (mặc định 50 dòng/lô)
 * và gửi tuần tự lên Server Action để không quá tải kết nối Database,
 * đồng thời cập nhật thanh tiến độ thời gian thực.
 */
export async function runBatchImportClient({
  fileName,
  totalRawRows,
  initialInvalidCount,
  validRows,
  mode,
  batchSize = 50,
  onProgress,
}: {
  fileName: string;
  totalRawRows: number;
  initialInvalidCount: number;
  validRows: ValidatedVocabRow[];
  mode: ImportMode;
  batchSize?: number;
  onProgress: (state: BatchProgressState) => void;
}): Promise<BatchProgressState> {
  let processedRows = 0;
  let successRows = 0;
  let errorRows = initialInvalidCount;
  const messages: string[] = [];

  // Chia thành các batch
  const batches: ValidatedVocabRow[][] = [];
  for (let i = 0; i < validRows.length; i += batchSize) {
    batches.push(validRows.slice(i, i + batchSize));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const isFirstBatch = batchIdx === 0;

    const response = await importVocabBatchAction({
      rows: batch,
      mode,
      isFirstBatch,
    });

    processedRows += batch.length;
    successRows += response.insertedOrUpdated;
    errorRows += response.failed;
    if (response.errorMessage) {
      messages.push(`Lô ${batchIdx + 1}: ${response.errorMessage}`);
    }

    const percentage = Math.round((processedRows / Math.max(validRows.length, 1)) * 100);
    onProgress({
      processedRows,
      totalRows: validRows.length,
      successRows,
      errorRows,
      percentage,
      messages,
    });
  }

  // Ghi log tổng kết vào bảng import_logs trên Server
  await finalizeImportLogAction({
    fileName,
    totalRows: totalRawRows,
    successRows,
    errorRows,
  });

  return {
    processedRows,
    totalRows: validRows.length,
    successRows,
    errorRows,
    percentage: 100,
    messages,
  };
}
