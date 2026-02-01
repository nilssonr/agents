import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { createAgentService } from '../agents/agent-service.js';
import { createFakeAgentRepository } from '../agents/fake-agent-repository.js';
import { createFakeJobRepository } from '../jobs/fake-job-repository.js';
import { createFakeTriggerRepository } from '../triggers/fake-trigger-repository.js';

import { createCronScheduler } from './cron-scheduler.js';
import type { CronScheduler } from './cron-scheduler.js';

describe('CronScheduler', () => {
    let scheduler: CronScheduler;
    let agentRepo: ReturnType<typeof createFakeAgentRepository>;
    let jobRepo: ReturnType<typeof createFakeJobRepository>;
    let triggerRepo: ReturnType<typeof createFakeTriggerRepository>;

    beforeEach(() => {
        vi.useFakeTimers();
        agentRepo = createFakeAgentRepository();
        jobRepo = createFakeJobRepository();
        triggerRepo = createFakeTriggerRepository();
        const agentService = createAgentService(agentRepo, jobRepo);
        scheduler = createCronScheduler(triggerRepo, agentService, 60_000);
    });

    afterEach(() => {
        scheduler.stop();
        vi.useRealTimers();
    });

    it('creates a job when cron trigger matches', async () => {
        const agent = await agentRepo.create('cron-agent', [], 3);
        await triggerRepo.create(agent.id, 'cron', '* * * * *');

        scheduler.start();

        vi.advanceTimersByTime(60_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(jobRepo.jobs.length).toBeGreaterThanOrEqual(1);
        const firstJob = jobRepo.jobs.at(0);
        expect(firstJob).toBeDefined();
        if (firstJob) {
            expect(firstJob.agent_id).toBe(agent.id);
        }
    });

    it('persists last_fired_at to the trigger repository', async () => {
        const agent = await agentRepo.create('persist-agent', [], 3);
        const trigger = await triggerRepo.create(agent.id, 'cron', '* * * * *');

        scheduler.start();

        vi.advanceTimersByTime(60_000);
        await vi.advanceTimersByTimeAsync(0);

        const updated = triggerRepo.triggers.find((t) => t.id === trigger.id);
        expect(updated).toBeDefined();
        expect(updated?.last_fired_at).not.toBeNull();
    });

    it('does not create jobs when no cron triggers exist', async () => {
        await agentRepo.create('no-cron', [], 3);

        scheduler.start();
        vi.advanceTimersByTime(60_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(jobRepo.jobs.length).toBe(0);
    });
});
