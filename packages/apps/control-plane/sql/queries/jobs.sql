-- name: CreateJob :one
INSERT INTO jobs (agent_id, payload)
VALUES ($1, $2)
RETURNING *;

-- name: ListJobsByAgent :many
SELECT * FROM jobs
WHERE agent_id = $1
AND (sqlc.narg('status')::text IS NULL OR status = sqlc.narg('status')::text)
ORDER BY created_at DESC;

-- name: ClaimJob :one
UPDATE jobs SET status = 'running', updated_at = now()
WHERE jobs.id = (
    SELECT j.id FROM jobs j
    WHERE j.agent_id = $1 AND j.status = 'pending'
    ORDER BY j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING *;

-- name: CompleteJob :exec
UPDATE jobs SET status = 'completed', result = $2, updated_at = now()
WHERE id = $1;

-- name: FailJob :exec
UPDATE jobs SET status = 'failed', error = $2, updated_at = now()
WHERE id = $1;
