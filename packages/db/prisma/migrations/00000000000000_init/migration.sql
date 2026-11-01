-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PM', 'DEV_LEAD', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('PLAN', 'REPLAN');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ExpansionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "Feature" AS ENUM ('PM_PLAN_OUTLINE', 'PM_PLAN_EXPAND', 'LEAD_DIGEST', 'DEV_SUMMARY', 'DEV_STANDUP');

-- CreateEnum
CREATE TYPE "SessionOutcome" AS ENUM ('OPEN', 'ACCEPTED', 'EDITED', 'REJECTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "LlmCallStatus" AS ENUM ('IN_FLIGHT', 'OK', 'SCHEMA_FAIL', 'UPSTREAM_ERROR', 'TIMEOUT', 'REFUSED', 'BLOCKED_INPUT', 'RATE_LIMITED', 'BUDGET_BLOCKED', 'CACHE_HIT');

-- CreateEnum
CREATE TYPE "TaskEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'BLOCKED', 'UNBLOCKED', 'POINTS_CHANGED', 'SPRINT_CHANGED');

-- CreateEnum
CREATE TYPE "ActivityItemType" AS ENUM ('COMMIT', 'PR');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brief" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epics" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "checkpoint_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "epics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "completed_points" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "epic_id" UUID NOT NULL,
    "sprint_id" UUID,
    "assignee_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptance_criteria" JSONB NOT NULL DEFAULT '[]',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "story_points" INTEGER,
    "done_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_events" (
    "id" BIGSERIAL NOT NULL,
    "task_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "type" "TaskEventType" NOT NULL,
    "from_value" TEXT,
    "to_value" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_proposals" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "kind" "ProposalKind" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "session_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "applied_by" UUID,
    "applied_at" TIMESTAMP(3),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_epics" (
    "proposal_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "checkpoint_name" TEXT,
    "content_hash" TEXT NOT NULL,
    "expansion_status" "ExpansionStatus" NOT NULL DEFAULT 'PENDING',
    "lease_expires_at" TIMESTAMP(3),
    "tasks" JSONB,
    "error" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_epics_pkey" PRIMARY KEY ("proposal_id","index")
);

-- CreateTable
CREATE TABLE "ai_sessions" (
    "id" UUID NOT NULL,
    "feature" "Feature" NOT NULL,
    "user_id" UUID NOT NULL,
    "project_id" UUID,
    "env" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "outcome" "SessionOutcome" NOT NULL DEFAULT 'OPEN',
    "regenerate_count" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,

    CONSTRAINT "ai_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" UUID,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "project_id" UUID,
    "env" TEXT NOT NULL,
    "feature" "Feature" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "status" "LlmCallStatus" NOT NULL,
    "lease_expires_at" TIMESTAMP(3),
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "attempts" INTEGER NOT NULL,
    "latency_ms" INTEGER,
    "estimated_prompt_tokens" INTEGER NOT NULL,
    "section_tokens" JSONB NOT NULL,
    "prefix_hash" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL,
    "truncated" BOOLEAN NOT NULL,
    "cost_microusd" BIGINT,
    "experiment" JSONB NOT NULL,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_gateway_state" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_gateway_state_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "rate_counters" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_counters_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "activity_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "item_type" "ActivityItemType" NOT NULL,
    "repo" TEXT NOT NULL DEFAULT '',
    "external_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "body_truncated" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "url" TEXT,
    "files" JSONB NOT NULL,
    "content_hash" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_summaries" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "content_hash" TEXT NOT NULL,
    "guard_version" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "one_liner" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL,
    "call_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standups" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "developer_id" UUID NOT NULL,
    "standup_date" DATE NOT NULL,
    "content" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "degraded" BOOLEAN NOT NULL,
    "flagged" BOOLEAN NOT NULL,
    "outcome" TEXT,
    "feedback" TEXT,
    "session_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "standups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_digests" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "facts" JSONB NOT NULL,
    "facts_hash" TEXT NOT NULL,
    "explanation" TEXT,
    "degraded" BOOLEAN NOT NULL,
    "flagged" BOOLEAN NOT NULL,
    "proposal_id" UUID,
    "session_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_digests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "checkpoints_project_id_target_date_idx" ON "checkpoints"("project_id", "target_date");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_project_id_id_key" ON "checkpoints"("project_id", "id");

-- CreateIndex
CREATE INDEX "epics_project_id_idx" ON "epics"("project_id");

-- CreateIndex
CREATE INDEX "epics_checkpoint_id_idx" ON "epics"("checkpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "epics_project_id_id_key" ON "epics"("project_id", "id");

-- CreateIndex
CREATE INDEX "sprints_project_id_start_date_idx" ON "sprints"("project_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_project_id_id_key" ON "sprints"("project_id", "id");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_epic_id_idx" ON "tasks"("epic_id");

-- CreateIndex
CREATE INDEX "tasks_sprint_id_idx" ON "tasks"("sprint_id");

-- CreateIndex
CREATE INDEX "task_events_project_id_at_idx" ON "task_events"("project_id", "at");

-- CreateIndex
CREATE INDEX "task_events_task_id_at_idx" ON "task_events"("task_id", "at");

-- CreateIndex
CREATE INDEX "ai_proposals_project_id_status_idx" ON "ai_proposals"("project_id", "status");

-- CreateIndex
CREATE INDEX "ai_proposals_session_id_idx" ON "ai_proposals"("session_id");

-- CreateIndex
CREATE INDEX "ai_sessions_user_id_started_at_idx" ON "ai_sessions"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "ai_sessions_feature_started_at_idx" ON "ai_sessions"("feature", "started_at");

-- CreateIndex
CREATE INDEX "llm_calls_created_at_idx" ON "llm_calls"("created_at");

-- CreateIndex
CREATE INDEX "llm_calls_user_id_created_at_idx" ON "llm_calls"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_feature_created_at_idx" ON "llm_calls"("feature", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_session_id_idx" ON "llm_calls"("session_id");

-- CreateIndex
CREATE INDEX "llm_calls_lease_expires_at_idx" ON "llm_calls"("lease_expires_at");

-- CreateIndex
CREATE INDEX "activity_items_project_id_uploaded_by_occurred_at_idx" ON "activity_items"("project_id", "uploaded_by", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "activity_items_project_id_uploaded_by_item_type_repo_extern_key" ON "activity_items"("project_id", "uploaded_by", "item_type", "repo", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_summaries_item_id_content_hash_guard_version_prompt_ve_key" ON "item_summaries"("item_id", "content_hash", "guard_version", "prompt_version");

-- CreateIndex
CREATE UNIQUE INDEX "standups_project_id_developer_id_standup_date_key" ON "standups"("project_id", "developer_id", "standup_date");

-- CreateIndex
CREATE INDEX "project_digests_project_id_created_at_idx" ON "project_digests"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epics" ADD CONSTRAINT "epics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epics" ADD CONSTRAINT "epics_project_id_checkpoint_id_fkey" FOREIGN KEY ("project_id", "checkpoint_id") REFERENCES "checkpoints"("project_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_epic_id_fkey" FOREIGN KEY ("project_id", "epic_id") REFERENCES "epics"("project_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_sprint_id_fkey" FOREIGN KEY ("project_id", "sprint_id") REFERENCES "sprints"("project_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_assignee_id_fkey" FOREIGN KEY ("project_id", "assignee_id") REFERENCES "project_members"("project_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_epics" ADD CONSTRAINT "proposal_epics_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "ai_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_sessions" ADD CONSTRAINT "ai_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_items" ADD CONSTRAINT "activity_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_items" ADD CONSTRAINT "activity_items_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_summaries" ADD CONSTRAINT "item_summaries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "activity_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_summaries" ADD CONSTRAINT "item_summaries_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "llm_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standups" ADD CONSTRAINT "standups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standups" ADD CONSTRAINT "standups_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standups" ADD CONSTRAINT "standups_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_digests" ADD CONSTRAINT "project_digests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_digests" ADD CONSTRAINT "project_digests_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "ai_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_digests" ADD CONSTRAINT "project_digests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- W1 partial indexes required by the architecture; Prisma schema parity verifies these migration-owned predicates.
CREATE INDEX "checkpoints_project_id_target_date_live_idx" ON "checkpoints"("project_id", "target_date") WHERE "deleted_at" IS NULL;
CREATE INDEX "llm_calls_in_flight_lease_idx" ON "llm_calls"("lease_expires_at") WHERE "status" = 'IN_FLIGHT';

