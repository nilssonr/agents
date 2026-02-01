import type { FastifyInstance } from 'fastify';
import { describe, expect, it, beforeEach } from 'vitest';

import { createAgentService } from '../../features/agents/agent-service.js';
import type { AgentService } from '../../features/agents/agent-service.js';
import { createFakeAgentRepository } from '../../features/agents/fake-agent-repository.js';
import { createFlowService } from '../../features/flows/flow-service.js';
import { createFakeJobRepository } from '../../features/jobs/fake-job-repository.js';
import { createJobService } from '../../features/jobs/job-service.js';
import type { JobService } from '../../features/jobs/job-service.js';
import { createFakeLogRepository } from '../../features/logs/fake-log-repository.js';
import { createLogService } from '../../features/logs/log-service.js';

import { buildRestServer } from './server.js';

describe('Webhook routes', () => {
    let app: FastifyInstance;
    let agentService: AgentService;

    beforeEach(async () => {
        const agentRepo = createFakeAgentRepository();
        const jobRepo = createFakeJobRepository();
        agentService = createAgentService(agentRepo, jobRepo);
        const jobService: JobService = createJobService(
            jobRepo,
            agentRepo,
            (agentId) => agentService.handleJobFailure(agentId),
            createFlowService(),
        );
        const logService = createLogService(createFakeLogRepository());
        app = await buildRestServer({ agentService, jobService, logService });
    });

    it('POST /webhooks/:agentId returns 202 and stores payload', async () => {
        const agent = await agentService.createAgent('webhook-agent', [], 3);
        const res = await app.inject({
            method: 'POST',
            url: `/webhooks/${agent.id}`,
            payload: { event: 'push', repo: 'test' },
        });
        expect(res.statusCode).toBe(202);
        const body: { payload: unknown } = res.json();
        expect(body.payload).toEqual({ event: 'push', repo: 'test' });
    });

    it('POST /webhooks/:agentId returns 404 for unknown agent', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/webhooks/nonexistent',
            payload: {},
        });
        expect(res.statusCode).toBe(404);
    });

    it('POST /webhooks/:agentId returns 409 when agent is paused', async () => {
        const agent = await agentService.createAgent('a', [], 1);
        await agentService.handleJobFailure(agent.id);
        const res = await app.inject({
            method: 'POST',
            url: `/webhooks/${agent.id}`,
            payload: {},
        });
        expect(res.statusCode).toBe(409);
    });
});
