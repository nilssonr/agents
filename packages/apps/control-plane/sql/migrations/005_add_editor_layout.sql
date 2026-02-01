-- migrate:up
ALTER TABLE agents ADD COLUMN editor_layout JSONB;

-- migrate:down
ALTER TABLE agents DROP COLUMN editor_layout;
