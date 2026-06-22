import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExamCanvas } from "@/components/ExamCanvas";
import { NetworkBanner } from "@/components/NetworkBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useExamArmor } from "@/hooks/useExamArmor";
import { useExamTimer } from "@/hooks/useExamTimer";
import {
  computeRestoredSeconds,
  purgeExamBackup,
  readExamBackup,
  rehydrateOfflineQueueFromBackup,
  useNetworkResilience,
  type CheatLogBackup,
  type PendingResponseBackup,
} from "@/hooks/useNetworkResilience";
import { useSyncEngine } from "@/hooks/use-sync-engine";
import { logCheatViolation, submitExamBatch } from "@/lib/exam.functions";
import { fetchLiveQuestions, validateExamAccess } from "@/lib/examiner.functions";
import {
  sanitizeExamResponsePayload,
  sanitizeStudentId,
  type RawExamResponse,
} from "@/lib/exam-payload";
import {
  type ExamSessionConfigPublic,
  type LockoutReason,
} from "@/lib/exam-session";
import { getOrCreateStudentId, persistStudentId, resolveClientIp } from "@/lib/identity";
import { offlineQueue, type PendingResponse } from "@/lib/offline-queue";
import { mapSafeRowToExamQuestion, type ExamQuestion } from "@/lib/questions";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  ShieldAlert,
  Terminal,
} from "lucide-react";

type SessionPhase = "entrance" | "active" | "locked";

export const Route = createFileRoute("/exam")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Secure Exam Session — AegisVault Core" },
      {
        name: "description",
        content:
          "Zero-trust, offline-resilient examination session with canvas-rendered question wrapper.",
      },
    ],
  }),
  component: ExamPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive font-mono">{String(error)}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function ExamPage() {
  const sync = useSyncEngine();
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("entrance");
  const [sessionConfig, setSessionConfig] = useState<ExamSessionConfigPublic | null>(
    null,
  );
  const [lockoutReason, setLockoutReason] = useState<LockoutReason | null>(null);
  const [lockoutSubmitting, setLockoutSubmitting] = useState(false);
  const [lockoutComplete, setLockoutComplete] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [entrancePin, setEntrancePin] = useState("");
  const [entranceError, setEntranceError] = useState<string | null>(null);
  const [entranceLoading, setEntranceLoading] = useState(false);

  const [ip, setIp] = useState("0.0.0.0");
  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [violationCount, setViolationCount] = useState(0);
  const [pendingCheatLogs, setPendingCheatLogs] = useState<CheatLogBackup[]>([]);
  const [pendingResponsesBackup, setPendingResponsesBackup] = useState<
    PendingResponseBackup[]
  >([]);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState<number | null>(
    null,
  );
  const [tail, setTail] = useState<PendingResponse[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  const studentIdRef = useRef(studentId);
  const ipRef = useRef(ip);
  const questionIdRef = useRef<string | undefined>(undefined);
  const selectionsRef = useRef(selections);
  const sessionConfigRef = useRef(sessionConfig);
  const lockoutTriggeredRef = useRef(false);
  const skipQuestionsFetchRef = useRef(false);

  studentIdRef.current = studentId;
  ipRef.current = ip;
  selectionsRef.current = selections;
  sessionConfigRef.current = sessionConfig;

  useEffect(() => {
    setStudentId(sanitizeStudentId(getOrCreateStudentId()));
    resolveClientIp().then(setIp);
  }, []);

  const forceSubmitSelections = useCallback(async () => {
    const queued = await offlineQueue.peekAll();
    const merged = new Map<string, RawExamResponse>();

    for (const record of queued) {
      if (record.student_id === studentIdRef.current) {
        merged.set(
          record.question_id,
          sanitizeExamResponsePayload({
            student_id: record.student_id,
            question_id: record.question_id,
            selected_option: record.selected_option,
            client_timestamp: record.client_timestamp,
            ip_address: record.ip_address,
          }),
        );
      }
    }

    for (const [questionId, selectedOption] of Object.entries(selectionsRef.current)) {
      merged.set(
        questionId,
        sanitizeExamResponsePayload({
          student_id: studentIdRef.current,
          question_id: questionId,
          selected_option: selectedOption,
          client_timestamp: new Date().toISOString(),
          ip_address: ipRef.current,
        }),
      );
    }

    const responses = Array.from(merged.values());
    if (responses.length === 0) return;

    await submitExamBatch({ data: { responses } });

    const submittedIds = queued
      .filter((record) => record.student_id === studentIdRef.current)
      .map((record) => record.id)
      .filter((id): id is number => typeof id === "number");

    await offlineQueue.removeMany(submittedIds);
    await sync.drain();
    purgeExamBackup(studentIdRef.current);
  }, [sync]);

  const triggerLockout = useCallback(
    async (reason: LockoutReason) => {
      if (lockoutTriggeredRef.current) return;
      lockoutTriggeredRef.current = true;
      setSessionPhase("locked");
      setLockoutReason(reason);
      setLockoutSubmitting(true);

      try {
        await forceSubmitSelections();
        setLockoutComplete(true);
      } catch (err) {
        console.warn("[AegisVault] force submit failed", err);
      } finally {
        setLockoutSubmitting(false);
      }
    },
    [forceSubmitSelections],
  );

  const handleTimerExpire = useCallback(() => {
    void triggerLockout("TIME_EXPIRED");
  }, [triggerLockout]);

  const timer = useExamTimer(
    sessionConfig?.duration_minutes ?? 0,
    sessionPhase === "active",
    handleTimerExpire,
    initialTimerSeconds,
  );

  useNetworkResilience({
    enabled: sessionPhase === "active" && !lockoutTriggeredRef.current,
    studentId,
    snapshot:
      sessionPhase === "active" && sessionConfig
        ? {
            session_config: sessionConfig,
            selections,
            violation_count: violationCount,
            cheat_logs: pendingCheatLogs,
            questions,
            question_index: index,
            seconds_remaining: timer.secondsRemaining,
            pending_responses: pendingResponsesBackup,
            ip_address: ip,
          }
        : null,
  });

  const handleCheatViolation = useCallback(
    (violation: string) => {
      if (lockoutTriggeredRef.current || sessionPhase !== "active") return;

      window.alert(
        `Anti-cheat violation detected: ${violation}. This incident has been logged.`,
      );

      void logCheatViolation({
        data: {
          student_id: studentIdRef.current,
          violation,
          question_id: questionIdRef.current,
          ip_address: ipRef.current,
        },
      }).catch((err) => {
        console.warn("[AegisVault] cheat log failed", err);
      });

      setPendingCheatLogs((prev) => [
        ...prev,
        {
          violation,
          question_id: questionIdRef.current,
          client_timestamp: new Date().toISOString(),
          ip_address: ipRef.current,
        },
      ]);

      setViolationCount((prev) => {
        const next = prev + 1;
        const maxAllowed = sessionConfigRef.current?.max_allowed_violations ?? Infinity;
        if (next >= maxAllowed) {
          queueMicrotask(() => void triggerLockout("MAX_VIOLATIONS"));
        }
        return next;
      });
    },
    [sessionPhase, triggerLockout],
  );

  useExamArmor(handleCheatViolation, sessionPhase === "active");

  useEffect(() => {
    if (sessionPhase !== "active") return;
    if (skipQuestionsFetchRef.current) {
      skipQuestionsFetchRef.current = false;
      return;
    }

    let cancelled = false;

    const loadQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionsError(null);

      try {
        const result = await fetchLiveQuestions();
        if (cancelled) return;
        setQuestions(result.questions.map(mapSafeRowToExamQuestion));
      } catch (err) {
        if (cancelled) return;
        setQuestionsError(
          err instanceof Error ? err.message : "Failed to load examination questions.",
        );
        setQuestions([]);
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    };

    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [sessionPhase]);

  useEffect(() => {
    if (sessionPhase !== "active") return;

    let cancelled = false;
    const refresh = async () => {
      const all = await offlineQueue.peekAll();
      if (cancelled) return;

      const studentPending = all
        .filter((record) => record.student_id === studentIdRef.current)
        .map((record) => ({
          student_id: record.student_id,
          question_id: record.question_id,
          selected_option: record.selected_option,
          client_timestamp: record.client_timestamp,
          ip_address: record.ip_address,
        }));

      setPendingResponsesBackup(studentPending);
      setTail(all.slice(-5).reverse());
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionPhase, sync.pendingCount, sync.lastSyncAt, studentId]);

  const applyBackupHydration = useCallback(async (sanitizedId: string) => {
    const backup = readExamBackup(sanitizedId);
    if (!backup || backup.questions.length === 0) return false;

    const restoredSeconds = computeRestoredSeconds(backup);

    setSessionConfig(backup.session_config);
    setSelections(backup.selections ?? {});
    setViolationCount(backup.violation_count ?? 0);
    setPendingCheatLogs(backup.cheat_logs ?? []);
    setQuestions(backup.questions ?? []);
    setIndex(
      backup.questions.length > 0
        ? Math.min(backup.question_index ?? 0, backup.questions.length - 1)
        : 0,
    );
    setInitialTimerSeconds(restoredSeconds);
    setQuestionsLoading(false);
    setQuestionsError(null);
    skipQuestionsFetchRef.current = true;

    await rehydrateOfflineQueueFromBackup(backup);
    await sync.drain();

    if (restoredSeconds <= 0) {
      queueMicrotask(() => void triggerLockout("TIME_EXPIRED"));
    }

    return true;
  }, [sync, triggerLockout]);

  const handleEntranceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedId = sanitizeStudentId(studentId);
    if (!sanitizedId || !/^\d{4}$/.test(entrancePin)) {
      setEntranceError("Enter a valid student ID and 4-digit access PIN.");
      return;
    }

    setEntranceLoading(true);
    setEntranceError(null);

    try {
      const result = await validateExamAccess({
        data: {
          student_id: sanitizedId,
          access_pin: entrancePin,
        },
      });

      persistStudentId(sanitizedId);
      setStudentId(sanitizedId);
      lockoutTriggeredRef.current = false;

      const restored = await applyBackupHydration(sanitizedId);
      if (!restored) {
        setSessionConfig(result.config);
        setViolationCount(0);
        setPendingCheatLogs([]);
        setInitialTimerSeconds(null);
        setSelections({});
        setQuestions([]);
        setIndex(0);
      }

      setSessionPhase("active");
    } catch (err) {
      setEntranceError(
        err instanceof Error ? err.message : "Access validation failed.",
      );
    } finally {
      setEntranceLoading(false);
    }
  };

  const question = questions[index];
  questionIdRef.current = question?.id;

  const handleSelect = (optionKey: string) => {
    if (!question || sessionPhase !== "active" || lockoutTriggeredRef.current) return;

    setSelections((prev) => {
      const next = { ...prev, [question.id]: optionKey };
      return next;
    });

    const payload = sanitizeExamResponsePayload({
      student_id: studentId,
      question_id: question.id,
      selected_option: optionKey,
      client_timestamp: new Date().toISOString(),
      ip_address: ip,
    });

    void offlineQueue
      .enqueue({ ...payload, ip_address: payload.ip_address ?? ip })
      .then(async () => {
        const all = await offlineQueue.peekAll();
        const studentPending = all
          .filter((record) => record.student_id === studentIdRef.current)
          .map((record) => ({
            student_id: record.student_id,
            question_id: record.question_id,
            selected_option: record.selected_option,
            client_timestamp: record.client_timestamp,
            ip_address: record.ip_address,
          }));
        setPendingResponsesBackup(studentPending);
        sync.notifyEnqueued();
      });
  };

  if (sessionPhase === "entrance") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-8">
          <div className="rounded-xl border border-border bg-card/60 p-6 shadow-[0_0_40px_rgba(34,211,238,0.04)] backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-accent/30 bg-accent/10">
                <Lock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
                  AEGISVAULT // ENTRANCE GUARD
                </p>
                <h1 className="text-lg font-bold tracking-tight">Secure Exam Access</h1>
              </div>
            </div>

            <form onSubmit={handleEntranceSubmit} className="space-y-4">
              {entranceError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 font-mono text-xs text-destructive">
                  {entranceError}
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="student-id"
                  className="font-mono text-xs tracking-wider text-muted-foreground"
                >
                  STUDENT ID
                </Label>
                <Input
                  id="student-id"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="AVX-ABC123"
                  disabled={entranceLoading}
                  className="border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="exam-pin"
                  className="font-mono text-xs tracking-wider text-muted-foreground"
                >
                  EXAM ACCESS PIN
                </Label>
                <Input
                  id="exam-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={entrancePin}
                  onChange={(e) =>
                    setEntrancePin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="••••"
                  disabled={entranceLoading}
                  className="border-border/80 bg-background/50 font-mono text-sm tracking-[0.3em] focus-visible:ring-accent/50"
                />
              </div>

              <Button
                type="submit"
                disabled={entranceLoading || !studentId.trim() || entrancePin.length !== 4}
                className="w-full bg-accent font-mono text-sm font-semibold text-accent-foreground hover:bg-accent/90"
              >
                {entranceLoading ? "VALIDATING…" : "UNLOCK EXAM SESSION"}
              </Button>
            </form>

            <Link
              to="/"
              className="mt-6 inline-block font-mono text-xs text-muted-foreground hover:text-accent"
            >
              ← return home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (sessionPhase === "locked") {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <LockoutOverlay
          reason={lockoutReason}
          submitting={lockoutSubmitting}
          complete={lockoutComplete}
          examTitle={sessionConfig?.exam_title}
        />
      </div>
    );
  }

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ExamTimerBar
          examTitle={sessionConfig?.exam_title ?? "Examination"}
          formatted={timer.formatted}
          secondsRemaining={timer.secondsRemaining}
          violationCount={violationCount}
          maxViolations={sessionConfig?.max_allowed_violations ?? 0}
        />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <ExamLoadingSkeleton />
        </main>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <ExamTimerBar
          examTitle={sessionConfig?.exam_title ?? "Examination"}
          formatted={timer.formatted}
          secondsRemaining={timer.secondsRemaining}
          violationCount={violationCount}
          maxViolations={sessionConfig?.max_allowed_violations ?? 0}
        />
        <main className="mx-auto max-w-5xl px-4 py-8">
          <div className="rounded-lg border border-destructive/40 bg-card/60 p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-4 font-mono text-sm text-muted-foreground">
              No examination questions available.
            </p>
            {questionsError && (
              <p className="mt-2 font-mono text-xs text-destructive">{questionsError}</p>
            )}
            <Link to="/" className="mt-4 inline-block font-mono text-xs text-accent hover:underline">
              ← return home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <ExamTimerBar
        examTitle={sessionConfig?.exam_title ?? "Examination"}
        formatted={timer.formatted}
        secondsRemaining={timer.secondsRemaining}
        violationCount={violationCount}
        maxViolations={sessionConfig?.max_allowed_violations ?? 0}
      />

      <NetworkBanner {...sync} studentId={studentId} ipAddress={ip} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            {sessionConfig?.exam_title}
          </span>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Lock className="h-3 w-3 text-accent" />
            CANVAS-WRAPPED · USER-SELECT DISABLED
          </div>
        </div>

        {questionsError && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 font-mono text-xs text-destructive">
            // question sync failed ({questionsError})
          </div>
        )}

        <div className="mb-4 flex items-center gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setIndex(i)}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === index
                  ? "bg-accent"
                  : selections[q.id]
                    ? "bg-accent/40"
                    : "bg-muted"
              }`}
              aria-label={`Question ${i + 1}`}
            />
          ))}
        </div>

        <ExamCanvas
          question={question}
          studentId={studentId}
          ipAddress={ip}
          selected={selections[question.id] ?? null}
          onSelect={handleSelect}
        />

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-mono text-foreground hover:border-accent disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" /> PREV
          </button>
          <span className="text-xs font-mono text-muted-foreground">
            QUESTION {index + 1} / {questions.length}
          </span>
          <button
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            disabled={index === questions.length - 1}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-4 py-2 text-sm font-mono text-foreground hover:border-accent disabled:opacity-30"
          >
            NEXT <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <section className="mt-8 rounded-lg border border-border bg-card/50">
          <header className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs font-mono text-accent">
            <Terminal className="h-3 w-3" />
            LOCAL BUFFER TAIL ({sync.pendingCount} packets pending)
          </header>
          <div className="max-h-48 overflow-auto p-4 font-mono text-[11px] text-muted-foreground">
            {tail.length === 0 ? (
              <div className="text-muted-foreground/60">
                // buffer empty — all packets synchronized
              </div>
            ) : (
              tail.map((r) => (
                <div key={r.id} className="border-b border-border/40 py-1">
                  <span className="text-accent">#{r.id}</span>{" "}
                  <span>{r.question_id}</span>{" "}
                  <span className="text-foreground">→ {r.selected_option}</span>{" "}
                  <span className="text-muted-foreground/60">
                    {new Date(r.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function ExamTimerBar({
  examTitle,
  formatted,
  secondsRemaining,
  violationCount,
  maxViolations,
}: {
  examTitle: string;
  formatted: string;
  secondsRemaining: number;
  violationCount: number;
  maxViolations: number;
}) {
  const isUrgent = secondsRemaining <= 300;

  return (
    <div className="sticky top-0 z-50 border-b border-accent/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-accent" />
          <span className="truncate font-mono text-xs text-muted-foreground">
            {examTitle}
          </span>
        </div>
        <span
          className={`font-mono text-2xl font-bold tabular-nums tracking-wider ${
            isUrgent ? "text-destructive animate-pulse" : "text-accent"
          }`}
        >
          {formatted}
        </span>
        <span
          className={`shrink-0 font-mono text-xs ${
            violationCount >= maxViolations - 1
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          VIOLATIONS {violationCount}/{maxViolations}
        </span>
      </div>
    </div>
  );
}

function LockoutOverlay({
  reason,
  submitting,
  complete,
  examTitle,
}: {
  reason: LockoutReason | null;
  submitting: boolean;
  complete: boolean;
  examTitle?: string;
}) {
  const message =
    reason === "TIME_EXPIRED"
      ? "The examination timer has reached 00:00."
      : "Maximum anti-cheat violations exceeded.";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur">
      <div className="mx-4 max-w-md rounded-xl border border-destructive/40 bg-card/90 p-8 text-center shadow-[0_0_60px_rgba(239,68,68,0.15)]">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <p className="mt-4 font-mono text-[10px] tracking-[0.25em] text-destructive">
          SESSION TERMINATED
        </p>
        <h2 className="mt-2 text-xl font-bold">{examTitle ?? "Examination"}</h2>
        <p className="mt-3 font-mono text-sm text-muted-foreground">{message}</p>
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          {submitting
            ? "// force-submitting responses to server…"
            : complete
              ? "// all selected answers have been submitted"
              : "// no answers to submit"}
        </p>
        <Link
          to="/"
          className="mt-6 inline-block font-mono text-xs text-accent hover:underline"
        >
          ← return home
        </Link>
      </div>
    </div>
  );
}

function ExamLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32 bg-accent/10" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-1.5 flex-1 bg-accent/10" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-lg bg-accent/10" />
      <div className="flex justify-between">
        <Skeleton className="h-10 w-24 bg-accent/10" />
        <Skeleton className="h-4 w-32 bg-accent/10" />
        <Skeleton className="h-10 w-24 bg-accent/10" />
      </div>
    </div>
  );
}
