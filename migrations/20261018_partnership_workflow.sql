CREATE TABLE IF NOT EXISTS partnership_applications (
 id text PRIMARY KEY,
 agency_id varchar REFERENCES agencies(id) ON DELETE SET NULL,
 submitted_by varchar REFERENCES users(id) ON DELETE SET NULL,
 agency_name text NOT NULL,
 destinations text NOT NULL,
 experience text NOT NULL,
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','review','needs_info','contract','onboarding','approved','rejected')),
 contract_status text NOT NULL DEFAULT 'pending' CHECK(contract_status IN ('pending','sent','signed')),
 contract_reference text NOT NULL DEFAULT '',
 training_done boolean NOT NULL DEFAULT false,
 meeting_done boolean NOT NULL DEFAULT false,
 portal_ready boolean NOT NULL DEFAULT false,
 public_note text NOT NULL DEFAULT '',
 internal_note text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,
 approved_by varchar REFERENCES users(id) ON DELETE SET NULL,
 approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(agency_id),
 CHECK(status <> 'approved' OR (contract_status='signed' AND training_done AND meeting_done AND portal_ready AND approved_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS partnership_events (
 id text PRIMARY KEY,
 application_id text NOT NULL REFERENCES partnership_applications(id) ON DELETE CASCADE,
 actor_id varchar REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL,
 from_status text,
 to_status text NOT NULL,
 public_note text NOT NULL DEFAULT '',
 admin_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partnership_events_application ON partnership_events(application_id,created_at);
