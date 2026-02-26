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

export function normalizeQuote(id: string, data: AnyRecord): Quote {
  const projectId = pickValue<string>(data, ["projectId", "project_id"], "");
  const projectType = pickValue<string>(data, ["projectType", "project_type"], "");
  const clientId = pickValue<string>(data, ["clientId", "client_id"], "");
  const totalAmount = pickNumber(data, ["totalAmount", "total_amount"], 0);
  const createdAt = pickTimestamp(data, ["createdAt", "created_at"]);
  const pdfUrl = pickValue<string>(data, ["pdfUrl", "pdf_url"], "");

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
  };
}
