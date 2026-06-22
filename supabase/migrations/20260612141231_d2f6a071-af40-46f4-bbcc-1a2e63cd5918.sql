
CREATE TABLE public.exam_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_option TEXT NOT NULL,
  client_timestamp TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX exam_responses_student_idx ON public.exam_responses(student_id);

GRANT INSERT ON public.exam_responses TO anon, authenticated;
GRANT ALL ON public.exam_responses TO service_role;

ALTER TABLE public.exam_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may submit exam responses"
  ON public.exam_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
