export interface AgentRow {
    id: string;
    name: string;
    status: string;
    activities: unknown;
    failure_threshold: number;
    failure_count: number;
    created_at: Date;
    updated_at: Date;
}

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

export interface TriggerRow {
    id: string;
    agent_id: string;
    kind: string;
    cron_expression: string | null;
    created_at: Date;
}

export interface AgentRepository {
    create(name: string, activities: unknown, failureThreshold: number): Promise<AgentRow>;
    get(id: string): Promise<AgentRow | null>;
    list(): Promise<AgentRow[]>;
    delete(id: string): Promise<void>;
    updateStatus(id: string, status: string): Promise<void>;
    incrementFailureCount(id: string): Promise<AgentRow>;
    reset(id: string): Promise<void>;
}

export interface JobRepository {
    create(agentId: string, payload: unknown): Promise<JobRow>;
    listByAgent(agentId: string, status?: string): Promise<JobRow[]>;
    claim(agentId: string): Promise<JobRow | null>;
    complete(id: string, result: unknown): Promise<void>;
    fail(id: string, error: string): Promise<void>;
}

export interface TriggerRepository {
    create(agentId: string, kind: string, cronExpression: string | null): Promise<TriggerRow>;
    getByAgent(agentId: string): Promise<TriggerRow[]>;
    getCronTriggers(): Promise<Array<TriggerRow & { agent_status: string }>>;
    delete(id: string): Promise<void>;
}
