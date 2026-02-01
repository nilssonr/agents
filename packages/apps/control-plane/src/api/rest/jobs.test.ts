import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';

import { createAgentService } from '../../features/agents/agent-service.js';
import { createFakeAgentRepository } from '../../features/agents/fake-agent-repository.js';
import { createFlowService } from '../../features/flows/flow-service.js';
import { createFakeJobRepository } from '../../features/jobs/fake-job-repository.js';
import { createJobService } from '../../features/jobs/job-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import { createFakeLogRepository } from '../../features/logs/fake-log-repository.js';
import { createLogService } from '../../features/logs/log-service.js';
import type { LogService } from '../../features/logs/log-service.js';

import { registerJobRoutes } from './jobs.js';

describe('Job routes', () => {
    let app: FastifyInstance;
    let logService: LogService;
    let jobService: JobService;
    let jobRepo: ReturnType<typeof createFakeJobRepository>;

    beforeEach(async () => {
        const agentRepo = createFakeAgentRepository();
        jobRepo = createFakeJobRepository();
        const agentService = createAgentService(agentRepo, jobRepo);
        jobService = createJobService(
            jobRepo,
            agentRepo,
            (agentId) => agentService.handleJobFailure(agentId),
            createFlowService(),
        );
        const logRepo = createFakeLogRepository();
        logService = createLogService(logRepo);
        app = Fastify();
        registerJobRoutes(app, { jobService, logService });
        await app.ready();
    });

    it('GET /jobs/:id returns a job', async () => {
        const agentRepo = createFakeAgentRepository();
        const agent = await agentRepo.create('test-agent', [], 3);
        // Seed a job directly in the fake repo
        jobRepo.jobs.push({
            id: 'job-1',
            agent_id: agent.id,
            status: 'failed',
            payload: null,
            result: null,
            error: 'something broke',
            current_step_id: 'step-0',
            context: {},
            step_retries: 0,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const response = await app.inject({ method: 'GET', url: '/jobs/job-1' });
        expect(response.statusCode).toBe(200);
        const body: { id: string; error: string } = response.json();
        expect(body.id).toBe('job-1');
        expect(body.error).toBe('something broke');
    });

    it('GET /jobs/:id returns 404 for unknown job', async () => {
        const response = await app.inject({ method: 'GET', url: '/jobs/unknown' });
        expect(response.statusCode).toBe(404);
    });

    it('GET /jobs/:id/logs returns logs for a job', async () => {
        await logService.appendLogs('job-1', [
            { level: 'info', message: 'started' },
            { level: 'error', message: 'failed', metadata: { code: 500 } },
        ]);

        const response = await app.inject({ method: 'GET', url: '/jobs/job-1/logs' });
        expect(response.statusCode).toBe(200);

        const body: Array<{ message: string; level: string }> = response.json();
        expect(body).toHaveLength(2);
        expect(body[0].message).toBe('started');
        expect(body[1].level).toBe('error');
    });

    it('GET /jobs/:id/logs returns empty array for job with no logs', async () => {
        const response = await app.inject({ method: 'GET', url: '/jobs/unknown/logs' });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });
});
