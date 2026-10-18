CREATE TABLE IF NOT EXISTS academy_translation_sources (
 kind text NOT NULL CHECK(kind IN ('content','quiz')), source_id text NOT NULL, source_hash text NOT NULL,
 snapshot jsonb NOT NULL, title text NOT NULL, source_language text NOT NULL DEFAULT 'en', eligible boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,source_id)
);
CREATE TABLE IF NOT EXISTS academy_translation_targets (
 kind text NOT NULL, source_id text NOT NULL, language text NOT NULL,
 locked boolean NOT NULL DEFAULT false, published_hash text, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,source_id,language), FOREIGN KEY(kind,source_id) REFERENCES academy_translation_sources(kind,source_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS academy_translation_jobs (
 id bigserial PRIMARY KEY, kind text NOT NULL, source_id text NOT NULL, language text NOT NULL, source_hash text NOT NULL,
 source_snapshot jsonb NOT NULL, previous_snapshot jsonb, base_translation jsonb, base_hash text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','ready','failed','budget_wait','locked','superseded','published','cancelled')),
 draft jsonb, attempts integer NOT NULL DEFAULT 0, error text, not_before timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), actor_id text,
 UNIQUE(kind,source_id,language,source_hash), FOREIGN KEY(kind,source_id) REFERENCES academy_translation_sources(kind,source_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS academy_translation_jobs_queue ON academy_translation_jobs(state,not_before);
CREATE TABLE IF NOT EXISTS academy_translation_publications (
 id bigserial PRIMARY KEY, job_id bigint NOT NULL REFERENCES academy_translation_jobs(id), actor_id text NOT NULL,
 previous_translation jsonb, published_translation jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS academy_translation_runtime (
 id integer PRIMARY KEY CHECK(id=1), enabled boolean NOT NULL DEFAULT true, baseline_complete boolean NOT NULL DEFAULT false, heartbeat timestamptz,
 last_scan timestamptz, last_error text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO academy_translation_runtime(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE UNIQUE INDEX IF NOT EXISTS academy_content_translation_language_unique ON content_translations(content_id,language);
