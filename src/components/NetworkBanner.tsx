import { Wifi, WifiOff, Database, RefreshCw, Shield } from "lucide-react";
import type { SyncState } from "@/hooks/use-sync-engine";

interface Props extends SyncState {
  studentId: string;
  ipAddress: string;
}

export function NetworkBanner({
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncAt,
  lastError,
  studentId,
  ipAddress,
}: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 text-xs font-mono">
        <div className="flex items-center gap-2 font-semibold text-accent">
          <Shield className="h-4 w-4" />
          <span className="tracking-widest">AEGISVAULT // CORE</span>
        </div>

        <Pill
          tone={isOnline ? "ok" : "danger"}
          icon={isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          label={isOnline ? "LINK SECURE" : "LINK SEVERED"}
        />

        <Pill
          tone="muted"
          icon={<Database className="h-3 w-3" />}
          label={`BUFFER ${String(pendingCount).padStart(3, "0")}`}
          accent={pendingCount > 0}
        />

        <Pill
          tone={isSyncing ? "active" : "muted"}
          icon={<RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />}
          label={isSyncing ? "SYNCING…" : lastSyncAt ? "SYNC IDLE" : "SYNC PENDING"}
        />

        <div className="ml-auto flex flex-wrap items-center gap-4 text-muted-foreground">
          <span>
            <span className="text-accent">STUDENT</span> {studentId}
          </span>
          <span>
            <span className="text-accent">IP</span> {ipAddress}
          </span>
          {lastSyncAt && (
            <span>
              <span className="text-accent">LAST</span>{" "}
              {new Date(lastSyncAt).toLocaleTimeString()}
            </span>
          )}
          {lastError && (
            <span className="text-destructive truncate max-w-[200px]" title={lastError}>
              ERR: {lastError}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function Pill({
  tone,
  icon,
  label,
  accent,
}: {
  tone: "ok" | "danger" | "muted" | "active";
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  const colors: Record<typeof tone, string> = {
    ok: "border-accent/40 bg-accent/10 text-accent",
    danger: "border-destructive/50 bg-destructive/15 text-destructive animate-pulse",
    muted: "border-border bg-muted/40 text-muted-foreground",
    active: "border-accent/40 bg-accent/10 text-accent",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 tracking-wider ${colors[tone]} ${accent ? "ring-1 ring-accent/40" : ""}`}
    >
      {icon}
      {label}
    </span>
  );
}
