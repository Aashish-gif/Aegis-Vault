export type ExamQuestion = {
  id: string;
  prompt: string;
  options: { key: "A" | "B" | "C" | "D"; text: string }[];
};

/** Supabase-safe projection — never includes correct_answer or validation hashes. */
export type SafeQuestionRow = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

export function mapSafeRowToExamQuestion(row: SafeQuestionRow): ExamQuestion {
  return {
    id: row.id,
    prompt: row.question_text,
    options: [
      { key: "A", text: row.option_a },
      { key: "B", text: row.option_b },
      { key: "C", text: row.option_c },
      { key: "D", text: row.option_d },
    ],
  };
}

export const EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: "Q-CAP-01",
    prompt:
      "In a partitioned distributed system, the CAP theorem forces a runtime choice between which two guarantees?",
    options: [
      { key: "A", text: "Consistency and Availability" },
      { key: "B", text: "Latency and Throughput" },
      { key: "C", text: "Durability and Encryption" },
      { key: "D", text: "Replication and Sharding" },
    ],
  },
  {
    id: "Q-CONS-02",
    prompt:
      "Which consensus protocol uses a leader-based log replication model and is widely deployed in etcd and Consul?",
    options: [
      { key: "A", text: "Two-phase commit" },
      { key: "B", text: "Gossip / SWIM" },
      { key: "C", text: "Raft" },
      { key: "D", text: "Vector clocks" },
    ],
  },
  {
    id: "Q-IDEM-03",
    prompt:
      "An idempotent HTTP endpoint must guarantee which of the following when the same request is retried?",
    options: [
      { key: "A", text: "Lower latency on each retry" },
      { key: "B", text: "Identical server-side state regardless of retry count" },
      { key: "C", text: "Cryptographic signing of the payload" },
      { key: "D", text: "Mandatory use of HTTP/2 multiplexing" },
    ],
  },
];
