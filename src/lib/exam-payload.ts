export const MAX_STUDENT_ID_LENGTH = 50;
export const MAX_SELECTED_OPTION_LENGTH = 10;

export function sanitizeStudentId(value: string): string {
  return value.trim().slice(0, MAX_STUDENT_ID_LENGTH);
}

export function sanitizeSelectedOption(value: string): string {
  return value.trim().slice(0, MAX_SELECTED_OPTION_LENGTH);
}

export type RawExamResponse = {
  student_id: string;
  question_id: string;
  selected_option: string;
  client_timestamp: string;
  ip_address?: string;
};

/** Client-side validation boundary before queueing or submitting responses. */
export function sanitizeExamResponsePayload(record: RawExamResponse): RawExamResponse {
  return {
    student_id: sanitizeStudentId(record.student_id),
    question_id: record.question_id.trim().slice(0, 64),
    selected_option: sanitizeSelectedOption(record.selected_option),
    client_timestamp: record.client_timestamp,
    ip_address: record.ip_address?.trim().slice(0, 64),
  };
}
