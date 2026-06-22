/** Public exam session config — never includes access_pin. */
export type ExamSessionConfigPublic = {
  exam_title: string;
  duration_minutes: number;
  max_allowed_violations: number;
};

/** Full config for examiner console editing. */
export type ExamSessionConfigFull = ExamSessionConfigPublic & {
  access_pin: string;
};

export type LockoutReason = "TIME_EXPIRED" | "MAX_VIOLATIONS";

export const ACTIVE_EXAM_SESSION_ID = "ACTIVE" as const;
