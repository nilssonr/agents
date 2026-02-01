-- migrate:up
ALTER TABLE triggers ADD COLUMN last_fired_at TIMESTAMPTZ;

-- migrate:down
ALTER TABLE triggers DROP COLUMN last_fired_at;
