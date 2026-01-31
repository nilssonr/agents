import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { createAgentService } from '../services/agent-service.js';
import { createFakeAgentRepository, createFakeJobRepository, createFakeTriggerRepository } from '../testing/fake-repositories.js';
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
        expect(jobRepo.jobs[0]!.agent_id).toBe(agent.id);
    });

    it('does not create jobs when no cron triggers exist', async () => {
        await agentRepo.create('no-cron', [], 3);

        scheduler.start();
        vi.advanceTimersByTime(60_000);
        await vi.advanceTimersByTimeAsync(0);

        expect(jobRepo.jobs).toHaveLength(0);
    });
});
