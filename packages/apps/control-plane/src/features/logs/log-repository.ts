/** A single persisted log entry for a job. */
export interface LogEntry {
    id: string;
    job_id: string;
    step_id: string | null;
    level: string;
    message: string;
    metadata: unknown;
    created_at: Date;
}

/** Input for creating a log entry (fields assigned by the system are omitted). */
export interface LogEntryInput {
    step_id?: string | null;
    level: string;
    message: string;
    metadata?: unknown;
}

/** Storage contract for job log entries. */
export interface LogRepository {
    createBatch(jobId: string, entries: LogEntryInput[]): Promise<void>;
    listByJob(jobId: string): Promise<LogEntry[]>;
}
