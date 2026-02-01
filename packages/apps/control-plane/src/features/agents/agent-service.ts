import type { JobRepository, JobRow } from '../jobs/job-repository.js';

import type { AgentRepository, AgentRow, UpdateAgentFields } from './agent-repository.js';

/** High-level operations on agents: creation, invocation, failure handling, and restart. */
export interface AgentService {
    createAgent(name: string, activities: unknown, failureThreshold: number): Promise<AgentRow>;
    getAgent(id: string): Promise<AgentRow | null>;
    listAgents(): Promise<AgentRow[]>;
    deleteAgent(id: string): Promise<void>;
    updateAgent(id: string, fields: UpdateAgentFields): Promise<AgentRow>;
    invokeAgent(id: string, payload: unknown): Promise<JobRow>;
    restartAgent(id: string): Promise<void>;
    handleJobFailure(agentId: string): Promise<void>;
}

/**
 * Creates an {@link AgentService} backed by the given repositories.
 *
 * Invoking an agent creates a pending job. Repeated job failures increment the
 * agent's failure counter and automatically pause the agent once its threshold
 * is reached.
 */
export function createAgentService(agents: AgentRepository, jobs: JobRepository): AgentService {
    return {
        async createAgent(name, activities, failureThreshold): Promise<AgentRow> {
            return agents.create(name, activities, failureThreshold);
        },

        async getAgent(id): Promise<AgentRow | null> {
            return agents.get(id);
        },

        async listAgents(): Promise<AgentRow[]> {
            return agents.list();
        },

        async deleteAgent(id): Promise<void> {
            return agents.delete(id);
        },

        async updateAgent(id, fields): Promise<AgentRow> {
            const agent = await agents.get(id);
            if (!agent) {
                throw new AgentNotFoundError(id);
            }
            return agents.update(id, fields);
        },

        async invokeAgent(id, payload): Promise<JobRow> {
            const agent = await agents.get(id);
            if (!agent) {
                throw new AgentNotFoundError(id);
            }
            if (agent.status === 'paused') {
                throw new AgentPausedError(id);
            }
            return jobs.create(id, payload);
        },

        async restartAgent(id): Promise<void> {
            const agent = await agents.get(id);
            if (!agent) {
                throw new AgentNotFoundError(id);
            }
            return agents.reset(id);
        },

        async handleJobFailure(agentId): Promise<void> {
            const agent = await agents.incrementFailureCount(agentId);
            if (agent.failure_count >= agent.failure_threshold) {
                await agents.updateStatus(agentId, 'paused');
            }
        },
    };
}

/** Thrown when an operation targets an agent id that does not exist. */
export class AgentNotFoundError extends Error {
    constructor(id: string) {
        super(`Agent not found: ${id}`);
        this.name = 'AgentNotFoundError';
    }
}

/** Thrown when attempting to invoke an agent that has been paused due to failures. */
export class AgentPausedError extends Error {
    constructor(id: string) {
        super(`Agent is paused: ${id}`);
        this.name = 'AgentPausedError';
    }
}
