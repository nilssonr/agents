import { describe, expect, it, beforeEach, vi } from 'vitest';

import { createFakeAgentRepository } from '../agents/fake-agent-repository.js';
import { createFlowService } from '../flows/flow-service.js';

import { createFakeJobRepository } from './fake-job-repository.js';
import { createJobService } from './job-service.js';
import type { JobService } from './job-service.js';

describe('JobService', () => {
    let agentRepo: ReturnType<typeof createFakeAgentRepository>;
    let jobRepo: ReturnType<typeof createFakeJobRepository>;
    let service: JobService;
    let onFailure: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        agentRepo = createFakeAgentRepository();
        jobRepo = createFakeJobRepository();
        onFailure = vi.fn().mockResolvedValue(undefined);
        service = createJobService(jobRepo, agentRepo, onFailure, createFlowService());
    });

    it('lists jobs for agent filtered by status', async () => {
        const agent = await agentRepo.create('a', [], 3);
        await jobRepo.create(agent.id, null);
        const pending = await jobRepo.create(agent.id, null);
        await jobRepo.complete(pending.id, { ok: true });

        const all = await service.getJobsForAgent(agent.id);
        expect(all).toHaveLength(2);

        const pendingOnly = await service.getJobsForAgent(agent.id, 'pending');
        expect(pendingOnly).toHaveLength(1);
    });

    it('claims the next pending job', async () => {
        const agent = await agentRepo.create('a', [], 3);
        await jobRepo.create(agent.id, { n: 1 });
        const claimed = await service.claimNextJob(agent.id);
        expect(claimed).not.toBeNull();
        expect(claimed?.status).toBe('running');
    });

    it('returns null when no pending jobs', async () => {
        const agent = await agentRepo.create('a', [], 3);
        const claimed = await service.claimNextJob(agent.id);
        expect(claimed).toBeNull();
    });

    it('completes a job and resets agent failure count', async () => {
        const agent = await agentRepo.create('a', [], 3);
        await agentRepo.incrementFailureCount(agent.id);
        const job = await jobRepo.create(agent.id, null);
        await jobRepo.claim(agent.id);

        await service.completeJob(job.id, agent.id, { done: true });

        const updatedJob = jobRepo.jobs.find((j) => j.id === job.id);
        expect(updatedJob?.status).toBe('completed');

        const updatedAgent = await agentRepo.get(agent.id);
        expect(updatedAgent?.failure_count).toBe(0);
    });

    it('fails a job and calls onJobFailure', async () => {
        const agent = await agentRepo.create('a', [], 3);
        const job = await jobRepo.create(agent.id, null);
        await jobRepo.claim(agent.id);

        await service.failJob(job.id, agent.id, 'something broke');

        const updatedJob = jobRepo.jobs.find((j) => j.id === job.id);
        expect(updatedJob?.status).toBe('failed');
        expect(updatedJob?.error).toBe('something broke');
        expect(onFailure).toHaveBeenCalledWith(agent.id);
    });

    describe('processStepResult', () => {
        it('completes flow when step has no next', async () => {
            const agent = await agentRepo.create('a', [{ id: 'a', type: 'noop' }], 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            await service.processStepResult(job.id, agent.id, 'a', true, { value: 42 }, undefined, agent.activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated?.status).toBe('completed');
        });

        it('advances to next step on success with next', async () => {
            const activities = [
                { id: 'a', type: 'fetch' },
                { id: 'b', type: 'transform' },
            ];
            const agent = await agentRepo.create('a', activities, 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            await service.processStepResult(job.id, agent.id, 'a', true, { next: 'b', data: 1 }, undefined, activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated?.status).toBe('pending');
            expect(updated?.current_step_id).toBe('b');
            expect(updated?.context).toEqual({ a: { next: 'b', data: 1 } });
        });

        it('retries step on failure when under maxRetries', async () => {
            const activities = [{ id: 'a', type: 'noop', maxRetries: 3 }];
            const agent = await agentRepo.create('a', activities, 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            await service.processStepResult(job.id, agent.id, 'a', false, undefined, 'fail', activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated).toBeDefined();
            expect(updated?.status).toBe('pending');
            expect(updated?.step_retries).toBe(1);
        });

        it('routes to onError step on failure', async () => {
            const activities = [
                { id: 'a', type: 'noop', onError: { default: 'b' } },
                { id: 'b', type: 'fallback' },
            ];
            const agent = await agentRepo.create('a', activities, 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            await service.processStepResult(job.id, agent.id, 'a', false, undefined, 'fail', activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated?.status).toBe('pending');
            expect(updated?.current_step_id).toBe('b');
        });

        it('fails job when context exceeds max size', async () => {
            const smallLimit = 50; // 50 bytes
            const limitedService = createJobService(
                jobRepo,
                agentRepo,
                onFailure,
                createFlowService(),
                undefined,
                smallLimit,
            );
            const activities = [
                { id: 'a', type: 'fetch' },
                { id: 'b', type: 'transform' },
            ];
            const agent = await agentRepo.create('a', activities, 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            // Provide a large result that will push context over the limit
            const bigResult = { data: 'x'.repeat(100) };
            await limitedService.processStepResult(job.id, agent.id, 'a', true, bigResult, undefined, activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated).toBeDefined();
            expect(updated?.status).toBe('failed');
            expect(updated?.error).toContain('Flow context exceeded maximum size');
            expect(onFailure).toHaveBeenCalledWith(agent.id);
        });

        it('proceeds when context is within size limit', async () => {
            const activities = [
                { id: 'a', type: 'fetch' },
                { id: 'b', type: 'transform' },
            ];
            const agent = await agentRepo.create('a', activities, 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            await service.processStepResult(job.id, agent.id, 'a', true, { next: 'b', data: 1 }, undefined, activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated?.status).toBe('pending');
            expect(updated?.current_step_id).toBe('b');
        });

        it('fails job when no recovery option', async () => {
            const activities = [{ id: 'a', type: 'noop' }];
            const agent = await agentRepo.create('a', activities, 3);
            const job = await jobRepo.create(agent.id, null);
            await jobRepo.claim(agent.id);

            await service.processStepResult(job.id, agent.id, 'a', false, undefined, 'boom', activities);

            const updated = jobRepo.jobs.find((j) => j.id === job.id);
            expect(updated?.status).toBe('failed');
            expect(updated?.error).toBe('boom');
            expect(onFailure).toHaveBeenCalledWith(agent.id);
        });
    });
});
