-- Automator schema. All tables are prefixed with automator_ and this script
-- NEVER drops or alters tables outside that prefix. Safe to run repeatedly.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS automator_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automator_workflows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES automator_users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    start_url   TEXT NOT NULL DEFAULT '',
    steps       JSONB NOT NULL DEFAULT '[]'::jsonb,
    variables   JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automator_workflows_user_id_idx
    ON automator_workflows (user_id);

CREATE TABLE IF NOT EXISTS automator_runs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id   UUID NOT NULL REFERENCES automator_workflows(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES automator_users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending',
    variable_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    log           TEXT NOT NULL DEFAULT '',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS automator_runs_workflow_id_idx
    ON automator_runs (workflow_id);
