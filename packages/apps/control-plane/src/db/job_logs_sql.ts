import { QueryArrayConfig, QueryArrayResult } from "pg";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const createJobLogQuery = `-- name: CreateJobLog :one
INSERT INTO job_logs (job_id, step_id, level, message, metadata)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, job_id, step_id, level, message, metadata, created_at`;

export interface CreateJobLogArgs {
    jobId: string;
    stepId: string | null;
    level: string;
    message: string;
    metadata: any | null;
}

export interface CreateJobLogRow {
    id: string;
    jobId: string;
    stepId: string | null;
    level: string;
    message: string;
    metadata: any | null;
    createdAt: Date;
}

export async function createJobLog(client: Client, args: CreateJobLogArgs): Promise<CreateJobLogRow | null> {
    const result = await client.query({
        text: createJobLogQuery,
        values: [args.jobId, args.stepId, args.level, args.message, args.metadata],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        jobId: row[1],
        stepId: row[2],
        level: row[3],
        message: row[4],
        metadata: row[5],
        createdAt: row[6]
    };
}

export const listLogsByJobQuery = `-- name: ListLogsByJob :many
SELECT id, job_id, step_id, level, message, metadata, created_at FROM job_logs
WHERE job_id = $1
ORDER BY created_at ASC`;

export interface ListLogsByJobArgs {
    jobId: string;
}

export interface ListLogsByJobRow {
    id: string;
    jobId: string;
    stepId: string | null;
    level: string;
    message: string;
    metadata: any | null;
    createdAt: Date;
}

export async function listLogsByJob(client: Client, args: ListLogsByJobArgs): Promise<ListLogsByJobRow[]> {
    const result = await client.query({
        text: listLogsByJobQuery,
        values: [args.jobId],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            jobId: row[1],
            stepId: row[2],
            level: row[3],
            message: row[4],
            metadata: row[5],
            createdAt: row[6]
        };
    });
}
