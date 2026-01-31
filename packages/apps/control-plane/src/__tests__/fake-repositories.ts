import { randomUUID } from 'node:crypto';

import type { AgentRepository, AgentRow, JobRepository, JobRow, TriggerRepository, TriggerRow } from '../repositories/types.js';

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

export function createFakeJobRepository(): JobRepository & { jobs: JobRow[] } {
    const jobs: JobRow[] = [];

    return {
        jobs,
        async create(agentId, payload): Promise<JobRow> {
            const job: JobRow = {
                id: randomUUID(),
                agent_id: agentId,
                status: 'pending',
                payload,
                result: null,
                error: null,
                created_at: new Date(),
                updated_at: new Date(),
            };
            jobs.push(job);
            return job;
        },
        async listByAgent(agentId, status): Promise<JobRow[]> {
            return jobs.filter((j) => j.agent_id === agentId && (!status || j.status === status));
        },
        async claim(agentId): Promise<JobRow | null> {
            const job = jobs.find((j) => j.agent_id === agentId && j.status === 'pending');
            if (!job) return null;
            job.status = 'running';
            job.updated_at = new Date();
            return job;
        },
        async complete(id, result): Promise<void> {
            const job = jobs.find((j) => j.id === id);
            if (job) {
                job.status = 'completed';
                job.result = result;
                job.updated_at = new Date();
            }
        },
        async fail(id, error): Promise<void> {
            const job = jobs.find((j) => j.id === id);
            if (job) {
                job.status = 'failed';
                job.error = error;
                job.updated_at = new Date();
            }
        },
    };
}

export function createFakeTriggerRepository(): TriggerRepository & { triggers: TriggerRow[] } {
    const triggers: TriggerRow[] = [];

    return {
        triggers,
        async create(agentId, kind, cronExpression): Promise<TriggerRow> {
            const trigger: TriggerRow = {
                id: randomUUID(),
                agent_id: agentId,
                kind,
                cron_expression: cronExpression,
                created_at: new Date(),
            };
            triggers.push(trigger);
            return trigger;
        },
        async getByAgent(agentId): Promise<TriggerRow[]> {
            return triggers.filter((t) => t.agent_id === agentId);
        },
        async getCronTriggers(): Promise<Array<TriggerRow & { agent_status: string }>> {
            return triggers
                .filter((t) => t.kind === 'cron')
                .map((t) => ({ ...t, agent_status: 'active' }));
        },
        async delete(id): Promise<void> {
            const idx = triggers.findIndex((t) => t.id === id);
            if (idx !== -1) triggers.splice(idx, 1);
        },
    };
}
