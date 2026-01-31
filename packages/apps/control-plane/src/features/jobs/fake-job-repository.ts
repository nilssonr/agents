import { randomUUID } from 'node:crypto';

import type { JobRepository, JobRow } from './job-repository.js';

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
