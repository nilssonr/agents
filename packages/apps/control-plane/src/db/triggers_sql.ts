import { QueryArrayConfig, QueryArrayResult } from "pg";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const createTriggerQuery = `-- name: CreateTrigger :one
INSERT INTO triggers (agent_id, kind, cron_expression)
VALUES ($1, $2, $3)
RETURNING id, agent_id, kind, cron_expression, created_at`;

export interface CreateTriggerArgs {
    agentId: string;
    kind: string;
    cronExpression: string | null;
}

export interface CreateTriggerRow {
    id: string;
    agentId: string;
    kind: string;
    cronExpression: string | null;
    createdAt: Date;
}

export async function createTrigger(client: Client, args: CreateTriggerArgs): Promise<CreateTriggerRow | null> {
    const result = await client.query({
        text: createTriggerQuery,
        values: [args.agentId, args.kind, args.cronExpression],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row[0],
        agentId: row[1],
        kind: row[2],
        cronExpression: row[3],
        createdAt: row[4]
    };
}

export const getTriggersByAgentQuery = `-- name: GetTriggersByAgent :many
SELECT id, agent_id, kind, cron_expression, created_at FROM triggers WHERE agent_id = $1 ORDER BY created_at DESC`;

export interface GetTriggersByAgentArgs {
    agentId: string;
}

export interface GetTriggersByAgentRow {
    id: string;
    agentId: string;
    kind: string;
    cronExpression: string | null;
    createdAt: Date;
}

export async function getTriggersByAgent(client: Client, args: GetTriggersByAgentArgs): Promise<GetTriggersByAgentRow[]> {
    const result = await client.query({
        text: getTriggersByAgentQuery,
        values: [args.agentId],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            agentId: row[1],
            kind: row[2],
            cronExpression: row[3],
            createdAt: row[4]
        };
    });
}

export const getCronTriggersQuery = `-- name: GetCronTriggers :many
SELECT t.id, t.agent_id, t.kind, t.cron_expression, t.created_at, a.status as agent_status
FROM triggers t
JOIN agents a ON a.id = t.agent_id
WHERE t.kind = 'cron'
AND a.status = 'active'`;

export interface GetCronTriggersRow {
    id: string;
    agentId: string;
    kind: string;
    cronExpression: string | null;
    createdAt: Date;
    agentStatus: string;
}

export async function getCronTriggers(client: Client): Promise<GetCronTriggersRow[]> {
    const result = await client.query({
        text: getCronTriggersQuery,
        values: [],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            id: row[0],
            agentId: row[1],
            kind: row[2],
            cronExpression: row[3],
            createdAt: row[4],
            agentStatus: row[5]
        };
    });
}

export const deleteTriggerQuery = `-- name: DeleteTrigger :exec
DELETE FROM triggers WHERE id = $1`;

export interface DeleteTriggerArgs {
    id: string;
}

export async function deleteTrigger(client: Client, args: DeleteTriggerArgs): Promise<void> {
    await client.query({
        text: deleteTriggerQuery,
        values: [args.id],
        rowMode: "array"
    });
}

