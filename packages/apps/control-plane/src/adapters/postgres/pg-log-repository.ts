import type { Pool } from 'pg';

import * as db from '../../db/job_logs_sql.js';
import type { LogEntry, LogEntryInput, LogRepository } from '../../features/logs/log-repository.js';

function toLogEntry(row: db.CreateJobLogRow | db.ListLogsByJobRow): LogEntry {
    return {
        id: row.id,
        job_id: row.jobId,
        step_id: row.stepId,
        level: row.level,
        message: row.message,
        metadata: row.metadata,
        created_at: row.createdAt,
    };
}

/** Creates a {@link LogRepository} backed by PostgreSQL using sqlc-generated queries. */
export function createPgLogRepository(pool: Pool): LogRepository {
    return {
        async createBatch(jobId: string, entries: LogEntryInput[]): Promise<void> {
            for (const entry of entries) {
                await db.createJobLog(pool, {
                    jobId,
                    stepId: entry.step_id ?? null,
                    level: entry.level,
                    message: entry.message,
                    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
                });
            }
        },
        async listByJob(jobId: string): Promise<LogEntry[]> {
            const rows = await db.listLogsByJob(pool, { jobId });
            return rows.map(toLogEntry);
        },
    };
}
