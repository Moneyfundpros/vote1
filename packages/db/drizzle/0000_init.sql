CREATE TABLE IF NOT EXISTS "ballots" (
	"poll_id" bigint NOT NULL,
	"voter_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"receipt_id" uuid NOT NULL,
	"cast_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ballots_pkey" PRIMARY KEY("poll_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_reconcile_state" (
	"poll_id" bigint PRIMARY KEY NOT NULL,
	"last_vote_id" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_tally" (
	"poll_id" bigint NOT NULL,
	"option_id" bigint NOT NULL,
	"dimension" text DEFAULT 'total' NOT NULL,
	"dim_key" text DEFAULT '_' NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	"recomputed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_tally_poll_id_option_id_dimension_dim_key_pk" PRIMARY KEY("poll_id","option_id","dimension","dim_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vote_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" bigint NOT NULL,
	"voter_id" uuid NOT NULL,
	"receipt_hash" "bytea" NOT NULL,
	"cast_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"basis" text DEFAULT 'explicit_consent' NOT NULL,
	"policy_version" text NOT NULL,
	"ip_hmac" "bytea",
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "consent_purpose_ck" CHECK (purpose IN ('kyc_identity', 'demographic_analytics', 'marketing')),
	CONSTRAINT "consent_basis_ck" CHECK (basis IN ('explicit_consent', 'legitimate_interest'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_dedup" (
	"dedup_hmac" "bytea" PRIMARY KEY NOT NULL,
	"dedup_key_v" smallint DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"id_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_dedup_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kyc_status" text NOT NULL,
	"provider_used" text NOT NULL,
	"provider_ref" text,
	"provider_ref_expires_at" timestamp with time zone,
	"id_type" text NOT NULL,
	"face_match" boolean,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_verifications_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "idv_kyc_status_ck" CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
	CONSTRAINT "idv_provider_ck" CHECK (provider_used IN ('dojah', 'smileid')),
	CONSTRAINT "idv_id_type_ck" CHECK (id_type IN ('nin', 'bvn'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"tier" text NOT NULL,
	"outcome" text NOT NULL,
	"fail_reason" text,
	"retain_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"handle" "citext",
	"avatar_object_key" text,
	"state_code" text,
	"lga_code" text,
	"age_band" text,
	"gender" text,
	"demographics_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_age_band_ck" CHECK (age_band IS NULL OR age_band IN ('18-24', '25-34', '35-44', '45-54', '55-64', '65+'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_enc" text NOT NULL,
	"phone_bidx" "bytea" NOT NULL,
	"email" "citext",
	"kyc_status" text DEFAULT 'unverified' NOT NULL,
	"role" text DEFAULT 'voter' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_kyc_status_ck" CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected')),
	CONSTRAINT "users_role_ck" CHECK (role IN ('voter', 'moderator', 'analyst', 'admin', 'auditor')),
	CONSTRAINT "users_status_ck" CHECK (status IN ('active', 'suspended', 'banned', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"parent_code" text,
	"geojson_object_key" text,
	CONSTRAINT "regions_level_ck" CHECK (level IN ('zone', 'state', 'lga', 'ward')),
	CONSTRAINT "regions_parent_fk_soft" CHECK (parent_code IS NULL OR parent_code <> code)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_promises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"tracking_status" text DEFAULT 'promised' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promise_status_ck" CHECK (tracking_status IN ('promised', 'in_progress', 'fulfilled', 'broken', 'stalled'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_follows" (
	"candidate_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"media_type" text NOT NULL,
	"content_type" text,
	"scan_status" text DEFAULT 'pending' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_type_ck" CHECK (media_type IN ('image', 'video', 'pdf')),
	CONSTRAINT "media_scan_ck" CHECK (scan_status IN ('pending', 'clean', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"stance" text NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_profiles" (
	"candidate_id" uuid PRIMARY KEY NOT NULL,
	"bio" text,
	"manifesto" jsonb,
	"birth_year" integer,
	"home_state_code" text,
	"socials" jsonb,
	"verified_badge" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidate_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"party_code" text,
	"office" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_status_ck" CHECK (status IN ('active', 'withdrawn', 'disqualified'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eligibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"requires_kyc" boolean DEFAULT true NOT NULL,
	"allowed_states" text[],
	"min_age_band" text,
	"predicate" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "poll_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "poll_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"poll_id" bigint NOT NULL,
	"candidate_id" uuid,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"media_object_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "polls" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "polls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" "citext" NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"vote_type" text DEFAULT 'single' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"eligibility_rule_id" uuid,
	"result_visibility" text DEFAULT 'live' NOT NULL,
	"cover_object_key" text,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "polls_kind_ck" CHECK (kind IN ('election', 'governance', 'policy', 'national_issue', 'survey')),
	CONSTRAINT "polls_status_ck" CHECK (status IN ('draft', 'scheduled', 'open', 'closed', 'certified', 'archived')),
	CONSTRAINT "polls_vote_type_ck" CHECK (vote_type IN ('single', 'multi', 'ranked')),
	CONSTRAINT "polls_result_vis_ck" CHECK (result_visibility IN ('live', 'after_close', 'certified_only')),
	CONSTRAINT "polls_window_ck" CHECK (opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_anchors" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_anchors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"poll_id" bigint,
	"batch_from_id" bigint NOT NULL,
	"batch_to_id" bigint NOT NULL,
	"leaf_count" bigint NOT NULL,
	"merkle_root" "bytea" NOT NULL,
	"prev_root" "bytea",
	"external_anchor_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"subject_ref" text,
	"payload" jsonb NOT NULL,
	"prev_hash" "bytea" NOT NULL,
	"row_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certified_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" bigint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"total_votes" bigint NOT NULL,
	"checksum" "bytea" NOT NULL,
	"export_object_key" text NOT NULL,
	"certified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certified_results_poll_id_unique" UNIQUE("poll_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "result_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" bigint,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"checksum" "bytea" NOT NULL,
	"byte_size" bigint,
	"built_by_job" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_exports_kind_ck" CHECK (kind IN ('certified', 'audit_log', 'raw_aggregate'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "results_aggregates" (
	"poll_id" bigint NOT NULL,
	"option_id" bigint NOT NULL,
	"dimension" text NOT NULL,
	"dim_key" text DEFAULT '_' NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	"recomputed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "results_agg_dim_ck" CHECK (dimension IN ('total', 'geo', 'demo'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"parent_post_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_status_ck" CHECK (status IN ('visible', 'hidden', 'removed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qa_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"answerer_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_official" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qa_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"poll_id" bigint,
	"asker_id" uuid NOT NULL,
	"body" text NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qa_status_ck" CHECK (status IN ('pending', 'approved', 'answered', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"respondent_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"state_code" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"questions" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"requires_kyc" integer DEFAULT 1 NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_status_ck" CHECK (status IN ('draft', 'open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" bigint,
	"candidate_id" uuid,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_status_ck" CHECK (status IN ('open', 'locked', 'hidden', 'removed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"category" text NOT NULL,
	"provider" text,
	"template_key" text,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"dedupe_key" text,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notif_channel_ck" CHECK (channel IN ('inapp', 'email', 'sms', 'push')),
	CONSTRAINT "notif_category_ck" CHECK (category IN ('otp', 'receipt', 'kyc', 'security', 'poll_announcement', 'results', 'marketing')),
	CONSTRAINT "notif_provider_ck" CHECK (provider IS NULL OR provider IN ('resend', 'brevo')),
	CONSTRAINT "notif_status_ck" CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'read'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_target_ck" CHECK (target_type IN ('post', 'thread', 'qa_question', 'candidate', 'user', 'vote_anomaly')),
	CONSTRAINT "reports_severity_ck" CHECK (severity IN ('low', 'medium', 'high', 'critical')),
	CONSTRAINT "reports_status_ck" CHECK (status IN ('open', 'triaging', 'actioned', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "security_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "security_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"event_type" text NOT NULL,
	"ip_hmac" "bytea",
	"fp_hmac" "bytea",
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_event_type_ck" CHECK (event_type IN ('login_success', 'login_failed', 'login_locked', 'new_device', 'mfa_challenge', 'mfa_pass', 'mfa_fail', 'risk_block', 'risk_stepup', 'kyc_started', 'kyc_verified', 'kyc_rejected', 'kyc_duplicate'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ballots" ADD CONSTRAINT "ballots_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ballots" ADD CONSTRAINT "ballots_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_reconcile_state" ADD CONSTRAINT "poll_reconcile_state_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_tally" ADD CONSTRAINT "poll_tally_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vote_receipts" ADD CONSTRAINT "vote_receipts_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vote_receipts" ADD CONSTRAINT "vote_receipts_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_ledger" ADD CONSTRAINT "consent_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_dedup" ADD CONSTRAINT "identity_dedup_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_attempts" ADD CONSTRAINT "kyc_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_promises" ADD CONSTRAINT "campaign_promises_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_follows" ADD CONSTRAINT "candidate_follows_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_media" ADD CONSTRAINT "candidate_media_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_positions" ADD CONSTRAINT "candidate_positions_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_home_state_code_regions_code_fk" FOREIGN KEY ("home_state_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "candidate_updates" ADD CONSTRAINT "candidate_updates_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "polls" ADD CONSTRAINT "polls_eligibility_rule_id_eligibility_rules_id_fk" FOREIGN KEY ("eligibility_rule_id") REFERENCES "public"."eligibility_rules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_anchors" ADD CONSTRAINT "audit_anchors_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certified_results" ADD CONSTRAINT "certified_results_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "result_exports" ADD CONSTRAINT "result_exports_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "results_aggregates" ADD CONSTRAINT "results_aggregates_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qa_answers" ADD CONSTRAINT "qa_answers_question_id_qa_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."qa_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qa_answers" ADD CONSTRAINT "qa_answers_answerer_id_users_id_fk" FOREIGN KEY ("answerer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_asker_id_users_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_id_users_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "threads" ADD CONSTRAINT "threads_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "threads" ADD CONSTRAINT "threads_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "threads" ADD CONSTRAINT "threads_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ballots_receipt_idx" ON "ballots" USING btree ("receipt_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vote_receipts_hash_uq" ON "vote_receipts" USING btree ("receipt_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vote_receipts_owner_uq" ON "vote_receipts" USING btree ("poll_id","voter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_user_purpose_idx" ON "consent_ledger" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idv_provider_ref_uq" ON "identity_verifications" USING btree ("provider_ref") WHERE provider_ref IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_attempts_user_idx" ON "kyc_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_handle_uq" ON "profiles" USING btree ("handle") WHERE handle IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_bidx_uq" ON "users" USING btree ("phone_bidx");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree ("email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_verified_idx" ON "users" USING btree ("id") WHERE kyc_status = 'verified';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_uq" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regions_parent_idx" ON "regions" USING btree ("parent_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regions_level_idx" ON "regions" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_follow_uq" ON "candidate_follows" USING btree ("candidate_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "candidate_media_idx" ON "candidate_media" USING btree ("candidate_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "poll_options_position_uq" ON "poll_options" USING btree ("poll_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "poll_options_candidate_uq" ON "poll_options" USING btree ("poll_id","candidate_id") WHERE candidate_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "polls_slug_uq" ON "polls" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "polls_status_closes_idx" ON "polls" USING btree ("status","closes_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "polls_kind_idx" ON "polls" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_anchors_poll_idx" ON "audit_anchors" USING btree ("poll_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_event_idx" ON "audit_log" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_subject_idx" ON "audit_log" USING btree ("subject_ref");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "results_agg_pk" ON "results_aggregates" USING btree ("poll_id","option_id","dimension","dim_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_thread_idx" ON "posts" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_author_idx" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_candidate_idx" ON "qa_questions" USING btree ("candidate_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_upvotes_idx" ON "qa_questions" USING btree ("upvotes");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "survey_response_uq" ON "survey_responses" USING btree ("survey_id","respondent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "survey_response_survey_idx" ON "survey_responses" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threads_poll_idx" ON "threads" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threads_candidate_idx" ON "threads" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threads_created_idx" ON "threads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_actions_admin_idx" ON "admin_actions" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_actions_action_idx" ON "admin_actions" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_status_idx" ON "notifications" USING btree ("status") WHERE status IN ('queued','failed');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notif_dedupe_uq" ON "notifications" USING btree ("dedupe_key") WHERE dedupe_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" USING btree ("status","severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_events_user_idx" ON "security_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "security_events_type_idx" ON "security_events" USING btree ("event_type","created_at");