
DROP POLICY "Anyone may submit exam responses" ON public.exam_responses;

CREATE POLICY "Submit valid exam responses"
  ON public.exam_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(student_id) BETWEEN 4 AND 64
    AND length(question_id) BETWEEN 1 AND 64
    AND length(selected_option) BETWEEN 1 AND 8
    AND client_timestamp > now() - interval '7 days'
    AND client_timestamp < now() + interval '1 hour'
  );
