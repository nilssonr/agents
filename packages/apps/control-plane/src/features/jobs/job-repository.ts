/** Persistent representation of a job as stored in the database. */
export interface JobRow {
    id: string;
    agent_id: string;
    status: string;
    payload: unknown;
    result: unknown;
    error: string | null;
    created_at: Date;
    updated_at: Date;
}

/** Storage contract for job creation, claiming, completion, and failure. */
export interface JobRepository {
    create(agentId: string, payload: unknown): Promise<JobRow>;
    listByAgent(agentId: string, status?: string): Promise<JobRow[]>;
    claim(agentId: string): Promise<JobRow | null>;
    complete(id: string, result: unknown): Promise<void>;
    fail(id: string, error: string): Promise<void>;
}
