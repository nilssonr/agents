import { randomUUID } from 'node:crypto';

import type { AgentRepository, AgentRow } from './agent-repository.js';

export function createFakeAgentRepository(): AgentRepository & { agents: AgentRow[] } {
    const agents: AgentRow[] = [];

    return {
        agents,
        async create(name, activities, failureThreshold): Promise<AgentRow> {
            const agent: AgentRow = {
                id: randomUUID(),
                name,
                status: 'active',
                activities,
                failure_threshold: failureThreshold,
                failure_count: 0,
                created_at: new Date(),
                updated_at: new Date(),
            };
            agents.push(agent);
            return agent;
        },
        async get(id): Promise<AgentRow | null> {
            return agents.find((a) => a.id === id) ?? null;
        },
        async list(): Promise<AgentRow[]> {
            return [...agents];
        },
        async delete(id): Promise<void> {
            const idx = agents.findIndex((a) => a.id === id);
            if (idx !== -1) agents.splice(idx, 1);
        },
        async updateStatus(id, status): Promise<void> {
            const agent = agents.find((a) => a.id === id);
            if (agent) {
                agent.status = status;
                agent.updated_at = new Date();
            }
        },
        async incrementFailureCount(id): Promise<AgentRow> {
            const agent = agents.find((a) => a.id === id);
            if (!agent) throw new Error('Agent not found');
            agent.failure_count += 1;
            agent.updated_at = new Date();
            return agent;
        },
        async reset(id): Promise<void> {
            const agent = agents.find((a) => a.id === id);
            if (agent) {
                agent.status = 'active';
                agent.failure_count = 0;
                agent.updated_at = new Date();
            }
        },
    };
}
