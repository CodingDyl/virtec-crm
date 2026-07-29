import { Timestamp } from "firebase/firestore";
import { Quote } from "@/types/quote";

type AnyRecord = Record<string, any>;

export function pickValue<T = any>(data: AnyRecord, keys: string[], fallback?: T): T {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key] as T;
    }
  }
  return fallback as T;
}

export function pickNumber(data: AnyRecord, keys: string[], fallback = 0): number {
  const value = pickValue<any>(data, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === "function") return value.toDate();
  return null;
}

export function pickTimestamp(data: AnyRecord, keys: string[]): Timestamp | Date | null {
  return pickValue<Timestamp | Date | null>(data, keys, null);
}

/**
 * Where a stored file lives.
 *
 * Records written since storage was locked down keep a bucket *path*, which is
 * resolved to a short-lived signed URL on demand. Older records kept a
 * permanent download URL and no path. Both are returned as an opaque reference
 * that the storage helpers know how to open.
 */
export function fileRef(data: AnyRecord, pathKeys: string[], urlKeys: string[]): string {
  return pickValue<string>(data, [...pathKeys, ...urlKeys], '');
}

/** The openable reference for a quote's PDF. */
export function quoteFileRef(quote: AnyRecord): string {
  return fileRef(quote, ['pdfPath'], ['pdfUrl', 'pdf_url']);
}

/** The openable reference for an uploaded document. */
export function documentFileRef(document: AnyRecord): string {
  return fileRef(document, ['storagePath'], ['fileUrl']);
}

export function normalizeQuote(id: string, data: AnyRecord): Quote {
  const projectId = pickValue<string>(data, ["projectId", "project_id"], "");
  const projectType = pickValue<string>(data, ["projectType", "project_type"], "");
  const clientId = pickValue<string>(data, ["clientId", "client_id"], "");
  const totalAmount = pickNumber(data, ["totalAmount", "total_amount"], 0);
  const createdAt = pickTimestamp(data, ["createdAt", "created_at"]);
  const pdfUrl = pickValue<string>(data, ["pdfUrl", "pdf_url"], "");
  const pdfPath = pickValue<string>(data, ["pdfPath"], "");

  return {
    id,
    status: (data.status ?? "pending") as Quote["status"],
    features: data.features ?? [],
    projectId,
    project_id: projectId,
    projectType,
    project_type: projectType,
    clientId,
    client_id: clientId,
    totalAmount,
    total_amount: totalAmount,
    createdAt,
    created_at: createdAt,
    pdfUrl,
    pdf_url: pdfUrl,
    pdfPath,
  };
}
