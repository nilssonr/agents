import type { AgentRepository } from '../agents/agent-repository.js';
import type { JobRepository, JobRow } from './job-repository.js';

/** High-level operations on jobs: listing, claiming, completion, and failure reporting. */
export interface JobService {
    getJobsForAgent(agentId: string, status?: string): Promise<JobRow[]>;
    claimNextJob(agentId: string): Promise<JobRow | null>;
    completeJob(jobId: string, agentId: string, result: unknown): Promise<void>;
    failJob(jobId: string, agentId: string, error: string): Promise<void>;
}

/**
 * Creates a {@link JobService} backed by the given repositories.
 *
 * Completing a job resets the owning agent's failure counter. Failing a job
 * delegates to `onJobFailure` so the agent service can track failures and
 * potentially pause the agent.
 */
export function createJobService(
    jobs: JobRepository,
    agents: AgentRepository,
    onJobFailure: (agentId: string) => Promise<void>,
): JobService {
    return {
        async getJobsForAgent(agentId, status): Promise<JobRow[]> {
            return jobs.listByAgent(agentId, status);
        },

        async claimNextJob(agentId): Promise<JobRow | null> {
            return jobs.claim(agentId);
        },

        async completeJob(jobId, agentId, result): Promise<void> {
            await jobs.complete(jobId, result);
            await agents.reset(agentId);
        },

        async failJob(jobId, agentId, error): Promise<void> {
            await jobs.fail(jobId, error);
            await onJobFailure(agentId);
        },
    };
}
