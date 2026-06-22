import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// @tanstack-start-server-fn — exam session RPCs (recompiled 2026-06-13)

import {
  MAX_SELECTED_OPTION_LENGTH,
  MAX_STUDENT_ID_LENGTH,
  sanitizeExamResponsePayload,
  sanitizeStudentId,
} from "@/lib/exam-payload";
import { mapSafeRowToExamQuestion, type SafeQuestionRow } from "@/lib/questions";

/** Explicit allow-list — correct_answer and created_at are never fetched for the exam client. */
const SAFE_QUESTION_COLUMNS =
  "id, question_text, option_a, option_b, option_c, option_d" as const;

const ResponseSchema = z.object({
  student_id: z.string().min(1).max(MAX_STUDENT_ID_LENGTH),
  question_id: z.string().min(1).max(64),
  selected_option: z.string().min(1).max(MAX_SELECTED_OPTION_LENGTH),
  client_timestamp: z.string(),
  ip_address: z.string().max(64).optional(),
});

const BatchSchema = z.object({
  responses: z.array(ResponseSchema).min(1).max(100),
});

const CheatLogSchema = z.object({
  student_id: z.string().min(1).max(MAX_STUDENT_ID_LENGTH),
  violation: z.string().min(1).max(500),
  question_id: z.string().min(1).max(64).optional(),
  ip_address: z.string().max(64).optional(),
});

export const fetchExamQuestions = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("questions")
      .select(SAFE_QUESTION_COLUMNS)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[AegisVault] question fetch failed", error);
      throw new Error(error.message);
    }

    const rows = (data ?? []) as SafeQuestionRow[];
    return { questions: rows.map(mapSafeRowToExamQuestion) };
  },
);

export const submitExamBatch = createServerFn({ method: "POST" })
  .validator((input: unknown) => BatchSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const responses = data.responses.map(sanitizeExamResponsePayload);

    const { error } = await supabaseAdmin.from("exam_responses").insert(responses);
    if (error) {
      console.error("[AegisVault] insert failed", error);
      throw new Error(`Insert failed: ${error.message}`);
    }
    return { inserted: responses.length };
  });

export const logCheatViolation = createServerFn({ method: "POST" })
  .validator((input: unknown) => CheatLogSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const payload = {
      student_id: sanitizeStudentId(data.student_id),
      question_id: data.question_id?.trim().slice(0, 64) ?? "ARMOR",
      selected_option: "VIOLATION",
      client_timestamp: new Date().toISOString(),
      ip_address: data.ip_address?.trim().slice(0, 64) ?? null,
      cheat_logs: [data.violation],
    };

    const { error } = await supabaseAdmin.from("exam_responses").insert(payload);

    if (error) {
      console.error("[AegisVault] cheat log insert failed", error);
      throw new Error(`Cheat log failed: ${error.message}`);
    }

    return { logged: true };
  });
