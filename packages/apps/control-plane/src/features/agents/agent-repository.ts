/** Persistent representation of an agent as stored in the database. */
export interface AgentRow {
    id: string;
    name: string;
    status: string;
    activities: unknown;
    failure_threshold: number;
    failure_count: number;
    editor_layout: unknown;
    created_at: Date;
    updated_at: Date;
}

/** Fields that can be updated on an agent. */
export interface UpdateAgentFields {
    name: string;
    activities: unknown;
    failure_threshold: number;
    editor_layout: unknown;
}

/** Storage contract for agent CRUD and lifecycle operations. */
export interface AgentRepository {
    create(name: string, activities: unknown, failureThreshold: number): Promise<AgentRow>;
    get(id: string): Promise<AgentRow | null>;
    list(): Promise<AgentRow[]>;
    delete(id: string): Promise<void>;
    update(id: string, fields: UpdateAgentFields): Promise<AgentRow>;
    updateStatus(id: string, status: string): Promise<void>;
    incrementFailureCount(id: string): Promise<AgentRow>;
    reset(id: string): Promise<void>;
}
