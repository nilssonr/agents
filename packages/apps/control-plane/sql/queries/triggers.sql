-- name: CreateTrigger :one
INSERT INTO triggers (agent_id, kind, cron_expression)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetTriggersByAgent :many
SELECT * FROM triggers WHERE agent_id = $1 ORDER BY created_at DESC;

-- name: GetCronTriggers :many
SELECT t.*, a.status as agent_status
FROM triggers t
JOIN agents a ON a.id = t.agent_id
WHERE t.kind = 'cron'
AND a.status = 'active';

-- name: DeleteTrigger :exec
DELETE FROM triggers WHERE id = $1;

-- name: UpdateTriggerLastFiredAt :exec
UPDATE triggers SET last_fired_at = $1 WHERE id = $2;
