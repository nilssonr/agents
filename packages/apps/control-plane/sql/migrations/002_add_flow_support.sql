-- migrate:up
ALTER TABLE jobs ADD COLUMN current_step_id TEXT;
ALTER TABLE jobs ADD COLUMN context JSONB NOT NULL DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN step_retries INTEGER NOT NULL DEFAULT 0;

-- migrate:down
ALTER TABLE jobs DROP COLUMN step_retries;
ALTER TABLE jobs DROP COLUMN context;
ALTER TABLE jobs DROP COLUMN current_step_id;
