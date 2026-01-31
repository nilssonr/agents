export interface TriggerRow {
    id: string;
    agent_id: string;
    kind: string;
    cron_expression: string | null;
    created_at: Date;
}

export interface TriggerRepository {
    create(agentId: string, kind: string, cronExpression: string | null): Promise<TriggerRow>;
    getByAgent(agentId: string): Promise<TriggerRow[]>;
    getCronTriggers(): Promise<Array<TriggerRow & { agent_status: string }>>;
    delete(id: string): Promise<void>;
}
