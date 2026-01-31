import type { AgentRepository, AgentRow, JobRepository, JobRow } from '../repositories/types.js';

export interface AgentService {
    createAgent(name: string, activities: unknown, failureThreshold: number): Promise<AgentRow>;
    getAgent(id: string): Promise<AgentRow | null>;
    listAgents(): Promise<AgentRow[]>;
    deleteAgent(id: string): Promise<void>;
    invokeAgent(id: string, payload: unknown): Promise<JobRow>;
    restartAgent(id: string): Promise<void>;
    handleJobFailure(agentId: string): Promise<void>;
}

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

export class AgentNotFoundError extends Error {
    constructor(id: string) {
        super(`Agent not found: ${id}`);
        this.name = 'AgentNotFoundError';
    }
}

export class AgentPausedError extends Error {
    constructor(id: string) {
        super(`Agent is paused: ${id}`);
        this.name = 'AgentPausedError';
    }
}
