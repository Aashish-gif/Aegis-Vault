import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, WifiOff, Layers, Lock, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AegisVault Core — Zero-Trust Examination Framework" },
      {
        name: "description",
        content:
          "Distributed, fault-tolerant exam network with offline-drop armor, background delta sync, and canvas anti-piracy wrapper.",
      },
      {
        property: "og:title",
        content: "AegisVault Core — Zero-Trust Examination Framework",
      },
      {
        property: "og:description",
        content:
          "Offline-resilient exam delivery with background sync and tamper-resistant canvas rendering.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simulate a short delay for feedback
      await new Promise(resolve => setTimeout(resolve, 300));

      if (accessCode === "STUDENT101") {
        navigate({ to: "/exam" });
      } else if (accessCode === "ADMIN202") {
        navigate({ to: "/examiner" });
      } else {
        setError("Invalid Access Code. Please check your credentials.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <nav className="flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2 text-accent">
            <Shield className="h-4 w-4" />
            <span className="tracking-widest font-semibold">AEGISVAULT // CORE</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">v1.0 • CLASSIFIED</span>
          </div>
        </nav>

        <div className="mt-20 grid gap-12 md:grid-cols-2">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-mono text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              ZERO-TRUST EXAMINATION NETWORK
            </div>
            <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl">
              Examinations that{" "}
              <span className="text-accent">survive the network.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Distributed, fault-tolerant exam delivery with offline-drop armor,
              autonomous delta sync, and a canvas-wrapped anti-piracy renderer.
              No spinners. No data loss. No screen scraping.
            </p>
            <div className="mt-10 grid gap-4">
              <Feature
                icon={<WifiOff className="h-5 w-5" />}
                title="Offline-Drop Armor"
                body="Every click lands in a Dexie/IndexedDB queue the instant it happens. Loss of connection never freezes the UI."
              />
              <Feature
                icon={<Layers className="h-5 w-5" />}
                title="Delta Recovery Sync"
                body="Online events trigger a background batch drainer that flushes the local queue sequentially without blocking the render thread."
              />
              <Feature
                icon={<Lock className="h-5 w-5" />}
                title="Canvas Anti-Piracy"
                body="Questions render to an HTML5 canvas under a live watermark of STUDENT-ID, IP and millisecond timestamp. Text cannot be selected."
              />
            </div>
          </section>

          <section className="flex items-center justify-center">
            <div className="w-full max-w-md rounded-xl border border-border bg-card/60 p-6 shadow-[0_0_40px_rgba(34,211,238,0.04)] backdrop-blur-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-accent/30 bg-accent/10">
                  <Lock className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground">
                    AEGISVAULT // SECURE ACCESS
                  </p>
                  <h1 className="text-lg font-bold tracking-tight">
                    Enter Access Code
                  </h1>
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2 font-mono text-xs text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="access-code"
                    className="font-mono text-xs tracking-wider text-muted-foreground"
                  >
                    ACCESS CODE
                  </Label>
                  <Input
                    id="access-code"
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter your access code"
                    disabled={loading}
                    className="border-border/80 bg-background/50 font-mono text-sm focus-visible:ring-accent/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !accessCode}
                  className="w-full bg-accent font-mono text-sm font-semibold text-accent-foreground hover:bg-accent/90"
                >
                  {loading ? "ACCESSING…" : "ENTER SYSTEM"}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card/60 p-4 transition hover:border-accent/50">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent/10 text-accent shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-mono text-sm font-semibold tracking-wider text-foreground">
            {title.toUpperCase()}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
    </article>
  );
}