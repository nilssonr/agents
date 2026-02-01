import type { LogEntry, LogEntryInput, LogRepository } from './log-repository.js';

/** High-level operations for appending and retrieving job logs. */
export interface LogService {
    appendLogs(jobId: string, entries: LogEntryInput[]): Promise<void>;
    getLogsForJob(jobId: string): Promise<LogEntry[]>;
}

/**
 * Creates a {@link LogService} backed by the given repository.
 */
export function createLogService(repo: LogRepository): LogService {
    return {
        async appendLogs(jobId: string, entries: LogEntryInput[]): Promise<void> {
            if (entries.length === 0) return;
            await repo.createBatch(jobId, entries);
        },
        async getLogsForJob(jobId: string): Promise<LogEntry[]> {
            return repo.listByJob(jobId);
        },
    };
}
