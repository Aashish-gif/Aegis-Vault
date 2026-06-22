const STUDENT_KEY = "aegisvault.student_id";
const IP_KEY = "aegisvault.ip";

export function getOrCreateStudentId(): string {
  if (typeof window === "undefined") return "AVX-SSR000";
  let id = localStorage.getItem(STUDENT_KEY);
  if (!id) {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    id = `AVX-${hex}`;
    localStorage.setItem(STUDENT_KEY, id);
  }
  return id;
}

export function persistStudentId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STUDENT_KEY, id.trim());
}

export async function resolveClientIp(): Promise<string> {
  if (typeof window === "undefined") return "0.0.0.0";
  const cached = sessionStorage.getItem(IP_KEY);
  if (cached) return cached;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    const json = (await res.json()) as { ip?: string };
    const ip = json.ip ?? "0.0.0.0";
    sessionStorage.setItem(IP_KEY, ip);
    return ip;
  } catch {
    return "0.0.0.0";
  }
}
