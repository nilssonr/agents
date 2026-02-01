import { randomUUID } from 'node:crypto';

import type { FlowContext } from '../flows/flow-types.js';
import type { JobRepository, JobRow } from './job-repository.js';

/**
 * In-memory {@link JobRepository} for use in tests.
 * Exposes the underlying `jobs` array for direct assertion.
 */
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
                current_step_id: null,
                context: {},
                step_retries: 0,
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
                job.current_step_id = null;
                job.step_retries = 0;
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
        async getById(id): Promise<JobRow | null> {
            return jobs.find((j) => j.id === id) ?? null;
        },
        async updateStep(id, stepId, context: FlowContext): Promise<void> {
            const job = jobs.find((j) => j.id === id);
            if (job) {
                job.current_step_id = stepId;
                job.context = context;
                job.step_retries = 0;
                job.status = 'pending';
                job.updated_at = new Date();
            }
        },
        async incrementStepRetries(id): Promise<JobRow | null> {
            const job = jobs.find((j) => j.id === id);
            if (!job) return null;
            job.step_retries += 1;
            job.status = 'pending';
            job.updated_at = new Date();
            return job;
        },
        async findStaleRunningJobs(olderThan): Promise<JobRow[]> {
            return jobs.filter((j) => j.status === 'running' && j.updated_at < olderThan);
        },
    };
}
