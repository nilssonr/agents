import { describe, expect, it, beforeEach, vi } from 'vitest';

import { createFakeJobRepository } from './fake-job-repository.js';
import { createJobReaper } from './job-reaper.js';

describe('JobReaper', () => {
    let jobRepo: ReturnType<typeof createFakeJobRepository>;
    let failedJobs: Array<{ jobId: string; agentId: string; error: string }>;

    beforeEach(() => {
        jobRepo = createFakeJobRepository();
        failedJobs = [];
    });

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    function buildReaper(ttlMs = 300_000) {
        return createJobReaper(
            jobRepo,
            (jobId, agentId, error) => {
                failedJobs.push({ jobId, agentId, error });
                return Promise.resolve();
            },
            { ttlMs, intervalMs: 60_000 },
        );
    }

    it('reaps jobs stuck in running longer than TTL', async () => {
        const job = await jobRepo.create('agent-1', { data: 'test' });
        await jobRepo.claim('agent-1');

        // Simulate the job being claimed 10 minutes ago
        job.updated_at = new Date(Date.now() - 600_000);

        const reaper = buildReaper();
        await reaper.tick();

        expect(job.status).toBe('failed');
        expect(job.error).toContain('timed out');
        expect(failedJobs).toHaveLength(1);
        expect(failedJobs[0]).toMatchObject({ agentId: 'agent-1' });
    });

    it('does not reap jobs within TTL', async () => {
        await jobRepo.create('agent-1', {});
        await jobRepo.claim('agent-1');
        // updated_at is now (within TTL)

        const reaper = buildReaper();
        await reaper.tick();

        const job = jobRepo.jobs[0] as { status: string };
        expect(job.status).toBe('running');
        expect(failedJobs).toHaveLength(0);
    });

    it('does not reap pending or completed jobs', async () => {
        const pending = await jobRepo.create('agent-1', {});
        const completed = await jobRepo.create('agent-2', {});
        await jobRepo.claim('agent-2');
        await jobRepo.complete(completed.id, { done: true });

        // Backdate both
        pending.updated_at = new Date(Date.now() - 600_000);
        completed.updated_at = new Date(Date.now() - 600_000);

        const reaper = buildReaper();
        await reaper.tick();

        expect(pending.status).toBe('pending');
        expect(failedJobs).toHaveLength(0);
    });

    it('starts and stops interval-based ticking', async () => {
        vi.useFakeTimers();
        try {
            // Create a stale running job
            const job = await jobRepo.create('agent-1', {});
            await jobRepo.claim('agent-1');
            job.updated_at = new Date(Date.now() - 600_000);

            const reaper = buildReaper();
            reaper.start();

            vi.advanceTimersByTime(60_000);
            await vi.advanceTimersByTimeAsync(0);

            expect(job.status).toBe('failed');

            reaper.stop();
        } finally {
            vi.useRealTimers();
        }
    });
});
