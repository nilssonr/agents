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

-- name: GetJobById :one
SELECT * FROM jobs WHERE id = $1;

-- name: CompleteJob :exec
UPDATE jobs SET status = 'completed', result = $2, current_step_id = NULL, step_retries = 0, updated_at = now()
WHERE id = $1;

-- name: FailJob :exec
UPDATE jobs SET status = 'failed', error = $2, updated_at = now()
WHERE id = $1;

-- name: UpdateJobStep :exec
UPDATE jobs SET current_step_id = $2, context = $3, step_retries = 0, status = 'pending', updated_at = now()
WHERE id = $1;

-- name: IncrementStepRetries :one
UPDATE jobs SET step_retries = step_retries + 1, status = 'pending', updated_at = now()
WHERE id = $1
RETURNING *;
