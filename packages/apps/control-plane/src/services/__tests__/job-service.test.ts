import { describe, expect, it, beforeEach, vi } from 'vitest';

import { createFakeAgentRepository, createFakeJobRepository } from '../../__tests__/fake-repositories.js';
import { createJobService } from '../job-service.js';
import type { JobService } from '../job-service.js';

describe('JobService', () => {
    let agentRepo: ReturnType<typeof createFakeAgentRepository>;
    let jobRepo: ReturnType<typeof createFakeJobRepository>;
    let service: JobService;
    let onFailure: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        agentRepo = createFakeAgentRepository();
        jobRepo = createFakeJobRepository();
        onFailure = vi.fn().mockResolvedValue(undefined);
        service = createJobService(jobRepo, agentRepo, onFailure);
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
});
