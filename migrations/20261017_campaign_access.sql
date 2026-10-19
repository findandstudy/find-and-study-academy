BEGIN;
CREATE TABLE IF NOT EXISTS academy_campaigns (
 id uuid PRIMARY KEY, code_hash text NOT NULL UNIQUE, label text NOT NULL,
 expires_at timestamptz NOT NULL, max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 100000),
 access_days integer NOT NULL CHECK(access_days BETWEEN 1 AND 3650),
 enabled boolean NOT NULL DEFAULT true, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS academy_campaign_members (
 user_id varchar PRIMARY KEY REFERENCES users(id), campaign_id uuid NOT NULL REFERENCES academy_campaigns(id),
 verified_at timestamptz NOT NULL DEFAULT now(), redeemed_at timestamptz NOT NULL DEFAULT now(), access_until timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS academy_campaign_members_campaign ON academy_campaign_members(campaign_id);
CREATE TABLE IF NOT EXISTS academy_email_challenges (
 email text PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES academy_campaigns(id),
 code_hash text NOT NULL, expires_at timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0,
 sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS academy_devices (
 id uuid PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id), secret_hash text NOT NULL,
 label text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 UNIQUE(user_id,secret_hash)
);
CREATE INDEX IF NOT EXISTS academy_devices_user ON academy_devices(user_id);
COMMIT;
