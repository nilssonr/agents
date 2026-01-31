import { QueryArrayConfig, QueryArrayResult } from "pg";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const createAgentQuery = `-- name: CreateAgent :one
INSERT INTO agents (name, activities, failure_threshold)
VALUES ($1, $2, $3)
RETURNING id, name, status, activities, failure_threshold, failure_count, created_at, updated_at`;

export interface CreateAgentArgs {
    name: string;
    activities: any;
    failureThreshold: number;
}

export interface CreateAgentRow {
    id: string;
    name: string;
    status: string;
    activities: any;
    failureThreshold: number;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function createAgent(client: Client, args: CreateAgentArgs): Promise<CreateAgentRow | null> {
    const result = await client.query({
        text: createAgentQuery,
        values: [args.name, args.activities, args.failureThreshold],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        name: row[1],
        status: row[2],
        activities: row[3],
        failureThreshold: row[4],
        failureCount: row[5],
        createdAt: row[6],
        updatedAt: row[7]
    };
}

export const getAgentQuery = `-- name: GetAgent :one
SELECT id, name, status, activities, failure_threshold, failure_count, created_at, updated_at FROM agents WHERE id = $1`;

export interface GetAgentArgs {
    id: string;
}

export interface GetAgentRow {
    id: string;
    name: string;
    status: string;
    activities: any;
    failureThreshold: number;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function getAgent(client: Client, args: GetAgentArgs): Promise<GetAgentRow | null> {
    const result = await client.query({
        text: getAgentQuery,
        values: [args.id],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        name: row[1],
        status: row[2],
        activities: row[3],
        failureThreshold: row[4],
        failureCount: row[5],
        createdAt: row[6],
        updatedAt: row[7]
    };
}

export const listAgentsQuery = `-- name: ListAgents :many
SELECT id, name, status, activities, failure_threshold, failure_count, created_at, updated_at FROM agents ORDER BY created_at DESC`;

export interface ListAgentsRow {
    id: string;
    name: string;
    status: string;
    activities: any;
    failureThreshold: number;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function listAgents(client: Client): Promise<ListAgentsRow[]> {
    const result = await client.query({
        text: listAgentsQuery,
        values: [],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            name: row[1],
            status: row[2],
            activities: row[3],
            failureThreshold: row[4],
            failureCount: row[5],
            createdAt: row[6],
            updatedAt: row[7]
        };
    });
}

export const deleteAgentQuery = `-- name: DeleteAgent :exec
DELETE FROM agents WHERE id = $1`;

export interface DeleteAgentArgs {
    id: string;
}

export async function deleteAgent(client: Client, args: DeleteAgentArgs): Promise<void> {
    await client.query({
        text: deleteAgentQuery,
        values: [args.id],
        rowMode: "array"
    });
}

export const updateAgentStatusQuery = `-- name: UpdateAgentStatus :exec
UPDATE agents SET status = $1, updated_at = now() WHERE id = $2`;

export interface UpdateAgentStatusArgs {
    status: string;
    id: string;
}

export async function updateAgentStatus(client: Client, args: UpdateAgentStatusArgs): Promise<void> {
    await client.query({
        text: updateAgentStatusQuery,
        values: [args.status, args.id],
        rowMode: "array"
    });
}

export const incrementFailureCountQuery = `-- name: IncrementFailureCount :one
UPDATE agents SET failure_count = failure_count + 1, updated_at = now()
WHERE id = $1
RETURNING id, name, status, activities, failure_threshold, failure_count, created_at, updated_at`;

export interface IncrementFailureCountArgs {
    id: string;
}

export interface IncrementFailureCountRow {
    id: string;
    name: string;
    status: string;
    activities: any;
    failureThreshold: number;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export async function incrementFailureCount(client: Client, args: IncrementFailureCountArgs): Promise<IncrementFailureCountRow | null> {
    const result = await client.query({
        text: incrementFailureCountQuery,
        values: [args.id],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        name: row[1],
        status: row[2],
        activities: row[3],
        failureThreshold: row[4],
        failureCount: row[5],
        createdAt: row[6],
        updatedAt: row[7]
    };
}

export const resetAgentQuery = `-- name: ResetAgent :exec
UPDATE agents SET status = 'active', failure_count = 0, updated_at = now()
WHERE id = $1`;

export interface ResetAgentArgs {
    id: string;
}

export async function resetAgent(client: Client, args: ResetAgentArgs): Promise<void> {
    await client.query({
        text: resetAgentQuery,
        values: [args.id],
        rowMode: "array"
    });
}

