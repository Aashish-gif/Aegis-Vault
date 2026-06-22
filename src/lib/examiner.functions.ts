import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  ACTIVE_EXAM_SESSION_ID,
  type ExamSessionConfigFull,
  type ExamSessionConfigPublic,
} from "@/lib/exam-session";
import { MAX_STUDENT_ID_LENGTH } from "@/lib/exam-payload";
import { type SafeQuestionRow } from "@/lib/questions";

// @tanstack-start-server-fn — examiner console RPCs (recompiled 2026-06-13)

const SAFE_QUESTION_COLUMNS =
  "id, question_text, option_a, option_b, option_c, option_d" as const;

const QuestionSchema = z.object({
  question_text: z.string().min(1).max(2000),
  option_a: z.string().min(1).max(500),
  option_b: z.string().min(1).max(500),
  option_c: z.string().min(1).max(500),
  option_d: z.string().min(1).max(500),
  correct_answer: z.enum(["A", "B", "C", "D"]),
});

const ExamSessionSchema = z.object({
  exam_title: z.string().min(1).max(200),
  duration_minutes: z.number().int().min(1).max(480),
  access_pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  max_allowed_violations: z.number().int().min(1).max(50),
});

const ValidateAccessSchema = z.object({
  student_id: z.string().min(4).max(MAX_STUDENT_ID_LENGTH),
  access_pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export type ExamResponseRow = {
  student_id: string;
  selected_option: string;
  ip_address: string | null;
  client_timestamp: string;
};

function mapSessionRow(row: {
  exam_title: string;
  duration_minutes: number;
  access_pin: string;
  max_allowed_violations: number;
}): ExamSessionConfigFull {
  return {
    exam_title: row.exam_title,
    duration_minutes: row.duration_minutes,
    access_pin: row.access_pin,
    max_allowed_violations: row.max_allowed_violations,
  };
}

function mapSessionPublic(row: {
  exam_title: string;
  duration_minutes: number;
  max_allowed_violations: number;
}): ExamSessionConfigPublic {
  return {
    exam_title: row.exam_title,
    duration_minutes: row.duration_minutes,
    max_allowed_violations: row.max_allowed_violations,
  };
}

export const insertQuestion = createServerFn({ method: "POST" })
  .validator((input: unknown) => QuestionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const id = `Q-${Date.now().toString(36).toUpperCase()}`;

    const { data: question, error } = await supabaseAdmin
      .from("questions")
      .insert({ id, ...data })
      .select()
      .single();

    if (error) {
      console.error("[Examiner] question insert failed", error);
      throw new Error(error.message);
    }

    return { question };
  });

export const fetchExamResponses = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ responses: ExamResponseRow[] }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("exam_responses")
      .select("student_id, selected_option, ip_address, client_timestamp")
      .order("client_timestamp", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[Examiner] telemetry fetch failed", error);
      throw new Error(error.message);
    }

    return { responses: data ?? [] };
  },
);

export const fetchLiveQuestions = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ questions: SafeQuestionRow[] }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("questions")
      .select(SAFE_QUESTION_COLUMNS)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Examiner] live question fetch failed", error);
      throw new Error(error.message);
    }

    return { questions: (data ?? []) as SafeQuestionRow[] };
  },
);

export const fetchExamSessionConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ config: ExamSessionConfigFull | null }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("exam_sessions")
      .select("exam_title, duration_minutes, access_pin, max_allowed_violations")
      .eq("id", ACTIVE_EXAM_SESSION_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[Examiner] session config fetch failed", error);
      throw new Error(error.message);
    }

    return { config: data ? mapSessionRow(data) : null };
  },
);

export const saveExamSessionConfig = createServerFn({ method: "POST" })
  .validator((input: unknown) => ExamSessionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const payload = {
      id: ACTIVE_EXAM_SESSION_ID,
      exam_title: data.exam_title.trim(),
      duration_minutes: data.duration_minutes,
      access_pin: data.access_pin,
      max_allowed_violations: data.max_allowed_violations,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: config, error } = await supabaseAdmin
      .from("exam_sessions")
      .upsert(payload, { onConflict: "id" })
      .select("exam_title, duration_minutes, access_pin, max_allowed_violations")
      .single();

    if (error) {
      console.error("[Examiner] session config save failed", error);
      throw new Error(error.message);
    }

    return { config: mapSessionRow(config) };
  });

export const validateExamAccess = createServerFn({ method: "POST" })
  .validator((input: unknown) => ValidateAccessSchema.parse(input))
  .handler(async ({ data }): Promise<{ config: ExamSessionConfigPublic }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: session, error } = await supabaseAdmin
      .from("exam_sessions")
      .select("exam_title, duration_minutes, access_pin, max_allowed_violations")
      .eq("id", ACTIVE_EXAM_SESSION_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[Examiner] session access lookup failed", error);
      throw new Error(error.message);
    }

    if (!session) {
      throw new Error("No active examination session is configured.");
    }

    if (session.access_pin !== data.access_pin) {
      throw new Error("Invalid access PIN.");
    }

    return { config: mapSessionPublic(session) };
  });
