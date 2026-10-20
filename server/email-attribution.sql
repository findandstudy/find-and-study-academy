BEGIN;
CREATE TABLE IF NOT EXISTS academy_email_visits (
 id uuid PRIMARY KEY,
 message_id text NOT NULL CONSTRAINT academy_email_visits_message_id_check CHECK (message_id IN ('email_01_en','email_02_en','email_03_en','email_04_en','email_05_en','email_01_tr','email_02_tr','email_03_tr','email_04_tr','email_05_tr')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_email_visits_created_message ON academy_email_visits(created_at,message_id);
CREATE TABLE IF NOT EXISTS academy_email_registrations (
 user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 message_id text NOT NULL CONSTRAINT academy_email_registrations_message_id_check CHECK (message_id IN ('email_01_en','email_02_en','email_03_en','email_04_en','email_05_en','email_01_tr','email_02_tr','email_03_tr','email_04_tr','email_05_tr')),
 visit_id uuid NOT NULL REFERENCES academy_email_visits(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_email_registrations_created_message ON academy_email_registrations(created_at,message_id);
CREATE INDEX IF NOT EXISTS academy_email_registrations_visit ON academy_email_registrations(visit_id);
-- Additive only: existing accounts and campaign redemptions are not attributed.
COMMIT;
