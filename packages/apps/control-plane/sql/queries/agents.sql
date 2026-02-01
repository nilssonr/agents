-- name: CreateAgent :one
INSERT INTO agents (name, activities, failure_threshold)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetAgent :one
SELECT * FROM agents WHERE id = $1;

-- name: ListAgents :many
SELECT * FROM agents ORDER BY created_at DESC;

-- name: DeleteAgent :exec
DELETE FROM agents WHERE id = $1;

-- name: UpdateAgentStatus :exec
UPDATE agents SET status = $1, updated_at = now() WHERE id = $2;

-- name: IncrementFailureCount :one
UPDATE agents SET failure_count = failure_count + 1, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: UpdateAgent :one
UPDATE agents SET name = $2, activities = $3, failure_threshold = $4, editor_layout = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: ResetAgent :exec
UPDATE agents SET status = 'active', failure_count = 0, updated_at = now()
WHERE id = $1;
