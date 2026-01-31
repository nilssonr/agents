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

export interface JobRepository {
    create(agentId: string, payload: unknown): Promise<JobRow>;
    listByAgent(agentId: string, status?: string): Promise<JobRow[]>;
    claim(agentId: string): Promise<JobRow | null>;
    complete(id: string, result: unknown): Promise<void>;
    fail(id: string, error: string): Promise<void>;
}
