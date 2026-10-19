BEGIN;
CREATE TABLE IF NOT EXISTS academy_brand_logos (
 id uuid PRIMARY KEY, agency_id varchar NOT NULL REFERENCES agencies(id),
 created_by varchar NOT NULL REFERENCES users(id), original_path text NOT NULL, cleaned_path text NOT NULL,
 cleanup_method text NOT NULL, warning text, selected_variant text CHECK(selected_variant IN ('original','cleaned')),
 approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_brand_logos_agency ON academy_brand_logos(agency_id,created_at DESC);
CREATE TABLE IF NOT EXISTS academy_brand_current (
 agency_id varchar PRIMARY KEY REFERENCES agencies(id), logo_id uuid NOT NULL REFERENCES academy_brand_logos(id)
);
CREATE TABLE IF NOT EXISTS academy_brand_templates (
 content_id varchar PRIMARY KEY REFERENCES contents(id), source_hash text NOT NULL,
 x real NOT NULL, y real NOT NULL, width real NOT NULL, height real NOT NULL,
 backdrop text NOT NULL CHECK(backdrop IN ('none','white','black')),
 updated_by varchar NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(x>=0 AND y>=0 AND width>=0.03 AND height>=0.03 AND x+width<=1.001 AND y+height<=1.001)
);
COMMIT;
