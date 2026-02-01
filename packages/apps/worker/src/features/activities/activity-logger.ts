/** A log entry collected during an activity execution. */
export interface ActivityLogEntry {
    level: string;
    message: string;
    metadata?: unknown;
}

/** Structured logger passed to activities to capture logs for persistence. */
export interface ActivityLogger {
    info(message: string, metadata?: unknown): void;
    warn(message: string, metadata?: unknown): void;
    error(message: string, metadata?: unknown): void;
    /** Returns all log entries collected so far. */
    entries(): ActivityLogEntry[];
}

/**
 * Creates an {@link ActivityLogger} that collects log entries in memory.
 * Entries can be retrieved via `entries()` after the activity completes.
 */
export function createActivityLogger(): ActivityLogger {
    const logs: ActivityLogEntry[] = [];

    return {
        info(message: string, metadata?: unknown): void {
            logs.push({ level: 'info', message, metadata });
        },
        warn(message: string, metadata?: unknown): void {
            logs.push({ level: 'warn', message, metadata });
        },
        error(message: string, metadata?: unknown): void {
            logs.push({ level: 'error', message, metadata });
        },
        entries(): ActivityLogEntry[] {
            return logs;
        },
    };
}
