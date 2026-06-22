import Dexie, { type Table } from "dexie";

import { sanitizeExamResponsePayload } from "@/lib/exam-payload";

export interface PendingResponse {
  id?: number;
  student_id: string;
  question_id: string;
  selected_option: string;
  client_timestamp: string; // ISO
  ip_address: string;
  created_at: number;
}

class AegisVaultDB extends Dexie {
  pendingResponses!: Table<PendingResponse, number>;

  constructor() {
    super("AegisVaultDB");
    this.version(1).stores({
      pendingResponses: "++id, created_at, student_id",
    });
  }
}

let _db: AegisVaultDB | null = null;
function db() {
  if (!_db) _db = new AegisVaultDB();
  return _db;
}

export const offlineQueue = {
  async enqueue(record: Omit<PendingResponse, "id" | "created_at">) {
    const sanitized = sanitizeExamResponsePayload(record);
    return db().pendingResponses.add({
      ...sanitized,
      ip_address: sanitized.ip_address ?? "0.0.0.0",
      created_at: Date.now(),
    });
  },
  async peekBatch(limit = 25): Promise<PendingResponse[]> {
    return db().pendingResponses.orderBy("created_at").limit(limit).toArray();
  },
  async peekAll(): Promise<PendingResponse[]> {
    return db().pendingResponses.orderBy("created_at").toArray();
  },
  async removeMany(ids: number[]) {
    if (ids.length === 0) return;
    await db().pendingResponses.bulkDelete(ids);
  },
  async count(): Promise<number> {
    return db().pendingResponses.count();
  },
  async clear() {
    await db().pendingResponses.clear();
  },
  async rehydrateForStudent(
    records: Array<Omit<PendingResponse, "id" | "created_at">>,
    studentId: string,
  ) {
    const existing = await db().pendingResponses
      .where("student_id")
      .equals(studentId)
      .toArray();
    const existingKeys = new Set(
      existing.map((record) => `${record.student_id}:${record.question_id}`),
    );

    for (const record of records) {
      const sanitized = sanitizeExamResponsePayload(record);
      const key = `${sanitized.student_id}:${sanitized.question_id}`;
      if (existingKeys.has(key)) continue;
      await db().pendingResponses.add({
        ...sanitized,
        ip_address: sanitized.ip_address ?? "0.0.0.0",
        created_at: Date.now(),
      });
      existingKeys.add(key);
    }
  },
};
