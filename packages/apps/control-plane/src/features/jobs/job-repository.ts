import type { FlowContext } from '../flows/flow-types.js';

/** Persistent representation of a job as stored in the database. */
export interface JobRow {
    id: string;
    agent_id: string;
    status: string;
    payload: unknown;
    result: unknown;
    error: string | null;
    current_step_id: string | null;
    context: FlowContext;
    step_retries: number;
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
    getById(id: string): Promise<JobRow | null>;
    updateStep(id: string, stepId: string, context: FlowContext): Promise<void>;
    incrementStepRetries(id: string): Promise<JobRow | null>;
    findStaleRunningJobs(olderThan: Date): Promise<JobRow[]>;
}
