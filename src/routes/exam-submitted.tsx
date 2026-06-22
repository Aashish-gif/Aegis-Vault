import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Shield } from "lucide-react";

export const Route = createFileRoute("/exam-submitted")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Exam Submitted — AegisVault Core" },
      {
        name: "description",
        content: "Your exam has been submitted successfully.",
      },
    ],
  }),
  component: ExamSubmitted,
});

function ExamSubmitted() {
  const search = Route.useSearch<{
    answersSynced?: string | number;
    totalQuestions?: string | number;
  }>();
  const answersSynced = Number(search.answersSynced) || 0;
  const totalQuestions = Number(search.totalQuestions) || 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-6 py-8">
        <nav className="flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2 text-accent">
            <Shield className="h-4 w-4" />
            <span className="tracking-widest font-semibold">AEGISVAULT // CORE</span>
          </div>
        </nav>

        <main className="mt-16 flex flex-col items-center justify-center text-center">
          <div className="rounded-xl border border-accent/30 bg-card/60 p-12 shadow-[0_0_60px_rgba(34,211,238,0.08)] backdrop-blur-sm">
            <CheckCircle2 className="mx-auto h-20 w-20 text-accent" />
            <h1 className="mt-6 text-3xl font-bold tracking-tight">
              Exam Submitted Successfully
            </h1>
            <p className="mt-4 text-muted-foreground">
              Your answers have been recorded and synced to the server.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background/50 p-6">
                <p className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">
                  ANSWERS SYNCED
                </p>
                <p className="mt-2 text-4xl font-bold tabular-nums text-accent">
                  {answersSynced}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background/50 p-6">
                <p className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">
                  STATE LOSS
                </p>
                <p className="mt-2 text-4xl font-bold tabular-nums text-accent">
                  0%
                </p>
              </div>
            </div>

            <Link
              to="/"
              className="mt-10 inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-6 py-3 font-mono text-sm text-accent hover:border-accent/50 hover:bg-accent/15 transition"
            >
              ← Return to Home
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
