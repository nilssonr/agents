-- name: CreateJobLog :one
INSERT INTO job_logs (job_id, step_id, level, message, metadata)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListLogsByJob :many
SELECT * FROM job_logs
WHERE job_id = $1
ORDER BY created_at ASC;
