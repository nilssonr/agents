import type { Pool } from 'pg';

import * as db from '../../db/jobs_sql.js';
import type { FlowContext } from '../../features/flows/flow-types.js';
import type { JobRepository, JobRow } from '../../features/jobs/job-repository.js';

type DbJobRow =
    | db.CreateJobRow
    | db.ListJobsByAgentRow
    | db.ClaimJobRow
    | db.GetJobByIdRow
    | db.IncrementStepRetriesRow;

function toJobRow(row: DbJobRow): JobRow {
    return {
        id: row.id,
        agent_id: row.agentId,
        status: row.status,
        payload: row.payload,
        result: row.result,
        error: row.error,
        current_step_id: row.currentStepId,
        context: (row.context ?? {}) as FlowContext,
        step_retries: row.stepRetries,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
    };
}

/** Creates a {@link JobRepository} backed by PostgreSQL using sqlc-generated queries. */
export function createPgJobRepository(pool: Pool): JobRepository {
    return {
        async create(agentId, payload): Promise<JobRow> {
            const row = await db.createJob(pool, {
                agentId,
                payload: payload !== null && payload !== undefined ? JSON.stringify(payload) : null,
            });
            if (!row) throw new Error('Failed to create job');
            return toJobRow(row);
        },

        async listByAgent(agentId, status): Promise<JobRow[]> {
            const rows = await db.listJobsByAgent(pool, { agentId, status: status ?? null });
            return rows.map(toJobRow);
        },

        async claim(agentId): Promise<JobRow | null> {
            const row = await db.claimJob(pool, { agentId });
            return row ? toJobRow(row) : null;
        },

        async complete(id, result): Promise<void> {
            await db.completeJob(pool, {
                id,
                result: result !== null && result !== undefined ? JSON.stringify(result) : null,
            });
        },

        async fail(id, error): Promise<void> {
            await db.failJob(pool, { id, error });
        },

        async getById(id): Promise<JobRow | null> {
            const row = await db.getJobById(pool, { id });
            return row ? toJobRow(row) : null;
        },

        async updateStep(id, stepId, context: FlowContext): Promise<void> {
            await db.updateJobStep(pool, {
                id,
                currentStepId: stepId,
                context: JSON.stringify(context),
            });
        },

        async incrementStepRetries(id): Promise<JobRow | null> {
            const row = await db.incrementStepRetries(pool, { id });
            return row ? toJobRow(row) : null;
        },

        async findStaleRunningJobs(olderThan): Promise<JobRow[]> {
            const result = await pool.query(
                `SELECT id, agent_id, status, payload, result, error,
                        current_step_id, context, step_retries, created_at, updated_at
                 FROM jobs WHERE status = 'running' AND updated_at < $1`,
                [olderThan],
            );
            return result.rows.map((row: Record<string, unknown>) => ({
                id: row.id as string,
                agent_id: row.agent_id as string,
                status: row.status as string,
                payload: row.payload,
                result: row.result,
                error: (row.error as string | null) ?? null,
                current_step_id: (row.current_step_id as string | null) ?? null,
                context: (row.context ?? {}) as FlowContext,
                step_retries: row.step_retries as number,
                created_at: row.created_at as Date,
                updated_at: row.updated_at as Date,
            }));
        },
    };
}
