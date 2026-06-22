import { useEffect, useRef, useState, useCallback } from "react";
import { offlineQueue } from "@/lib/offline-queue";
import { sanitizeExamResponsePayload } from "@/lib/exam-payload";
import { submitExamBatch } from "@/lib/exam.functions";

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

export function useSyncEngine() {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  });
  const drainingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const c = await offlineQueue.count();
    setState((s) => ({ ...s, pendingCount: c }));
  }, []);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    drainingRef.current = true;
    setState((s) => ({ ...s, isSyncing: true, lastError: null }));
    try {
      // Sequential batch loop — never blocks the UI (each await yields).
      while (true) {
        const batch = await offlineQueue.peekBatch(25);
        if (batch.length === 0) break;
        const payload = batch.map((r) =>
          sanitizeExamResponsePayload({
            student_id: r.student_id,
            question_id: r.question_id,
            selected_option: r.selected_option,
            client_timestamp: r.client_timestamp,
            ip_address: r.ip_address,
          }),
        );
        await submitExamBatch({ data: { responses: payload } });
        const ids = batch.map((r) => r.id!).filter((x) => typeof x === "number");
        await offlineQueue.removeMany(ids);
        await refreshCount();
      }
      setState((s) => ({
        ...s,
        isSyncing: false,
        lastSyncAt: Date.now(),
      }));
    } catch (err) {
      console.warn("[AegisVault] sync failed; will retry", err);
      setState((s) => ({
        ...s,
        isSyncing: false,
        lastError: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      drainingRef.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    const handleOnline = () => {
      setState((s) => ({ ...s, isOnline: true }));
      queueMicrotask(() => void drain());
    };
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // Initial drain (in case items were left from a previous session)
    queueMicrotask(() => void drain());
    // Periodic safety net
    const interval = window.setInterval(() => {
      void refreshCount();
      if (navigator.onLine) void drain();
    }, 8000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [drain, refreshCount]);

  const notifyEnqueued = useCallback(() => {
    void refreshCount();
    if (typeof navigator !== "undefined" && navigator.onLine) {
      queueMicrotask(() => void drain());
    }
  }, [drain, refreshCount]);

  return { ...state, drain, notifyEnqueued };
}
