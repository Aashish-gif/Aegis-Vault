CREATE TABLE public.exam_sessions (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'ACTIVE',
  exam_title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480),
  access_pin TEXT NOT NULL CHECK (access_pin ~ '^\d{4}$'),
  max_allowed_violations INTEGER NOT NULL DEFAULT 3 CHECK (max_allowed_violations BETWEEN 1 AND 50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.exam_sessions (
  id,
  exam_title,
  duration_minutes,
  access_pin,
  max_allowed_violations
)
VALUES ('ACTIVE', 'Untitled Examination', 60, '0000', 3);

GRANT ALL ON public.exam_sessions TO service_role;

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to exam_sessions"
  ON public.exam_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
