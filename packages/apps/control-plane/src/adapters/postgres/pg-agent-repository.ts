import type { Pool } from 'pg';

import * as db from '../../db/agents_sql.js';
import type { AgentRepository, AgentRow } from '../../features/agents/agent-repository.js';

function toAgentRow(row: db.CreateAgentRow | db.GetAgentRow | db.ListAgentsRow | db.IncrementFailureCountRow): AgentRow {
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        activities: row.activities,
        failure_threshold: row.failureThreshold,
        failure_count: row.failureCount,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
    };
}

export function createPgAgentRepository(pool: Pool): AgentRepository {
    return {
        async create(name, activities, failureThreshold): Promise<AgentRow> {
            const row = await db.createAgent(pool, {
                name,
                activities: JSON.stringify(activities),
                failureThreshold,
            });
            if (!row) throw new Error('Failed to create agent');
            return toAgentRow(row);
        },

        async get(id): Promise<AgentRow | null> {
            const row = await db.getAgent(pool, { id });
            return row ? toAgentRow(row) : null;
        },

        async list(): Promise<AgentRow[]> {
            const rows = await db.listAgents(pool);
            return rows.map(toAgentRow);
        },

        async delete(id): Promise<void> {
            await db.deleteAgent(pool, { id });
        },

        async updateStatus(id, status): Promise<void> {
            await db.updateAgentStatus(pool, { id, status });
        },

        async incrementFailureCount(id): Promise<AgentRow> {
            const row = await db.incrementFailureCount(pool, { id });
            if (!row) throw new Error('Agent not found');
            return toAgentRow(row);
        },

        async reset(id): Promise<void> {
            await db.resetAgent(pool, { id });
        },
    };
}
