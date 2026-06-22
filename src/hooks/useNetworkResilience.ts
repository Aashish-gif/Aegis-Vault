import { useEffect, useRef } from "react";

import { sanitizeStudentId } from "@/lib/exam-payload";
import { offlineQueue } from "@/lib/offline-queue";
import type { ExamSessionConfigPublic } from "@/lib/exam-session";
import type { ExamQuestion } from "@/lib/questions";

export const EXAM_BACKUP_VERSION = 1 as const;
export const EXAM_BACKUP_KEY_PREFIX = "aegisvault.exam.backup." as const;

export type CheatLogBackup = {
  violation: string;
  question_id?: string;
  client_timestamp: string;
  ip_address?: string;
};

export type PendingResponseBackup = {
  student_id: string;
  question_id: string;
  selected_option: string;
  client_timestamp: string;
  ip_address: string;
};

export type ExamSessionBackup = {
  version: typeof EXAM_BACKUP_VERSION;
  student_id: string;
  session_config: ExamSessionConfigPublic;
  selections: Record<string, string>;
  violation_count: number;
  cheat_logs: CheatLogBackup[];
  questions: ExamQuestion[];
  question_index: number;
  seconds_remaining: number;
  saved_at_ms: number;
  pending_responses: PendingResponseBackup[];
  ip_address: string;
  submitted: boolean;
};

export type ExamBackupSnapshot = Omit<
  ExamSessionBackup,
  "version" | "student_id" | "saved_at_ms" | "submitted"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExamSessionConfigPublic(value: unknown): value is ExamSessionConfigPublic {
  if (!isRecord(value)) return false;
  return (
    typeof value.exam_title === "string" &&
    typeof value.duration_minutes === "number" &&
    Number.isFinite(value.duration_minutes) &&
    typeof value.max_allowed_violations === "number" &&
    Number.isFinite(value.max_allowed_violations)
  );
}

function isExamQuestion(value: unknown): value is ExamQuestion {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.prompt !== "string") return false;
  if (!Array.isArray(value.options)) return false;
  return value.options.every(
    (option) =>
      isRecord(option) &&
      typeof option.key === "string" &&
      typeof option.text === "string",
  );
}

function isCheatLogBackup(value: unknown): value is CheatLogBackup {
  if (!isRecord(value)) return false;
  return (
    typeof value.violation === "string" &&
    value.violation.length > 0 &&
    typeof value.client_timestamp === "string"
  );
}

function isPendingResponseBackup(value: unknown): value is PendingResponseBackup {
  if (!isRecord(value)) return false;
  return (
    typeof value.student_id === "string" &&
    typeof value.question_id === "string" &&
    typeof value.selected_option === "string" &&
    typeof value.client_timestamp === "string" &&
    typeof value.ip_address === "string"
  );
}

export function isExamSessionBackup(value: unknown): value is ExamSessionBackup {
  if (!isRecord(value)) return false;

  if (value.version !== EXAM_BACKUP_VERSION) return false;
  if (typeof value.student_id !== "string" || value.student_id.length === 0) return false;
  if (value.submitted !== false) return false;
  if (!isExamSessionConfigPublic(value.session_config)) return false;
  if (!isRecord(value.selections)) return false;
  if (typeof value.violation_count !== "number" || value.violation_count < 0) return false;
  if (!Array.isArray(value.cheat_logs) || !value.cheat_logs.every(isCheatLogBackup)) {
    return false;
  }
  if (!Array.isArray(value.questions) || !value.questions.every(isExamQuestion)) {
    return false;
  }
  if (typeof value.question_index !== "number" || value.question_index < 0) return false;
  if (typeof value.seconds_remaining !== "number" || value.seconds_remaining < 0) return false;
  if (typeof value.saved_at_ms !== "number" || value.saved_at_ms <= 0) return false;
  if (
    !Array.isArray(value.pending_responses) ||
    !value.pending_responses.every(isPendingResponseBackup)
  ) {
    return false;
  }
  if (typeof value.ip_address !== "string") return false;

  return true;
}

export function getExamBackupStorageKey(studentId: string): string {
  return `${EXAM_BACKUP_KEY_PREFIX}${sanitizeStudentId(studentId)}`;
}

export function readExamBackup(studentId: string): ExamSessionBackup | null {
  if (typeof window === "undefined") return null;

  const sanitizedId = sanitizeStudentId(studentId);
  if (!sanitizedId) return null;

  try {
    const raw = localStorage.getItem(getExamBackupStorageKey(sanitizedId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isExamSessionBackup(parsed)) return null;
    if (sanitizeStudentId(parsed.student_id) !== sanitizedId) return null;

    return parsed;
  } catch {
    return null;
  }
}

/** Synchronous mirror — survives tab close and hard refresh. */
export function writeExamBackup(studentId: string, snapshot: ExamBackupSnapshot): void {
  if (typeof window === "undefined") return;

  const sanitizedId = sanitizeStudentId(studentId);
  if (!sanitizedId || !snapshot.session_config) return;

  const payload: ExamSessionBackup = {
    version: EXAM_BACKUP_VERSION,
    student_id: sanitizedId,
    saved_at_ms: Date.now(),
    submitted: false,
    session_config: snapshot.session_config,
    selections: snapshot.selections ?? {},
    violation_count: Math.max(0, snapshot.violation_count ?? 0),
    cheat_logs: snapshot.cheat_logs ?? [],
    questions: snapshot.questions ?? [],
    question_index: Math.max(0, snapshot.question_index ?? 0),
    seconds_remaining: Math.max(0, snapshot.seconds_remaining ?? 0),
    pending_responses: snapshot.pending_responses ?? [],
    ip_address: snapshot.ip_address ?? "0.0.0.0",
  };

  try {
    localStorage.setItem(getExamBackupStorageKey(sanitizedId), JSON.stringify(payload));
  } catch (err) {
    console.warn("[AegisVault] exam backup write failed", err);
  }
}

export function purgeExamBackup(studentId: string): void {
  if (typeof window === "undefined") return;

  const sanitizedId = sanitizeStudentId(studentId);
  if (!sanitizedId) return;

  try {
    localStorage.removeItem(getExamBackupStorageKey(sanitizedId));
  } catch (err) {
    console.warn("[AegisVault] exam backup purge failed", err);
  }
}

export function computeRestoredSeconds(backup: ExamSessionBackup): number {
  const elapsedSeconds = Math.floor((Date.now() - backup.saved_at_ms) / 1000);
  return Math.max(0, backup.seconds_remaining - elapsedSeconds);
}

export async function rehydrateOfflineQueueFromBackup(
  backup: ExamSessionBackup,
): Promise<void> {
  await offlineQueue.rehydrateForStudent(
    backup.pending_responses ?? [],
    backup.student_id,
  );
}

export function hasPendingExamBackup(studentId: string): boolean {
  const backup = readExamBackup(studentId);
  return backup !== null && !backup.submitted;
}

type UseNetworkResilienceParams = {
  enabled: boolean;
  studentId: string;
  snapshot: ExamBackupSnapshot | null;
};

export function useNetworkResilience({
  enabled,
  studentId,
  snapshot,
}: UseNetworkResilienceParams): void {
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!enabled || !studentId || !snapshot) return;
    writeExamBackup(studentId, snapshot);
  }, [enabled, studentId, snapshot]);

  useEffect(() => {
    if (!enabled || !studentId) return;

    const flushOnUnload = () => {
      const current = snapshotRef.current;
      if (!current) return;
      writeExamBackup(studentId, current);
    };

    window.addEventListener("beforeunload", flushOnUnload);
    return () => window.removeEventListener("beforeunload", flushOnUnload);
  }, [enabled, studentId]);
}
