BEGIN;
CREATE TABLE IF NOT EXISTS quiz_translations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id varchar NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  language text NOT NULL,
  title text NOT NULL,
  description text,
  questions text NOT NULL,
  source_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_translation_language_unique UNIQUE (quiz_id, language)
);
COMMIT;
