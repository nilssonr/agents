import type { Pool } from 'pg';

import * as db from '../../db/triggers_sql.js';
import type { TriggerRepository, TriggerRow } from '../../features/triggers/trigger-repository.js';

function toTriggerRow(row: db.CreateTriggerRow | db.GetTriggersByAgentRow): TriggerRow {
    return {
        id: row.id,
        agent_id: row.agentId,
        kind: row.kind,
        cron_expression: row.cronExpression,
        last_fired_at: (row as unknown as { lastFiredAt?: Date | null }).lastFiredAt ?? null,
        created_at: row.createdAt,
    };
}

/** Creates a {@link TriggerRepository} backed by PostgreSQL using sqlc-generated queries. */
export function createPgTriggerRepository(pool: Pool): TriggerRepository {
    return {
        async create(agentId, kind, cronExpression): Promise<TriggerRow> {
            const row = await db.createTrigger(pool, { agentId, kind, cronExpression });
            if (!row) throw new Error('Failed to create trigger');
            return toTriggerRow(row);
        },

        async getByAgent(agentId): Promise<TriggerRow[]> {
            const rows = await db.getTriggersByAgent(pool, { agentId });
            return rows.map(toTriggerRow);
        },

        async getCronTriggers(): Promise<Array<TriggerRow & { agent_status: string }>> {
            const rows = await db.getCronTriggers(pool);
            return rows.map((row) => ({
                ...toTriggerRow(row),
                agent_status: row.agentStatus,
            }));
        },

        async delete(id): Promise<void> {
            await db.deleteTrigger(pool, { id });
        },

        async updateLastFiredAt(id, firedAt): Promise<void> {
            await pool.query(
                'UPDATE triggers SET last_fired_at = $1 WHERE id = $2',
                [firedAt, id],
            );
        },
    };
}
