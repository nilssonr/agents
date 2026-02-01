import { createLogger } from '@agents/logger';

import type { JobRepository } from './job-repository.js';

const logger = createLogger('job-reaper');

/** Controls the lifecycle of the job reaper that reclaims stale running jobs. */
export interface JobReaper {
    /** Executes a single reaper sweep. Exposed for testing. */
    tick(): Promise<void>;
    /** Starts the interval-based sweep loop. */
    start(): void;
    /** Stops the sweep loop. */
    stop(): void;
}

/**
 * Creates a reaper that periodically finds jobs stuck in `running` state
 * longer than `ttlMs` and transitions them to `failed`, notifying the
 * `onJobFailure` callback so agent failure tracking stays consistent.
 */
export function createJobReaper(
    jobRepo: JobRepository,
    onJobFailure: (jobId: string, agentId: string, error: string) => Promise<void>,
    opts: { ttlMs: number; intervalMs: number },
): JobReaper {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function tick(): Promise<void> {
        try {
            const cutoff = new Date(Date.now() - opts.ttlMs);
            const staleJobs = await jobRepo.findStaleRunningJobs(cutoff);

            for (const job of staleJobs) {
                const error = 'Job timed out: no result reported within TTL';
                logger.warn({ jobId: job.id, agentId: job.agent_id }, error);
                await jobRepo.fail(job.id, error);
                await onJobFailure(job.id, job.agent_id, error);
            }
        } catch (err: unknown) {
            logger.error({ err }, 'job reaper error');
        }
    }

    return {
        tick,
        start(): void {
            timer = setInterval(() => {
                void tick();
            }, opts.intervalMs);
            logger.info({ ttlMs: opts.ttlMs, intervalMs: opts.intervalMs }, 'job reaper started');
        },
        stop(): void {
            if (timer) {
                clearInterval(timer);
                timer = null;
                logger.info('job reaper stopped');
            }
        },
    };
}
