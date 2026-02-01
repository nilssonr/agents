import { QueryArrayConfig, QueryArrayResult } from "pg";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const createJobQuery = `-- name: CreateJob :one
INSERT INTO jobs (agent_id, payload)
VALUES ($1, $2)
RETURNING id, agent_id, status, payload, result, error, current_step_id, context, step_retries, created_at, updated_at`;

export interface CreateJobArgs {
    agentId: string;
    payload: any | null;
}

export interface CreateJobRow {
    id: string;
    agentId: string;
    status: string;
    payload: any | null;
    result: any | null;
    error: string | null;
    currentStepId: string | null;
    context: any;
    stepRetries: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function createJob(client: Client, args: CreateJobArgs): Promise<CreateJobRow | null> {
    const result = await client.query({
        text: createJobQuery,
        values: [args.agentId, args.payload],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        agentId: row[1],
        status: row[2],
        payload: row[3],
        result: row[4],
        error: row[5],
        currentStepId: row[6],
        context: row[7],
        stepRetries: row[8],
        createdAt: row[9],
        updatedAt: row[10]
    };
}

export const listJobsByAgentQuery = `-- name: ListJobsByAgent :many
SELECT id, agent_id, status, payload, result, error, current_step_id, context, step_retries, created_at, updated_at FROM jobs
WHERE agent_id = $1
AND ($2::text IS NULL OR status = $2::text)
ORDER BY created_at DESC`;

export interface ListJobsByAgentArgs {
    agentId: string;
    status: string | null;
}

export interface ListJobsByAgentRow {
    id: string;
    agentId: string;
    status: string;
    payload: any | null;
    result: any | null;
    error: string | null;
    currentStepId: string | null;
    context: any;
    stepRetries: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function listJobsByAgent(client: Client, args: ListJobsByAgentArgs): Promise<ListJobsByAgentRow[]> {
    const result = await client.query({
        text: listJobsByAgentQuery,
        values: [args.agentId, args.status],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            agentId: row[1],
            status: row[2],
            payload: row[3],
            result: row[4],
            error: row[5],
            currentStepId: row[6],
            context: row[7],
            stepRetries: row[8],
            createdAt: row[9],
            updatedAt: row[10]
        };
    });
}

export const claimJobQuery = `-- name: ClaimJob :one
UPDATE jobs SET status = 'running', updated_at = now()
WHERE jobs.id = (
    SELECT j.id FROM jobs j
    WHERE j.agent_id = $1 AND j.status = 'pending'
    ORDER BY j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING id, agent_id, status, payload, result, error, current_step_id, context, step_retries, created_at, updated_at`;

export interface ClaimJobArgs {
    agentId: string;
}

export interface ClaimJobRow {
    id: string;
    agentId: string;
    status: string;
    payload: any | null;
    result: any | null;
    error: string | null;
    currentStepId: string | null;
    context: any;
    stepRetries: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function claimJob(client: Client, args: ClaimJobArgs): Promise<ClaimJobRow | null> {
    const result = await client.query({
        text: claimJobQuery,
        values: [args.agentId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        agentId: row[1],
        status: row[2],
        payload: row[3],
        result: row[4],
        error: row[5],
        currentStepId: row[6],
        context: row[7],
        stepRetries: row[8],
        createdAt: row[9],
        updatedAt: row[10]
    };
}

export const getJobByIdQuery = `-- name: GetJobById :one
SELECT id, agent_id, status, payload, result, error, current_step_id, context, step_retries, created_at, updated_at FROM jobs WHERE id = $1`;

export interface GetJobByIdArgs {
    id: string;
}

export interface GetJobByIdRow {
    id: string;
    agentId: string;
    status: string;
    payload: any | null;
    result: any | null;
    error: string | null;
    currentStepId: string | null;
    context: any;
    stepRetries: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function getJobById(client: Client, args: GetJobByIdArgs): Promise<GetJobByIdRow | null> {
    const result = await client.query({
        text: getJobByIdQuery,
        values: [args.id],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        agentId: row[1],
        status: row[2],
        payload: row[3],
        result: row[4],
        error: row[5],
        currentStepId: row[6],
        context: row[7],
        stepRetries: row[8],
        createdAt: row[9],
        updatedAt: row[10]
    };
}

export const completeJobQuery = `-- name: CompleteJob :exec
UPDATE jobs SET status = 'completed', result = $2, current_step_id = NULL, step_retries = 0, updated_at = now()
WHERE id = $1`;

export interface CompleteJobArgs {
    id: string;
    result: any | null;
}

export async function completeJob(client: Client, args: CompleteJobArgs): Promise<void> {
    await client.query({
        text: completeJobQuery,
        values: [args.id, args.result],
        rowMode: "array"
    });
}

export const failJobQuery = `-- name: FailJob :exec
UPDATE jobs SET status = 'failed', error = $2, updated_at = now()
WHERE id = $1`;

export interface FailJobArgs {
    id: string;
    error: string | null;
}

export async function failJob(client: Client, args: FailJobArgs): Promise<void> {
    await client.query({
        text: failJobQuery,
        values: [args.id, args.error],
        rowMode: "array"
    });
}

export const updateJobStepQuery = `-- name: UpdateJobStep :exec
UPDATE jobs SET current_step_id = $2, context = $3, step_retries = 0, status = 'pending', updated_at = now()
WHERE id = $1`;

export interface UpdateJobStepArgs {
    id: string;
    currentStepId: string | null;
    context: any;
}

export async function updateJobStep(client: Client, args: UpdateJobStepArgs): Promise<void> {
    await client.query({
        text: updateJobStepQuery,
        values: [args.id, args.currentStepId, args.context],
        rowMode: "array"
    });
}

export const incrementStepRetriesQuery = `-- name: IncrementStepRetries :one
UPDATE jobs SET step_retries = step_retries + 1, status = 'pending', updated_at = now()
WHERE id = $1
RETURNING id, agent_id, status, payload, result, error, current_step_id, context, step_retries, created_at, updated_at`;

export interface IncrementStepRetriesArgs {
    id: string;
}

export interface IncrementStepRetriesRow {
    id: string;
    agentId: string;
    status: string;
    payload: any | null;
    result: any | null;
    error: string | null;
    currentStepId: string | null;
    context: any;
    stepRetries: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function incrementStepRetries(client: Client, args: IncrementStepRetriesArgs): Promise<IncrementStepRetriesRow | null> {
    const result = await client.query({
        text: incrementStepRetriesQuery,
        values: [args.id],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        agentId: row[1],
        status: row[2],
        payload: row[3],
        result: row[4],
        error: row[5],
        currentStepId: row[6],
        context: row[7],
        stepRetries: row[8],
        createdAt: row[9],
        updatedAt: row[10]
    };
}

