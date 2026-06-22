import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  PenLine,
  Radio,
  Settings,
  Shield,
  Wifi,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchExamResponses,
  fetchExamSessionConfig,
  insertQuestion,
  saveExamSessionConfig,
  type ExamResponseRow,
} from "@/lib/examiner.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/examiner")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Examiner Console — AegisVault Core" },
      {
        name: "description",
        content:
          "Secure examiner dashboard for question authoring and live exam telemetry.",
      },
    ],
  }),
  component: Examiner,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg border border-destructive/40 bg-card/60 p-6 text-center">
        <p className="font-mono text-xs tracking-wider text-destructive">
          EXAMINER CONSOLE ERROR
        </p>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{String(error)}</p>
        <Link
          to="/"
          className="mt-4 inline-flex font-mono text-xs text-accent hover:underline"
        >
          ← return to home
        </Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 font-mono text-muted-foreground">
      Examiner route not found
    </div>
  ),
});

type OptionKey = "A" | "B" | "C" | "D";

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

const EMPTY_FORM = {
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "" as OptionKey | "",
};

/** Secure examiner/admin dashboard — mounted at `/examiner`. */
function Examiner() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GridBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-6">
        <ExaminerHeader />
        <div className="mt-8 space-y-6">
          <ExamSessionConfigurator />
          <div className="grid gap-6 lg:grid-cols-2">
            <CreateQuestionCanvas />
            <LiveTelemetryTracker />
          </div>
        </div>
      </div>
    </div>
  );
}

function GridBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]"
      />
    </>
  );
}

function ExaminerHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-accent/30 bg-accent/10">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
            AEGISVAULT // EXAMINER
          </p>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            Secure Admin Console
          </h1>
        </div>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-2 font-mono text-xs text-muted-foreground transition hover:border-accent/50 hover:text-accent"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        EXIT CONSOLE
      </Link>
    </header>
  );
}

function ExamSessionConfigurator() {
  const [examTitle, setExamTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [accessPin, setAccessPin] = useState("");
  const [maxViolations, setMaxViolations] = useState("3");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchExamSessionConfig();
        if (cancelled) return;

        if (result.config) {
          setExamTitle(result.config.exam_title);
          setDurationMinutes(String(result.config.duration_minutes));
          setAccessPin(result.config.access_pin);
          setMaxViolations(String(result.config.max_allowed_violations));
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load exam configuration.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const isValid =
    examTitle.trim() &&
    /^\d+$/.test(durationMinutes) &&
    Number(durationMinutes) >= 1 &&
    Number(durationMinutes) <= 480 &&
    /^\d{4}$/.test(accessPin) &&
    /^\d+$/.test(maxViolations) &&
    Number(maxViolations) >= 1 &&
    Number(maxViolations) <= 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await saveExamSessionConfig({
        data: {
          exam_title: examTitle.trim(),
          duration_minutes: Number(durationMinutes),
          access_pin: accessPin,
          max_allowed_violations: Number(maxViolations),
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save exam configuration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="group rounded-xl border border-border bg-card/60 shadow-[0_0_40px_rgba(34,211,238,0.03)] backdrop-blur-sm transition hover:border-accent/30">
      <SectionHeader
        icon={<Settings className="h-4 w-4" />}
        title="Exam Session Configuration"
        subtitle="Define title, duration, access PIN, and violation threshold"
      />

      {loading ? (
        <div className="space-y-4 p-5 md:p-6">
          <Skeleton className="h-10 w-full bg-accent/10" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-10 bg-accent/10" />
            <Skeleton className="h-10 bg-accent/10" />
            <Skeleton className="h-10 bg-accent/10" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 p-5 md:p-6">
          {error && (
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-mono text-xs tracking-wider">
                CONFIG ERROR
              </AlertTitle>
              <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-accent/30 bg-accent/5 text-accent">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle className="font-mono text-xs tracking-wider">
                CONFIGURATION SAVED
              </AlertTitle>
              <AlertDescription className="font-mono text-xs text-accent/80">
                Active exam session updated. Students must use the new PIN to enter.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="exam-title"
              className="font-mono text-xs tracking-wider text-muted-foreground"
            >
              EXAM TITLE
            </Label>
            <Input
              id="exam-title"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="Distributed Systems Final — Spring 2026"
              disabled={submitting}
              className="border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label
                htmlFor="duration-minutes"
                className="font-mono text-xs tracking-wider text-muted-foreground"
              >
                DURATION (MINUTES)
              </Label>
              <Input
                id="duration-minutes"
                type="number"
                min={1}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={submitting}
                className="border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="access-pin"
                className="font-mono text-xs tracking-wider text-muted-foreground"
              >
                4-DIGIT ACCESS PIN
              </Label>
              <Input
                id="access-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                disabled={submitting}
                className="border-border/80 bg-background/50 font-mono text-sm tracking-[0.3em] focus-visible:ring-accent/50"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="max-violations"
                className="font-mono text-xs tracking-wider text-muted-foreground"
              >
                MAX VIOLATIONS
              </Label>
              <Input
                id="max-violations"
                type="number"
                min={1}
                max={50}
                value={maxViolations}
                onChange={(e) => setMaxViolations(e.target.value)}
                disabled={submitting}
                className="border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full bg-accent font-mono text-sm font-semibold text-accent-foreground hover:bg-accent/90 sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                SAVING…
              </>
            ) : (
              "SAVE EXAM CONFIGURATION"
            )}
          </Button>
        </form>
      )}
    </section>
  );
}

function CreateQuestionCanvas() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const isValid =
    form.questionText.trim() &&
    form.optionA.trim() &&
    form.optionB.trim() &&
    form.optionC.trim() &&
    form.optionD.trim() &&
    form.correctAnswer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !form.correctAnswer) return;

    setSubmitting(true);
    setError(null);
    setSuccessId(null);

    try {
      const result = await insertQuestion({
        data: {
          question_text: form.questionText.trim(),
          option_a: form.optionA.trim(),
          option_b: form.optionB.trim(),
          option_c: form.optionC.trim(),
          option_d: form.optionD.trim(),
          correct_answer: form.correctAnswer,
        },
      });

      setSuccessId(result.question.id);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to insert question.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateOption = (key: OptionKey, value: string) => {
    const field = `option${key}` as keyof typeof form;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <section className="group rounded-xl border border-border bg-card/60 shadow-[0_0_40px_rgba(34,211,238,0.03)] backdrop-blur-sm transition hover:border-accent/30">
      <SectionHeader
        icon={<PenLine className="h-4 w-4" />}
        title="Create Question Canvas"
        subtitle="Author and deploy new examination items"
      />

      <form onSubmit={handleSubmit} className="space-y-5 p-5 md:p-6">
        {error && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-mono text-xs tracking-wider">
              INSERT FAILED
            </AlertTitle>
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {successId && (
          <Alert className="border-accent/30 bg-accent/5 text-accent">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle className="font-mono text-xs tracking-wider">
              QUESTION DEPLOYED
            </AlertTitle>
            <AlertDescription className="font-mono text-xs text-accent/80">
              Record <span className="text-foreground">{successId}</span> inserted into
              questions table.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="question-text" className="font-mono text-xs tracking-wider text-muted-foreground">
            QUESTION TEXT
          </Label>
          <Textarea
            id="question-text"
            value={form.questionText}
            onChange={(e) => setForm((prev) => ({ ...prev, questionText: e.target.value }))}
            placeholder="Enter the examination prompt…"
            rows={4}
            disabled={submitting}
            className="resize-none border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {OPTION_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <Label
                htmlFor={`option-${key}`}
                className="font-mono text-xs tracking-wider text-muted-foreground"
              >
                OPTION {key}
              </Label>
              <Input
                id={`option-${key}`}
                value={form[`option${key}` as keyof typeof form] as string}
                onChange={(e) => updateOption(key, e.target.value)}
                placeholder={`Answer choice ${key}…`}
                disabled={submitting}
                className="border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
              />
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4">
          <div className="flex items-center gap-2 font-mono text-xs tracking-wider text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-accent" />
            CORRECT ANSWER
          </div>
          <RadioGroup
            value={form.correctAnswer}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, correctAnswer: value as OptionKey }))
            }
            disabled={submitting}
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {OPTION_KEYS.map((key) => (
              <label
                key={key}
                htmlFor={`correct-${key}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 font-mono text-sm transition",
                  form.correctAnswer === key
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:border-accent/40",
                )}
              >
                <RadioGroupItem value={key} id={`correct-${key}`} />
                {key}
              </label>
            ))}
          </RadioGroup>
        </div>

        <Button
          type="submit"
          disabled={!isValid || submitting}
          className="w-full bg-accent font-mono text-sm font-semibold text-accent-foreground hover:bg-accent/90"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              DEPLOYING…
            </>
          ) : (
            "INSERT INTO QUESTIONS TABLE"
          )}
        </Button>
      </form>
    </section>
  );
}

function LiveTelemetryTracker() {
  const [responses, setResponses] = useState<ExamResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadResponses = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const result = await fetchExamResponses();
      setResponses(result.responses);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch exam responses.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadResponses(true);
    const interval = window.setInterval(() => void loadResponses(false), 3000);
    return () => window.clearInterval(interval);
  }, [loadResponses]);

  return (
    <section className="group flex flex-col rounded-xl border border-border bg-card/60 shadow-[0_0_40px_rgba(34,211,238,0.03)] backdrop-blur-sm transition hover:border-accent/30">
      <SectionHeader
        icon={<Activity className="h-4 w-4" />}
        title="Live Telemetry Tracker"
        subtitle="Real-time exam response stream"
        trailing={
          <div className="flex items-center gap-2">
            {refreshing && !loading && (
              <Loader2 className="h-3 w-3 animate-spin text-accent" />
            )}
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-accent">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              LIVE
            </span>
          </div>
        }
      />

      <div className="flex flex-1 flex-col p-5 md:p-6">
        {error && (
          <Alert variant="destructive" className="mb-4 border-destructive/40 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-mono text-xs tracking-wider">
              TELEMETRY ERROR
            </AlertTitle>
            <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Wifi className="h-3 w-3" />
            {responses.length} packet{responses.length === 1 ? "" : "s"} captured
          </span>
          {lastUpdated && (
            <span>synced {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>

        <div className="flex-1 overflow-hidden rounded-lg border border-border/60 bg-background/30">
          {loading ? (
            <TelemetrySkeleton />
          ) : responses.length === 0 && !error ? (
            <EmptyTelemetry />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] tracking-wider text-accent">
                    STUDENT ID
                  </TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-accent">
                    SELECTED
                  </TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-accent">
                    IP ADDRESS
                  </TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-accent">
                    SUBMITTED
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((row, i) => (
                  <TableRow
                    key={`${row.student_id}-${row.client_timestamp}-${i}`}
                    className="border-border/40 font-mono text-xs hover:bg-accent/5"
                  >
                    <TableCell className="text-foreground">{row.student_id}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
                        {row.selected_option}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.ip_address ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(row.client_timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4 md:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/10 text-accent">
          {icon}
        </div>
        <div>
          <h2 className="font-mono text-sm font-semibold tracking-wider">{title.toUpperCase()}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {trailing}
    </header>
  );
}

function TelemetrySkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-24 bg-accent/10" />
          <Skeleton className="h-4 w-10 bg-accent/10" />
          <Skeleton className="h-4 w-28 bg-accent/10" />
          <Skeleton className="h-4 flex-1 bg-accent/10" />
        </div>
      ))}
    </div>
  );
}

function EmptyTelemetry() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/40">
        <Activity className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <p className="mt-4 font-mono text-xs tracking-wider text-muted-foreground">
        // NO TELEMETRY PACKETS
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
        Waiting for student submissions on the exam_responses channel…
      </p>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
