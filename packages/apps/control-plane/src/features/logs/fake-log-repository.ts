/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto';

import type { LogEntry, LogEntryInput, LogRepository } from './log-repository.js';

/**
 * In-memory {@link LogRepository} for use in tests.
 * Exposes the underlying `logs` array for direct assertion.
 */
export function createFakeLogRepository(): LogRepository & { logs: LogEntry[] } {
    const logs: LogEntry[] = [];

    return {
        logs,
        async createBatch(jobId: string, entries: LogEntryInput[]): Promise<void> {
            for (const entry of entries) {
                logs.push({
                    id: randomUUID(),
                    job_id: jobId,
                    step_id: entry.step_id ?? null,
                    level: entry.level,
                    message: entry.message,
                    metadata: entry.metadata ?? null,
                    created_at: new Date(),
                });
            }
        },
        async listByJob(jobId: string): Promise<LogEntry[]> {
            return logs.filter((l) => l.job_id === jobId);
        },
    };
}
