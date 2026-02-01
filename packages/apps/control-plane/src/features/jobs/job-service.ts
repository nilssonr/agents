import type { AgentRepository } from '../agents/agent-repository.js';
import type { FlowService } from '../flows/flow-service.js';
import type { Metrics } from '../metrics/metrics.js';

import type { JobRepository, JobRow } from './job-repository.js';

/** High-level operations on jobs: listing, claiming, completion, and failure reporting. */
export interface JobService {
    getJob(id: string): Promise<JobRow | null>;
    getJobsForAgent(agentId: string, status?: string): Promise<JobRow[]>;
    claimNextJob(agentId: string): Promise<JobRow | null>;
    completeJob(jobId: string, agentId: string, result: unknown): Promise<void>;
    failJob(jobId: string, agentId: string, error: string): Promise<void>;
    processStepResult(
        jobId: string,
        agentId: string,
        stepId: string,
        success: boolean,
        result: unknown,
        error: string | undefined,
        activities: unknown,
    ): Promise<void>;
}

/**
 * Creates a {@link JobService} backed by the given repositories.
 *
 * Completing a job resets the owning agent's failure counter. Failing a job
 * delegates to `onJobFailure` so the agent service can track failures and
 * potentially pause the agent.
 */
/** Default maximum flow context size in bytes (1 MB). */
const DEFAULT_MAX_CONTEXT_SIZE_BYTES = 1_048_576;

export function createJobService(
    jobs: JobRepository,
    agents: AgentRepository,
    onJobFailure: (agentId: string) => Promise<void>,
    flows: FlowService,
    metrics?: Metrics,
    maxContextSizeBytes: number = DEFAULT_MAX_CONTEXT_SIZE_BYTES,
): JobService {
    return {
        async getJob(id): Promise<JobRow | null> {
            return jobs.getById(id);
        },

        async getJobsForAgent(agentId, status): Promise<JobRow[]> {
            return jobs.listByAgent(agentId, status);
        },

        async claimNextJob(agentId): Promise<JobRow | null> {
            const job = await jobs.claim(agentId);
            if (job) {
                metrics?.jobsActive.inc();
            }
            return job;
        },

        async completeJob(jobId, agentId, result): Promise<void> {
            await jobs.complete(jobId, result);
            await agents.reset(agentId);
            metrics?.jobsActive.dec();
            metrics?.jobsTotal.inc({ status: 'completed', agent_id: agentId });
        },

        async failJob(jobId, agentId, error): Promise<void> {
            await jobs.fail(jobId, error);
            await onJobFailure(agentId);
            metrics?.jobsActive.dec();
            metrics?.jobsTotal.inc({ status: 'failed', agent_id: agentId });
        },

        async processStepResult(jobId, agentId, stepId, success, result, error, activities): Promise<void> {
            const job = await jobs.getById(jobId);
            if (!job) return;

            if (success) {
                const transition = flows.handleStepSuccess(activities, stepId, result, job.context);
                const contextSize = Buffer.byteLength(JSON.stringify(transition.updatedContext), 'utf8');
                if (contextSize > maxContextSizeBytes) {
                    await jobs.fail(
                        jobId,
                        `Flow context exceeded maximum size (${String(contextSize)} > ${String(maxContextSizeBytes)} bytes)`,
                    );
                    await onJobFailure(agentId);
                    return;
                }
                if (transition.nextStepId) {
                    await jobs.updateStep(jobId, transition.nextStepId, transition.updatedContext);
                } else {
                    await jobs.complete(jobId, transition.updatedContext);
                    await agents.reset(agentId);
                }
            } else {
                const transition = flows.handleStepFailure(
                    activities,
                    stepId,
                    { message: error ?? 'unknown error' },
                    job.step_retries,
                    job.context,
                );
                if (transition.retry) {
                    await jobs.incrementStepRetries(jobId);
                } else if (transition.nextStepId) {
                    await jobs.updateStep(jobId, transition.nextStepId, job.context);
                } else {
                    await jobs.fail(jobId, error ?? 'unknown error');
                    await onJobFailure(agentId);
                }
            }
        },
    };
}
