/** Persistent representation of an agent as stored in the database. */
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

/** Storage contract for agent CRUD and lifecycle operations. */
export interface AgentRepository {
    create(name: string, activities: unknown, failureThreshold: number): Promise<AgentRow>;
    get(id: string): Promise<AgentRow | null>;
    list(): Promise<AgentRow[]>;
    delete(id: string): Promise<void>;
    updateStatus(id: string, status: string): Promise<void>;
    incrementFailureCount(id: string): Promise<AgentRow>;
    reset(id: string): Promise<void>;
}
