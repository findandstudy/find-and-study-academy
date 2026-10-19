CREATE TABLE "agencies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"country" text,
	"city" text,
	"contact_email" text,
	"contact_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"address" text,
	"google_map_url" text,
	"yandex_map_url" text,
	"staff_size" integer,
	"annual_students" integer,
	"website" text,
	"phone" text,
	"primary_contact_name" text,
	"primary_contact_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"metric_type" text NOT NULL,
	"metric_value" text,
	"course_id" varchar,
	"content_id" varchar,
	"quiz_id" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_translations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" varchar NOT NULL,
	"language" text NOT NULL,
	"title" text,
	"content" text,
	"translated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_lang_unique" UNIQUE("announcement_id","language")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"expires_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"quiz_id" varchar NOT NULL,
	"score_percent" integer NOT NULL,
	"correct" integer NOT NULL,
	"incorrect" integer NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"score_percent" integer NOT NULL,
	"code" varchar NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_code_unique" UNIQUE("code"),
	CONSTRAINT "user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "content_translations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" varchar NOT NULL,
	"language" text NOT NULL,
	"title" text,
	"description" text,
	"content" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"translated_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'lesson' NOT NULL,
	"content_type" text,
	"country_id" varchar,
	"country_code" text,
	"course_id" varchar,
	"quiz_id" varchar,
	"content" text,
	"video_url" text,
	"video_duration" integer,
	"document_url" text,
	"image_url" text,
	"alt_text" text,
	"display_name" text,
	"file_size" text,
	"category_tag" text,
	"language" text DEFAULT 'en' NOT NULL,
	"section" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"order" integer DEFAULT 0,
	"folder_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contents_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" varchar(2) NOT NULL,
	"flag" text,
	"status" text DEFAULT 'active' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "countries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"template_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findy_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar,
	CONSTRAINT "findy_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "findy_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"user_id" varchar,
	"message_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"fallback_count" integer DEFAULT 0 NOT NULL,
	"feedback_positive" integer DEFAULT 0 NOT NULL,
	"feedback_negative" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findy_keyword_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turkish_phrase" text NOT NULL,
	"english_equivalents" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "findy_keyword_mappings_turkish_phrase_unique" UNIQUE("turkish_phrase")
);
--> statement-breakpoint
CREATE TABLE "findy_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"feedback" text,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_api_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[],
	"integration_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_by" varchar
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" varchar,
	"integration_name" text,
	"event_type" text NOT NULL,
	"method" text DEFAULT 'POST' NOT NULL,
	"target_url" text,
	"request_payload" text,
	"response_status" integer,
	"response_body" text,
	"hmac_header" text,
	"duration_ms" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"triggered_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"display_name" text,
	"description" text,
	"endpoint_url" text,
	"api_key" text,
	"api_secret" text,
	"webhook_secret" text,
	"smtp_host" text,
	"smtp_port" text,
	"smtp_user" text,
	"smtp_pass" text,
	"from_email" text,
	"sheet_id" text,
	"tab_name" text,
	"crm_domain" text,
	"crm_token" text,
	"workflow_id" text,
	"settings" text,
	"last_test_at" timestamp,
	"last_test_status" text,
	"last_test_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"keywords" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"file_type" text,
	"original_name" text,
	"file_path" text,
	"url" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"row_count" integer DEFAULT 0,
	"chunk_count" integer DEFAULT 0,
	"error_message" text,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"country_code" varchar(10),
	"category_tag" text,
	"parent_folder_id" varchar,
	"status" text DEFAULT 'draft' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'none' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"display_name" text,
	"public_key" text,
	"secret_key" text,
	"webhook_secret" text,
	"success_url" text,
	"cancel_url" text,
	"settings" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "popup_dismissals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"popup_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL,
	"dont_show_again" boolean DEFAULT false NOT NULL,
	CONSTRAINT "popup_user_unique" UNIQUE("popup_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "popups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"link_url" text,
	"link_text" text,
	"target_audience" text DEFAULT 'all' NOT NULL,
	"target_agency_ids" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"frequency" text DEFAULT 'every_session' NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progresses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"course_id" varchar NOT NULL,
	"lesson_completed_ids" text[] DEFAULT ARRAY[]::text[],
	"percent" integer DEFAULT 0 NOT NULL,
	"current_lesson_id" varchar,
	"last_accessed" timestamp DEFAULT now() NOT NULL,
	"last_lesson_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_course_progress_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"course_id" varchar NOT NULL,
	"country_id" varchar,
	"is_final" boolean DEFAULT false NOT NULL,
	"pass_percent" integer DEFAULT 70 NOT NULL,
	"questions" text,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"category" text DEFAULT 'general' NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"agency_id" varchar,
	"company_name" text,
	"country" text,
	"phone" text,
	"language_preference" text DEFAULT 'en',
	"profile_picture" text,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"course_completion_notif" boolean DEFAULT true NOT NULL,
	"certificate_notif" boolean DEFAULT true NOT NULL,
	"announcement_notif" boolean DEFAULT true NOT NULL,
	"reset_token" varchar,
	"reset_token_expiry" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "announcement_translations" ADD CONSTRAINT "announcement_translations_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findy_messages" ADD CONSTRAINT "findy_messages_conversation_id_findy_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."findy_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_folders" ADD CONSTRAINT "partner_folders_parent_folder_id_partner_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."partner_folders"("id") ON DELETE restrict ON UPDATE no action;