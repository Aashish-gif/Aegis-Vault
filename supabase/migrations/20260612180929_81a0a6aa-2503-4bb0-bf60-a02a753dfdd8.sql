-- Lock down SELECT on exam_responses: service_role only.
REVOKE SELECT ON public.exam_responses FROM anon, authenticated;

CREATE POLICY "No client reads of exam responses"
  ON public.exam_responses
  FOR SELECT
  TO anon, authenticated
  USING (false);